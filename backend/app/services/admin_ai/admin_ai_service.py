"""Orchestrate LLM call + structured JSON for Admin AI Solver."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import requests

from app.config.openrouter_models import DEFAULT_CHAT_MODEL
from app.services.admin_ai.context_builder import build_admin_ai_context, context_summary_flags
from app.services.admin_ai.prompt_builder import build_system_prompt, build_user_payload
from app.services.admin_ai.action_executor import (
    delete_pending,
    execute_confirmed_intent,
    load_pending_action,
    store_pending_action,
)
from app.services.admin_ai.constants import CONFIRMABLE_INTENTS
from app.services.admin_ai.structured_response import validate_and_normalize_structured

log = logging.getLogger(__name__)


def _strip_json_fences(s: str) -> str:
    t = (s or "").strip()
    if t.startswith("```"):
        lines = t.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def _parse_model_json(content: str) -> dict[str, Any]:
    raw = _strip_json_fences(content)
    return json.loads(raw)


def run_admin_solver_turn(
    db,
    *,
    admin_user_id: str,
    admin_email: str,
    message: str,
    current_page: str | None,
    selected_team_id: str | None,
    selected_trip_id: str | None,
    selected_date_range: dict | None,
    extra_ui: dict | None,
    model: str | None,
) -> dict[str, Any]:
    ctx = build_admin_ai_context(
        db,
        admin_user_id=admin_user_id,
        admin_email=admin_email,
        current_page=current_page,
        selected_team_id=selected_team_id,
        selected_trip_id=selected_trip_id,
        selected_date_range=selected_date_range,
        extra_ui=extra_ui,
    )
    system_prompt = build_system_prompt(db)
    user_content = build_user_payload(message, ctx)

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {"ok": False, "error": "OPENROUTER_API_KEY is not configured"}

    payload = {
        "model": (model or os.getenv("OPENROUTER_CHAT_MODEL") or DEFAULT_CHAT_MODEL).strip(),
        "messages": [
            {"role": "system", "content": system_prompt[:24000]},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.35,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "https://localhost"),
        "X-Title": "AI Admin Solver",
    }
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=120,
        )
        if not resp.ok:
            err = resp.json() if resp.content else {}
            msg = err.get("error", resp.reason)
            if isinstance(msg, dict):
                msg = msg.get("message", str(msg))
            return {"ok": False, "error": str(msg), "status": resp.status_code}
        data = resp.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        parsed = _parse_model_json(content)
    except json.JSONDecodeError as e:
        log.exception("admin solver json parse")
        return {"ok": False, "error": f"Model did not return valid JSON: {e}"}
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}

    normalized, val_errs = validate_and_normalize_structured(parsed)
    if val_errs:
        normalized["validationErrors"] = val_errs[:20]
        normalized["requiresConfirmation"] = False
        normalized["pendingActionBlocked"] = True
        ufm = normalized.get("userFacingMessage") or ""
        normalized["userFacingMessage"] = (
            ufm
            + ("\n\n" if ufm else "")
            + "[Validation] "
            + "; ".join(val_errs[:6])
        )

    intent = str(normalized.get("intent") or "none").strip().lower()
    requires_confirmation = bool(normalized.get("requiresConfirmation"))
    action_payload = normalized.get("actionPayload")
    if not isinstance(action_payload, dict):
        action_payload = {}

    pending_id = None
    if (
        not val_errs
        and requires_confirmation
        and intent in CONFIRMABLE_INTENTS
        and isinstance(normalized.get("actionPayload"), dict)
    ):
        pending_id = store_pending_action(
            db,
            admin_user_id=admin_user_id,
            intent=intent,
            payload=action_payload,
            model_json=normalized,
        )

    return {
        "ok": True,
        "structured": normalized,
        "contextUsed": context_summary_flags(ctx),
        "pendingActionId": pending_id,
        "usage": data.get("usage", {}),
    }


def confirm_and_execute(
    db,
    *,
    admin_user_id: str,
    admin_email: str,
    pending_action_id: str,
) -> dict[str, Any]:
    doc = load_pending_action(db, pending_action_id)
    if not doc:
        return {"ok": False, "error": "Invalid or expired pending action"}
    if doc.get("adminUserId") != admin_user_id:
        return {"ok": False, "error": "Forbidden"}
    intent = (doc.get("intent") or "").strip().lower()
    payload = doc.get("payload") if isinstance(doc.get("payload"), dict) else {}

    result = execute_confirmed_intent(
        db,
        intent=intent,
        action_payload=payload,
        admin_user_id=admin_user_id,
        admin_email=admin_email,
    )
    ok_exec = bool(result.get("ok"))
    if ok_exec:
        delete_pending(db, pending_action_id)
    return {"ok": ok_exec, "executed": result, "intent": intent}
