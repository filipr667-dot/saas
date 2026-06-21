import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import Response
import mimetypes
from storage_utils import put_object, get_object, delete_object
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, require_role, user_has_role
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
    document_rev: Optional[int] = 0
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
        "document_rev": body.document_rev if body.document_rev is not None else 0,
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


@router.post("/rules/{rule_id}/send")
async def send_rule_now(rule_id: str, request: Request):
    """Manually trigger training record creation for a rule — no approval needed."""
    import asyncio
    from email_service import send_email, build_training_email
    import os

    await require_role("admin")(request)
    db = get_db()

    rule = await db.training_rules.find_one({"id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    document = await db.documents.find_one({"id": rule["document_id"]}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    base_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    now = datetime.now(timezone.utc)
    due_date = (now + timedelta(days=30)).isoformat()
    now_iso = now.isoformat()
    created = 0

    for assigned in rule.get("assigned_users", []):
        user_id = assigned["user_id"]

        existing = await db.training_records.find_one({
            "document_id": document["id"],
            "user_id": user_id,
        })
        if existing:
            continue

        user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0})
        if not user:
            continue

        record = {
            "id": str(uuid.uuid4()),
            "document_id": document["id"],
            "document_number": document["doc_number"],
            "document_title": document["title"],
            "document_rev": document.get("rev_number", 0),
            "doc_type": document.get("doc_type", ""),
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "user_role": user.get("role", ""),
            "user_department": user.get("department", ""),
            "assigned_at": now_iso,
            "due_date": due_date,
            "completed_at": None,
            "signature": None,
            "status": "pending",
        }
        await db.training_records.insert_one(record)
        created += 1

        link = f"{base_url}/my-training"
        asyncio.create_task(send_email(
            user["email"],
            f"Training Required: {document['doc_number']} - {document['title']}",
            build_training_email(document["doc_number"], document["title"],
                                 document.get("doc_type", ""), user["name"], link),
        ))

    return {"message": f"Training sent to {created} user(s)", "created": created}


# ─────────────────────── training records ───────────────

@router.get("/records")
async def list_records(request: Request, status: Optional[str] = None, user_id: Optional[str] = None):
    current_user = await get_current_user(request)
    db = get_db()

    if user_has_role(current_user, "admin", "training_coordinator"):
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
    """Admin/coordinator view: all users with their training completion summary."""
    await require_role("admin", "training_coordinator")(request)
    db = get_db()

    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "department": 1, "phone": 1, "position": 1}
    ).to_list(1000)

    now_iso = datetime.now(timezone.utc).isoformat()
    result = []
    for u in users:
        pending = await db.training_records.count_documents({"user_id": u["id"], "status": "pending"})
        completed = await db.training_records.count_documents({"user_id": u["id"], "status": "completed"})
        overdue = await db.training_records.count_documents({
            "user_id": u["id"],
            "status": "pending",
            "due_date": {"$lt": now_iso},
        })
        result.append({
            **u,
            "pending_training": pending,
            "completed_training": completed,
            "overdue_training": overdue,
        })

    return result


@router.get("/stats")
async def get_training_stats(request: Request):
    """Summary counts for dashboard stats card."""
    await require_role("admin", "training_coordinator")(request)
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    overdue = await db.training_records.count_documents({"status": "pending", "due_date": {"$lt": now_iso}})
    return {"overdue": overdue}


@router.post("/records/{record_id}/signoff")
async def sign_off(record_id: str, request: Request, body: SignOffRequest):
    current_user = await get_current_user(request)
    db = get_db()

    record = await db.training_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")

    if record["user_id"] != current_user["id"] and not user_has_role(current_user, "admin", "training_coordinator"):
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


