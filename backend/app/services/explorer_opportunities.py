"""Travel opportunity search (Ticketmaster API + DuckDuckGo fallback)."""
import hashlib
import os
from typing import Any
from datetime import date

import requests

from app.services.web_search import duckduckgo_text_results
from app.services.link_preview import og_image_for_url

MAX_CITIES = 5
MAX_PER_CITY_CAP = 10
MAX_IMAGE_PREVIEWS = 12
TICKETMASTER_HOST = "https://app.ticketmaster.com/discovery/v2"
GEOCODE_HOST = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_HOST = "https://nominatim.openstreetmap.org/search"
OVERPASS_HOST = "https://overpass-api.de/api/interpreter"
_CITY_EXISTS_CACHE: dict[str, bool] = {}
ALLOWED_SOURCES = frozenset({"ticketmaster", "duckduckgo", "openstreetmap"})
ALLOWED_SORTS = frozenset({"date", "relevance"})
ALLOWED_EVENT_TYPES = frozenset({"music", "sports", "arts", "film", "miscellaneous"})


def _base_query() -> str:
    return "business conferences industry events networking"


def _result_id(url: str) -> str:
    h = hashlib.sha256(url.encode('utf-8', errors='replace')).hexdigest()
    return h[:24]


def _normalize_url(url: str) -> str:
    return (url or '').strip().lower().rstrip('/')


def _city_exists(city: str) -> bool:
    key = " ".join((city or "").split()).strip().lower()
    if not key:
        return False
    if key in _CITY_EXISTS_CACHE:
        return _CITY_EXISTS_CACHE[key]
    try:
        resp = requests.get(
            GEOCODE_HOST,
            params={"name": key, "count": 1, "language": "en", "format": "json"},
            timeout=6,
        )
        data = resp.json() if resp.ok else {}
        rows = data.get("results") if isinstance(data, dict) else None
        exists = isinstance(rows, list) and len(rows) > 0
    except Exception:
        # Fail open on network issues so search still works.
        exists = True
    _CITY_EXISTS_CACHE[key] = exists
    return exists


def split_valid_cities(cities: list[str]) -> tuple[list[str], list[str]]:
    valid: list[str] = []
    invalid: list[str] = []
    for city in cities or []:
        s = " ".join(str(city).split()).strip()
        if not s:
            continue
        if _city_exists(s):
            valid.append(s)
        else:
            invalid.append(s)
    return valid, invalid


