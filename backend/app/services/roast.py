"""
Confidently Wrong Roast AI — one roast from truth (text only).
Local (Ollama) first, fallback OpenRouter. Returns {"roast": str}, latency_ms, source.
"""
import os
import time
import requests
from app.prompts.roast import SYSTEM as ROAST_SYSTEM, build_user_prompt
from app.utils.json_repair import parse_json_with_retry, JSON_PARSE_FAILED

REPAIR_PROMPT = JSON_PARSE_FAILED
OLLAMA_ROAST_TIMEOUT = 25


def _try_ollama_roast(
    truth_caption: str,
    truth_objects: list,
    scene_type: str,
) -> tuple[dict | None, float]:
    """Try Ollama for roast (text-only). Returns ({"roast": str}, latency_ms) or (None, latency_ms)."""
    base_url = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_HUMOR_MODEL") or os.getenv("OLLAMA_VISION_MODEL") or "llama3.2"
    url = f"{base_url}/api/chat"
    user_content = build_user_prompt(truth_caption, truth_objects, scene_type)
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": ROAST_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    }
    start = time.perf_counter()
    try:
        r = requests.post(url, json=payload, timeout=OLLAMA_ROAST_TIMEOUT)
        latency_ms = (time.perf_counter() - start) * 1000
        if not r.ok:
            return None, latency_ms
        data = r.json()
        content = (data.get("message") or {}).get("content") or ""
        if not content.strip():
            return None, latency_ms
        parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
        if isinstance(parsed, dict) and isinstance(parsed.get("roast"), str):
            return {"roast": (parsed.get("roast") or "").strip()}, latency_ms
        return None, latency_ms
    except (requests.RequestException, ValueError, KeyError):
        return None, (time.perf_counter() - start) * 1000


def _openrouter_roast(
    truth_caption: str,
    truth_objects: list,
    scene_type: str,
) -> tuple[dict, float]:
    """OpenRouter (text-only) fallback for roast. Raises if API key missing."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("Ollama failed or is not running. Set OPENROUTER_API_KEY to use cloud fallback.")
    model = os.getenv("OPENROUTER_HUMOR_MODEL") or os.getenv("OPENROUTER_VISION_MODEL") or "openai/gpt-3.5-turbo"
    url = "https://openrouter.ai/api/v1/chat/completions"
    user_content = build_user_prompt(truth_caption, truth_objects, scene_type)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": ROAST_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "",
    }
    start = time.perf_counter()
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    if not r.ok and r.status_code == 400 and "response_format" in payload:
        payload = {k: v for k, v in payload.items() if k != "response_format"}
        r = requests.post(url, headers=headers, json=payload, timeout=60)
    latency_ms = (time.perf_counter() - start) * 1000
    if not r.ok:
        try:
            err = r.json()
            msg = err.get("error", {}).get("message", r.text) if isinstance(err.get("error"), dict) else r.text
        except Exception:
            msg = r.text
        raise RuntimeError(f"OpenRouter roast error: {msg}")
    data = r.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    try:
        parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
    except ValueError:
        repair_payload = {
            **payload,
            "messages": [
                {"role": "system", "content": ROAST_SYSTEM},
                {"role": "user", "content": user_content + "\n\nYour entire response must be only the JSON object. Nothing else."},
            ],
        }
        r2 = requests.post(url, headers=headers, json=repair_payload, timeout=60)
        if not r2.ok:
            try:
                err2 = r2.json()
                msg2 = err2.get("error", {}).get("message", r2.text) if isinstance(err2.get("error"), dict) else r2.text
            except Exception:
                msg2 = r2.text[:200] if r2.text else "unknown"
            raise RuntimeError(f"OpenRouter roast retry failed: {msg2}")
        content = (r2.json().get("choices") or [{}])[0].get("message", {}).get("content") or ""
        parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
        latency_ms = (time.perf_counter() - start) * 1000
    if not isinstance(parsed, dict) or not isinstance(parsed.get("roast"), str):
        raise RuntimeError("OpenRouter roast did not return a valid roast string")
    return {"roast": (parsed.get("roast") or "").strip()}, latency_ms


def generate_roast(
    truth_caption: str,
    truth_objects: list,
    scene_type: str,
) -> tuple[dict, float, str]:
    """
    Roast: try Ollama (local) first, then OpenRouter.
    Returns ({"roast": str}, latency_ms, source "local" | "openrouter").
    """
    result, latency = _try_ollama_roast(truth_caption, truth_objects, scene_type)
    if result is not None:
        return result, latency, "local"
    result, latency = _openrouter_roast(truth_caption, truth_objects, scene_type)
    return result, latency, "openrouter"