@router.get("/records/{record_id}/certificate")
async def download_certificate(record_id: str, request: Request):
    """Generate and return a PDF training certificate for a completed record."""
    from certificate_utils import generate_training_certificate

    current_user = await get_current_user(request)
    db = get_db()

    record = await db.training_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")

    # Only the user themselves or admin can download
    if record["user_id"] != current_user["id"] and not user_has_role(current_user, "admin", "training_coordinator"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if record.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Training not yet completed")

    pdf_bytes = generate_training_certificate(record)
    filename = f"training-certificate-{record.get('document_number', record_id)}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────── helper (called from doc routes) ─

async def reassign_previous_revision_training(db, new_doc: dict, parent_doc_id: str, base_url: str):
    """Re-assign training to users who completed training on the previous revision."""
    import asyncio
    from email_service import send_email, build_training_email

    completed_records = await db.training_records.find(
        {"document_id": parent_doc_id, "status": "completed"}
    ).to_list(1000)

    if not completed_records:
        return

    now = datetime.now(timezone.utc)
    due_date = (now + timedelta(days=30)).isoformat()
    now_iso = now.isoformat()

    for record in completed_records:
        # Don't duplicate if already assigned
        existing = await db.training_records.find_one({
            "document_id": new_doc["id"],
            "user_id": record["user_id"],
        })
        if existing:
            continue

        user = await db.users.find_one({"id": record["user_id"], "is_active": True}, {"_id": 0})
        if not user:
            continue

        new_record = {
            "id": str(uuid.uuid4()),
            "document_id": new_doc["id"],
            "document_number": new_doc["doc_number"],
            "document_title": new_doc["title"],
            "document_rev": new_doc.get("rev_number", 0),
            "doc_type": new_doc.get("doc_type", ""),
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "user_role": user.get("role", ""),
            "user_department": user.get("department", ""),
            "assigned_at": now_iso,
            "due_date": due_date,
            "completed_at": None,
            "signature": None,
            "status": "pending",
        }
        await db.training_records.insert_one(new_record)

        link = f"{base_url}/my-training"
        asyncio.create_task(send_email(
            user["email"],
            f"New Revision Training Required: {new_doc['doc_number']} Rev {new_doc.get('rev_number', 0)} - {new_doc['title']}",
            build_training_email(new_doc["doc_number"], new_doc["title"],
                                 new_doc.get("doc_type", ""), user["name"], link),
        ))


async def create_training_records(db, document: dict, base_url: str):
    """Create training records for specifically assigned users when a doc is approved."""
    import asyncio
    from email_service import send_email, build_training_email

    # Find all rules tied to this exact document
    rules = await db.training_rules.find({"document_id": document["id"]}).to_list(100)
    if not rules:
        return  # No training assigned to this document

    doc_type = document.get("doc_type", "")
    now = datetime.now(timezone.utc)
    due_date = (now + timedelta(days=30)).isoformat()
    now_iso = now.isoformat()

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
                "assigned_at": now_iso,
                "due_date": due_date,
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


# ─────────────────────── EHS / standalone training ──────────────────────────
#
# Free-text training records (Safe Pass, Working at Heights, etc.) that are
# not tied to a specific document in the system.
# Admin / training_coordinator manage them; users see their own on My Training.

class EHSTrainingRequest(BaseModel):
    name: str                           # e.g. "Safe Pass"
    user_id: str
    completed_date: Optional[str] = None   # ISO date string (YYYY-MM-DD)
    expiry_date: Optional[str] = None      # ISO date string (YYYY-MM-DD)
    notes: Optional[str] = None


class EHSTrainingUpdate(BaseModel):
    name: Optional[str] = None
    completed_date: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None


def _ehs_status(record: dict) -> str:
    """Compute EHS training status from dates."""
    expiry = record.get("expiry_date")
    completed = record.get("completed_date")
    if expiry:
        now = datetime.now(timezone.utc).date().isoformat()
        soon = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
        if expiry < now:
            return "overdue"
        if expiry <= soon:
            return "due"
    if completed:
        return "completed"
    return "pending"


@router.post("/ehs")
async def create_ehs_record(request: Request, body: EHSTrainingRequest):
    admin = await require_role("admin", "training_coordinator")(request)
    db = get_db()

    user = await db.users.find_one({"id": body.user_id, "is_active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "user_department": user.get("department", ""),
        "assigned_by": admin["name"],
        "assigned_at": now,
        "completed_date": body.completed_date or None,
        "expiry_date": body.expiry_date or None,
        "notes": body.notes or "",
    }
    await db.ehs_records.insert_one(record)
    record.pop("_id", None)
    record["status"] = _ehs_status(record)
    return record


@router.get("/ehs")
async def list_ehs_records(request: Request, user_id: Optional[str] = None):
    current_user = await get_current_user(request)
    db = get_db()

    if user_has_role(current_user, "admin", "training_coordinator"):
        query = {}
        if user_id:
            query["user_id"] = user_id
    else:
        query = {"user_id": current_user["id"]}

    records = await db.ehs_records.find(query, {"_id": 0}).sort("assigned_at", -1).to_list(1000)
    for r in records:
        r["status"] = _ehs_status(r)
        r["has_cert"] = bool(r.get("cert_file_path"))
        r.pop("cert_file_path", None)   # internal storage key — not exposed to frontend
    return records


@router.put("/ehs/{record_id}")
async def update_ehs_record(record_id: str, request: Request, body: EHSTrainingUpdate):
    await require_role("admin", "training_coordinator")(request)
    db = get_db()

    record = await db.ehs_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="EHS record not found")

    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.completed_date is not None:
        update["completed_date"] = body.completed_date or None
    if body.expiry_date is not None:
        update["expiry_date"] = body.expiry_date or None
    if body.notes is not None:
        update["notes"] = body.notes

    if update:
        await db.ehs_records.update_one({"id": record_id}, {"$set": update})

    updated = await db.ehs_records.find_one({"id": record_id}, {"_id": 0})
    updated["status"] = _ehs_status(updated)
    return updated


@router.delete("/ehs/{record_id}")
async def delete_ehs_record(record_id: str, request: Request):
    await require_role("admin", "training_coordinator")(request)
    db = get_db()
    record = await db.ehs_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="EHS record not found")
    # Clean up cert file if present
    if record.get("cert_file_path"):
        try:
            delete_object(record["cert_file_path"])
        except Exception:
            pass
    result = await db.ehs_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="EHS record not found")
    return {"message": "EHS record deleted"}


