"""Quick test for web search (DuckDuckGo or SerpAPI). Run from backend: python -m scripts.test_web_search"""
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.web_search import search_web


def main():
    print("Testing web search (weather and news)...\n")
    for query in ["weather Lamoni Iowa", "today news headlines"]:
        print(f"Query: {query}")
        print("-" * 50)
        result = search_web(query)
        print(result[:800] + ("..." if len(result) > 800 else ""))
        print()
    print("Done. If you see results above, internet search is working.")


if __name__ == "__main__":
    main()
