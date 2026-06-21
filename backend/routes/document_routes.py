import re
import uuid
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import Response
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, user_has_role
from auth_utils import verify_password
from audit_utils import log_audit
from storage_utils import put_object, get_object, generate_storage_path
from email_service import send_email, build_doc_email
from routes.training_routes import create_training_records

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx"}
ALLOWED_ROLES_EDIT = {"admin", "author"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ─────────────────────── helpers ────────────────────────

async def get_next_doc_number(db, prefix: str) -> str:
    result = await db.doc_sequences.find_one_and_update(
        {"prefix": prefix},
        {"$inc": {"last_number": 1}},
        upsert=True,
        return_document=True,
    )
    number = result["last_number"]
    return f"{prefix}-{str(number).zfill(3)}"


def clean_doc(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def base_url():
    import os
    raw = os.environ.get("FRONTEND_URL", "")
    first = raw.split(",")[0].strip() if raw else ""
    return first or "https://lapisims.com"


def can_access_doc(user: dict, doc: dict) -> bool:
    """Single-document access control — prevents IDOR by matching list-endpoint logic."""
    uid = user.get("id")
    if user.get("role") == "admin":
        return True
    # Published docs are visible to all authenticated users
    if doc.get("status") in ["active", "review_due", "review_overdue", "obsolete"]:
        return True
    # Workflow docs: author, assigned reviewer, or assigned approver
    if doc.get("author_id") == uid:
        return True
    if uid in (doc.get("reviewer_ids") or []):
        return True
    if doc.get("approver_id") == uid:
        return True
    return False


# ─────────────────────── models ─────────────────────────

class CreateDocRequest(BaseModel):
    doc_type_id: str
    title: str
    description: Optional[str] = None
    rev_number: Optional[int] = None  # manual override — defaults to 0


class ReviseDocRequest(BaseModel):
    rev_number: Optional[int] = None  # manual override — defaults to parent + 1


class UpdateDocRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class SubmitReviewRequest(BaseModel):
    reviewer_ids: List[str]
    approver_id: str


class ReviewActionRequest(BaseModel):
    action: str  # "approve" | "reject"
    comments: Optional[str] = None
    password: str


class ApproveActionRequest(BaseModel):
    action: str  # "approve" | "reject"
    comments: Optional[str] = None
    password: str


# ─────────────────────── list + create ──────────────────

@router.get("")
async def list_documents(
    request: Request,
    status: Optional[str] = None,
    doc_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    current_user = await get_current_user(request)
    db = get_db()
    role = current_user.get("role", "")
    doc_roles = current_user.get("doc_roles", [])
    uid = current_user["id"]

    query = {}

    if role != "admin":
        # Base: all published docs are visible to everyone
        or_clauses = [{"status": {"$in": ["active", "review_due", "review_overdue", "obsolete"]}}]
        # Own authored docs (any status)
        or_clauses.append({"author_id": uid})
        # Docs assigned for review
        if "reviewer" in doc_roles:
            or_clauses.append({"reviewer_ids": uid})
        # Docs assigned for approval
        if "approver" in doc_roles:
            or_clauses.append({"approver_id": uid})
        query["$or"] = or_clauses

    if status and status != "all":
        if isinstance(query.get("status"), dict):
            pass  # readonly already has status filter
        else:
            query["status"] = status

    if doc_type and doc_type != "all":
        query["doc_type"] = doc_type

    if search:
        # Escape user input so it is treated as a literal string, not a regex.
        # Prevents ReDoS and malformed-pattern errors from special characters.
        safe = re.escape(search.strip())[:100]
        search_filter = {"$or": [
            {"doc_number": {"$regex": safe, "$options": "i"}},
            {"title": {"$regex": safe, "$options": "i"}},
            {"author_name": {"$regex": safe, "$options": "i"}},
            {"description": {"$regex": safe, "$options": "i"}},
        ]}
        if "$or" in query:
            query = {"$and": [{"$or": query["$or"]}, search_filter]}
        else:
            query.update(search_filter)

    total = await db.documents.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {"items": docs, "total": total, "page": page, "limit": limit}


@router.post("")
async def create_document(request: Request, body: CreateDocRequest):
    current_user = await get_current_user(request)
    if not user_has_role(current_user, "admin", "author"):
        raise HTTPException(status_code=403, detail="Only Authors and Admins can create documents")

    db = get_db()
    doc_type = await db.doc_types.find_one({"id": body.doc_type_id, "is_active": True})
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")

    doc_number = await get_next_doc_number(db, doc_type["prefix"])
    now = datetime.now(timezone.utc).isoformat()
    doc_id = str(uuid.uuid4())

    doc = {
        "id": doc_id,
        "doc_number": doc_number,
        "doc_type": doc_type["name"],
        "doc_type_id": doc_type["id"],
        "prefix": doc_type["prefix"],
        "title": body.title,
        "description": body.description or "",
        "rev_number": body.rev_number if body.rev_number is not None else 0,
        "status": "draft",
        "author_id": current_user["id"],
        "author_name": current_user["name"],
        "author_email": current_user["email"],
        "reviewer_ids": [],
        "review_actions": [],
        "approver_id": "",
        "approver_name": "",
        "approver_email": "",
        "file_path": "",
        "file_name": "",
        "file_size": 0,
        "file_content_type": "",
        "approval_comments": "",
        "review_period_months": doc_type["review_period_months"],
        "parent_doc_id": "",
        "is_latest_revision": True,
        "created_at": now,
        "submitted_at": "",
        "approved_at": "",
        "effective_date": "",
        "next_review_date": "",
        "obsolete_date": "",
    }

    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(db, current_user, "DOCUMENT_CREATED", doc_id, doc_number,
                    new_value={"title": body.title, "doc_type": doc_type["name"]}, request=request)
    return doc


# ─────────────────────── single doc ─────────────────────

@router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    role = current_user.get("role", "")
    doc_roles = current_user.get("doc_roles", [])
    uid = current_user["id"]

    if role == "admin":
        total = await db.documents.count_documents({})
        active = await db.documents.count_documents({"status": {"$in": ["active", "review_due", "review_overdue"]}})
        draft = await db.documents.count_documents({"status": "draft"})
        under_review = await db.documents.count_documents({"status": "under_review"})
        pending_approval = await db.documents.count_documents({"status": "pending_approval"})
        obsolete = await db.documents.count_documents({"status": "obsolete"})
        review_due = await db.documents.count_documents({"status": "review_due"})
        overdue = await db.documents.count_documents({"status": "review_overdue"})
        rejected = await db.documents.count_documents({"status": "rejected"})
        recent_audit = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)

        # Upcoming reviews — active docs with next_review_date within 30 days
        thirty_days_iso = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        upcoming_query = {
            "status": {"$in": ["active", "review_due", "review_overdue"]},
            "next_review_date": {"$ne": "", "$lte": thirty_days_iso},
        }
        upcoming_reviews_count = await db.documents.count_documents(upcoming_query)
        upcoming_review_docs = await db.documents.find(
            upcoming_query,
            {"_id": 0, "id": 1, "doc_number": 1, "title": 1, "doc_type": 1,
             "next_review_date": 1, "status": 1, "author_name": 1, "rev_number": 1}
        ).sort("next_review_date", 1).limit(10).to_list(10)

        # Chart data: docs by type
        pipeline = [{"$group": {"_id": "$doc_type", "count": {"$sum": 1}}}]
        by_type = await db.documents.aggregate(pipeline).to_list(20)
        return {
            "total": total, "active": active, "draft": draft, "under_review": under_review,
            "pending_approval": pending_approval, "obsolete": obsolete, "review_due": review_due,
            "overdue": overdue, "rejected": rejected,
            "upcoming_reviews": upcoming_reviews_count,
            "upcoming_review_docs": upcoming_review_docs,
            "recent_audit": recent_audit,
            "by_type": [{"name": x["_id"], "count": x["count"]} for x in by_type if x["_id"]],
        }
    elif "author" in doc_roles:
        my_draft = await db.documents.count_documents({"author_id": uid, "status": {"$in": ["draft", "rejected"]}})
        my_active = await db.documents.count_documents({"author_id": uid, "status": {"$in": ["active", "review_due", "review_overdue"]}})
        my_review_due = await db.documents.count_documents({"author_id": uid, "status": {"$in": ["review_due", "review_overdue"]}})
        pending_review = await db.documents.count_documents({"author_id": uid, "status": "under_review"})
        return {"my_draft": my_draft, "my_active": my_active, "my_review_due": my_review_due, "pending_review": pending_review}
    elif "reviewer" in doc_roles:
        pending = await db.documents.count_documents({
            "status": "under_review",
            "review_actions": {"$elemMatch": {"reviewer_id": uid, "status": "pending"}}
        })
        completed = await db.documents.count_documents({
            "review_actions": {"$elemMatch": {"reviewer_id": uid, "status": {"$ne": "pending"}}}
        })
        return {"pending_reviews": pending, "completed_reviews": completed}
    elif "approver" in doc_roles:
        pending = await db.documents.count_documents({"status": "pending_approval", "approver_id": uid})
        approved = await db.documents.count_documents({"approved_at": {"$ne": ""}, "approver_id": uid})
        return {"pending_approvals": pending, "total_approved": approved}
    else:
        active = await db.documents.count_documents({"status": {"$in": ["active", "review_due", "review_overdue"]}})
        return {"total_active": active}


@router.get("/{doc_id}")
async def get_document(doc_id: str, request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not can_access_doc(current_user, doc):
        raise HTTPException(status_code=403, detail="Access denied")

    await log_audit(db, current_user, "DOCUMENT_VIEWED", doc_id, doc.get("doc_number", ""), request=request)
    return doc


@router.put("/{doc_id}")
async def update_document(doc_id: str, request: Request, body: UpdateDocRequest):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Can only edit draft or rejected documents")

    if doc["author_id"] != current_user["id"] and not user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to edit this document")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.title:
        update["title"] = body.title
    if body.description is not None:
        update["description"] = body.description

    prev = {"title": doc.get("title"), "description": doc.get("description")}
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    await log_audit(db, current_user, "DOCUMENT_UPDATED", doc_id, doc["doc_number"],
                    previous_value=prev, new_value=update, request=request)
    return {"message": "Document updated"}


# ─────────────────────── file upload/download ───────────

@router.post("/{doc_id}/upload")
async def upload_file(doc_id: str, request: Request, file: UploadFile = File(...)):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Can only upload to draft or rejected documents")
    if doc["author_id"] != current_user["id"] and not user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted formats: {', '.join(sorted(ALLOWED_EXTENSIONS)).upper()}")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB")

    file_hash = hashlib.sha256(data).hexdigest()
    storage_path = generate_storage_path(file.filename)
    content_type = file.content_type or "application/octet-stream"
    result = put_object(storage_path, data, content_type)

    await db.documents.update_one({"id": doc_id}, {"$set": {
        "file_path": result["path"],
        "file_name": file.filename,
        "file_size": len(data),
        "file_content_type": content_type,
        "file_hash": file_hash,
    }})

    await log_audit(db, current_user, "DOCUMENT_UPLOADED", doc_id, doc["doc_number"],
                    new_value={"file_name": file.filename, "size": len(data), "hash": file_hash}, request=request)
    return {"message": "File uploaded", "file_name": file.filename, "file_path": result["path"]}


@router.get("/{doc_id}/file")
async def download_file(doc_id: str, request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.get("file_path"):
        raise HTTPException(status_code=404, detail="No file attached")

    if not can_access_doc(current_user, doc):
        raise HTTPException(status_code=403, detail="Access denied")

    data, content_type = get_object(doc["file_path"])
    await log_audit(db, current_user, "DOCUMENT_DOWNLOADED", doc_id, doc["doc_number"], request=request)

    filename = doc.get("file_name", "document")
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────── workflow ───────────────────────

@router.post("/{doc_id}/submit")
async def submit_for_review(doc_id: str, request: Request, body: SubmitReviewRequest):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Document must be in draft or rejected state")
    if doc["author_id"] != current_user["id"] and not user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not doc.get("file_path"):
        raise HTTPException(status_code=400, detail="Please upload a file before submitting for review")
    if not body.reviewer_ids:
        raise HTTPException(status_code=400, detail="At least one reviewer is required")

    # Build review actions
    review_actions = []
    reviewer_emails = []
    for r_id in body.reviewer_ids:
        reviewer = await db.users.find_one({"id": r_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        if not reviewer:
            raise HTTPException(status_code=404, detail=f"Reviewer {r_id} not found")
        review_actions.append({
            "reviewer_id": reviewer["id"],
            "reviewer_name": reviewer["name"],
            "reviewer_email": reviewer["email"],
            "status": "pending",
            "comments": None,
            "reviewed_at": None,
        })
        reviewer_emails.append(reviewer["email"])

    # Get approver info
    approver = await db.users.find_one({"id": body.approver_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})
    if not approver:
        raise HTTPException(status_code=404, detail="Approver not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.documents.update_one({"id": doc_id}, {"$set": {
        "status": "under_review",
        "reviewer_ids": body.reviewer_ids,
        "review_actions": review_actions,
        "approver_id": approver["id"],
        "approver_name": approver["name"],
        "approver_email": approver["email"],
        "submitted_at": now,
    }})

    await log_audit(db, current_user, "SUBMITTED_FOR_REVIEW", doc_id, doc["doc_number"],
                    new_value={"reviewers": [ra["reviewer_name"] for ra in review_actions],
                               "approver": approver["name"]}, request=request)

    link = f"{base_url()}/documents/{doc_id}"
    for email in reviewer_emails:
        asyncio.create_task(send_email(
            email,
            f"Review Required: {doc['doc_number']} - {doc['title']}",
            build_doc_email(doc["doc_number"], doc["title"], "Under Review", "Please review this document", link),
        ))

    return {"message": "Document submitted for review"}


@router.post("/{doc_id}/review")
async def review_action(doc_id: str, request: Request, body: ReviewActionRequest):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] != "under_review":
        raise HTTPException(status_code=400, detail="Document is not under review")

    uid = current_user["id"]
    # Self-conflict: authors cannot review their own documents
    if doc.get("author_id") == uid:
        raise HTTPException(status_code=403, detail="You cannot review a document you authored")
    reviewer_entry = next((ra for ra in doc.get("review_actions", []) if ra["reviewer_id"] == uid), None)
    if not reviewer_entry:
        raise HTTPException(status_code=403, detail="You are not assigned as a reviewer for this document")
    if reviewer_entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="You have already reviewed this document")

    # Verify password for electronic signature
    full_user = await db.users.find_one({"id": uid})
    if not verify_password(body.password, full_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password for electronic signature")

    if body.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    now = datetime.now(timezone.utc).isoformat()

    # Update reviewer's entry
    review_actions = doc["review_actions"]
    for ra in review_actions:
        if ra["reviewer_id"] == uid:
            ra["status"] = body.action + "d"  # approved / rejected
            ra["comments"] = body.comments or ""
            ra["reviewed_at"] = now

    # Create signature record
    await db.signatures.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "user_role": current_user.get("role", ""),
        "document_id": doc_id,
        "doc_number": doc["doc_number"],
        "rev_number": doc.get("rev_number", 0),
        "action": f"REVIEW_{body.action.upper()}D",
        "action_meaning": "Reviewer electronic signature — review decision",
        "comments": body.comments or "",
        "timestamp": now,
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
    })

    if body.action == "reject":
        # Reject → back to rejected status
        await db.documents.update_one({"id": doc_id}, {"$set": {
            "status": "rejected",
            "review_actions": review_actions,
        }})
        await log_audit(db, current_user, "REVIEW_REJECTED", doc_id, doc["doc_number"],
                        new_value={"comments": body.comments, "reviewer": current_user["name"]}, request=request)
        # Notify author
        author = await db.users.find_one({"id": doc["author_id"]}, {"_id": 0, "email": 1})
        if author:
            asyncio.create_task(send_email(
                author["email"],
                f"Review Rejected: {doc['doc_number']} - {doc['title']}",
                build_doc_email(doc["doc_number"], doc["title"], "Rejected",
                                f"Rejected by {current_user['name']}: {body.comments or 'No comments'}",
                                f"{base_url()}/documents/{doc_id}"),
            ))
        return {"message": "Review rejected"}

    # All approved?
    await db.documents.update_one({"id": doc_id}, {"$set": {"review_actions": review_actions}})
    all_approved = all(ra["status"] == "approved" for ra in review_actions)

    if all_approved:
        await db.documents.update_one({"id": doc_id}, {"$set": {"status": "pending_approval"}})
        await log_audit(db, current_user, "REVIEW_APPROVED_ALL", doc_id, doc["doc_number"], request=request)
        # Notify approver
        approver = await db.users.find_one({"id": doc["approver_id"]}, {"_id": 0, "email": 1})
        if approver:
            asyncio.create_task(send_email(
                approver["email"],
                f"Approval Required: {doc['doc_number']} - {doc['title']}",
                build_doc_email(doc["doc_number"], doc["title"], "Pending Approval",
                                "All reviewers have approved. Please approve or reject this document.",
                                f"{base_url()}/documents/{doc_id}"),
            ))
    else:
        await log_audit(db, current_user, "REVIEW_APPROVED", doc_id, doc["doc_number"],
                        new_value={"reviewer": current_user["name"]}, request=request)

    return {"message": "Review approved"}


