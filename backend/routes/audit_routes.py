from fastapi import APIRouter, Request, Query, HTTPException
from typing import Optional
import logging

from database import get_db
from deps import get_current_user, require_role

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_LIMIT = 100


@router.get("")
async def list_audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    await require_role("admin")(request)
    db = get_db()

    # Clamp limit to safe maximum
    safe_limit = min(limit, MAX_LIMIT)

    query = {}
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if user_id:
        query["user_id"] = user_id
    if entity_id:
        query["entity_id"] = entity_id
    if search:
        query["$or"] = [
            {"action": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_email": {"$regex": search, "$options": "i"}},
            {"entity_label": {"$regex": search, "$options": "i"}},
        ]
    if from_date or to_date:
        ts_filter = {}
        if from_date:
            ts_filter["$gte"] = from_date
        if to_date:
            ts_filter["$lte"] = to_date
        query["timestamp"] = ts_filter

    try:
        total = await db.audit_logs.count_documents(query)
        skip = (page - 1) * safe_limit
        logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(safe_limit).to_list(safe_limit)
        return {"items": logs, "total": total, "page": page, "limit": safe_limit}
    except Exception as exc:
        logger.error("audit list error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve audit records. Please try again.")


@router.get("/actions")
async def list_actions(request: Request):
    await require_role("admin")(request)
    db = get_db()
    actions = await db.audit_logs.distinct("action")
    return sorted(actions)
