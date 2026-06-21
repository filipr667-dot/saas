import jwt
import os
import uuid
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional

from database import get_db
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token
from deps import get_current_user
from audit_utils import log_audit
from email_service import send_email, build_password_reset_email

router = APIRouter()

RESET_TOKEN_TTL_MINUTES = 60


def frontend_base_url() -> str:
    """Primary frontend URL for building user-facing links."""
    raw = os.environ.get("FRONTEND_URL", "")
    first = raw.split(",")[0].strip() if raw else ""
    return first or "https://lapisims.com"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _validate_password(pw: str):
    if not pw or len(pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")


def client_ip(request: Request) -> str:
    """Real client IP, accounting for Render/proxy X-Forwarded-For header."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # First entry is the original client; the rest are proxies.
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/login")
async def login(request: Request, body: LoginRequest):
    db = get_db()
    email = body.email.lower().strip()

    # Brute force check — keyed on real client IP + email
    identifier = f"{client_ip(request)}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        locked_time = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": locked_time}},
            upsert=True,
        )
        await log_audit(
            db,
            {"id": "", "name": "Unknown", "email": email, "role": ""},
            "LOGIN_FAILED",
            email,
            email,
            new_value={"reason": "invalid credentials"},
            request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    await db.login_attempts.delete_one({"identifier": identifier})

    access_token = create_access_token(user["id"], user["email"], user["role"])
    refresh_token = create_refresh_token(user["id"])

    user_data = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
    await log_audit(db, user_data, "LOGIN", user["id"], user["name"], request=request)
    # Return tokens in body — frontend stores per-tab in sessionStorage
    return {**user_data, "access_token": access_token, "refresh_token": refresh_token}


@router.post("/logout")
async def logout(request: Request):
    try:
        current_user = await get_current_user(request)
        db = get_db()
        await log_audit(db, current_user, "LOGOUT", current_user["id"], current_user["name"], request=request)
    except Exception:
        pass
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request):
    return await get_current_user(request)


@router.post("/forgot-password")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    db = get_db()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})

    # Always return the same response so we never reveal whether an email exists.
    if user and user.get("is_active", True):
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat()

        # Invalidate any prior outstanding reset tokens for this user
        await db.password_resets.delete_many({"user_id": user["id"]})
        await db.password_resets.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "email": email,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "ip_address": client_ip(request),
        })

        reset_link = f"{frontend_base_url()}/reset-password?token={raw_token}"
        await send_email(
            email,
            "Reset your Lapis IMS password",
            build_password_reset_email(user.get("name", "there"), reset_link, RESET_TOKEN_TTL_MINUTES),
        )
        await log_audit(db, {"id": user["id"], "name": user["name"], "email": email, "role": user.get("role", "")},
                        "PASSWORD_RESET_REQUESTED", user["id"], email, request=request)

    return {"message": "If an account exists for that email, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: Request, body: ResetPasswordRequest):
    db = get_db()
    _validate_password(body.new_password)

    token_hash = _hash_token(body.token.strip())
    record = await db.password_resets.find_one({"token_hash": token_hash})
    if not record:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has already been used")

    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        await db.password_resets.delete_one({"id": record["id"]})
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    user = await db.users.find_one({"id": record["user_id"]})
    if not user:
        await db.password_resets.delete_one({"id": record["id"]})
        raise HTTPException(status_code=400, detail="Account no longer exists")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password),
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    # Token is single-use; clear it and any login lockouts for this user
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{user['email']}$"}})

    await log_audit(db, {"id": user["id"], "name": user["name"], "email": user["email"], "role": user.get("role", "")},
                    "PASSWORD_RESET_COMPLETED", user["id"], user["email"], request=request)

    return {"message": "Your password has been reset. You can now sign in with your new password."}


@router.post("/refresh")
async def refresh(request: Request, body: RefreshRequest):
    db = get_db()
    # Accept token from request body (sessionStorage approach)
    refresh_token = body.refresh_token if body and body.refresh_token else None
    # Fallback: cookie (for any legacy requests)
    if not refresh_token:
        refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(refresh_token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(user["id"], user["email"], user["role"])
        return {"access_token": access_token}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
