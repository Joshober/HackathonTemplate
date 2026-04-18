"""DuckDuckGo-backed travel opportunity search (Explorer page + chat tools)."""
import hashlib

from app.services.web_search import duckduckgo_text_results
from app.services.link_preview import og_image_for_url

MAX_CITIES = 5
MAX_PER_CITY_CAP = 10
MAX_IMAGE_PREVIEWS = 12


def _opportunity_query(city: str) -> str:
    return f'business conferences industry events networking {city}'


def _result_id(url: str) -> str:
    h = hashlib.sha256(url.encode('utf-8', errors='replace')).hexdigest()
    return h[:24]


def _normalize_url(url: str) -> str:
    return (url or '').strip().lower().rstrip('/')


def travel_opportunities_for_cities(cities: list[str], max_per_city: int = 8) -> list[dict]:
    """
    Same shape as /api/explorer/opportunities: id, title, snippet, url, city.
    cities: plain names (e.g. 'Chicago'); capped at MAX_CITIES.
    """
    cleaned: list[str] = []
    for c in cities or []:
        s = ' '.join(str(c).split()).strip()
        if s:
            cleaned.append(s[:200])
    cleaned = cleaned[:MAX_CITIES]
    if not cleaned:
        return []
    try:
        max_per = int(max_per_city)
    except (TypeError, ValueError):
        max_per = 8
    max_per = max(1, min(max_per, MAX_PER_CITY_CAP))

    seen_urls: set[str] = set()
    opportunities: list[dict] = []
    for city in cleaned:
        q = _opportunity_query(city)
        rows = duckduckgo_text_results(q, max_results=max_per)
        for r in rows:
            url = (r.get('href') or '').strip()
            title = (r.get('title') or '').strip() or url or 'Untitled'
            snippet = (r.get('body') or '').strip()
            if not url:
                continue
            key = _normalize_url(url)
            if not key or key in seen_urls:
                continue
            seen_urls.add(key)
            opportunities.append(
                {
                    'id': _result_id(url),
                    'title': title[:500],
                    'snippet': snippet[:800],
                    'url': url[:2000],
                    'city': city[:200],
                }
            )

    # Best-effort enrich with preview images (og:image). Keep it fast:
    # - small timeout per URL
    # - cap total lookups to avoid slowing down multi-city searches
    looked_up = 0
    for o in opportunities:
        if looked_up >= MAX_IMAGE_PREVIEWS:
            break
        url = o.get('url')
        if not isinstance(url, str) or not url.strip():
            continue
        try:
            img = og_image_for_url(url, timeout=2.5)
        except Exception:
            img = None
        if img:
            o['imageUrl'] = img
            looked_up += 1

    return opportunities