# ─────────────────────── EHS certificate upload ─────────────────────────

@router.post("/ehs/{record_id}/cert")
async def upload_ehs_cert(record_id: str, request: Request, file: UploadFile = File(...)):
    await require_role("admin", "training_coordinator")(request)
    db = get_db()

    record = await db.ehs_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="EHS record not found")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large — maximum 20 MB")

    # Sanitise extension and generate path
    original_name = file.filename or "certificate"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"
    allowed_exts = {"pdf", "png", "jpg", "jpeg", "webp"}
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload PDF or image.")

    storage_path = f"ehs_certs/{record_id}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    # Delete old cert if replacing
    if record.get("cert_file_path"):
        try:
            delete_object(record["cert_file_path"])
        except Exception:
            pass

    put_object(storage_path, data, content_type)

    await db.ehs_records.update_one(
        {"id": record_id},
        {"$set": {
            "cert_file_path": storage_path,
            "cert_file_name": original_name,
            "cert_uploaded_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {"message": "Certificate uploaded", "file_name": original_name}


@router.get("/ehs/{record_id}/cert")
async def get_ehs_cert(record_id: str, request: Request, download: bool = False):
    current_user = await get_current_user(request)
    db = get_db()

    record = await db.ehs_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="EHS record not found")

    if not user_has_role(current_user, "admin", "training_coordinator"):
        if record["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    if not record.get("cert_file_path"):
        raise HTTPException(status_code=404, detail="No certificate on this record")

    try:
        data, content_type = get_object(record["cert_file_path"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Certificate file not found in storage")

    filename = record.get("cert_file_name", "certificate")
    disposition = f'attachment; filename="{filename}"' if download else f'inline; filename="{filename}"'

    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": disposition},
    )


@router.delete("/ehs/{record_id}/cert")
async def remove_ehs_cert(record_id: str, request: Request):
    await require_role("admin", "training_coordinator")(request)
    db = get_db()

    record = await db.ehs_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="EHS record not found")

    if record.get("cert_file_path"):
        try:
            delete_object(record["cert_file_path"])
        except Exception:
            pass
        await db.ehs_records.update_one(
            {"id": record_id},
            {"$unset": {"cert_file_path": "", "cert_file_name": "", "cert_uploaded_at": ""}}
        )

    return {"message": "Certificate removed"}
