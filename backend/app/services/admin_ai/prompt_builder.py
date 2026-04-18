"""Assemble system + user content for Admin AI Solver."""

from __future__ import annotations

import json
from typing import Any

from app.prompts.admin_ai_solver import ADMIN_SOLVER_SYSTEM, merge_prompt_config


def build_system_prompt(db) -> str:
    extra = None
    try:
        doc = db.app_settings.find_one({"_id": "admin_ai"}) or {}
        if isinstance(doc, dict):
            extra = doc.get("systemPromptExtra")
    except Exception:
        extra = None
    return merge_prompt_config(ADMIN_SOLVER_SYSTEM, extra if isinstance(extra, str) else None)


def build_user_payload(
    message: str,
    context: dict[str, Any],
) -> str:
    return (
        "App context (JSON):\n"
        + json.dumps(context, ensure_ascii=False, default=str)[:28000]
        + "\n\nAdmin message:\n"
        + (message or "").strip()[:12000]
    )
