"""Quick test for web search (DuckDuckGo or SerpAPI) and library count API. Run from backend: python -m scripts.test_web_search"""
import json
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.web_search import search_web
from app.services.library import get_library_count


def test_library():
    print("Testing library count API...")
    result = get_library_count()
    data = json.loads(result)
    if "error" in data:
        print(f"  FAIL: {data['error']}")
        return False
    if "count" not in data:
        print(f"  FAIL: unexpected response {data}")
        return False
    print(f"  PASS: count = {data['count']}")
    return True


def main():
    print("Testing web search (weather and news)...\n")
    for query in ["weather Lamoni Iowa", "today news headlines"]:
        print(f"Query: {query}")
        print("-" * 50)
        result = search_web(query)
        print(result[:800] + ("..." if len(result) > 800 else ""))
        print()

    print("-" * 50)
    print("Testing library count API...\n")
    ok = test_library()
    print()

    print("Done. If you see results above, internet search is working.")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
