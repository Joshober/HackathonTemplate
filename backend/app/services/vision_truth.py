"""
Fase 1: Truth extraction from image.
Ollama first (images: [base64], timeout 15-20s), fallback OpenRouter vision.
Returns truth dict, truth_source ("local" | "openrouter"), latency_ms.
"""
import os
import time
import base64
import requests
from app.prompts.truth import SYSTEM as TRUTH_SYSTEM, USER as TRUTH_USER
from app.utils.json_repair import parse_json_with_retry, JSON_PARSE_FAILED

OLLAMA_TIMEOUT = 18
REPAIR_PROMPT = JSON_PARSE_FAILED


def _sanitize_ocr(raw: str) -> str:
    """Drop OCR that looks like API artifacts or gibberish (e.g. MediaRelationship, random tokens)."""
    if not raw or not isinstance(raw, str):
        return ""
    s = raw.strip()
    # Known vision-model artifacts / garbage
    if any(x in s for x in ("MediaRelationship", "Supported recipient", "=collection", "actftcm")):
        return ""
    # Mixed nonsense: lots of short tokens with no spaces, or single letters
    if len(s) > 80 and (s.count(" ") < 3 or sum(1 for c in s if c.isalpha()) < len(s) // 2):
        return ""
    return s


def _normalize_truth(d: dict) -> dict:
    """Ensure required keys exist and sanitize OCR."""
    raw_ocr = d.get("truth_ocr") or ""
    return {
        "truth_caption": (d.get("truth_caption") or "").strip(),
        "truth_objects": d.get("truth_objects") if isinstance(d.get("truth_objects"), list) else [],
        "scene_type": (d.get("scene_type") or "other").strip(),
        "truth_ocr": _sanitize_ocr(raw_ocr),
        "confidence": (d.get("confidence") or "medium").strip(),
    }


def _try_ollama(image_base64: str) -> tuple[dict | None, float]:
    """
    Try Ollama with images: [base64]. Returns (truth_dict, latency_ms) or (None, latency_ms) on failure.
    On invalid JSON, retries once with repair prompt.
    """
    base_url = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_VISION_MODEL") or "llama3.2-vision:11b"
    url = f"{base_url}/api/chat"

    def _request(user_content: str) -> tuple[dict | None, float]:
        start = time.perf_counter()
        try:
            r = requests.post(
                url,
                json={
                    "model": model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": TRUTH_SYSTEM},
                        {"role": "user", "content": user_content, "images": [image_base64]},
                    ],
                },
                timeout=OLLAMA_TIMEOUT,
            )
            latency_ms = (time.perf_counter() - start) * 1000
            if not r.ok:
                return None, latency_ms
            data = r.json()
            content = (data.get("message") or {}).get("content") or ""
            if not content.strip():
                return None, latency_ms
            parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
            if isinstance(parsed, dict):
                return _normalize_truth(parsed), latency_ms
            return None, latency_ms
        except (requests.RequestException, ValueError, KeyError):
            return None, (time.perf_counter() - start) * 1000

    truth, latency = _request(TRUTH_USER)
    if truth is not None:
        return truth, latency
    # One retry with repair prompt
    truth, latency2 = _request(TRUTH_USER + "\n\nReturn valid JSON only. No extra text.")
    if truth is not None:
        return truth, latency2
    return None, latency


def _openrouter_vision(image_base64: str) -> tuple[dict, float]:
    """
    OpenRouter vision fallback. Returns (truth_dict, latency_ms). Raises on API/key error.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("Ollama failed or is not running. Set OPENROUTER_API_KEY to use cloud vision as fallback.")
    model = os.getenv("OPENROUTER_VISION_MODEL") or "meta-llama/llama-3.2-11b-vision-instruct"
    url = "https://openrouter.ai/api/v1/chat/completions"
    # Standard vision format: image_url with data URL
    data_url = f"data:image/jpeg;base64,{image_base64}"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": TRUTH_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": TRUTH_USER},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "",
    }
    start = time.perf_counter()
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    if not r.ok:
        try:
            err = r.json()
            msg = err.get("error", {}).get("message", r.text) if isinstance(err.get("error"), dict) else r.text
        except Exception:
            msg = r.text
        raise RuntimeError(f"OpenRouter vision error: {msg}")
    data = r.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    try:
        parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
    except ValueError:
        # Retry once with repair prompt
        repair_payload = {**payload, "messages": [
            {"role": "system", "content": TRUTH_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": TRUTH_USER + "\n\nReturn valid JSON only. No extra text."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]}
        r2 = requests.post(url, headers=headers, json=repair_payload, timeout=60)
        if not r2.ok:
            try:
                err2 = r2.json()
                msg2 = err2.get("error", {}).get("message", r2.text) if isinstance(err2.get("error"), dict) else r2.text
            except Exception:
                msg2 = r2.text[:200] if r2.text else "unknown"
            raise RuntimeError(f"OpenRouter vision retry failed: {msg2}")
        content = (r2.json().get("choices") or [{}])[0].get("message", {}).get("content") or ""
        parsed, _ = parse_json_with_retry(content, REPAIR_PROMPT)
    latency_ms = (time.perf_counter() - start) * 1000
    if not isinstance(parsed, dict):
        raise RuntimeError("OpenRouter vision did not return a JSON object")
    return _normalize_truth(parsed), latency_ms


def extract_truth(image_base64: str) -> tuple[dict, str, float]:
    """
    Extract truth from image. Tries Ollama first, then OpenRouter.
    Returns (truth_dict, truth_source, latency_ms_truth).
    """
    truth, latency = _try_ollama(image_base64)
    if truth is not None:
        return truth, "local", latency
    truth, latency = _openrouter_vision(image_base64)
    return truth, "openrouter", latency
