"""User authentication endpoints.

POST /auth/register   — create first user (only works when DB has 0 users)
POST /auth/login      — verify credentials + Turnstile, set httpOnly cookie
POST /auth/logout     — clear cookie
GET  /auth/me         — current user info
PATCH /auth/me        — update display_name
POST /auth/forgot-password — send reset email via Resend
POST /auth/reset-password  — set new password using reset token
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_reset_token,
    decode_access_token,
    decode_reset_token,
    verify_turnstile,
)

router = APIRouter(prefix="/auth", tags=["user-auth"])

COOKIE_NAME = "euphony_token"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM_EMAIL", "noreply@gedarc.com")


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    email = decode_access_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


@router.post("/register", response_model=schemas.UserRead, status_code=201)
def register(body: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    if user_count > 0:
        raise HTTPException(status_code=403, detail="Registration is closed")
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = models.User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_superuser=True,  # first user is always superuser
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.email)
    _set_auth_cookie(response, token)
    return user


@router.post("/login", response_model=schemas.UserRead)
def login(body: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    if not verify_turnstile(body.turnstile_token):
        raise HTTPException(status_code=400, detail="Turnstile verification failed")
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token(user.email)
    _set_auth_cookie(response, token)
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserRead)
def update_me(
    body: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    if not verify_turnstile(body.turnstile_token):
        raise HTTPException(status_code=400, detail="Turnstile verification failed")
    user = db.query(models.User).filter(models.User.email == body.email).first()
    # Always return 200 to avoid email enumeration
    if not user:
        return {"ok": True}
    token = create_reset_token(user.email)
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    _send_reset_email(user.email, reset_url)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    email = decode_reset_token(body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


def _send_reset_email(to_email: str, reset_url: str) -> None:
    """Send password reset email via Resend. Fails silently in dev if no API key."""
    if not RESEND_API_KEY:
        print(f"[DEV] Reset URL for {to_email}: {reset_url}")
        return
    import resend  # local import to avoid startup error if not installed yet
    resend.api_key = RESEND_API_KEY
    resend.Emails.send({
        "from": RESEND_FROM,
        "to": [to_email],
        "subject": "Euphony — Restablecer contraseña",
        "html": f"""
        <p>Recibiste este correo porque solicitaste restablecer tu contraseña en Euphony.</p>
        <p><a href="{reset_url}">Haz clic aquí para crear una nueva contraseña</a></p>
        <p>El enlace expira en 60 minutos.</p>
        <p>Si no solicitaste esto, ignora este correo.</p>
        """,
    })
