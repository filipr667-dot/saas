import bcrypt
import jwt
import os
import re
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

JWT_ALGORITHM = "HS256"

MIN_PASSWORD_LENGTH = 10


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def validate_password_strength(password: str):
    """Raise 400 if the password does not meet minimum strength rules."""
    errors = []
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"at least {MIN_PASSWORD_LENGTH} characters")
    if not re.search(r"[A-Z]", password or ""):
        errors.append("an uppercase letter")
    if not re.search(r"[a-z]", password or ""):
        errors.append("a lowercase letter")
    if not re.search(r"\d", password or ""):
        errors.append("a number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/\\`~\"£€]", password or ""):
        errors.append("a special character")
    if errors:
        raise HTTPException(
            status_code=400,
            detail="Password must contain: " + ", ".join(errors),
        )


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