@router.post("/{doc_id}/approve")
async def approve_action(doc_id: str, request: Request, body: ApproveActionRequest):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Document is not pending approval")

    uid = current_user["id"]
    # Self-conflict: authors cannot approve their own documents
    if doc.get("author_id") == uid and not user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="You cannot approve a document you authored")
    if doc["approver_id"] != uid and not user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="You are not the approver for this document")

    if body.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    # Verify password
    full_user = await db.users.find_one({"id": uid})
    if not verify_password(body.password, full_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password for electronic signature")

    now = datetime.now(timezone.utc).isoformat()

    # Create signature
    await db.signatures.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "user_role": current_user.get("role", ""),
        "document_id": doc_id,
        "doc_number": doc["doc_number"],
        "rev_number": doc.get("rev_number", 0),
        "action": f"APPROVAL_{body.action.upper()}D",
        "action_meaning": "Approver electronic signature — approval decision",
        "comments": body.comments or "",
        "timestamp": now,
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
    })

    if body.action == "reject":
        await db.documents.update_one({"id": doc_id}, {"$set": {
            "status": "rejected",
            "approval_comments": body.comments or "",
        }})
        await log_audit(db, current_user, "APPROVAL_REJECTED", doc_id, doc["doc_number"],
                        new_value={"comments": body.comments}, request=request)
        author = await db.users.find_one({"id": doc["author_id"]}, {"_id": 0, "email": 1})
        if author:
            asyncio.create_task(send_email(
                author["email"],
                f"Approval Rejected: {doc['doc_number']} - {doc['title']}",
                build_doc_email(doc["doc_number"], doc["title"], "Rejected",
                                f"Rejected by approver {current_user['name']}: {body.comments or ''}",
                                f"{base_url()}/documents/{doc_id}"),
            ))
        return {"message": "Approval rejected"}

    # Calculate next review date
    review_months = doc.get("review_period_months", 12)
    effective_dt = datetime.now(timezone.utc)
    next_review_dt = effective_dt + timedelta(days=review_months * 30)

    await db.documents.update_one({"id": doc_id}, {"$set": {
        "status": "active",
        "approved_at": now,
        "effective_date": effective_dt.isoformat(),
        "next_review_date": next_review_dt.isoformat(),
        "approval_comments": body.comments or "",
        "approver_name": current_user["name"],
    }})

    # Obsolete previous active revision
    if doc.get("parent_doc_id"):
        prev_rev = await db.documents.find_one({"id": doc["parent_doc_id"]})
        if prev_rev and prev_rev["status"] in ["active", "review_due", "review_overdue"]:
            await db.documents.update_one(
                {"id": doc["parent_doc_id"]},
                {"$set": {"status": "obsolete", "obsolete_date": now, "is_latest_revision": False}},
            )
            await log_audit(db, current_user, "DOCUMENT_OBSOLETED", doc["parent_doc_id"],
                            prev_rev["doc_number"], request=request)

    await log_audit(db, current_user, "DOCUMENT_APPROVED", doc_id, doc["doc_number"],
                    new_value={"effective_date": effective_dt.isoformat(),
                               "next_review_date": next_review_dt.isoformat()}, request=request)

    # Notify author
    author = await db.users.find_one({"id": doc["author_id"]}, {"_id": 0, "email": 1})
    if author:
        asyncio.create_task(send_email(
            author["email"],
            f"Document Approved: {doc['doc_number']} - {doc['title']}",
            build_doc_email(doc["doc_number"], doc["title"], "Active",
                            "Your document has been approved and is now active.",
                            f"{base_url()}/documents/{doc_id}"),
        ))

    # Trigger training records — rules were already copied to new revision on create_revision
    approved_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if approved_doc:
        asyncio.create_task(create_training_records(db, approved_doc, base_url()))

    return {"message": "Document approved and activated"}


