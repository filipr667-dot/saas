import uuid
import calendar
import asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from database import get_db
from deps import get_current_user, require_role
from audit_utils import log_audit
from storage_utils import put_object, get_object

router = APIRouter()


# ─────────────────────── helpers ────────────────────────

def add_months(date_str: str, months: int) -> Optional[str]:
    """Add N months to an ISO date string, return ISO date string."""
    try:
        d = date.fromisoformat(date_str)
        month = d.month - 1 + months
        year = d.year + month // 12
        month = month % 12 + 1
        day = min(d.day, calendar.monthrange(year, month)[1])
        return date(year, month, day).isoformat()
    except Exception:
        return None


def days_until(date_str: str) -> Optional[int]:
    try:
        d = date.fromisoformat(date_str)
        return (d - date.today()).days
    except Exception:
        return None


# ─────────────────────── models ─────────────────────────

class AssetCreateRequest(BaseModel):
    asset_id: str
    name: str
    serial_number: Optional[str] = ""
    supplier: Optional[str] = ""
    calibration_required: bool = False
    calibration_frequency_months: Optional[int] = None
    last_calibration_date: Optional[str] = None   # ISO date YYYY-MM-DD
    notification_email: Optional[str] = None
    notification_phone: Optional[str] = None


class AssetUpdateRequest(BaseModel):
    asset_id: Optional[str] = None
    name: Optional[str] = None
    serial_number: Optional[str] = None
    supplier: Optional[str] = None
    calibration_required: Optional[bool] = None
    calibration_frequency_months: Optional[int] = None
    last_calibration_date: Optional[str] = None
    notification_email: Optional[str] = None
    notification_phone: Optional[str] = None


class PMActivityCreate(BaseModel):
    activity_name: str
    frequency_months: int
    last_check_date: Optional[str] = None   # ISO date YYYY-MM-DD


class PMActivityUpdate(BaseModel):
    activity_name: Optional[str] = None
    frequency_months: Optional[int] = None
    last_check_date: Optional[str] = None


# ─────────────────────── assets CRUD ────────────────────

@router.get("/stats/dashboard")
async def asset_dashboard_stats(request: Request):
    """Stats for the Asset Management dashboard."""
    await require_role("admin")(request)
    db = get_db()
    today = date.today().isoformat()
    thirty_days = add_months(today, 1) or today

    total = await db.assets.count_documents({})

    # Due for calibration in 30 days: calibration_required=True, due_date between today and +30d
    calib_due_cursor = db.assets.find({
        "calibration_required": True,
        "calibration_due_date": {"$gte": today, "$lte": thirty_days},
    }, {"_id": 0})
    calib_due_docs = await calib_due_cursor.to_list(500)

    # Overdue calibration (past due date)
    calib_overdue_cursor = db.assets.find({
        "calibration_required": True,
        "calibration_due_date": {"$lt": today},
    }, {"_id": 0})
    calib_overdue_docs = await calib_overdue_cursor.to_list(500)

    # PM activities due in 30 days
    pm_due_cursor = db.pm_activities.find({
        "next_check_date": {"$gte": today, "$lte": thirty_days},
    }, {"_id": 0})
    pm_due_list = await pm_due_cursor.to_list(500)

    # PM overdue
    pm_overdue_cursor = db.pm_activities.find({
        "next_check_date": {"$lt": today},
    }, {"_id": 0})
    pm_overdue_list = await pm_overdue_cursor.to_list(500)

    return {
        "total_assets": total,
        "calibration_due": len(calib_due_docs),
        "calibration_overdue": len(calib_overdue_docs),
        "calibration_due_assets": calib_due_docs,
        "calibration_overdue_assets": calib_overdue_docs,
        "pm_due": len(pm_due_list),
        "pm_overdue": len(pm_overdue_list),
        "pm_due_activities": pm_due_list,
        "pm_overdue_activities": pm_overdue_list,
    }


@router.get("")
async def list_assets(request: Request):
    current_user = await get_current_user(request)
    db = get_db()
    assets = await db.assets.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return assets


