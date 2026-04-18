"""OpenRouter chat completions client — no secrets in logs."""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT_SEC = 90

logger = logging.getLogger(__name__)


def get_openrouter_api_key() -> str | None:
    k = os.getenv("OPENROUTER_API_KEY")
    return k.strip() if k and str(k).strip() else None


def openrouter_headers(request) -> dict[str, str]:
    """Build headers; Referer from request Origin (safe)."""
    api_key = get_openrouter_api_key()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": (request.headers.get("Origin") or "")[:512],
        "X-Title": "Travel Copilot",
    }


def chat_completions(
    *,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | None = "auto",
    timeout_sec: float | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[dict[str, Any], int]:
    """
    POST /chat/completions. Returns (response_json, http_status).
    Raises requests.RequestException on network failure.
    """
    api_key = get_openrouter_api_key()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        **(extra_headers or {}),
    }
    body: dict[str, Any] = {"model": model, "messages": messages}
    if tools is not None:
        body["tools"] = tools
    if tool_choice is not None and tools:
        body["tool_choice"] = tool_choice

    to = float(timeout_sec if timeout_sec is not None else DEFAULT_TIMEOUT_SEC)
    resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=to)
    try:
        data = resp.json() if resp.content else {}
    except ValueError:
        data = {}
    if not resp.ok:
        err = data.get("error") if isinstance(data, dict) else None
        if isinstance(err, dict):
            msg = err.get("message", resp.reason)
        else:
            msg = str(err) if err else resp.reason
        logger.warning("OpenRouter error status=%s (no body secrets logged)", resp.status_code)
        return data if isinstance(data, dict) else {}, resp.status_code
    return data if isinstance(data, dict) else {}, resp.status_code
