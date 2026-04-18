from datetime import date

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.services.explorer_opportunities import (
    MAX_CITIES,
    MAX_PER_CITY_CAP,
    suggest_cities,
    split_valid_cities,
    travel_opportunities,
)

bp = Blueprint("explorer", __name__)
ALLOWED_SOURCES = frozenset({"ticketmaster", "duckduckgo", "openstreetmap"})
ALLOWED_SORTS = frozenset({"date", "relevance"})
ALLOWED_EVENT_TYPES = frozenset({"music", "sports", "arts", "film", "miscellaneous"})


def _parse_cities(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw:
        if not isinstance(x, str):
            continue
        s = " ".join(x.split())
        if s:
            out.append(s)
    return out[:MAX_CITIES]


def _parse_date(raw) -> str | None:
    s = " ".join(str(raw or "").split()).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s).isoformat()
    except ValueError:
        return None


def _parse_sources(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for v in raw:
        if not isinstance(v, str):
            continue
        s = v.strip().lower()
        if s in ALLOWED_SOURCES and s not in out:
            out.append(s)
    return out


def _parse_event_types(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for v in raw:
        if not isinstance(v, str):
            continue
        s = v.strip().lower()
        if s in ALLOWED_EVENT_TYPES and s not in out:
            out.append(s)
    return out


@bp.route("/explorer/cities/suggest", methods=["GET"])
@require_auth
def explorer_city_suggest(user_id):
    _ = user_id
    q = " ".join(str(request.args.get("q") or "").split()).strip()
    if len(q) < 2:
        return jsonify({"suggestions": []}), 200
    return jsonify({"suggestions": suggest_cities(q, max_results=6)}), 200


@bp.route("/explorer/opportunities", methods=["POST"])
@require_auth
def explorer_opportunities(user_id):
    """Travel opportunity hints (Ticketmaster API + DuckDuckGo fallback)."""
    _ = user_id
    body = request.get_json(silent=True) or {}
    cities = _parse_cities(body.get("cities"))
    query = " ".join(str(body.get("query") or "").split()).strip()
    if not cities and not query:
        return jsonify({"error": "Provide at least one city or a search query."}), 400

    valid_cities: list[str] = []
    if cities:
        valid_cities, invalid_cities = split_valid_cities(cities)
        if invalid_cities:
            return (
                jsonify(
                    {
                        "error": f"These locations are not recognized: {', '.join(invalid_cities)}",
                        "invalidCities": invalid_cities,
                    }
                ),
                400,
            )

    max_per = body.get("maxPerCity")
    try:
        max_per = int(max_per) if max_per is not None else 8
    except (TypeError, ValueError):
        max_per = 8
    max_per = max(1, min(max_per, MAX_PER_CITY_CAP))
    start_date = _parse_date(body.get("startDate"))
    end_date = _parse_date(body.get("endDate"))
    if body.get("startDate") and not start_date:
        return jsonify({"error": "startDate must be YYYY-MM-DD."}), 400
    if body.get("endDate") and not end_date:
        return jsonify({"error": "endDate must be YYYY-MM-DD."}), 400
    if start_date and end_date and start_date > end_date:
        return jsonify({"error": "startDate must be before or equal to endDate."}), 400
    sort_by = str(body.get("sortBy") or "date").strip().lower()
    if sort_by not in ALLOWED_SORTS:
        sort_by = "date"
    sources = _parse_sources(body.get("sources"))
    event_types = _parse_event_types(body.get("eventTypes"))
    max_price = body.get("maxPrice")
    if max_price is not None:
        try:
            max_price = float(max_price)
            if max_price < 0:
                return jsonify({"error": "maxPrice must be >= 0."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "maxPrice must be a number."}), 400

    opportunities = travel_opportunities(
        cities=valid_cities,
        query=query,
        max_per_city=max_per,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sources=sources or None,
        event_types=event_types or None,
        max_price=max_price,
    )

    return jsonify({"opportunities": opportunities}), 200
