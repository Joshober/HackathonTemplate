"""Google Calendar OAuth token storage and free/busy helpers."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _token_collection(db):
    return db.google_calendar_tokens


def google_client_id() -> str:
    return (
        os.getenv("GOOGLE_CLIENT_ID")
        or os.getenv("GOOGLE_OAUTH_CLIENT_ID")
        or os.getenv("GOOGLE_CALENDAR_CLIENT_ID")
        or ""
    ).strip().strip("'\"")


def google_client_secret() -> str:
    return (
        os.getenv("GOOGLE_CLIENT_SECRET")
        or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
        or os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET")
        or ""
    ).strip().strip("'\"")


def google_redirect_uri() -> str:
    explicit = (
        os.getenv("GOOGLE_REDIRECT_URI")
        or os.getenv("GOOGLE_CALENDAR_REDIRECT_URI")
        or ""
    ).strip().strip("'\"")
    if explicit:
        return explicit
    backend_url = (os.getenv("BACKEND_URL") or "http://localhost:5001").rstrip("/")
    return f"{backend_url}/api/auth/google/calendar/callback"


def google_frontend_return_url() -> str:
    frontend_url = (os.getenv("AUTH0_BASE_URL") or "http://localhost:3000").rstrip("/")
    return f"{frontend_url}/explorer"


def upsert_google_calendar_token(db, user_id: str, token_data: dict[str, Any]) -> None:
    expires_in = token_data.get("expires_in")
    try:
        expires_s = int(expires_in)
    except (TypeError, ValueError):
        expires_s = 3600
    expires_at = _utc_now() + timedelta(seconds=max(60, expires_s))
    payload: dict[str, Any] = {
        "userId": user_id,
        "provider": "google_calendar",
        "accessToken": token_data.get("access_token") or "",
        "scope": token_data.get("scope") or "",
        "tokenType": token_data.get("token_type") or "Bearer",
        "expiresAt": expires_at,
        "updatedAt": _utc_now(),
    }
    refresh_token = token_data.get("refresh_token")
    if isinstance(refresh_token, str) and refresh_token.strip():
        payload["refreshToken"] = refresh_token.strip()
    _token_collection(db).update_one(
        {"userId": user_id, "provider": "google_calendar"},
        {"$set": payload, "$setOnInsert": {"createdAt": _utc_now()}},
        upsert=True,
    )


def get_google_calendar_token_doc(db, user_id: str) -> dict[str, Any] | None:
    return _token_collection(db).find_one({"userId": user_id, "provider": "google_calendar"})


def disconnect_google_calendar(db, user_id: str) -> None:
    _token_collection(db).delete_one({"userId": user_id, "provider": "google_calendar"})


def _refresh_google_access_token(db, user_id: str, refresh_token: str) -> dict[str, Any]:
    client_id = google_client_id()
    client_secret = google_client_secret()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth is not configured")
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=20,
    )
    data = resp.json() if resp.ok else {}
    if not resp.ok:
        msg = (data.get("error_description") or data.get("error") or "refresh failed") if isinstance(data, dict) else "refresh failed"
        raise ValueError(f"Google token refresh failed: {msg}")
    if isinstance(data, dict):
        data.setdefault("refresh_token", refresh_token)
    upsert_google_calendar_token(db, user_id, data if isinstance(data, dict) else {})
    doc = get_google_calendar_token_doc(db, user_id)
    if not doc:
        raise ValueError("Google token persistence failed")
    return doc


def get_valid_google_access_token(db, user_id: str) -> str | None:
    doc = get_google_calendar_token_doc(db, user_id)
    if not doc:
        return None
    access_token = (doc.get("accessToken") or "").strip()
    expires_at = doc.get("expiresAt")
    refresh_token = (doc.get("refreshToken") or "").strip()
    now = _utc_now()
    if access_token and isinstance(expires_at, datetime):
        exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if exp > now + timedelta(minutes=2):
            return access_token
    if not refresh_token:
        return access_token or None
    refreshed = _refresh_google_access_token(db, user_id, refresh_token)
    return (refreshed.get("accessToken") or "").strip() or None


def fetch_google_freebusy(
    db,
    user_id: str,
    time_min_iso: str,
    time_max_iso: str,
) -> list[tuple[datetime, datetime]]:
    token = get_valid_google_access_token(db, user_id)
    if not token:
        return []
    resp = requests.post(
        GOOGLE_FREEBUSY_URL,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "timeMin": time_min_iso,
            "timeMax": time_max_iso,
            "items": [{"id": "primary"}],
        },
        timeout=20,
    )
    data = resp.json() if resp.ok else {}
    if not resp.ok:
        return []
    calendars = data.get("calendars") if isinstance(data, dict) else None
    primary = calendars.get("primary") if isinstance(calendars, dict) else None
    busy = primary.get("busy") if isinstance(primary, dict) else None
    if not isinstance(busy, list):
        return []
    out: list[tuple[datetime, datetime]] = []
    for block in busy:
        if not isinstance(block, dict):
            continue
        s_raw = block.get("start")
        e_raw = block.get("end")
        if not isinstance(s_raw, str) or not isinstance(e_raw, str):
            continue
        try:
            start = datetime.fromisoformat(s_raw.replace("Z", "+00:00"))
            end = datetime.fromisoformat(e_raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if end <= start:
            continue
        out.append((start.astimezone(timezone.utc), end.astimezone(timezone.utc)))
    return out

