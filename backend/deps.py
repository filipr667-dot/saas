import jwt
import os
from fastapi import HTTPException, Request
from database import get_db

JWT_ALGORITHM = "HS256"


async def get_current_user(request: Request) -> dict:
    db = get_db()
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") not in ("access", "impersonate"):
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account deactivated")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        # Carry impersonation metadata if present
        if payload.get("impersonated_by"):
            user["_impersonated_by"] = payload["impersonated_by"]
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _all_roles(user: dict) -> list:
    """Return the flat list of all roles a user holds (system role + doc roles)."""
    roles = []
    if user.get("role"):
        roles.append(user["role"])
    roles.extend(user.get("doc_roles", []))
    return roles


def require_role(*roles):
    """Dependency: require the user to hold at least one of the given roles."""
    async def check_role(request: Request) -> dict:
        current_user = await get_current_user(request)
        if not any(r in _all_roles(current_user) for r in roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return check_role


def user_has_role(user: dict, *roles: str) -> bool:
    """Check if a user holds any of the given roles (system or document)."""
    return any(r in _all_roles(user) for r in roles)


def org_filter(user: dict) -> dict:
    """MongoDB filter dict scoping a query to the user's organisation.
    Super admin returns {} to see all orgs."""
    if user.get("role") == "super_admin":
        return {}
    return {"org_id": user.get("org_id", "default")}
