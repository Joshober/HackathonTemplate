from datetime import date, datetime, timezone, timedelta
from typing import Any

from flask import Blueprint, jsonify, request

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.services.google_calendar import fetch_google_freebusy, get_google_calendar_token_doc
from app.services.explorer_opportunities import (
    expand_event_options,
    _parse_iso_dt,
    MAX_CITIES,
    MAX_PER_CITY_CAP,
    filter_opportunities_by_busy,
    suggest_cities,
    split_valid_cities,
    travel_opportunities,
)
from app.services.team_items_access import parse_team_oid, user_member_of_team
from app.services.amadeus_client import client_or_none as amadeus_client_or_none, summarize_flight_offer
from app.services.duffel_client import client_or_none as duffel_client_or_none, summarize_duffel_offer

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


def _parse_datetime(raw) -> str | None:
    s = " ".join(str(raw or "").split()).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def _parse_iso_day(raw) -> str | None:
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


def _parse_bool(raw) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        v = raw.strip().lower()
        if v in {"1", "true", "yes", "on"}:
            return True
        if v in {"0", "false", "no", "off"}:
            return False
    return False


def _estimate_ticket_cost(opportunity: dict[str, Any]) -> float:
    snippet = str(opportunity.get("snippet") or "")
    nums = []
    cur = ""
    for ch in snippet:
        if ch.isdigit() or ch == ".":
            cur += ch
        else:
            if cur:
                try:
                    nums.append(float(cur))
                except ValueError:
                    pass
                cur = ""
    if cur:
        try:
            nums.append(float(cur))
        except ValueError:
            pass
    likely = [n for n in nums if 10 <= n <= 5000]
    return likely[0] if likely else 120.0


