"""Validate and execute confirmed admin actions (server-side)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.services.pricing.pricing_admin_service import update_item_travel_cost_estimate
from app.services.roles import is_admin_email
from app.services.admin_ai.structured_response import validate_action_payload
from app.services.team.team_admin_service import (
    remove_team_member_as_admin,
    update_team_member_availability_as_admin,
)


def _audit(
    db,
    *,
    actor_user_id: str,
    actor_email: str,
    action: str,
    payload: dict[str, Any],
    result: dict[str, Any],
) -> None:
    try:
        db.admin_ai_audit.insert_one(
            {
                "actorUserId": actor_user_id,
                "actorEmail": (actor_email or "").strip().lower(),
                "action": action,
                "payload": payload,
                "result": result,
                "ok": bool(result.get("ok")),
                "createdAt": datetime.utcnow(),
            }
        )
    except Exception:
        pass


def execute_confirmed_intent(
    db,
    *,
    intent: str,
    action_payload: dict[str, Any] | None,
    admin_user_id: str,
    admin_email: str,
) -> dict[str, Any]:
    """Execute a single confirmed action. Caller must verify admin + confirmation."""
    em = (admin_email or "").strip().lower()
    if not is_admin_email(em):
        return {"ok": False, "error": "Admin access required"}
    intent = (intent or "").strip().lower()
    payload = action_payload if isinstance(action_payload, dict) else {}

    v_errs = validate_action_payload(intent, payload)
    if v_errs:
        return {"ok": False, "error": "; ".join(v_errs)}

    if intent == "remove_team_member":
        team_id = (payload.get("teamId") or "").strip()
        member_id = (payload.get("memberUserId") or payload.get("userId") or "").strip()
        out = remove_team_member_as_admin(db, team_id, member_id, em)
        _audit(db, actor_user_id=admin_user_id, actor_email=em, action=intent, payload=payload, result=out)
        return out

    if intent == "update_team_member_availability":
        team_id = (payload.get("teamId") or "").strip()
        member_id = (payload.get("memberUserId") or payload.get("userId") or "").strip()
        windows = payload.get("windows") or []
        out = update_team_member_availability_as_admin(db, team_id, member_id, windows, em)
        _audit(db, actor_user_id=admin_user_id, actor_email=em, action=intent, payload=payload, result=out)
        return out

    if intent == "update_price":
        item_id = (payload.get("itemId") or "").strip()
        price = payload.get("newPrice")
        if price is None:
            price = payload.get("price")
        cur = (payload.get("currency") or "").strip() or None
        out = update_item_travel_cost_estimate(
            db, item_id, float(price), em, currency=cur
        )
        _audit(db, actor_user_id=admin_user_id, actor_email=em, action=intent, payload=payload, result=out)
        return out

    if intent == "update_prompt_config":
        extra = payload.get("systemPromptExtra")
        if not isinstance(extra, str):
            return {"ok": False, "error": "systemPromptExtra string required"}
        db.app_settings.update_one(
            {"_id": "admin_ai"},
            {
                "$set": {
                    "systemPromptExtra": extra[:8000],
                    "updatedAt": datetime.utcnow(),
                    "updatedBy": admin_user_id,
                }
            },
            upsert=True,
        )
        out = {"ok": True, "message": "Prompt config updated"}
        _audit(db, actor_user_id=admin_user_id, actor_email=em, action=intent, payload=payload, result=out)
        return out

    return {"ok": False, "error": f"Unsupported intent for execution: {intent}"}


def store_pending_action(
    db,
    *,
    admin_user_id: str,
    intent: str,
    payload: dict[str, Any],
    model_json: dict[str, Any],
) -> str:
    """Persist a pending confirmation token (15 min TTL)."""
    exp = datetime.utcnow() + timedelta(minutes=15)
    ins = db.admin_ai_pending.insert_one(
        {
            "adminUserId": admin_user_id,
            "intent": intent,
            "payload": payload,
            "modelJson": model_json,
            "expiresAt": exp,
            "createdAt": datetime.utcnow(),
        }
    )
    return str(ins.inserted_id)


def load_pending_action(db, pending_id: str) -> dict[str, Any] | None:
    try:
        oid = ObjectId(pending_id)
    except InvalidId:
        return None
    doc = db.admin_ai_pending.find_one({"_id": oid})
    if not doc:
        return None
    if doc.get("expiresAt") and doc["expiresAt"] < datetime.utcnow():
        db.admin_ai_pending.delete_one({"_id": oid})
        return None
    return doc


def delete_pending(db, pending_id: str) -> None:
    try:
        db.admin_ai_pending.delete_one({"_id": ObjectId(pending_id)})
    except Exception:
        pass