def suggest_cities(query: str, max_results: int = 6) -> list[dict[str, str]]:
    q = " ".join((query or "").split()).strip()
    if not q:
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    tried_queries: list[str] = []

    def add_city(city: str, admin: str, country: str):
        if not city:
            return
        # Keep city-only values suitable for Ticketmaster's `city` param.
        city_clean = " ".join(city.split()).strip()
        if len(city_clean) < 2:
            return
        low_city = city_clean.lower()
        blocked = (" park", " stadium", " arena", " center", " theatre", " theater")
        if any(tok in low_city for tok in blocked):
            return
        label_parts = [city]
        if admin:
            label_parts.append(admin)
        if country:
            label_parts.append(country)
        label = ", ".join(label_parts)[:120]
        key = label.lower()
        if key in seen:
            return
        seen.add(key)
        out.append({"label": label, "city": city_clean[:80], "country": country[:80]})

    def query_variants(base: str) -> list[str]:
        variants = [base]
        low = base.lower()
        # Common typo patterns for city names.
        if "ei" in low:
            variants.append(low.replace("ei", "ie"))
        if "feild" in low:
            variants.append(low.replace("feild", "field"))
        # Handle split-word city typos like "spring field" -> "springfield".
        compact = " ".join(low.split()).replace(" ", "")
        if compact and compact != low:
            variants.append(compact)
        if "," not in low:
            variants.append(f"{low}, usa")
            variants.append(f"{low}, united states")
            if compact and compact != low:
                variants.append(f"{compact}, usa")
                variants.append(f"{compact}, united states")
        dedup: list[str] = []
        seen_local: set[str] = set()
        for v in variants:
            vv = " ".join(v.split()).strip()
            if not vv or vv in seen_local:
                continue
            seen_local.add(vv)
            dedup.append(vv)
        return dedup[:5]

    for qq in query_variants(q):
        tried_queries.append(qq)
        # Provider 1: Open-Meteo geocoding
        try:
            resp = requests.get(
                GEOCODE_HOST,
                params={"name": qq[:80], "count": max(1, min(max_results, 10)), "language": "en", "format": "json"},
                timeout=6,
            )
            data = resp.json() if resp.ok else {}
            rows = data.get("results") if isinstance(data, dict) else None
            if isinstance(rows, list):
                for r in rows:
                    if not isinstance(r, dict):
                        continue
                    fc = str(r.get("feature_code") or "").upper()
                    if fc and not (fc.startswith("PPL") or fc.startswith("ADM")):
                        continue
                    add_city((r.get("name") or "").strip(), (r.get("admin1") or "").strip(), (r.get("country") or "").strip())
                    if len(out) >= max_results:
                        return out[:max_results]
        except Exception:
            pass

        # Provider 2: OpenStreetMap Nominatim (maps API fallback; typo-tolerant)
        try:
            resp = requests.get(
                NOMINATIM_HOST,
                params={
                    "q": qq[:120],
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": max(1, min(max_results * 2, 12)),
                },
                headers={"User-Agent": "HackathonTemplate/1.0 (city-suggest)"},
                timeout=8,
            )
            rows = resp.json() if resp.ok else []
            if isinstance(rows, list):
                for r in rows:
                    if not isinstance(r, dict):
                        continue
                    addr = r.get("address") if isinstance(r.get("address"), dict) else {}
                    city = (
                        str(addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality") or "").strip()
                    )
                    if not city:
                        continue
                    admin = str(addr.get("state") or "").strip()
                    country = str(addr.get("country") or "").strip()
                    add_city(city, admin, country)
                    if len(out) >= max_results:
                        return out[:max_results]
        except Exception:
            pass

    return out[:max_results]


def _ticketmaster_key() -> str:
    return (os.getenv("TICKETMASTER_API_KEY") or "").strip()


def _ticketmaster_search(city: str | None, keyword: str | None, size: int) -> list[dict[str, Any]]:
    key = _ticketmaster_key()
    if not key:
        return []
    try:
        params = {
            "apikey": key,
            "size": max(1, min(size, MAX_PER_CITY_CAP)),
            "sort": "date,asc",
            "countryCode": "US",
        }
        if city:
            params["city"] = city[:120]
        if keyword:
            params["keyword"] = keyword[:120]
        resp = requests.get(
            f"{TICKETMASTER_HOST}/events.json",
            params=params,
            timeout=10,
        )
        data = resp.json() if resp.ok else {}
    except Exception:
        return []
    embedded = data.get("_embedded") if isinstance(data, dict) else {}
    events = embedded.get("events") if isinstance(embedded, dict) else []
    return [e for e in events if isinstance(e, dict)]


def _ticketmaster_search_filtered(
    city: str | None,
    keyword: str | None,
    size: int,
    start_date: str | None,
    end_date: str | None,
    sort_by: str,
) -> list[dict[str, Any]]:
    key = _ticketmaster_key()
    if not key:
        return []
    try:
        params: dict[str, Any] = {
            "apikey": key,
            "size": max(1, min(size, MAX_PER_CITY_CAP)),
            "sort": "date,asc" if sort_by == "date" else "relevance,desc",
            "countryCode": "US",
        }
        if city:
            params["city"] = city[:120]
        if keyword:
            params["keyword"] = keyword[:120]
        if start_date:
            params["startDateTime"] = f"{start_date}T00:00:00Z"
        if end_date:
            params["endDateTime"] = f"{end_date}T23:59:59Z"
        resp = requests.get(
            f"{TICKETMASTER_HOST}/events.json",
            params=params,
            timeout=10,
        )
        data = resp.json() if resp.ok else {}
    except Exception:
        return []
    embedded = data.get("_embedded") if isinstance(data, dict) else {}
    events = embedded.get("events") if isinstance(embedded, dict) else []
    return [e for e in events if isinstance(e, dict)]


def _pick_ticketmaster_image(event: dict[str, Any]) -> str | None:
    imgs = event.get("images")
    if not isinstance(imgs, list):
        return None
    best_url = None
    best_area = -1
    for im in imgs:
        if not isinstance(im, dict):
            continue
        url = (im.get("url") or "").strip()
        if not url:
            continue
        w = int(im.get("width") or 0)
        h = int(im.get("height") or 0)
        area = w * h
        if area > best_area:
            best_area = area
            best_url = url
    return best_url


def _ticketmaster_city_for_event(event: dict[str, Any], fallback_city: str | None) -> str:
    embedded = event.get("_embedded")
    if isinstance(embedded, dict):
        venues = embedded.get("venues")
        if isinstance(venues, list) and venues and isinstance(venues[0], dict):
            city_block = venues[0].get("city")
            if isinstance(city_block, dict):
                city_name = (city_block.get("name") or "").strip()
                if city_name:
                    return city_name[:200]
    return (fallback_city or "Other")[:200]


def _ticketmaster_event_type(event: dict[str, Any]) -> str | None:
    cls = event.get("classifications")
    if not isinstance(cls, list) or not cls or not isinstance(cls[0], dict):
        return None
    segment = cls[0].get("segment")
    if not isinstance(segment, dict):
        return None
    name = (segment.get("name") or "").strip().lower()
    if name in ALLOWED_EVENT_TYPES:
        return name
    return None


def _ticketmaster_event_matches(event: dict[str, Any], event_types: set[str], max_price: float | None) -> bool:
    if event_types:
        et = _ticketmaster_event_type(event)
        if not et or et not in event_types:
            return False
    if max_price is not None:
        ranges = event.get("priceRanges")
        if not isinstance(ranges, list) or not ranges or not isinstance(ranges[0], dict):
            return False
        minimum = ranges[0].get("min")
        try:
            min_price = float(minimum)
        except (TypeError, ValueError):
            return False
        if min_price > max_price:
            return False
    return True


def _city_coords(city: str) -> tuple[float, float] | None:
    try:
        resp = requests.get(
            GEOCODE_HOST,
            params={"name": city[:80], "count": 1, "language": "en", "format": "json"},
            timeout=6,
        )
        data = resp.json() if resp.ok else {}
        rows = data.get("results") if isinstance(data, dict) else None
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict):
            return None
        lat = float(rows[0].get("latitude"))
        lon = float(rows[0].get("longitude"))
        return lat, lon
    except Exception:
        return None


