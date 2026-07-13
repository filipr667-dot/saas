"""Super-admin routes — accessible only to role: super_admin.

Super admins can list all users and impersonate any non-super-admin user.
Impersonation issues a short-lived JWT with type="impersonate" and
an "impersonated_by" claim so audit logs can record the real actor.
"""
import os
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, require_role
from auth_utils import get_jwt_secret, hash_password, validate_password_strength
import jwt

router = APIRouter()

JWT_ALGORITHM = "HS256"


def _require_super(user: dict):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access only")


# ─────────────────────── users ──────────────────────────

@router.get("/users")
async def superadmin_list_users(request: Request):
    user = await get_current_user(request)
    _require_super(user)
    db = get_db()
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(5000)
    return users


@router.post("/impersonate/{target_user_id}")
async def impersonate_user(target_user_id: str, request: Request):
    actor = await get_current_user(request)
    _require_super(actor)

    db = get_db()
    target = await db.users.find_one({"id": target_user_id}, {"password_hash": 0, "_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot impersonate another super admin")

    payload = {
        "sub": target["id"],
        "email": target["email"],
        "role": target.get("role", "readonly"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=4),
        "type": "impersonate",
        "impersonated_by": actor["id"],
        "impersonated_by_name": actor["name"],
    }
    token = jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return {
        "access_token": token,
        "target_user": target,
        "impersonated_by": actor["name"],
    }


@router.delete("/impersonate")
async def stop_impersonation(request: Request):
    """No-op endpoint — client simply restores the saved super-admin token."""
    user = await get_current_user(request)
    return {"message": "Impersonation stopped", "user_id": user["id"]}


# ─────────────────────── organisations ──────────────────

class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    plan: Optional[str] = "trial"
    admin_email: str
    admin_name: str
    admin_password: str


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/orgs")
async def list_orgs(request: Request):
    user = await get_current_user(request)
    _require_super(user)
    db = get_db()
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    # Annotate each org with user count
    for org in orgs:
        org["user_count"] = await db.users.count_documents({"org_id": org["id"]})
    return orgs


@router.post("/orgs")
async def create_org(request: Request, body: CreateOrgRequest):
    actor = await get_current_user(request)
    _require_super(actor)
    db = get_db()

    slug = body.slug.lower().strip().replace(" ", "-")
    if await db.organizations.find_one({"slug": slug}):
        raise HTTPException(status_code=409, detail="Organisation slug already in use")

    validate_password_strength(body.admin_password)

    admin_email = body.admin_email.lower().strip()
    if await db.users.find_one({"email": admin_email}):
        raise HTTPException(status_code=409, detail="Admin email already in use")

    now = datetime.now(timezone.utc).isoformat()
    org_id = str(uuid.uuid4())

    await db.organizations.insert_one({
        "id": org_id,
        "name": body.name.strip(),
        "slug": slug,
        "plan": body.plan or "trial",
        "is_active": True,
        "created_at": now,
        "created_by": actor["email"],
    })

    admin_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": admin_id,
        "org_id": org_id,
        "email": admin_email,
        "name": body.admin_name.strip(),
        "role": "admin",
        "doc_roles": [],
        "modules": ["asset_management", "audit_trail"],
        "department": "Administration",
        "password_hash": hash_password(body.admin_password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    })

    # Seed default doc types for the new org
    import uuid as _uuid
    from datetime import datetime as _dt, timezone as _tz
    _DEFAULT_DOC_TYPES = [
        {"name": "Policy", "prefix": "POL", "review_period_months": 36},
        {"name": "Procedure", "prefix": "PROC", "review_period_months": 12},
        {"name": "Work Instruction", "prefix": "WI", "review_period_months": 36},
        {"name": "Form", "prefix": "FORM", "review_period_months": 36},
        {"name": "Register", "prefix": "REG", "review_period_months": 12},
        {"name": "Manual", "prefix": "MAN", "review_period_months": 12},
    ]
    for dt in _DEFAULT_DOC_TYPES:
        if not await db.doc_types.find_one({"prefix": dt["prefix"], "org_id": org_id}):
            await db.doc_types.insert_one({
                "id": str(_uuid.uuid4()),
                "org_id": org_id,
                "name": dt["name"],
                "prefix": dt["prefix"],
                "review_period_months": dt["review_period_months"],
                "is_active": True,
                "created_at": _dt.now(_tz.utc).isoformat(),
            })

    return {
        "org_id": org_id,
        "name": body.name,
        "slug": slug,
        "admin_email": admin_email,
        "message": "Organisation and admin user created",
    }


@router.put("/orgs/{org_id}")
async def update_org(org_id: str, request: Request, body: UpdateOrgRequest):
    actor = await get_current_user(request)
    _require_super(actor)
    db = get_db()

    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.plan is not None:
        update["plan"] = body.plan
    if body.is_active is not None:
        update["is_active"] = body.is_active

    if update:
        await db.organizations.update_one({"id": org_id}, {"$set": update})

    return {"message": "Organisation updated"}
