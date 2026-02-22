"""Web search for the chat pipeline. Supports DuckDuckGo (no key) and SerpAPI (API key)."""

import os
import requests


def _search_duckduckgo(query: str, max_results: int = 8) -> str:
    """Search via DuckDuckGo; returns formatted string of results or error message."""
    if not query or not str(query).strip():
        return "Error: empty search query."
    try:
        from ddgs import DDGS

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


def _serpapi_available() -> bool:
    key = os.getenv("SERPAPI_API_KEY") or os.getenv("SerpAPI")
    return bool(key and str(key).strip())


def search_web(query: str, max_results: int = 8, provider: str | None = None) -> str:
    """
    Run a web search and return a single string of results (title, snippet, URL per result).
    If the first query returns no results, tries fallback queries for news-like requests.
    Provider: 'duckduckgo' | 'serpapi' | None (use env WEB_SEARCH_PROVIDER, default duckduckgo).
    If WEB_SEARCH_BOTH=true and SerpAPI is configured, runs both DuckDuckGo and SerpAPI and
    returns combined labeled results so the model can use whichever is better.
    Returns an error message string if search fails.
    """
    if provider is None:
        provider = (os.getenv("WEB_SEARCH_PROVIDER") or "duckduckgo").strip().lower()
    use_both = (os.getenv("WEB_SEARCH_BOTH") or "").strip().lower() in ("1", "true", "yes")
    do_search = _search_serpapi if provider == "serpapi" else _search_duckduckgo

    def run_one(q: str) -> str:
        return do_search(q, max_results=max_results)

    # Optional: run both providers and combine (model can prefer one)
    if use_both and _serpapi_available() and provider != "serpapi":
        ddg_out = _search_duckduckgo(query, max_results=max_results)
        serp_out = _search_serpapi(query, max_results=max_results)
        parts = []
        if not _no_results(ddg_out):
            parts.append("DuckDuckGo results:\n" + ddg_out)
        if not _no_results(serp_out):
            parts.append("SerpAPI (Google) results:\n" + serp_out)
        if parts:
            return "\n\n---\n\n".join(parts)
        # both failed; continue with normal fallbacks below using primary provider
        out = do_search(query, max_results=max_results)
    else:
        out = run_one(query)
    if not _no_results(out):
        return out

    # Fallback queries when the first returns nothing
    q_lower = (query or "").strip().lower()
    news_keywords = ("news", "headlines", "current", "today", "latest", "breaking", "what's happening")
    if any(k in q_lower for k in news_keywords):
        for fallback in ["today news headlines", "breaking news", "latest news"]:
            if fallback == q_lower:
                continue
            out = do_search(fallback, max_results=max_results)
            if not _no_results(out):
                return f"(Fallback query: '{fallback}')\n\n" + out

    # Fallback for restaurant search: only use location-specific variants so we don't get Denver/Brooklyn
    if "restaurant" in q_lower or "eat" in q_lower or "food" in q_lower:
        stop = {"in", "near", "around", "me", "restaurants", "restaurant", "places", "to", "eat"}
        parts = [p for p in query.strip().split() if p.lower() not in stop]
        fallbacks = []
        if parts:
            # Keep the location in every fallback so results stay local (no "best restaurants" / "restaurants near me")
            fallbacks.append(" ".join(parts) + " restaurants")
            fallbacks.append("places to eat " + " ".join(parts))
            fallbacks.append("restaurants near " + " ".join(parts))
            if len(parts) >= 2:
                # e.g. "Lamoni Iowa" -> try "Iowa restaurants" for same state only
                fallbacks.append(parts[-1] + " restaurants")
        # Only if user gave no location do we try generic (avoid "best restaurants" — returns national lists)
        elif "near me" in q_lower or "nearby" in q_lower:
            fallbacks.append("restaurants near me")
        for fallback in fallbacks:
            if fallback == q_lower:
                continue
            out = do_search(fallback, max_results=max_results)
            if not _no_results(out):
                return f"(Fallback query: '{fallback}')\n\n" + out
    return out