def _from_openstreetmap(city: str, query: str | None, max_per: int) -> list[dict]:
    coords = _city_coords(city)
    if not coords:
        return []
    lat, lon = coords
    q = (query or "").lower()
    wants_water = any(k in q for k in ("rafting", "whitewater", "kayak", "canoe", "river"))
    if wants_water:
        overpass_q = f"""
        [out:json][timeout:20];
        (
          nwr(around:35000,{lat},{lon})["sport"~"canoe|kayak|whitewater"];
          nwr(around:35000,{lat},{lon})["name"~"rafting|whitewater|kayak|canoe", i];
        );
        out center {max_per};
        """
    else:
        overpass_q = f"""
        [out:json][timeout:20];
        (
          nwr(around:25000,{lat},{lon})["tourism"="attraction"];
          nwr(around:25000,{lat},{lon})["leisure"];
          nwr(around:25000,{lat},{lon})["sport"];
        );
        out center {max_per};
        """
    try:
        resp = requests.post(OVERPASS_HOST, data=overpass_q, timeout=25)
        data = resp.json() if resp.ok else {}
    except Exception:
        return []
    elements = data.get("elements") if isinstance(data, dict) else None
    if not isinstance(elements, list):
        return []
    out: list[dict] = []
    for el in elements:
        if not isinstance(el, dict):
            continue
        tags = el.get("tags") if isinstance(el.get("tags"), dict) else {}
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        lat_c = el.get("lat") or (el.get("center") or {}).get("lat")
        lon_c = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat_c is None or lon_c is None:
            continue
        url = f"https://www.openstreetmap.org/?mlat={lat_c}&mlon={lon_c}#map=13/{lat_c}/{lon_c}"
        snippet = " | ".join(
            x for x in [str(tags.get("sport") or "").strip(), str(tags.get("leisure") or "").strip(), str(tags.get("tourism") or "").strip()] if x
        ) or f"Nearby activity in {city}"
        out.append(
            {
                "id": _result_id(url),
                "title": name[:500],
                "snippet": snippet[:800],
                "url": url[:2000],
                "city": city[:200],
                "source": "openstreetmap",
            }
        )
        if len(out) >= max_per:
            break
    return out


