import logging
import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from jose import jwt as jose_jwt, JWTError

logger = logging.getLogger(__name__)

from database import get_db
from auth_utils import create_access_token, create_refresh_token
from audit_utils import log_audit
from limiter import limiter

router = APIRouter()

JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"

# Simple in-memory JWKS cache — Microsoft rotates keys infrequently
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
JWKS_TTL_SECONDS = 3600


async def _get_jwks() -> list:
    now = datetime.now(timezone.utc).timestamp()
    if _jwks_cache["fetched_at"] and (now - _jwks_cache["fetched_at"]) < JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(JWKS_URL)
        resp.raise_for_status()
    keys = resp.json().get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


class MicrosoftLoginRequest(BaseModel):
    id_token: str


@router.post("/microsoft")
@limiter.limit("10/minute")
async def microsoft_login(request: Request, body: MicrosoftLoginRequest):
    client_id = os.environ.get("AZURE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=501, detail="Microsoft login is not configured on this server")

    try:
        header = jose_jwt.get_unverified_header(body.id_token)
        keys = await _get_jwks()
        key = next((k for k in keys if k.get("kid") == header.get("kid")), None)

        if not key:
            # Keys might be stale — force refresh once and retry
            _jwks_cache["fetched_at"] = 0.0
            keys = await _get_jwks()
            key = next((k for k in keys if k.get("kid") == header.get("kid")), None)

        if not key:
            raise HTTPException(status_code=401, detail="Microsoft token: signing key not recognised")

        payload = jose_jwt.decode(
            body.id_token,
            key,
            algorithms=["RS256"],
            audience=client_id,
        )

    except JWTError as exc:
        logger.warning("Microsoft token validation failed: %s", exc)
        raise HTTPException(status_code=401, detail="Microsoft token is invalid or has expired")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach Microsoft identity service")

    # Microsoft tokens use either 'email' or 'preferred_username' for the email
    email = (payload.get("email") or payload.get("preferred_username") or "").lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=401, detail="Microsoft token did not provide an email address")

    # Optionally restrict to a specific tenant
    tenant_id = os.environ.get("AZURE_TENANT_ID")
    if tenant_id and tenant_id != "common":
        if payload.get("tid") != tenant_id:
            raise HTTPException(status_code=401, detail="Microsoft account is from a different organisation")

    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=401,
            detail="No Lapis account found for this Microsoft identity. Contact your administrator.",
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = create_access_token(user["id"], user["email"], user["role"])
    refresh_token = create_refresh_token(user["id"])
    user_data = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}

    await log_audit(db, user_data, "LOGIN_MICROSOFT", user["id"], user["name"], request=request)
    return {**user_data, "access_token": access_token, "refresh_token": refresh_token}
