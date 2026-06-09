import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, require_role
from auth_utils import verify_password
from audit_utils import log_audit

router = APIRouter()


# ─────────────────────── models ─────────────────────────

class AssignedUser(BaseModel):
    user_id: str
    user_name: str
    user_email: str


class TrainingRuleRequest(BaseModel):
    document_id: str
    document_number: str
    document_title: str
    doc_type: str
    assigned_user_ids: List[str]   # list of user IDs to assign


class SignOffRequest(BaseModel):
    password: str
    comments: Optional[str] = None


# ─────────────────────── training rules (admin) ─────────

@router.get("/rules")
async def list_rules(request: Request):
    await require_role("admin")(request)
    db = get_db()
    rules = await db.training_rules.find({}, {"_id": 0}).to_list(500)
    return rules


@router.post("/rules")
async def create_rule(request: Request, body: TrainingRuleRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    if not body.assigned_user_ids:
        raise HTTPException(status_code=400, detail="At least one user must be assigned")

    # Resolve user details
    users = await db.users.find(
        {"id": {"$in": body.assigned_user_ids}, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(1000)

    if not users:
        raise HTTPException(status_code=400, detail="No valid users found")

    assigned_users = [{"user_id": u["id"], "user_name": u["name"], "user_email": u["email"]} for u in users]

    rule = {
        "id": str(uuid.uuid4()),
        "document_id": body.document_id,
        "document_number": body.document_number,
        "document_title": body.document_title,
        "doc_type": body.doc_type,
        "assigned_users": assigned_users,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["name"],
    }
    await db.training_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, request: Request):
    await require_role("admin")(request)
    db = get_db()
    result = await db.training_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}


# ─────────────────────── training records ───────────────

@router.get("/records")
async def list_records(request: Request, status: Optional[str] = None, user_id: Optional[str] = None):
    current_user = await get_current_user(request)
    db = get_db()

    if current_user["role"] == "admin":
        query = {}
        if user_id:
            query["user_id"] = user_id
    else:
        query = {"user_id": current_user["id"]}

    if status:
        query["status"] = status

    records = await db.training_records.find(query, {"_id": 0}).sort("assigned_at", -1).to_list(1000)
    return records


@router.get("/matrix")
async def get_matrix(request: Request):
    """Admin view: all users with their training completion summary."""
    await require_role("admin")(request)
    db = get_db()

    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "department": 1, "phone": 1, "position": 1}
    ).to_list(1000)

    result = []
    for u in users:
        pending = await db.training_records.count_documents({"user_id": u["id"], "status": "pending"})
        completed = await db.training_records.count_documents({"user_id": u["id"], "status": "completed"})
        result.append({**u, "pending_training": pending, "completed_training": completed})

    return result


@router.post("/records/{record_id}/signoff")
async def sign_off(record_id: str, request: Request, body: SignOffRequest):
    current_user = await get_current_user(request)
    db = get_db()

    record = await db.training_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")

    if record["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    if record["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already signed off")

    # Verify password (electronic signature)
    full_user = await db.users.find_one({"id": current_user["id"]})
    if not verify_password(body.password, full_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password for electronic signature")

    now = datetime.now(timezone.utc).isoformat()
    signature = {
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "timestamp": now,
        "ip_address": request.client.host if request.client else "unknown",
        "comments": body.comments or "",
    }

    await db.training_records.update_one({"id": record_id}, {"$set": {
        "status": "completed",
        "completed_at": now,
        "signature": signature,
    }})

    await log_audit(db, current_user, "TRAINING_SIGNED_OFF", record_id,
                    record.get("document_number", ""),
                    new_value={"document": record.get("document_title"), "comments": body.comments},
                    request=request)

    return {"message": "Training signed off successfully"}


# ─────────────────────── helper (called from doc routes) ─

async def create_training_records(db, document: dict, base_url: str):
    """Create training records for specifically assigned users when a doc is approved."""
    import asyncio
    from email_service import send_email, build_training_email

    # Find all rules tied to this exact document
    rules = await db.training_rules.find({"document_id": document["id"]}).to_list(100)
    if not rules:
        return  # No training assigned to this document

    doc_type = document.get("doc_type", "")
    now = datetime.now(timezone.utc).isoformat()

    for rule in rules:
        for assigned in rule.get("assigned_users", []):
            user_id = assigned["user_id"]

            # Skip if record already exists for this doc + user
            existing = await db.training_records.find_one({
                "document_id": document["id"],
                "user_id": user_id,
            })
            if existing:
                continue

            # Get latest user details
            user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0})
            if not user:
                continue

            record = {
                "id": str(uuid.uuid4()),
                "document_id": document["id"],
                "document_number": document["doc_number"],
                "document_title": document["title"],
                "document_rev": document.get("rev_number", 0),
                "doc_type": doc_type,
                "user_id": user["id"],
                "user_name": user["name"],
                "user_email": user["email"],
                "user_role": user.get("role", ""),
                "user_department": user.get("department", ""),
                "assigned_at": now,
                "completed_at": None,
                "signature": None,
                "status": "pending",
            }
            await db.training_records.insert_one(record)

            link = f"{base_url}/my-training"
            asyncio.create_task(send_email(
                user["email"],
                f"Training Required: {document['doc_number']} - {document['title']}",
                build_training_email(document["doc_number"], document["title"], doc_type, user["name"], link),
            ))