def _from_ticketmaster(
    city: str | None,
    max_per: int,
    query: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_by: str = "date",
    event_types: set[str] | None = None,
    max_price: float | None = None,
) -> list[dict]:
    rows: list[dict] = []
    if query:
        queries: tuple[str | None, ...] = (query, None)
    else:
        # Try business-oriented terms first, then broad city events.
        queries = ("conference", "networking", "expo", None)
    for q in queries:
        for ev in _ticketmaster_search_filtered(city, q, max_per, start_date, end_date, sort_by):
            if not _ticketmaster_event_matches(ev, event_types or set(), max_price):
                continue
            url = (ev.get("url") or "").strip()
            title = (ev.get("name") or "").strip() or url or "Untitled"
            when = ""
            dates = ev.get("dates")
            if isinstance(dates, dict):
                start = dates.get("start")
                if isinstance(start, dict):
                    local_date = start.get("localDate")
                    local_time = start.get("localTime")
                    when = " ".join(x for x in [str(local_date or "").strip(), str(local_time or "").strip()] if x).strip()
            venues = ""
            embedded = ev.get("_embedded")
            if isinstance(embedded, dict):
                v = embedded.get("venues")
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    venues = (v[0].get("name") or "").strip()
            snippet_parts = [p for p in [when, venues] if p]
            snippet = " | ".join(snippet_parts) if snippet_parts else f"Live event data for {city}"
            item = {
                "id": _result_id(url or f"{city or 'global'}:{title}"),
                "title": title[:500],
                "snippet": snippet[:800],
                "url": url[:2000],
                "city": _ticketmaster_city_for_event(ev, city),
                "source": "ticketmaster",
            }
            image = _pick_ticketmaster_image(ev)
            if image:
                item["imageUrl"] = image
            rows.append(item)
            if len(rows) >= max_per:
                return rows
    return rows


def _clean_date(value: str | None) -> str | None:
    v = " ".join(str(value or "").split()).strip()
    if not v:
        return None
    try:
        return date.fromisoformat(v).isoformat()
    except ValueError:
        return None