@router.post("/{doc_id}/revise")
async def create_revision(doc_id: str, request: Request, body: ReviseDocRequest = None):
    current_user = await get_current_user(request)
    if not user_has_role(current_user, "admin", "author"):
        raise HTTPException(status_code=403, detail="Only Authors and Admins can create revisions")

    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["status"] not in ["active", "review_due", "review_overdue"]:
        raise HTTPException(status_code=400, detail="Can only revise active documents")

    now = datetime.now(timezone.utc).isoformat()
    new_id = str(uuid.uuid4())
    # Use manual override if provided, else auto-increment
    new_rev_num = (body.rev_number if body and body.rev_number is not None else None) or (doc["rev_number"] + 1)

    new_doc = {
        "id": new_id,
        "doc_number": doc["doc_number"],
        "doc_type": doc["doc_type"],
        "doc_type_id": doc.get("doc_type_id", ""),
        "prefix": doc.get("prefix", ""),
        "title": doc["title"],
        "description": doc.get("description", ""),
        "rev_number": new_rev_num,
        "status": "draft",
        "author_id": current_user["id"],
        "author_name": current_user["name"],
        "author_email": current_user["email"],
        "reviewer_ids": doc.get("reviewer_ids", []),
        "review_actions": [],
        "approver_id": doc.get("approver_id", ""),
        "approver_name": doc.get("approver_name", ""),
        "approver_email": doc.get("approver_email", ""),
        "file_path": "",
        "file_name": "",
        "file_size": 0,
        "file_content_type": "",
        "approval_comments": "",
        "review_period_months": doc.get("review_period_months", 12),
        "parent_doc_id": doc_id,
        "is_latest_revision": True,
        "created_at": now,
        "submitted_at": "",
        "approved_at": "",
        "effective_date": "",
        "next_review_date": "",
        "obsolete_date": "",
    }

    # Mark old doc as no longer latest
    await db.documents.update_one({"id": doc_id}, {"$set": {"is_latest_revision": False}})
    await db.documents.insert_one(new_doc)
    new_doc.pop("_id", None)

    # Copy training rules from parent to new revision so assignments carry forward
    parent_rules = await db.training_rules.find({"document_id": doc_id}).to_list(100)
    for rule in parent_rules:
        rule.pop("_id", None)
        rule["id"] = str(uuid.uuid4())
        rule["document_id"] = new_id
        rule["document_number"] = new_doc["doc_number"]
        rule["document_title"] = new_doc["title"]
        rule["document_rev"] = new_doc.get("rev_number", 0)
        rule["created_at"] = now
        rule["created_by"] = current_user["name"]
        await db.training_rules.insert_one(rule)

    await log_audit(db, current_user, "REVISION_CREATED", new_id,
                    f"{doc['doc_number']} Rev {new_rev_num}",
                    new_value={"parent": doc_id, "rev_number": new_rev_num}, request=request)
    return new_doc


@router.get("/{doc_id}/history")
async def get_history(doc_id: str, request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_number = doc["doc_number"]
    history = await db.documents.find(
        {"doc_number": doc_number},
        {"_id": 0}
    ).sort("rev_number", 1).to_list(100)

    return history


@router.get("/{doc_id}/signatures")
async def get_signatures(doc_id: str, request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    sigs = await db.signatures.find({"document_id": doc_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return sigs
