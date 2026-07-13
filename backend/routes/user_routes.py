import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_db
from auth_utils import hash_password, validate_password_strength
from deps import get_current_user, require_role, org_filter
from audit_utils import log_audit

router = APIRouter()

# System roles (one per user — controls access level)
SYSTEM_ROLES = {"admin", "training_coordinator", "readonly", "super_admin"}
# Document workflow roles (can hold multiple simultaneously)
DOC_ROLES = {"author", "reviewer", "approver"}
# All valid values that can appear in the role field
VALID_SYSTEM_ROLES = {"admin", "training_coordinator", "readonly"}
# All valid values for doc_roles items (training_coordinator is additive — combinable with any system role)
VALID_DOC_ROLES = {"author", "reviewer", "approver", "training_coordinator", "document_controller", "asset_coordinator"}
# Available modules (documents + training are always on)
VALID_MODULES = {"asset_management", "audit_trail"}


class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str                                   # system role
    doc_roles: Optional[List[str]] = []         # document workflow roles
    modules: Optional[List[str]] = []           # enabled feature modules
    password: str
    department: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    doc_roles: Optional[List[str]] = None
    modules: Optional[List[str]] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None


@router.get("")
async def list_users(request: Request):
    admin = await require_role("admin", "super_admin")(request)
    db = get_db()
    users = await db.users.find(
        {"role": {"$ne": "super_admin"}, **org_filter(admin)},
        {"password_hash": 0, "_id": 0}
    ).to_list(1000)
    return users


@router.post("")
async def create_user(request: Request, body: CreateUserRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    if body.role not in VALID_SYSTEM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_SYSTEM_ROLES))}")

    invalid_doc_roles = [r for r in (body.doc_roles or []) if r not in VALID_DOC_ROLES]
    if invalid_doc_roles:
        raise HTTPException(status_code=400, detail=f"Invalid doc roles: {invalid_doc_roles}")

    invalid_modules = [m for m in (body.modules or []) if m not in VALID_MODULES]
    if invalid_modules:
        raise HTTPException(status_code=400, detail=f"Invalid modules: {invalid_modules}")

    validate_password_strength(body.password)
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "org_id": admin.get("org_id", "default"),
        "email": email,
        "name": body.name,
        "role": body.role,
        "doc_roles": list(set(body.doc_roles or [])),
        "modules": list(set(body.modules or [])),
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
                    new_value={"email": email, "role": body.role, "doc_roles": user_doc["doc_roles"]},
                    request=request)
    return user_doc


@router.put("/{user_id}")
async def update_user(user_id: str, request: Request, body: UpdateUserRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    user = await db.users.find_one({"id": user_id, **org_filter(admin)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in VALID_SYSTEM_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        update["role"] = body.role
    if body.doc_roles is not None:
        invalid = [r for r in body.doc_roles if r not in VALID_DOC_ROLES]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid doc roles: {invalid}")
        update["doc_roles"] = list(set(body.doc_roles))
    if body.modules is not None:
        invalid = [m for m in body.modules if m not in VALID_MODULES]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid modules: {invalid}")
        update["modules"] = list(set(body.modules))
    if body.department is not None:
        update["department"] = body.department
    if body.is_active is not None:
        update["is_active"] = body.is_active
    if body.password:
        validate_password_strength(body.password)
        update["password_hash"] = hash_password(body.password)
    if body.phone is not None:
        update["phone"] = body.phone
    if body.position is not None:
        update["position"] = body.position

    prev = {k: user.get(k) for k in update if k not in ("updated_at", "password_hash")}
    await db.users.update_one({"id": user_id}, {"$set": update})
    await log_audit(db, admin, "USER_UPDATED", user_id, user["name"],
                    previous_value=prev,
                    new_value={k: v for k, v in update.items() if k != "password_hash"},
                    request=request)
    return {"message": "User updated"}


@router.delete("/{user_id}")
async def deactivate_user(user_id: str, request: Request):
    admin = await require_role("admin")(request)
    db = get_db()

    user = await db.users.find_one({"id": user_id, **org_filter(admin)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    await log_audit(db, admin, "USER_DEACTIVATED", user_id, user["name"], request=request)
    return {"message": "User deactivated"}


@router.get("/reviewers-approvers")
async def get_reviewers_approvers(request: Request):
    """Users who can be assigned as reviewer or approver on a document."""
    current_user = await get_current_user(request)
    db = get_db()
    # Include admin + users who have reviewer or approver in their doc_roles
    users = await db.users.find(
        {"is_active": True, "$or": [
            {"role": "admin"},
            {"doc_roles": {"$in": ["reviewer", "approver"]}},
        ], **org_filter(current_user)},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "doc_roles": 1, "department": 1}
    ).to_list(1000)
    return users
