"""Library occupancy: fetch people count from sensor (ngrok or local), fallback to constant."""
import os
import json
import requests

_LIBRARY_NGROK_URL = 'https://warner-unthrashed-nonvascularly.ngrok-free.dev/api/ble/count'
_LIBRARY_LOCAL_URL = 'http://192.168.137.147/api/ble/count'
_LIBRARY_FALLBACK_COUNT = 14


def get_library_count() -> str:
    """Fetch people count from sensor: try LIBRARY_SENSOR_URL (or ngrok), then local IP; if both fail return fallback count. Returns JSON string e.g. '{"count": 14}'."""
    primary = os.getenv('LIBRARY_SENSOR_URL', _LIBRARY_NGROK_URL)
    urls = [primary, _LIBRARY_LOCAL_URL]
    if primary == _LIBRARY_LOCAL_URL:
        urls = [_LIBRARY_NGROK_URL, _LIBRARY_LOCAL_URL]
    for url in urls:
        try:
            print(f"[library] GET {url}", flush=True)
            headers = {'ngrok-skip-browser-warning': '1'} if 'ngrok' in url else {}
            r = requests.get(url, timeout=10, headers=headers)
            r.raise_for_status()
            data = r.json()
            count = data.get('count')
            if count is not None:
                return json.dumps({'count': count})
        except (requests.RequestException, ValueError, TypeError, json.JSONDecodeError):
            continue
    print(f"[library] both URLs failed, using fallback count {_LIBRARY_FALLBACK_COUNT}", flush=True)
    return json.dumps({'count': _LIBRARY_FALLBACK_COUNT})
