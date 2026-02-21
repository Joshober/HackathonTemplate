"""Library API: occupancy count from sensor (hardcoded URLs only)."""
import json
import requests
from flask import Blueprint, jsonify

bp = Blueprint('library', __name__)

# Hardcoded sensor API URLs (no env)
LIBRARY_NGROK_URL = 'https://warner-unthrashed-nonvascularly.ngrok-free.dev/api/ble/count'
LIBRARY_LOCAL_URL = 'http://192.168.137.201/api/ble/count'
LIBRARY_FALLBACK_COUNT = 14


def _fetch_count() -> int:
    """Try ngrok then local URL; return fallback if both fail."""
    for url in (LIBRARY_NGROK_URL, LIBRARY_LOCAL_URL):
        try:
            headers = {'ngrok-skip-browser-warning': '1'} if 'ngrok' in url else {}
            r = requests.get(url, timeout=10, headers=headers)
            r.raise_for_status()
            data = r.json()
            count = data.get('count')
            if count is not None:
                return int(count)
        except (requests.RequestException, ValueError, TypeError, json.JSONDecodeError):
            continue
    return LIBRARY_FALLBACK_COUNT


@bp.route('/librarycount', methods=['GET'])
def library_count():
    """GET /api/librarycount -> JSON {count: N}. On any failure, returns 14."""
    try:
        count = _fetch_count()
        return jsonify({'count': count})
    except Exception:
        return jsonify({'count': LIBRARY_FALLBACK_COUNT})