@router.post("")
async def create_asset(request: Request, body: AssetCreateRequest):
    current_user = await require_role("admin")(request)
    db = get_db()

    # Check asset_id uniqueness
    existing = await db.assets.find_one({"asset_id": body.asset_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Asset ID '{body.asset_id}' already exists")

    now = datetime.now(timezone.utc).isoformat()

    # Calculate calibration_due_date
    calib_due = None
    if body.calibration_required and body.last_calibration_date and body.calibration_frequency_months:
        calib_due = add_months(body.last_calibration_date, body.calibration_frequency_months)

    asset = {
        "id": str(uuid.uuid4()),
        "asset_id": body.asset_id,
        "name": body.name,
        "serial_number": body.serial_number or "",
        "supplier": body.supplier or "",
        "photo_path": None,
        "calibration_required": body.calibration_required,
        "calibration_frequency_months": body.calibration_frequency_months if body.calibration_required else None,
        "last_calibration_date": body.last_calibration_date if body.calibration_required else None,
        "calibration_due_date": calib_due,
        "calibration_certificate_path": None,
        "notification_email": body.notification_email or None,
        "notification_phone": body.notification_phone or None,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["name"],
    }
    await db.assets.insert_one(asset)
    asset.pop("_id", None)

    await log_audit(db, current_user, "ASSET_CREATED", asset["id"], body.asset_id,
                    new_value={"name": body.name}, request=request)

    # Send creation notification
    if body.notification_email:
        asyncio.create_task(_send_asset_notification(asset))

    return asset


@router.get("/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    await get_current_user(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{asset_id}")
async def update_asset(asset_id: str, request: Request, body: AssetUpdateRequest):
    current_user = await require_role("admin")(request)
    db = get_db()

    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    updates = {}
    if body.asset_id is not None:
        # Check uniqueness if changing asset_id
        if body.asset_id != asset["asset_id"]:
            clash = await db.assets.find_one({"asset_id": body.asset_id, "id": {"$ne": asset_id}})
            if clash:
                raise HTTPException(status_code=400, detail=f"Asset ID '{body.asset_id}' already exists")
        updates["asset_id"] = body.asset_id
    if body.name is not None:
        updates["name"] = body.name
    if body.serial_number is not None:
        updates["serial_number"] = body.serial_number
    if body.supplier is not None:
        updates["supplier"] = body.supplier
    if body.notification_email is not None:
        updates["notification_email"] = body.notification_email or None
    if body.notification_phone is not None:
        updates["notification_phone"] = body.notification_phone or None

    # Handle calibration fields
    calib_required = body.calibration_required if body.calibration_required is not None else asset.get("calibration_required", False)
    if body.calibration_required is not None:
        updates["calibration_required"] = body.calibration_required
    freq = body.calibration_frequency_months if body.calibration_frequency_months is not None else asset.get("calibration_frequency_months")
    last = body.last_calibration_date if body.last_calibration_date is not None else asset.get("last_calibration_date")
    if body.calibration_frequency_months is not None:
        updates["calibration_frequency_months"] = freq if calib_required else None
    if body.last_calibration_date is not None:
        updates["last_calibration_date"] = last if calib_required else None

    # Recalculate due date whenever relevant fields change
    if calib_required and last and freq:
        updates["calibration_due_date"] = add_months(last, freq)
    elif not calib_required:
        updates["calibration_due_date"] = None

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.assets.update_one({"id": asset_id}, {"$set": updates})

    updated = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    await log_audit(db, current_user, "ASSET_UPDATED", asset_id, asset["asset_id"],
                    new_value=updates, request=request)

    # If calibration date was updated, send reminder notification
    if body.last_calibration_date and updated.get("notification_email"):
        asyncio.create_task(_send_calibration_updated_notification(updated))

    return updated


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    current_user = await require_role("admin")(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.assets.delete_one({"id": asset_id})
    await db.pm_activities.delete_many({"asset_id": asset_id})
    await log_audit(db, current_user, "ASSET_DELETED", asset_id, asset["asset_id"],
                    request=request)
    return {"message": "Asset deleted"}


# ─────────────────────── photo ──────────────────────────

@router.post("/{asset_id}/photo")
async def upload_photo(asset_id: str, request: Request, file: UploadFile = File(...)):
    current_user = await require_role("admin")(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only image files are allowed (JPEG, PNG, WebP)")

    data = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    path = f"assets/{asset_id}/photo.{ext}"
    put_object(path, data, file.content_type)

    await db.assets.update_one({"id": asset_id}, {"$set": {"photo_path": path, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Photo uploaded", "photo_path": path}


@router.get("/{asset_id}/photo")
async def get_photo(asset_id: str, request: Request):
    await get_current_user(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset or not asset.get("photo_path"):
        raise HTTPException(status_code=404, detail="No photo for this asset")
    data, content_type = get_object(asset["photo_path"])
    return Response(content=data, media_type=content_type)


# ─────────────────────── calibration certificate ────────

@router.post("/{asset_id}/certificate")
async def upload_certificate(asset_id: str, request: Request, file: UploadFile = File(...)):
    current_user = await require_role("admin")(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.get("calibration_required"):
        raise HTTPException(status_code=400, detail="Calibration not required for this asset")
    if not asset.get("last_calibration_date"):
        raise HTTPException(status_code=400, detail="Record last calibration date before uploading certificate")

    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF or image files allowed")

    data = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "pdf"
    path = f"assets/{asset_id}/certificate.{ext}"
    put_object(path, data, file.content_type)

    await db.assets.update_one({"id": asset_id}, {"$set": {
        "calibration_certificate_path": path,
        "calibration_certificate_name": file.filename,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"message": "Certificate uploaded", "certificate_path": path}


@router.get("/{asset_id}/certificate")
async def download_certificate(asset_id: str, request: Request):
    await get_current_user(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset or not asset.get("calibration_certificate_path"):
        raise HTTPException(status_code=404, detail="No certificate for this asset")
    data, content_type = get_object(asset["calibration_certificate_path"])
    filename = asset.get("calibration_certificate_name", "calibration-certificate.pdf")
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────── calibration sticker PDF ────────

@router.get("/{asset_id}/sticker")
async def download_sticker(asset_id: str, request: Request):
    """Generate a print-ready calibration sticker PDF for this asset."""
    from certificate_utils import generate_calibration_sticker
    await get_current_user(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    pdf_bytes = generate_calibration_sticker(asset)
    filename = f"sticker-{asset.get('asset_id', asset_id)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────── PM activities ──────────────────

@router.get("/{asset_id}/pm")
async def list_pm(asset_id: str, request: Request):
    await get_current_user(request)
    db = get_db()
    activities = await db.pm_activities.find({"asset_id": asset_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return activities


@router.post("/{asset_id}/pm")
async def create_pm(asset_id: str, request: Request, body: PMActivityCreate):
    current_user = await require_role("admin")(request)
    db = get_db()
    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    next_check = None
    if body.last_check_date and body.frequency_months:
        next_check = add_months(body.last_check_date, body.frequency_months)

    now = datetime.now(timezone.utc).isoformat()
    activity = {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "asset_name": asset.get("name", ""),
        "asset_ref_id": asset.get("asset_id", ""),
        "activity_name": body.activity_name,
        "frequency_months": body.frequency_months,
        "last_check_date": body.last_check_date,
        "next_check_date": next_check,
        "created_at": now,
        "updated_at": now,
    }
    await db.pm_activities.insert_one(activity)
    activity.pop("_id", None)
    return activity


@router.put("/{asset_id}/pm/{pm_id}")
async def update_pm(asset_id: str, pm_id: str, request: Request, body: PMActivityUpdate):
    current_user = await require_role("admin")(request)
    db = get_db()
    pm = await db.pm_activities.find_one({"id": pm_id, "asset_id": asset_id})
    if not pm:
        raise HTTPException(status_code=404, detail="PM activity not found")

    updates = {}
    if body.activity_name is not None:
        updates["activity_name"] = body.activity_name
    freq = body.frequency_months if body.frequency_months is not None else pm.get("frequency_months")
    last = body.last_check_date if body.last_check_date is not None else pm.get("last_check_date")
    if body.frequency_months is not None:
        updates["frequency_months"] = freq
    if body.last_check_date is not None:
        updates["last_check_date"] = last

    if last and freq:
        updates["next_check_date"] = add_months(last, freq)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pm_activities.update_one({"id": pm_id}, {"$set": updates})
    updated = await db.pm_activities.find_one({"id": pm_id}, {"_id": 0})
    return updated


@router.delete("/{asset_id}/pm/{pm_id}")
async def delete_pm(asset_id: str, pm_id: str, request: Request):
    current_user = await require_role("admin")(request)
    db = get_db()
    result = await db.pm_activities.delete_one({"id": pm_id, "asset_id": asset_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PM activity not found")
    return {"message": "PM activity deleted"}


# ─────────────────────── notifications ──────────────────

async def _send_asset_notification(asset: dict):
    from email_service import send_email, build_asset_notification_email
    email = asset.get("notification_email")
    if not email:
        return
    subject = f"Asset Registered: {asset['asset_id']} — {asset['name']}"
    html = build_asset_notification_email(asset)
    await send_email(email, subject, html)


async def _send_calibration_updated_notification(asset: dict):
    from email_service import send_email, build_calibration_reminder_email
    email = asset.get("notification_email")
    if not email:
        return
    subject = f"Calibration Updated: {asset['asset_id']} — {asset['name']}"
    html = build_calibration_reminder_email(asset)
    await send_email(email, subject, html)
