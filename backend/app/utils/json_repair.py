"""
Strip markdown/backticks from model JSON output and parse with optional retry.
"""
import json
import re
from typing import Tuple, Union

# Internal message used when parsing fails; do not expose to API users.
JSON_PARSE_FAILED = "Return valid JSON only. No extra text."


def strip_json_fences(raw: str) -> str:
    """
    Remove markdown code fences and any text before/after the JSON object.
    Handles: ```json ... ```, ``` ... ```, and stray text.
    """
    if not raw or not isinstance(raw, str):
        return ""
    text = raw.strip()
    # Remove optional BOM
    if text.startswith("\ufeff"):
        text = text[1:]
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if match:
        text = match.group(1).strip()
    # Find first { or [ and last } or ] to extract single JSON value
    start_obj = text.find("{")
    start_arr = text.find("[")
    if start_obj == -1 and start_arr == -1:
        return text
    if start_obj == -1:
        start = start_arr
        end = text.rfind("]")
    elif start_arr == -1:
        start = start_obj
        end = text.rfind("}")
    else:
        start = min(start_obj, start_arr)
        end = max(text.rfind("}"), text.rfind("]"))
    if end == -1:
        return text
    return text[start : end + 1].strip()


def _try_fix_json(s: str) -> str:
    """Apply common fixes for model output that almost parses."""
    # Trailing comma before } or ]
    s = re.sub(r",\s*([}\]])", r"\1", s)
    # Replace ' with " only when it looks like a key boundary (key: 'value' or "key": 'value')
    # Be conservative: only fix clearly broken key strings like "key':  (rare)
    return s


def parse_json_with_retry(raw: str, repair_prompt_phrase: str = JSON_PARSE_FAILED) -> Tuple[Union[dict, list], bool]:
    """
    Parse JSON from model output. Strips fences first.
    Returns (parsed_object, used_repair).
    Raises ValueError(repair_prompt_phrase) on failure so callers can map to a friendly message.
    """
    cleaned = strip_json_fences(raw)
    if not cleaned:
        raise ValueError(repair_prompt_phrase)
    try:
        return json.loads(cleaned), False
    except json.JSONDecodeError:
        pass
    fixed = _try_fix_json(cleaned)
    try:
        return json.loads(fixed), False
    except json.JSONDecodeError:
        pass
    # Last attempt: try to close unclosed braces (truncated output)
    try:
        open_braces = fixed.count("{") - fixed.count("}")
        open_brackets = fixed.count("[") - fixed.count("]")
        suffix = "]" * open_brackets + "}" * open_braces
        return json.loads(fixed + suffix), False
    except json.JSONDecodeError:
        pass
    raise ValueError(repair_prompt_phrase)
