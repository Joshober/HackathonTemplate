"""OpenRouter team travel replies; delegates to chat route helper to avoid duplicating tool wiring."""
import os
from flask import request as flask_request

from app.routes.chat import _chat_with_web_search
from app.config.openrouter_models import DEFAULT_CHAT_MODEL
from app.prompts.travel_team import LOCKTON_TRAVEL_TEAM_PERSONALITY, TEAM_CHANNEL_SUFFIX


def _openrouter_headers():
    req = flask_request
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        raise ValueError('OPENROUTER_API_KEY is not configured')
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'HTTP-Referer': req.headers.get('Origin', '') if req else '',
        'X-Title': 'Team Travel Chat',
    }


def run_team_travel_assistant(conversation_messages: list[dict]) -> tuple[str, dict]:
    """
    conversation_messages: OpenAI-style list with roles user|assistant only (no leading system;
    _chat_with_web_search prepends system + personality).
    Returns (assistant_text, usage_dict).
    """
    model = os.getenv('OPENROUTER_CHAT_MODEL') or DEFAULT_CHAT_MODEL
    personality = LOCKTON_TRAVEL_TEAM_PERSONALITY + TEAM_CHANNEL_SUFFIX
    content, usage = _chat_with_web_search(
        list(conversation_messages),
        model,
        _openrouter_headers(),
        timeout_sec=90,
        personality_override=personality,
    )
    return (content or "I couldn't generate a response."), usage or {}
