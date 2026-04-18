"""SerpAPI helpers for Travelbot scrape: Google Flights, Google Hotels, DuckDuckGo (via SerpAPI engines)."""

from __future__ import annotations

import os
import re
from typing import Any

import requests

SERPAPI_SEARCH_URL = "https://serpapi.com/search"


def get_serpapi_key() -> str | None:
    k = os.getenv("SERPAPI_API_KEY") or os.getenv("SerpAPI")
    if not k or not str(k).strip():
        return None
    return str(k).strip()


_ENV_ON = frozenset({"1", "true", "yes"})


def _serpapi_scrape_flag() -> bool:
    return (os.getenv("TRAVEL_SERPAPI_SCRAPE") or "").strip().lower() in _ENV_ON


def serpapi_google_hotels_enabled() -> bool:
    """
    Needs SERPAPI_API_KEY and either TRAVEL_SERPAPI_GOOGLE_HOTELS=1 or TRAVEL_SERPAPI_SCRAPE=1
    (same key as Google Flights scrape).
    """
    if not get_serpapi_key():
        return False
    if (os.getenv("TRAVEL_SERPAPI_GOOGLE_HOTELS") or "").strip().lower() in _ENV_ON:
        return True
    return _serpapi_scrape_flag()


def parse_duration_to_minutes(text: str) -> int | None:
    """Parse strings like '1 hr 15 min', '58 min', '2 hr 22 min'."""
    if not text:
        return None
    t = text.replace("\u202f", " ").replace("\xa0", " ").lower()
    hr_m = re.search(r"(\d+)\s*(?:hr|hour|hours)\b", t)
    mn_m = re.search(r"(\d+)\s*(?:min|minutes?)\b", t)
    total = 0
    if hr_m:
        total += int(hr_m.group(1)) * 60
    if mn_m:
        total += int(mn_m.group(1))
    return total if total > 0 else None


def _distance_from_property(prop: dict[str, Any]) -> tuple[int | None, str]:
    """Use Google Hotels nearby_places transit durations; return (avg minutes, short hint)."""
    nearby = prop.get("nearby_places") or []
    mins: list[int] = []
    hints: list[str] = []
    for place in nearby[:4]:
        if not isinstance(place, dict):
            continue
        pname = (place.get("name") or "").strip()[:48]
        for tr in (place.get("transportations") or [])[:3]:
            if not isinstance(tr, dict):
                continue
            dur_s = (tr.get("duration") or "").strip()
            typ = (tr.get("type") or "").strip()
            m = parse_duration_to_minutes(dur_s)
            if m is not None:
                mins.append(m)
            if dur_s and typ:
                hints.append(f"{typ} {dur_s} ({pname})" if pname else f"{typ} {dur_s}")
    if not mins:
        return None, ""
    return int(round(sum(mins) / len(mins))), "; ".join(hints[:3])


def serpapi_google_hotels_offer_rows(
    destination_query: str,
    check_in: str,
    check_out: str,
    adults: int = 1,
    max_properties: int = 10,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    engine=google_hotels → rows compatible with travel_pricing hotel offers
    (hotelName, total, currency, checkIn, checkOut, hotelId, boardType, distanceMinutes, distanceHint, listingUrl).
    """
    api_key = get_serpapi_key()
    if not api_key:
        return [], "SERPAPI_API_KEY is not set"

    q = (destination_query or "").strip()[:200]
    ob = (check_in or "").strip()[:10]
    ib = (check_out or "").strip()[:10]
    if len(ob) != 10 or len(ib) != 10:
        return [], "Invalid check-in or check-out date for Google Hotels"
    if not q:
        return [], "Missing destination for Google Hotels"

    currency = (os.getenv("TRAVEL_SERPAPI_CURRENCY") or "USD").strip() or "USD"
    params: dict[str, Any] = {
        "engine": "google_hotels",
        "api_key": api_key,
        "q": q,
        "check_in_date": ob,
        "check_out_date": ib,
        "currency": currency,
        "hl": (os.getenv("TRAVEL_SERPAPI_HL") or "en").strip() or "en",
        "gl": (os.getenv("TRAVEL_SERPAPI_GL") or "us").strip() or "us",
        "adults": max(1, min(int(adults or 1), 9)),
        "sort_by": "3",
    }

    try:
        resp = requests.get(SERPAPI_SEARCH_URL, params=params, timeout=50)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return [], f"SerpAPI Google Hotels request failed: {e!s}"
    except Exception as e:
        return [], f"SerpAPI Google Hotels error: {e!s}"

    err = data.get("error")
    if err:
        return [], str(err)

    meta = data.get("search_metadata") or {}
    fallback_url = ""
    if isinstance(meta.get("google_hotels_url"), str):
        fallback_url = meta["google_hotels_url"].strip()[:2000]

    offers: list[dict[str, Any]] = []
    for prop in (data.get("properties") or [])[:max_properties]:
        if not isinstance(prop, dict):
            continue
        name = (prop.get("name") or "Hotel").strip()[:240]
        ptype = (prop.get("type") or "").strip()
        token = (prop.get("property_token") or "")[:120]
        listing = (prop.get("link") or "").strip()[:2000]
        if not listing and isinstance(prop.get("serpapi_property_details_link"), str):
            listing = prop["serpapi_property_details_link"].strip()[:2000]
        if not listing:
            listing = fallback_url

        tr = prop.get("total_rate") if isinstance(prop.get("total_rate"), dict) else {}
        rn = prop.get("rate_per_night") if isinstance(prop.get("rate_per_night"), dict) else {}
        ext_total = tr.get("extracted_lowest")
        if ext_total is None:
            ext_total = rn.get("extracted_lowest")
        total_s = tr.get("lowest") or rn.get("lowest")
        if ext_total is not None:
            total_out = str(ext_total)
        elif total_s is not None:
            ts = str(total_s).strip()
            total_out = ts.lstrip("$").strip() or ts
        else:
            p = (prop.get("price") or "").strip()
            total_out = p.lstrip("$").strip() or "—"

        dist_min, dist_hint = _distance_from_property(prop)

        offers.append(
            {
                "hotelId": token or None,
                "hotelName": f"{name}" + (f" ({ptype})" if ptype else ""),
                "checkIn": ob,
                "checkOut": ib,
                "total": total_out,
                "currency": currency,
                "boardType": "google_hotels",
                "distanceMinutes": dist_min,
                "distanceHint": dist_hint[:500] if dist_hint else None,
                "listingUrl": listing or None,
                "source": "serpapi_google_hotels",
            }
        )

    if not offers:
        return [], None

    return offers, None


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