def travel_opportunities(
    cities: list[str] | None = None,
    query: str | None = None,
    max_per_city: int = 8,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_by: str = "date",
    sources: list[str] | None = None,
    event_types: list[str] | None = None,
    max_price: float | None = None,
) -> list[dict]:
    """
    Same shape as /api/explorer/opportunities: id, title, snippet, url, city.
    cities: plain names (e.g. 'Chicago'); capped at MAX_CITIES.
    query: optional event keyword. If no cities provided, this runs global search.
    """
    cleaned: list[str] = []
    for c in cities or []:
        s = ' '.join(str(c).split()).strip()
        if s:
            cleaned.append(s[:200])
    cleaned = cleaned[:MAX_CITIES]
    query_clean = " ".join(str(query or "").split()).strip()[:120]
    start_date_clean = _clean_date(start_date)
    end_date_clean = _clean_date(end_date)
    sort_clean = sort_by if sort_by in ALLOWED_SORTS else "date"
    source_set = {s for s in (sources or list(ALLOWED_SOURCES)) if s in ALLOWED_SOURCES}
    if not source_set:
        source_set = set(ALLOWED_SOURCES)
    event_type_set = {t for t in (event_types or []) if t in ALLOWED_EVENT_TYPES}
    max_price_clean: float | None = None
    if max_price is not None:
        try:
            max_price_clean = max(0.0, float(max_price))
        except (TypeError, ValueError):
            max_price_clean = None
    city_scopes: list[str | None] = cleaned if cleaned else [None]
    if not city_scopes and not query_clean:
        return []
    try:
        max_per = int(max_per_city)
    except (TypeError, ValueError):
        max_per = 8
    max_per = max(1, min(max_per, MAX_PER_CITY_CAP))

    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    opportunities: list[dict] = []
    for city in city_scopes:
        ticketmaster_rows = []
        if "ticketmaster" in source_set:
            ticketmaster_rows = _from_ticketmaster(
                city,
                max_per=max_per,
                query=query_clean or None,
                start_date=start_date_clean,
                end_date=end_date_clean,
                sort_by=sort_clean,
                event_types=event_type_set,
                max_price=max_price_clean,
            )
        city_ticketmaster_count = 0
        for r in ticketmaster_rows:
            url = (r.get("url") or "").strip()
            title = (r.get("title") or "").strip().lower()
            key = _normalize_url(url) if url else ""
            # Some APIs omit URLs; de-dupe by title as fallback.
            if key and key in seen_urls:
                continue
            if title and title in seen_titles:
                continue
            if key:
                seen_urls.add(key)
            if title:
                seen_titles.add(title)
            opportunities.append(r)
            city_ticketmaster_count += 1
            city_key = city or r.get("city") or "Other"
            if len([o for o in opportunities if o.get("city") == city_key]) >= max_per:
                break

        if city and "openstreetmap" in source_set:
            osm_rows = _from_openstreetmap(city, query_clean or None, max_per=max_per)
            for r in osm_rows:
                url = (r.get("url") or "").strip()
                title = (r.get("title") or "").strip().lower()
                key = _normalize_url(url) if url else ""
                if key and key in seen_urls:
                    continue
                if title and title in seen_titles:
                    continue
                if key:
                    seen_urls.add(key)
                if title:
                    seen_titles.add(title)
                opportunities.append(r)
                if len([o for o in opportunities if o.get("city") == city]) >= max_per:
                    break

        if city and len([o for o in opportunities if o.get("city") == city]) >= max_per:
            continue
        if city_ticketmaster_count > 0:
            continue
        if "duckduckgo" not in source_set:
            continue

        if city and query_clean:
            q = f"{query_clean} {city}"
        elif city:
            q = f"{_base_query()} {city}"
        elif query_clean:
            q = f"{query_clean} events"
        else:
            q = _base_query()
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
                    'city': (city or "Other")[:200],
                    'source': 'duckduckgo',
                }
            )
            if city and len([o for o in opportunities if o.get("city") == city]) >= max_per:
                break

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
        if o.get("imageUrl"):
            continue
        try:
            img = og_image_for_url(url, timeout=2.5)
        except Exception:
            img = None
        if img:
            o['imageUrl'] = img
            looked_up += 1

    return opportunities


def travel_opportunities_for_cities(cities: list[str], max_per_city: int = 8) -> list[dict]:
    """Backward-compatible wrapper for city-scoped search."""
    return travel_opportunities(cities=cities, max_per_city=max_per_city)
