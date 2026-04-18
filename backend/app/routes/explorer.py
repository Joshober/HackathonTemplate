from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.services.explorer_opportunities import MAX_CITIES, MAX_PER_CITY_CAP, travel_opportunities_for_cities

bp = Blueprint("explorer", __name__)


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


@bp.route("/explorer/opportunities", methods=["POST"])
@require_auth
def explorer_opportunities(user_id):
    """DuckDuckGo-backed travel opportunity hints for one or more cities."""
    _ = user_id
    body = request.get_json(silent=True) or {}
    cities = _parse_cities(body.get("cities"))
    if not cities:
        return jsonify({"error": "Provide a non-empty cities array (e.g. [\"Chicago\", \"Austin\"])."}), 400

    max_per = body.get("maxPerCity")
    try:
        max_per = int(max_per) if max_per is not None else 8
    except (TypeError, ValueError):
        max_per = 8
    max_per = max(1, min(max_per, MAX_PER_CITY_CAP))

    opportunities = travel_opportunities_for_cities(cities, max_per_city=max_per)

    return jsonify({"opportunities": opportunities}), 200
