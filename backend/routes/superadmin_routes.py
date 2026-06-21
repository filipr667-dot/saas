"""Super-admin routes — accessible only to role: super_admin.

Super admins can list all users and impersonate any non-super-admin user.
Impersonation issues a short-lived JWT with type="impersonate" and
an "impersonated_by" claim so audit logs can record the real actor.
"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request

from database import get_db
from deps import get_current_user, require_role
from auth_utils import get_jwt_secret
import jwt

router = APIRouter()

JWT_ALGORITHM = "HS256"


def _require_super(user: dict):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access only")


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
