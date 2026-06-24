from dotenv import load_dotenv
load_dotenv()

import asyncio
import logging
import os
import uuid
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from database import init_db, close_db, get_db
from auth_utils import hash_password
from storage_utils import init_storage

from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.document_routes import router as doc_router
from routes.audit_routes import router as audit_router
from routes.settings_routes import router as settings_router
from routes.training_routes import router as training_router
from routes.asset_routes import router as asset_router
from routes.superadmin_routes import router as superadmin_router
from routes.microsoft_auth import router as microsoft_auth_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Lapis IMS — Integrated Management System")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

_BASELINE_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://lapisims.com",
    "https://www.lapisims.com",
    "https://saas-1-qvzn.onrender.com",
]
_raw_origins = os.environ.get("FRONTEND_URL", "")
_env_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_allowed_origins = sorted(set(_BASELINE_ORIGINS) | set(_env_origins))
_origin_regex = r"https?://([a-z0-9-]+\.)*lapisims\.com"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"CORS allowed origins: {_allowed_origins} (+ regex {_origin_regex})")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(doc_router, prefix="/documents", tags=["documents"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(training_router, prefix="/training", tags=["training"])
api_router.include_router(asset_router, prefix="/assets", tags=["assets"])
api_router.include_router(superadmin_router, prefix="/superadmin", tags=["superadmin"])
api_router.include_router(microsoft_auth_router, prefix="/auth", tags=["auth"])

@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)


DEFAULT_DOC_TYPES = [
    {"name": "Policy", "prefix": "POL", "review_period_months": 36},
    {"name": "Procedure", "prefix": "PROC", "review_period_months": 12},
    {"name": "Work Instruction", "prefix": "WI", "review_period_months": 36},
    {"name": "Form", "prefix": "FORM", "review_period_months": 36},
    {"name": "Register", "prefix": "REG", "review_period_months": 12},
    {"name": "Manual", "prefix": "MAN", "review_period_months": 12},
]


async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@doccontrol.com").lower()
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        admin_password = os.environ.get("ADMIN_PASSWORD")
        if not admin_password:
            admin_password = secrets.token_urlsafe(12)
            logger.warning(
                f"No ADMIN_PASSWORD set — generated temporary admin password for "
                f"{admin_email}: {admin_password}  (change it after first login)"
            )
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "System Administrator",
            "role": "admin",
            "doc_roles": [],
            "modules": ["asset_management", "audit_trail"],
            "department": "Administration",
            "password_hash": hash_password(admin_password),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
        logger.info(f"Admin user created: {admin_email}")


async def seed_super_admin(db):
    sa_email = os.environ.get("SUPER_ADMIN_EMAIL", "").lower().strip()
    sa_password = os.environ.get("SUPER_ADMIN_PASSWORD", "").strip()
    if not sa_email or not sa_password:
        return  # super admin is optional — only created when env vars are set

    existing = await db.users.find_one({"email": sa_email})
    if existing is None:
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": sa_email,
            "name": "Super Admin",
            "role": "super_admin",
            "doc_roles": [],
            "modules": ["asset_management", "audit_trail"],
            "department": "Lapis IMS",
            "password_hash": hash_password(sa_password),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
        logger.info(f"Super admin created: {sa_email}")
    else:
        # Keep super admin role in sync in case they had a different role
        if existing.get("role") != "super_admin":
            await db.users.update_one(
                {"email": sa_email},
                {"$set": {"role": "super_admin"}}
            )


async def migrate_roles(db):
    """Idempotent startup migration:
    - author/reviewer/approver in role field → role=readonly + doc_roles
    - training_coordinator in role field → role=readonly + doc_roles (now an additive permission)
    - backfills doc_roles/modules on older records
    """
    old_doc_roles = {"author", "reviewer", "approver", "training_coordinator"}

    async for user in db.users.find({"role": {"$in": list(old_doc_roles)}}):
        new_doc_roles = list({user["role"]} | set(user.get("doc_roles", [])))
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "role": "readonly",
                "doc_roles": new_doc_roles,
            }}
        )
        logger.info(f"Migrated role for {user.get('email')}: {user['role']} → readonly + doc_roles={new_doc_roles}")

    # Backfill missing fields on users that predate this schema
    await db.users.update_many(
        {"doc_roles": {"$exists": False}},
        {"$set": {"doc_roles": []}}
    )
    await db.users.update_many(
        {"modules": {"$exists": False}},
        {"$set": {"modules": []}}
    )
    # Admin gets all modules by default
    await db.users.update_many(
        {"role": "admin", "modules": []},
        {"$set": {"modules": ["asset_management", "audit_trail"]}}
    )


async def seed_doc_types(db):
    for dt in DEFAULT_DOC_TYPES:
        existing = await db.doc_types.find_one({"prefix": dt["prefix"]})
        if not existing:
            await db.doc_types.insert_one({
                "id": str(uuid.uuid4()),
                "name": dt["name"],
                "prefix": dt["prefix"],
                "review_period_months": dt["review_period_months"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    logger.info("Document types seeded")


async def create_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index("doc_number")
    await db.documents.create_index("status")
    await db.documents.create_index("author_id")
    await db.audit_logs.create_index([("timestamp", -1)])
    await db.audit_logs.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_resets.create_index("token_hash")
    await db.password_resets.create_index("user_id")
    await db.doc_sequences.create_index("prefix", unique=True)
    try:
        await db.training_rules.drop_index("doc_type_1")
    except Exception:
        pass
    await db.training_rules.create_index("document_id")
    await db.training_rules.create_index("doc_type")
    await db.training_records.create_index([("user_id", 1), ("status", 1)])
    await db.training_records.create_index("document_id")
    await db.training_records.create_index("id", unique=True)
    await db.assets.create_index("id", unique=True)
    await db.assets.create_index("asset_id")
    await db.assets.create_index("calibration_due_date")
    await db.pm_activities.create_index("id", unique=True)
    await db.pm_activities.create_index("asset_id")
    await db.pm_activities.create_index("next_check_date")
    await db.ehs_records.create_index("id", unique=True)
    await db.ehs_records.create_index("user_id")
    await db.ehs_records.create_index("expiry_date")
    logger.info("Indexes created")


async def check_review_due_status():
    """Background task: update review due/overdue statuses hourly"""
    while True:
        try:
            await asyncio.sleep(3600)
            db = get_db()
            if db is None:
                continue
            now = datetime.now(timezone.utc).isoformat()
            ninety_days = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

            await db.documents.update_many(
                {"status": {"$in": ["active", "review_due"]},
                 "next_review_date": {"$ne": "", "$lt": now}},
                {"$set": {"status": "review_overdue"}},
            )
            await db.documents.update_many(
                {"status": "active",
                 "next_review_date": {"$ne": "", "$lt": ninety_days}},
                {"$set": {"status": "review_due"}},
            )
        except Exception as e:
            logger.error(f"Review due check error: {e}")


@app.on_event("startup")
async def startup():
    db = await init_db()
    await create_indexes(db)
    await migrate_roles(db)
    await seed_admin(db)
    await seed_super_admin(db)
    await seed_doc_types(db)
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init warning: {e}")
    asyncio.create_task(check_review_due_status())
    logger.info("Application started successfully")


@app.on_event("shutdown")
async def shutdown():
    await close_db()
