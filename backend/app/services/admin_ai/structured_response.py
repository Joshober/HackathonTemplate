"""
Validate and normalize Admin AI Solver JSON output before persisting pending actions.
"""

from __future__ import annotations

import re
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.services.admin_ai.constants import CONFIRMABLE_INTENTS

ALLOWED_RESPONSE_TYPES = frozenset(
    {"informational", "recommendation", "action_proposal", "validation"}
)

ALLOWED_INTENTS = CONFIRMABLE_INTENTS | {
    "reassign_team_member",
    "suggest_price_adjustment",
    "evaluate_destination_fit",
    "suggest_better_location",
    "validate_trip_against_weather",
    "suggest_alternative_dates",
    "none",
}

_OID_RE = re.compile(r"^[a-fA-F0-9]{24}$")


def _is_object_id(s: str) -> bool:
    if not isinstance(s, str) or not _OID_RE.match(s.strip()):
        return False
    try:
        ObjectId(s.strip())
        return True
    except InvalidId:
        return False


def _clip_confidence(v: Any) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, x))


def _is_user_id(s: str) -> bool:
    """Team member ids are Auth0-style subs (not necessarily Mongo ObjectIds)."""
    t = (s or "").strip()
    return 1 <= len(t) <= 200 and "\x00" not in t


def validate_action_payload(intent: str, payload: dict[str, Any] | None) -> list[str]:
    """Return list of error strings; empty means OK."""
    if payload is None:
        return ["actionPayload required for this intent"] if intent in CONFIRMABLE_INTENTS else []
    errs: list[str] = []
    if intent == "remove_team_member":
        tid = (payload.get("teamId") or "").strip()
        mid = (payload.get("memberUserId") or payload.get("userId") or "").strip()
        if not _is_object_id(tid):
            errs.append("teamId must be a valid Mongo ObjectId string")
        if not _is_user_id(mid):
            errs.append("memberUserId must be a non-empty user id")
    elif intent == "update_team_member_availability":
        tid = (payload.get("teamId") or "").strip()
        mid = (payload.get("memberUserId") or payload.get("userId") or "").strip()
        wins = payload.get("windows")
        if not _is_object_id(tid):
            errs.append("teamId must be a valid Mongo ObjectId string")
        if not _is_user_id(mid):
            errs.append("memberUserId must be a non-empty user id")
        if not isinstance(wins, list):
            errs.append("windows must be an array")
    elif intent == "update_price":
        iid = (payload.get("itemId") or "").strip()
        price = payload.get("newPrice")
        if price is None:
            price = payload.get("price")
        if not _is_object_id(iid):
            errs.append("itemId must be a valid ObjectId")
        try:
            pv = float(price)
            if pv < 0 or pv > 1_000_000_000:
                errs.append("newPrice out of allowed range")
        except (TypeError, ValueError):
            errs.append("newPrice must be a number")
    elif intent == "update_prompt_config":
        extra = payload.get("systemPromptExtra")
        if not isinstance(extra, str) or not extra.strip():
            errs.append("systemPromptExtra non-empty string required")
        elif len(extra) > 8000:
            errs.append("systemPromptExtra exceeds 8000 characters")
    return errs


def validate_and_normalize_structured(parsed: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """
    Returns (normalized_dict, validation_errors).
    validation_errors non-empty means pending actions must not be created.
    """
    errs: list[str] = []
    if not isinstance(parsed, dict):
        return {"intent": "none", "userFacingMessage": "Invalid model output."}, ["root must be an object"]

    out = dict(parsed)

    rt = str(out.get("responseType") or "").strip().lower()
    if rt and rt not in ALLOWED_RESPONSE_TYPES:
        errs.append(f"invalid responseType: {rt!r}")
    if rt:
        out["responseType"] = rt

    intent = str(out.get("intent") or "none").strip().lower()
    if intent not in ALLOWED_INTENTS:
        errs.append(f"invalid intent: {intent!r}")
        intent = "none"
    out["intent"] = intent

    out["confidence"] = _clip_confidence(out.get("confidence"))

    rc = out.get("requiresConfirmation")
    out["requiresConfirmation"] = bool(rc) if rc is not None else False

    ufm = out.get("userFacingMessage")
    if not isinstance(ufm, str) or not ufm.strip():
        errs.append("userFacingMessage must be a non-empty string")
    else:
        out["userFacingMessage"] = ufm.strip()[:12000]

    rs = out.get("reasoningSummary")
    if rs is not None and isinstance(rs, str):
        out["reasoningSummary"] = rs.strip()[:8000]

    ap = out.get("actionPayload")
    if ap is not None and not isinstance(ap, dict):
        errs.append("actionPayload must be an object or null")
        out["actionPayload"] = None
    elif isinstance(ap, dict):
        out["actionPayload"] = ap
        errs.extend(validate_action_payload(intent, ap))
    else:
        out["actionPayload"] = None
        if intent in CONFIRMABLE_INTENTS:
            errs.extend(validate_action_payload(intent, None))

    wd = out.get("weatherDigest")
    if wd is not None and not isinstance(wd, dict):
        out["weatherDigest"] = None

    sr = out.get("structuredRecommendations")
    if sr is not None:
        if isinstance(sr, list):
            out["structuredRecommendations"] = [str(x)[:500] for x in sr[:30] if x is not None]
        else:
            out["structuredRecommendations"] = []

    return out, errs
