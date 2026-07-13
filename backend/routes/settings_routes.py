import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, require_role, org_filter
from audit_utils import log_audit

router = APIRouter()


class DocTypeRequest(BaseModel):
    name: str
    prefix: str
    review_period_months: int


class UpdateDocTypeRequest(BaseModel):
    name: Optional[str] = None
    review_period_months: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/doc-types")
async def list_doc_types(request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    doc_types = await db.doc_types.find({**org_filter(current_user)}, {"_id": 0}).to_list(100)
    return doc_types


@router.post("/doc-types")
async def create_doc_type(request: Request, body: DocTypeRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    existing = await db.doc_types.find_one({"prefix": body.prefix.upper(), **org_filter(admin)})
    if existing:
        raise HTTPException(status_code=409, detail="Prefix already in use")

    doc_type = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id", "default"),
        "name": body.name,
        "prefix": body.prefix.upper(),
        "review_period_months": body.review_period_months,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.doc_types.insert_one(doc_type)
    doc_type.pop("_id", None)
    await log_audit(db, admin, "DOC_TYPE_CREATED", doc_type["id"], body.name, request=request)
    return doc_type


@router.put("/doc-types/{type_id}")
async def update_doc_type(type_id: str, request: Request, body: UpdateDocTypeRequest):
    admin = await require_role("admin")(request)
    db = get_db()

    dt = await db.doc_types.find_one({"id": type_id, **org_filter(admin)})
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")

    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.review_period_months is not None:
        update["review_period_months"] = body.review_period_months
    if body.is_active is not None:
        update["is_active"] = body.is_active

    await db.doc_types.update_one({"id": type_id}, {"$set": update})
    await log_audit(db, admin, "DOC_TYPE_UPDATED", type_id, dt["name"], previous_value=dt, new_value=update, request=request)
    return {"message": "Document type updated"}


@router.get("/review-periods")
async def get_review_periods(request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    doc_types = await db.doc_types.find({"is_active": True, **org_filter(current_user)}, {"_id": 0, "name": 1, "prefix": 1, "review_period_months": 1}).to_list(100)
    return doc_types


@router.get("/email-config")
async def get_email_config(request: Request):
    admin = await require_role("admin")(request)
    import os
    return {
        "resend_configured": bool(os.environ.get("RESEND_API_KEY", "").startswith("re_") and
                                  not os.environ.get("RESEND_API_KEY", "").startswith("re_placeholder")),
        "sender_email": os.environ.get("SENDER_EMAIL", "onboarding@resend.dev"),
    }
