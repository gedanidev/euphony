# Euphony Auth System — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Goal

Add authentication to Euphony so the app is not publicly accessible. Implement login, forgot/reset password, and Cloudflare Turnstile bot protection. Architecture must support single user now and multiple independent users later.

---

## Constraints

- Single user for now; multi-user ready by design (no data model shortcuts that block it later)
- Existing stack: FastAPI + SQLAlchemy + PostgreSQL + React + Vite
- Email provider: Resend (custom domain `gedarc.com`)
- Bot protection: Cloudflare Turnstile (invisible mode)
- Deployed at `https://euphony.gedarc.com` behind nginx + Cloudflare

---

## Architecture

### Library: fastapi-users

`fastapi-users` handles the auth lifecycle (register, login, logout, forgot password, reset password) on top of SQLAlchemy + PostgreSQL. JWTs are stored in httpOnly cookies. Extending to multi-user later only requires adding `user_id FK` to `songs`, `playlists`, and other owned tables.

### Bot Protection: Cloudflare Turnstile (invisible)

The frontend embeds the Turnstile widget in invisible mode. On form submit, a token is generated client-side and sent with the request. The backend verifies the token against the Cloudflare Turnstile API before processing login or register.

### Email: Resend

Password reset emails are sent via Resend's API using a `noreply@gedarc.com` sender. The reset link points to `https://euphony.gedarc.com/reset-password?token=<token>`.

DNS records required in Cloudflare for `gedarc.com`:
- 2× CNAME for DKIM (values provided by Resend dashboard)
- 1× TXT for SPF
- 1× TXT for DMARC (recommended)

---

## Data Model

### `users` table (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `email` | String(320) | unique, indexed |
| `hashed_password` | String | bcrypt via fastapi-users |
| `is_active` | Boolean | default True |
| `is_superuser` | Boolean | default False |
| `is_verified` | Boolean | default False |
| `display_name` | String(100) | nullable, profile field |
| `created_at` | DateTime | UTC |

Migration: `backend/alembic/versions/0003_add_users.py`

---

## Backend

### New files

- `backend/app/auth.py` — fastapi-users setup: `UserManager`, `BearerTransport`, `JWTStrategy`, cookie backend, `current_active_user` dependency
- `backend/app/routers/auth_routes.py` — mounts fastapi-users routers + Turnstile verification dependency

### Modified files

- `backend/app/models.py` — add `User` model extending `SQLAlchemyBaseUserTableUUID`, add `display_name` and `created_at`
- `backend/app/schemas.py` — add `UserRead`, `UserCreate`, `UserUpdate` schemas
- `backend/app/main.py` — include auth router; add `current_active_user` dependency to all existing routers so unauthenticated requests get 401

### Turnstile verification

Backend dependency `verify_turnstile(token: str)`:
```
POST https://challenges.cloudflare.com/turnstile/v1/siteverify
  secret: CF_TURNSTILE_SECRET_KEY
  response: <token from client>
```
Returns 400 if verification fails. Applied to `/api/auth/login` and `/api/auth/register`.

### Endpoints (provided by fastapi-users)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Set httpOnly cookie with JWT |
| POST | `/api/auth/logout` | Clear cookie |
| POST | `/api/auth/register` | Create user |
| POST | `/api/auth/forgot-password` | Send reset email via Resend |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/users/me` | Current user info |
| PATCH | `/api/users/me` | Update display_name |

### New environment variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | 32+ char random string for JWT signing |
| `RESEND_API_KEY` | From Resend dashboard |
| `CF_TURNSTILE_SECRET_KEY` | From Cloudflare Turnstile dashboard |
| `CF_TURNSTILE_SITE_KEY` | Public key, passed to frontend via env |

---

## Frontend

### New files

- `frontend/src/contexts/AuthContext.jsx` — provides `user`, `login()`, `logout()`, `loading` state; calls `GET /api/users/me` on mount
- `frontend/src/components/ProtectedRoute.jsx` — redirects to `/login` if no session
- `frontend/src/pages/Login.jsx` — email + password form, Turnstile invisible widget, calls POST `/api/auth/login`
- `frontend/src/pages/ForgotPassword.jsx` — email form, calls POST `/api/auth/forgot-password`
- `frontend/src/pages/ResetPassword.jsx` — reads `?token=` from URL, new password form, calls POST `/api/auth/reset-password`

### Modified files

- `frontend/src/App.jsx` — wrap existing routes in `<ProtectedRoute>`, add `/login`, `/forgot-password`, `/reset-password` routes (unprotected)
- `frontend/src/main.jsx` — wrap app in `<AuthProvider>`
- `frontend/src/components/Layout.jsx` — add logout button in sidebar footer (calls `logout()` from context)
- `frontend/package.json` — add `@cloudflare/turnstile` (or load via CDN script tag in `index.html`)
- `frontend/.env` / `frontend/src/vite.config.js` — expose `VITE_CF_TURNSTILE_SITE_KEY`

### Auth flow

1. App loads → `AuthContext` calls `GET /api/users/me`
   - 200: user is logged in, render normally
   - 401: redirect to `/login`
2. Login page → user submits → Turnstile fires invisibly → token sent with credentials → backend validates both → sets cookie → redirect to `/playlists`
3. Forgot password → email sent → user clicks link → `/reset-password?token=...` → new password submitted → redirect to `/login`

### i18n

New translation keys added to `es.json`, `en.json`, `ja.json`:
- `auth.login`, `auth.email`, `auth.password`, `auth.loginBtn`, `auth.forgotPassword`
- `auth.forgotTitle`, `auth.forgotDesc`, `auth.sendLink`, `auth.linkSent`
- `auth.resetTitle`, `auth.newPassword`, `auth.resetBtn`, `auth.resetSuccess`
- `auth.logout`

---

## Multi-user readiness

When multi-user is added later:
1. Add `user_id UUID FK → users.id` to `songs`, `playlists`, `artists`, `albums`, `genres`, `moods`
2. Alembic migration to backfill existing rows with a default admin user id
3. Filter all queries by `current_user.id`
4. Add admin role check for superuser operations

No shortcuts are taken now that would block this. The `users` table uses UUID PK to match the pattern of all other tables.

---

## Security notes

- Passwords hashed with bcrypt (fastapi-users default)
- JWT stored in httpOnly cookie (not localStorage) — not accessible to JS
- Turnstile token verified server-side on every login/register attempt
- Reset tokens are single-use and expire (fastapi-users default: 1 hour)
- HTTPS enforced by nginx + Cloudflare

---

## Out of scope

- Email verification on register (can be enabled later via fastapi-users flag)
- Social login (Spotify OAuth is separate, existing feature)
- Admin panel for managing users (superuser flag is there but no UI)
- Rate limiting beyond Turnstile (can add later with slowapi)
