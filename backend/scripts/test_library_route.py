"""Test GET /api/librarycount (live server or test client). Usage: python -m scripts.test_library_route [base_url]"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def test_via_client():
    from app import create_app
    app = create_app()
    with app.test_client() as c:
        r = c.get("/api/librarycount")
        return r.status_code, r.get_json()

def test_via_http(base_url="http://localhost:5001"):
    try:
        import urllib.request
        req = urllib.request.Request(f"{base_url}/api/librarycount", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return resp.status, data
    except Exception as e:
        return None, {"error": str(e)}

if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else None
    if base:
        status, data = test_via_http(base)
        print(f"HTTP GET {base}/api/librarycount -> {status}")
    else:
        status, data = test_via_client()
        print(f"Test client GET /api/librarycount -> {status}")
    print(json.dumps(data, indent=2))
    sys.exit(0 if status == 200 and data.get("count") is not None else 1)
