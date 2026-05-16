"""JWT, password hashing, and Turnstile verification utilities."""
import os
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ.get("SECRET_KEY", "insecure-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_MINUTES = 60

CF_TURNSTILE_SECRET = os.environ.get("CF_TURNSTILE_SECRET_KEY", "")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v1/siteverify"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": subject, "type": "access", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": email, "type": "reset", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> str | None:
    """Returns email (sub) if valid access token, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decode_reset_token(token: str) -> str | None:
    """Returns email (sub) if valid reset token, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def verify_turnstile(token: str) -> bool:
    """Call Cloudflare Turnstile siteverify. Returns True if valid."""
    if not CF_TURNSTILE_SECRET:
        # Dev mode: skip verification
        return True
    try:
        resp = httpx.post(
            TURNSTILE_VERIFY_URL,
            data={"secret": CF_TURNSTILE_SECRET, "response": token},
            timeout=10,
        )
        return resp.json().get("success", False)
    except Exception:
        return False
