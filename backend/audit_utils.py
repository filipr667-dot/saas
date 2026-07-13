import uuid
from datetime import datetime, timezone
from fastapi import Request


async def log_audit(
    db,
    user: dict,
    action: str,
    entity_id: str = "",
    entity_label: str = "",
    previous_value: dict = None,
    new_value: dict = None,
    request: Request = None,
):
    ip = "unknown"
    user_agent = "unknown"
    if request:
        try:
            ip = request.client.host if request.client else "unknown"
        except Exception:
            pass
        user_agent = request.headers.get("user-agent", "unknown")

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id", "default"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user.get("id", ""),
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "role": user.get("role", ""),
        "ip_address": ip,
        "user_agent": user_agent,
        "action": action,
        "entity_id": entity_id,
        "entity_label": entity_label,
        "previous_value": previous_value or {},
        "new_value": new_value or {},
    })