def _build_event_option_rows(opportunities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups = expand_event_options(opportunities)
    rows: list[dict[str, Any]] = []
    for g in groups:
        for opt in g.get("options") or []:
            rows.append(
                {
                    "eventKey": g.get("eventKey"),
                    "optionId": opt.get("optionId"),
                    "sourceEventId": opt.get("sourceEventId"),
                    "title": g.get("title"),
                    "city": g.get("city"),
                    "source": g.get("source"),
                    "url": g.get("url"),
                    "imageUrl": g.get("imageUrl"),
                    "snippet": g.get("snippet"),
                    "startAt": opt.get("startAt"),
                    "endAt": opt.get("endAt"),
                }
            )
    rows.sort(key=lambda r: (str(r.get("city") or ""), str(r.get("startAt") or "")))
    return rows


def _option_availability(
    option: dict[str, Any],
    member_ids: list[str],
    busy_by_user: dict[str, list[tuple[datetime, datetime]]],
    manual_available_by_user: dict[str, list[tuple[datetime, datetime]]],
) -> dict[str, Any]:
    start = _parse_iso_dt(option.get("startAt"))
    if not start:
        return {
            "availableCount": 0,
            "totalMembers": len(member_ids),
            "conflictMemberIds": member_ids,
            "availabilityScore": 0.0,
            "meetsMajority": False,
        }
    end = _parse_iso_dt(option.get("endAt")) or (start + timedelta(hours=2))
    available = 0
    conflicts = []
    for uid in member_ids:
        if uid in manual_available_by_user:
            windows = manual_available_by_user.get(uid) or []
            ok = any(start < w_end and w_start < end for (w_start, w_end) in windows)
            if ok:
                available += 1
            else:
                conflicts.append(uid)
            continue
        blocks = busy_by_user.get(uid) or []
        conflict = any(start < b_end and b_start < end for (b_start, b_end) in blocks)
        if conflict:
            conflicts.append(uid)
        else:
            available += 1
    total = len(member_ids)
    score = (available / total) if total else 0.0
    return {
        "availableCount": available,
        "totalMembers": total,
        "conflictMemberIds": conflicts,
        "availabilityScore": round(score, 4),
        "meetsMajority": available >= max(1, (total // 2) + 1) if total else False,
    }


def _try_live_cost(city: str, start_day: str | None) -> dict[str, Any]:
    # Live-first pricing: try Amadeus, then Duffel, fallback estimate.
    estimate = {"mode": "estimate", "flightTotal": 420.0, "hotelTotal": 360.0, "ticketEstimate": 120.0}
    if not city or not start_day:
        return estimate
    amadeus = amadeus_client_or_none()
    duffel = duffel_client_or_none()
    origin = "ORD"
    if amadeus:
        try:
            code, _ = amadeus.resolve_iata(city)
            if code:
                offers = amadeus.flight_offers(origin, code, start_day, None, adults=1, max_offers=1)
                if offers:
                    s = summarize_flight_offer(offers[0])
                    f = float(s.get("grandTotal") or 0) if s.get("grandTotal") else 0.0
                    return {"mode": "live_amadeus", "flightTotal": f or 420.0, "hotelTotal": 360.0}
        except Exception:
            pass
    if duffel:
        try:
            code, _ = duffel.suggest_airport_iata(city)
            if code:
                offers = duffel.search_flight_offers(origin, code, start_day, None, adults=1, max_offers=1)
                if offers:
                    s = summarize_duffel_offer(offers[0])
                    f = float(s.get("grandTotal") or 0) if s.get("grandTotal") else 0.0
                    return {"mode": "live_duffel", "flightTotal": f or 420.0, "hotelTotal": 360.0}
        except Exception:
            pass
    return estimate


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
    require_all_members_free = _parse_bool(body.get("requireAllMembersFree"))
    team_id = " ".join(str(body.get("teamId") or "").split()).strip()
    availability_start = _parse_datetime(body.get("availabilityWindowStart"))
    availability_end = _parse_datetime(body.get("availabilityWindowEnd"))
    if body.get("availabilityWindowStart") and not availability_start:
        return jsonify({"error": "availabilityWindowStart must be an ISO datetime."}), 400
    if body.get("availabilityWindowEnd") and not availability_end:
        return jsonify({"error": "availabilityWindowEnd must be an ISO datetime."}), 400
    if availability_start and availability_end and availability_start >= availability_end:
        return jsonify({"error": "availabilityWindowStart must be before availabilityWindowEnd."}), 400
    if require_all_members_free and not team_id:
        return jsonify({"error": "teamId is required when requireAllMembersFree is enabled."}), 400

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

    availability_coverage = None
    member_ids: list[str] = []
    busy_by_user: dict[str, list[tuple[datetime, datetime]]] = {}
    manual_available_by_user: dict[str, list[tuple[datetime, datetime]]] = {}
    if team_id:
        db = get_db()
        team_oid = parse_team_oid(team_id)
        if not team_oid or not user_member_of_team(db, user_id, team_oid):
            return jsonify({"error": "Invalid teamId or not a team member."}), 403
        team = db.teams.find_one({"_id": team_oid}) or {}
        member_ids = [m for m in (team.get("memberIds") or []) if isinstance(m, str) and m.strip()]
        connected_ids = []
        manual_map = team.get("manualAvailability") if isinstance(team.get("manualAvailability"), dict) else {}
        manual_ids = []
        for uid in member_ids:
            token_doc = get_google_calendar_token_doc(db, uid)
            if token_doc and (token_doc.get("accessToken") or token_doc.get("refreshToken")):
                connected_ids.append(uid)
            windows = manual_map.get(uid) if isinstance(manual_map, dict) else None
            if isinstance(windows, list) and len(windows) > 0:
                manual_ids.append(uid)
        availability_coverage = {
            "teamId": team_id,
            "totalMembers": len(member_ids),
            "connectedMembers": len(connected_ids),
            "manualAvailabilityMembers": len(manual_ids),
            "requireAllMembersFree": require_all_members_free,
        }
        if require_all_members_free and (connected_ids or manual_ids) and availability_start and availability_end:
            for uid in connected_ids:
                blocks = fetch_google_freebusy(db, uid, availability_start, availability_end)
                busy_by_user[uid] = blocks
            for uid in member_ids:
                windows = manual_map.get(uid) if isinstance(manual_map, dict) else None
                if not isinstance(windows, list) or not windows:
                    continue
                parsed = []
                for w in windows:
                    if not isinstance(w, dict):
                        continue
                    start_day = _parse_iso_day(w.get("startDate"))
                    end_day = _parse_iso_day(w.get("endDate"))
                    if not start_day or not end_day or start_day > end_day:
                        continue
                    start_dt = datetime.fromisoformat(f"{start_day}T00:00:00+00:00")
                    end_dt = datetime.fromisoformat(f"{end_day}T23:59:59+00:00")
                    parsed.append((start_dt.astimezone(timezone.utc), end_dt.astimezone(timezone.utc)))
                if parsed:
                    manual_available_by_user[uid] = parsed
            opportunities, stats = filter_opportunities_by_busy(
                opportunities=opportunities,
                busy_by_user=busy_by_user,
                require_all_members_free=True,
                exclude_unknown_event_times=True,
                available_by_user=manual_available_by_user,
                required_user_ids=member_ids,
            )
            availability_coverage.update(stats)
    event_options = _build_event_option_rows(opportunities)
    enriched_options = []
    for opt in event_options:
        a = _option_availability(opt, member_ids, busy_by_user, manual_available_by_user) if member_ids else {
            "availableCount": 0,
            "totalMembers": 0,
            "conflictMemberIds": [],
            "availabilityScore": 0.0,
            "meetsMajority": True,
        }
        if member_ids and not a.get("meetsMajority"):
            continue
        start_day = None
        dt = _parse_iso_dt(opt.get("startAt"))
        if dt:
            start_day = dt.date().isoformat()
        live_cost = _try_live_cost(str(opt.get("city") or ""), start_day)
        ticket_est = _estimate_ticket_cost(opt)
        total_cost = float(live_cost.get("flightTotal") or 0) + float(live_cost.get("hotelTotal") or 0) + ticket_est
        enriched_options.append(
            {
                **opt,
                "availability": a,
                "cost": {
                    **live_cost,
                    "ticketEstimate": ticket_est,
                    "totalEstimated": round(total_cost, 2),
                },
            }
        )
    enriched_options.sort(
        key=lambda o: (
            -(o.get("availability") or {}).get("availabilityScore", 0),
            (o.get("cost") or {}).get("totalEstimated", 999999),
        )
    )
    top_options = enriched_options[:30]
    packages = []
    for i, opt in enumerate(top_options[:6]):
        packages.append(
            {
                "packageId": f"pkg-{i+1}",
                "title": f"{opt.get('title')} package",
                "city": opt.get("city"),
                "options": [opt],
                "availability": opt.get("availability"),
                "cost": opt.get("cost"),
                "score": round(
                    ((opt.get("availability") or {}).get("availabilityScore", 0) * 100)
                    - float((opt.get("cost") or {}).get("totalEstimated", 0) / 100),
                    3,
                ),
            }
        )
    return jsonify(
        {
            "opportunities": opportunities,
            "availabilityCoverage": availability_coverage,
            "eventOptions": top_options,
            "itineraryPackages": packages,
        }
    ), 200
