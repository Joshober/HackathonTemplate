"""DDG snippets + light HTML fetch for travel pricing (on by default).

Opt out: TRAVEL_SCRAPE_OPTIONS=0.

When SERPAPI_API_KEY is set, SerpAPI is used for DuckDuckGo text + Google Flights snippets (opt out: TRAVEL_SERPAPI_SCRAPE=0).
"""

from __future__ import annotations

import os
from urllib.parse import urlparse

import requests

from app.services.web_search import _ddgs_text_query

_SCRAPE_OFF = frozenset({"0", "false", "no", "off"})


def scrape_enabled() -> bool:
    """Extra web scrape rows (DDG + optional SerpAPI). Default on; disable with TRAVEL_SCRAPE_OPTIONS=0."""
    v = (os.getenv("TRAVEL_SCRAPE_OPTIONS") or "").strip().lower()
    if v in _SCRAPE_OFF:
        return False
    return True


def serpapi_travel_scrape_enabled() -> bool:
    """SerpAPI google_flights + engine=duckduckgo when API key is set. Default on; opt out: TRAVEL_SERPAPI_SCRAPE=0."""
    from app.services.serpapi_travel import get_serpapi_key

    if not get_serpapi_key():
        return False
    v = (os.getenv("TRAVEL_SERPAPI_SCRAPE") or "").strip().lower()
    if v in _SCRAPE_OFF:
        return False
    return True


def _text_search_rows(query: str, max_results: int) -> tuple[list[dict[str, str]], str | None]:
    """Local DuckDuckGo (ddgs) or SerpAPI engine=duckduckgo."""
    if serpapi_travel_scrape_enabled():
        from app.services.serpapi_travel import serpapi_duckduckgo_text_results

        return serpapi_duckduckgo_text_results(query, max_results=max_results)
    rows, err = _ddgs_text_query(query, max_results)
    if err == "empty":
        return [], None
    return rows, err


def _fetch_page_title(url: str, timeout: float = 4.0, max_bytes: int = 120_000) -> str | None:
    try:
        r = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "HackathonTravelBot/1.0"},
            stream=True,
        )
        if r.status_code != 200:
            return None
        buf = b""
        for chunk in r.iter_content(8192):
            buf += chunk
            if len(buf) >= max_bytes:
                break
        text = buf.decode("utf-8", errors="replace")
    except Exception:
        return None
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(text[:max_bytes], "html.parser")
        t = soup.find("title")
        if t and t.string:
            return t.string.strip()[:200]
    except Exception:
        pass
    low = text.lower()
    if "<title>" in low:
        start = low.find("<title>") + 7
        end = low.find("</title>", start)
        if end > start:
            return text[start:end].strip()[:200]
    return None


def _safe_http_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


def collect_scraped_options(
    origin_iata: str,
    city: str,
    outbound: str,
    inbound: str | None,
    destination_iata: str | None = None,
    max_ddg: int = 6,
    max_html: int = 2,
) -> tuple[list[dict], str | None]:
    if not scrape_enabled():
        return [], None
    out: list[dict] = []
    seen: set[str] = set()
    err: str | None = None

    # SerpAPI Google Flights — needs resolved 3-letter destination airport (from Amadeus/Duffel in pricing route)
    if serpapi_travel_scrape_enabled() and destination_iata:
        try:
            from app.services.serpapi_travel import serpapi_google_flights_scraped_rows

            gf_rows, gf_err = serpapi_google_flights_scraped_rows(
                origin_iata,
                destination_iata,
                outbound,
                inbound,
                max_options=5,
            )
            if gf_err and not gf_rows:
                err = gf_err
            elif gf_err and gf_rows:
                err = err or gf_err
            gf_dedupe: set[str] = set()
            for gr in gf_rows:
                t = (gr.get("title") or "")[:240]
                u = (gr.get("url") or "").strip() or "https://www.google.com/travel/flights"
                dkey = f"{t}|{u}"
                if dkey in gf_dedupe:
                    continue
                gf_dedupe.add(dkey)
                out.append(
                    {
                        "title": gr.get("title") or "Flight",
                        "snippet": gr.get("snippet") or "",
                        "url": u[:2000],
                        "kind": gr.get("kind") or "flight",
                        "sourceQuery": gr.get("sourceQuery") or "google_flights",
                    }
                )
        except Exception as e:
            err = str(e)

    queries = [
        f"cheap flights {origin_iata} to {city} {outbound}",
        f"hotels {city} check in {outbound}",
    ]
    if inbound:
        queries.append(f"round trip flights {origin_iata} {city} return {inbound}")
    for q in queries:
        try:
            rows, row_err = _text_search_rows(q, max_ddg)
            if row_err and row_err != "empty query":
                err = err or row_err
        except Exception as e:
            err = str(e)
            rows = []
        for r in rows:
            href = (r.get("href") or "").strip()
            if not href or href in seen:
                continue
            seen.add(href)
            kind = "flight" if "flight" in q else "hotel" if "hotel" in q else "mixed"
            out.append(
                {
                    "title": (r.get("title") or "")[:300],
                    "snippet": (r.get("body") or "")[:500],
                    "url": href[:2000],
                    "kind": kind,
                    "sourceQuery": q[:200],
                }
            )
    html_enriched = 0
    for opt in out[:8]:
        if html_enriched >= max_html:
            break
        u = opt.get("url") or ""
        if not isinstance(u, str) or not _safe_http_url(u):
            continue
        title = _fetch_page_title(u)
        if title:
            opt["pageTitle"] = title
            html_enriched += 1
    return out[:12], err
