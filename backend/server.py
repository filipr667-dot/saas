from dotenv import load_dotenv
load_dotenv()

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from database import init_db, close_db, get_db
from auth_utils import hash_password
from storage_utils import init_storage

from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.document_routes import router as doc_router
from routes.audit_routes import router as audit_router
from routes.settings_routes import router as settings_router
from routes.training_routes import router as training_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Document Control Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(doc_router, prefix="/documents", tags=["documents"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(training_router, prefix="/training", tags=["training"])

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
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "System Administrator",
            "role": "admin",
            "department": "Administration",
            "password_hash": hash_password(admin_password),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin user created: {admin_email}")
    else:
        from auth_utils import verify_password
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}}
            )
            logger.info("Admin password updated")


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
    await db.doc_sequences.create_index("prefix", unique=True)
    await db.training_rules.create_index("doc_type", unique=True)
    await db.training_records.create_index([("user_id", 1), ("status", 1)])
    await db.training_records.create_index("document_id")
    await db.training_records.create_index("id", unique=True)
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

            # Mark overdue
            await db.documents.update_many(
                {"status": {"$in": ["active", "review_due"]},
                 "next_review_date": {"$ne": "", "$lt": now}},
                {"$set": {"status": "review_overdue"}},
            )
            # Mark review_due (within 90 days)
            await db.documents.update_many(
                {"status": "active",
                 "next_review_date": {"$ne": "", "$lt": ninety_days}},
                {"$set": {"status": "review_due"}},
            )
        except Exception as e:
            logger.error(f"Review due check error: {e}")


async def write_test_credentials():
    """Write admin credentials to memory/test_credentials.md if the directory exists."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@doccontrol.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    content = f"""# Admin Credentials\n\nEmail: {admin_email}\nPassword: {admin_password}\n"""
    try:
        out = Path("./memory/test_credentials.md")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content)
    except Exception:
        pass


@app.on_event("startup")
async def startup():
    db = await init_db()
    await create_indexes(db)
    await seed_admin(db)
    await seed_doc_types(db)
    await write_test_credentials()
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init warning: {e}")
    asyncio.create_task(check_review_due_status())
    logger.info("Application started successfully")


@app.on_event("shutdown")
async def shutdown():
    await close_db()
