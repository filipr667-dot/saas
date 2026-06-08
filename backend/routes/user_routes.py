import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_db
from auth_utils import hash_password
from deps import get_current_user, require_role
from audit_utils import log_audit

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str
    password: str
    department: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None


VALID_ROLES = {"admin", "author", "reviewer", "approver", "readonly"}


@router.get("")
async def list_users(request: Request):
    admin = await require_role("admin")(request)
    db = get_db()
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(1000)
    return users


@router.post("")
async def create_user(request: Request, body: CreateUserRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "role": body.role,
        "department": body.department or "",
        "phone": body.phone or "",
        "position": body.position or "",
        "password_hash": hash_password(body.password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)

    await log_audit(db, admin, "USER_CREATED", user_id, body.name,
                    new_value={"email": email, "role": body.role}, request=request)
    return user_doc


@router.put("/{user_id}")
async def update_user(user_id: str, request: Request, body: UpdateUserRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        update["role"] = body.role
    if body.department is not None:
        update["department"] = body.department
    if body.is_active is not None:
        update["is_active"] = body.is_active
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if body.phone is not None:
        update["phone"] = body.phone
    if body.position is not None:
        update["position"] = body.position

    prev = {k: user.get(k) for k in update if k != "updated_at" and k != "password_hash"}
    await db.users.update_one({"id": user_id}, {"$set": update})
    await log_audit(db, admin, "USER_UPDATED", user_id, user["name"],
                    previous_value=prev, new_value={k: v for k, v in update.items() if k != "password_hash"},
                    request=request)
    return {"message": "User updated"}


@router.delete("/{user_id}")
async def deactivate_user(user_id: str, request: Request):
    admin = await require_role("admin")(request)
    db = get_db()

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    await log_audit(db, admin, "USER_DEACTIVATED", user_id, user["name"], request=request)
    return {"message": "User deactivated"}


@router.get("/reviewers-approvers")
async def get_reviewers_approvers(request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    users = await db.users.find(
        {"role": {"$in": ["reviewer", "approver", "admin"]}, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "department": 1}
    ).to_list(1000)
    return users
