import jwt
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional

from database import get_db
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token
from deps import get_current_user
from audit_utils import log_audit

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


@router.post("/login")
async def login(request: Request, body: LoginRequest):
    db = get_db()
    email = body.email.lower().strip()

    # Brute force check
    identifier = f"{request.client.host if request.client else 'unknown'}:{email}"
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
