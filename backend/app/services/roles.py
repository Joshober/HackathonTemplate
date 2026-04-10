"""
Admin and professor role checks. Env lists merge with MongoDB-managed professor emails.

- ADMIN_EMAILS (comma-separated): extra admins; alvaromp2005@gmail.com is always admin.
- PROFESSOR_EMAILS (comma-separated): extra professors; built-in defaults always include
  contatothomastesa@gmail.com and alvaromp2005@gmail.com.
- MongoDB app_settings.professor_emails_additional: emails admins add via /admin panel.
"""
import os
import re
from typing import List, Set

from app.db.mongodb import get_db

SETTINGS_COL = 'app_settings'
SETTINGS_DOC_ID = 'roles'

# Always treated as admin (Auth0 login email, lowercased).
_SUPER_ADMIN_EMAIL = 'alvaromp2005@gmail.com'

_BUILTIN_PROFESSORS = frozenset(
    {
        'contatothomastesa@gmail.com',
        'adsthomastesa@gmail.com',  # alternate professor account (flutter-mobile branch)
        _SUPER_ADMIN_EMAIL,
    }
)

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


def _parse_email_csv(key: str) -> Set[str]:
    raw = os.getenv(key, '') or ''
    return {e.strip().lower() for e in raw.split(',') if e.strip()}


def get_admin_emails() -> Set[str]:
    """Admins: env ADMIN_EMAILS plus super-admin (always)."""
    return _parse_email_csv('ADMIN_EMAILS') | {_SUPER_ADMIN_EMAIL}


def get_env_professor_emails() -> Set[str]:
    """Professors from env only (not DB)."""
    return _BUILTIN_PROFESSORS | _parse_email_csv('PROFESSOR_EMAILS')


def _get_managed_professor_emails_from_db() -> Set[str]:
    try:
        db = get_db()
        doc = db[SETTINGS_COL].find_one({'_id': SETTINGS_DOC_ID})
        if not doc:
            return set()
        arr = doc.get('professor_emails_additional') or []
        out: Set[str] = set()
        for e in arr:
            if isinstance(e, str) and e.strip():
                out.add(e.strip().lower())
        return out
    except Exception:
        return set()


def get_effective_professor_emails() -> Set[str]:
    return get_env_professor_emails() | _get_managed_professor_emails_from_db()


def get_managed_professor_emails_list() -> List[str]:
    """Additional professor emails stored by admin (sorted)."""
    return sorted(_get_managed_professor_emails_from_db())


def set_managed_professor_emails(emails: List[str]) -> List[str]:
    """Validate, normalize, persist. Returns saved list sorted."""
    normalized: List[str] = []
    seen: Set[str] = set()
    for raw in emails:
        if not isinstance(raw, str):
            continue
        e = raw.strip().lower()
        if not e or e in seen:
            continue
        if not _EMAIL_RE.match(e):
            raise ValueError(f'Invalid email: {raw!r}')
        seen.add(e)
        normalized.append(e)
    db = get_db()
    db[SETTINGS_COL].update_one(
        {'_id': SETTINGS_DOC_ID},
        {
            '$set': {
                'professor_emails_additional': normalized,
            }
        },
        upsert=True,
    )
    return sorted(normalized)


def is_admin_email(email: str) -> bool:
    e = (email or '').strip().lower()
    return bool(e) and e in get_admin_emails()


def is_professor_email(email: str) -> bool:
    e = (email or '').strip().lower()
    return bool(e) and e in get_effective_professor_emails()


def mask_smtp_user_hint() -> str | None:
    user = (os.getenv('SMTP_USER') or '').strip()
    if not user or '@' not in user:
        return None
    local, _, domain = user.partition('@')
    if len(local) <= 1:
        return f'*@{domain}'
    return f'{local[0]}***@{domain}'
