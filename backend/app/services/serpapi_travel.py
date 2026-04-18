"""SerpAPI helpers for Travelbot scrape: Google Flights + DuckDuckGo (via SerpAPI engines)."""

from __future__ import annotations

import os
from typing import Any

import requests

SERPAPI_SEARCH_URL = "https://serpapi.com/search"


def get_serpapi_key() -> str | None:
    k = os.getenv("SERPAPI_API_KEY") or os.getenv("SerpAPI")
    if not k or not str(k).strip():
        return None
    return str(k).strip()


def serpapi_duckduckgo_text_results(query: str, max_results: int = 8) -> tuple[list[dict[str, str]], str | None]:
    """
    DuckDuckGo organic results via SerpAPI (engine=duckduckgo).
    Returns (rows, error_message). rows match duckduckgo_text_results shape: title, body, href.
    """
    if not query or not str(query).strip():
        return [], "empty query"
    api_key = get_serpapi_key()
    if not api_key:
        return [], "SERPAPI_API_KEY is not set"

    try:
        resp = requests.get(
            SERPAPI_SEARCH_URL,
            params={
                "engine": "duckduckgo",
                "api_key": api_key,
                "q": str(query).strip(),
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return [], f"SerpAPI DuckDuckGo request failed: {e!s}"
    except Exception as e:
        return [], f"SerpAPI DuckDuckGo error: {e!s}"

    err = data.get("error")
    if err:
        return [], str(err)

    rows: list[dict[str, str]] = []
    for r in (data.get("organic_results") or [])[:max_results]:
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or "").strip()
        link = (r.get("link") or "").strip()
        if title or link:
            rows.append({"title": title, "body": snippet, "href": link})
    return rows, None


def _fmt_duration_minutes(m: Any) -> str:
    try:
        n = int(m)
    except (TypeError, ValueError):
        return ""
    if n <= 0:
        return ""
    h, mm = divmod(n, 60)
    if h and mm:
        return f"{h}h {mm}m"
    if h:
        return f"{h}h"
    return f"{mm}m"


def _summarize_flight_option(item: dict[str, Any], currency: str) -> tuple[str, str, str | None]:
    """Build title, snippet, optional link from one best_flights / other_flights entry."""
    flights = item.get("flights") or []
    price = item.get("price")
    try:
        price_s = f"{int(price)} {currency}" if price is not None else ""
    except (TypeError, ValueError):
        price_s = str(price) if price is not None else ""

    first = flights[0] if flights else {}
    last = flights[-1] if flights else {}
    dep = (first.get("departure_airport") or {}).get("id") or ""
    arr = (last.get("arrival_airport") or {}).get("id") or ""
    airline = (first.get("airline") or "").strip()
    total_d = _fmt_duration_minutes(item.get("total_duration"))
    stops = max(0, len(flights) - 1)
    trip_type = (item.get("type") or "").strip()

    title_parts = [p for p in (price_s, f"{dep}→{arr}" if dep and arr else None, airline or None) if p]
    title = " · ".join(title_parts) if title_parts else "Google Flights result"

    snip_bits = []
    if total_d:
        snip_bits.append(f"Duration {total_d}")
    snip_bits.append(f"{stops} stop(s)" if stops else "Nonstop")
    if trip_type:
        snip_bits.append(trip_type)
    snippet = " · ".join(snip_bits)

    link = None
    if isinstance(item.get("link"), str):
        link = item["link"].strip() or None
    return title, snippet, link


def serpapi_google_flights_scraped_rows(
    departure_id: str,
    arrival_id: str,
    outbound_date: str,
    return_date: str | None,
    max_options: int = 5,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Call SerpAPI engine=google_flights and return rows suitable for scrapedOptions (plus metadata).
    Each row: title, snippet, url, kind, sourceQuery.
    """
    api_key = get_serpapi_key()
    if not api_key:
        return [], "SERPAPI_API_KEY is not set"

    dep = (departure_id or "").strip().upper()[:3]
    arr = (arrival_id or "").strip().upper()[:3]
    ob = (outbound_date or "").strip()[:10]
    if len(dep) != 3 or len(arr) != 3:
        return [], "Need valid 3-letter IATA codes for SerpAPI Google Flights"
    if len(ob) != 10:
        return [], "Invalid outbound_date for Google Flights"

    currency = (os.getenv("TRAVEL_SERPAPI_CURRENCY") or "USD").strip() or "USD"
    params: dict[str, Any] = {
        "engine": "google_flights",
        "api_key": api_key,
        "departure_id": dep,
        "arrival_id": arr,
        "outbound_date": ob,
        "currency": currency,
        "hl": (os.getenv("TRAVEL_SERPAPI_HL") or "en").strip() or "en",
        "gl": (os.getenv("TRAVEL_SERPAPI_GL") or "us").strip() or "us",
        "adults": 1,
    }
    if return_date and len(str(return_date).strip()) >= 10:
        params["type"] = "1"
        params["return_date"] = str(return_date).strip()[:10]
    else:
        params["type"] = "2"

    deep = (os.getenv("TRAVEL_SERPAPI_DEEP_SEARCH") or "").strip().lower()
    if deep in ("1", "true", "yes"):
        params["deep_search"] = "true"

    try:
        resp = requests.get(SERPAPI_SEARCH_URL, params=params, timeout=45)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return [], f"SerpAPI Google Flights request failed: {e!s}"
    except Exception as e:
        return [], f"SerpAPI Google Flights error: {e!s}"

    err = data.get("error")
    if err:
        return [], str(err)

    gf_url = None
    meta = data.get("search_metadata") or {}
    if isinstance(meta.get("google_flights_url"), str):
        gf_url = meta["google_flights_url"].strip()

    options: list[dict[str, Any]] = []
    for bucket in ("best_flights", "other_flights"):
        for item in data.get(bucket) or []:
            if not isinstance(item, dict):
                continue
            title, snippet, link = _summarize_flight_option(item, currency)
            url = link or gf_url or ""
            options.append(
                {
                    "title": title[:300],
                    "snippet": snippet[:500],
                    "url": url[:2000] if url else "",
                    "kind": "flight",
                    "sourceQuery": f"google_flights:{dep}->{arr}:{ob}"[:200],
                    "serpapiEngine": "google_flights",
                }
            )
            if len(options) >= max_options:
                break
        if len(options) >= max_options:
            break

    if not options:
        return [], None

    return options, None
