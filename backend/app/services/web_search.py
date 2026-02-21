"""Web search for the chat pipeline. Supports DuckDuckGo (no key) and SerpAPI (API key)."""

import os
import requests


def _search_duckduckgo(query: str, max_results: int = 8) -> str:
    """Search via DuckDuckGo; returns formatted string of results or error message."""
    if not query or not str(query).strip():
        return "Error: empty search query."
    try:
        from duckduckgo_search import DDGS

        ddgs = DDGS()
        results = list(ddgs.text(str(query).strip(), max_results=max_results))
    except Exception as e:
        return f"DuckDuckGo search failed: {e!s}"

    if not results:
        return "No results found for that query. Try a more specific query (e.g. 'weather Lamoni Iowa' or 'today news headlines')."

    lines = []
    for i, r in enumerate(results, 1):
        title = (r.get("title") or "").strip()
        body = (r.get("body") or "").strip()
        href = (r.get("href") or "").strip()
        lines.append(f"{i}. {title}\n   {body}\n   URL: {href}")
    return "\n\n".join(lines)


def _search_serpapi(query: str, max_results: int = 8) -> str:
    """Search via SerpAPI Google; returns formatted string of results or error message."""
    if not query or not str(query).strip():
        return "Error: empty search query."
    api_key = os.getenv("SERPAPI_API_KEY") or os.getenv("SerpAPI")
    if not api_key or not api_key.strip():
        return "SerpAPI is not configured. Set SERPAPI_API_KEY (or SerpAPI) in .env."

    try:
        resp = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google",
                "q": str(query).strip(),
                "api_key": api_key.strip(),
                "num": min(max_results, 20),
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return f"SerpAPI request failed: {e!s}"
    except Exception as e:
        return f"SerpAPI error: {e!s}"

    results = data.get("organic_results") or []
    if not results:
        return "No results found for that query. Try a more specific query (e.g. 'weather Lamoni Iowa' or 'today news headlines')."

    lines = []
    for i, r in enumerate(results[:max_results], 1):
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or "").strip()
        link = (r.get("link") or "").strip()
        lines.append(f"{i}. {title}\n   {snippet}\n   URL: {link}")
    return "\n\n".join(lines)


def _no_results(out: str) -> bool:
    """True if the search returned a 'no results' or error message."""
    if not out or not out.strip():
        return True
    lower = out.strip().lower()
    return lower.startswith("no results found") or lower.startswith("duckduckgo search failed") or lower.startswith("serpapi")


def search_web(query: str, max_results: int = 8, provider: str | None = None) -> str:
    """
    Run a web search and return a single string of results (title, snippet, URL per result).
    If the first query returns no results, tries fallback queries for news-like requests.
    Provider: 'duckduckgo' | 'serpapi' | None (use env WEB_SEARCH_PROVIDER, default duckduckgo).
    Returns an error message string if search fails.
    """
    if provider is None:
        provider = (os.getenv("WEB_SEARCH_PROVIDER") or "duckduckgo").strip().lower()
    do_search = _search_serpapi if provider == "serpapi" else _search_duckduckgo

    out = do_search(query, max_results=max_results)
    if not _no_results(out):
        return out

    # Fallback queries for news / current events when the first returns nothing
    q_lower = (query or "").strip().lower()
    news_keywords = ("news", "headlines", "current", "today", "latest", "breaking", "what's happening")
    if any(k in q_lower for k in news_keywords):
        for fallback in ["today news headlines", "breaking news", "latest news"]:
            if fallback == q_lower:
                continue
            out = do_search(fallback, max_results=max_results)
            if not _no_results(out):
                return f"(Fallback query: '{fallback}')\n\n" + out
    return out
