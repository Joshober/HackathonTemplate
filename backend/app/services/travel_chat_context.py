"""Aggregate MongoDB-backed context for the travel copilot chat."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from bson import ObjectId

_MAX_JSON_CHARS = 14_000
_MAX_STR = 500
_MAX_LIST = 15


def _clip(s: str | None, n: int = _MAX_STR) -> str:
    if s is None:
        return ""
    t = " ".join(str(s).split())
    return t[:n] + ("…" if len(t) > n else "")


def _sanitize_value(val: Any, depth: int = 0) -> Any:
    if depth > 5:
        return None
    if val is None or isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        if isinstance(val, float) and (val != val):  # NaN
            return None
        return val
    if isinstance(val, str):
        return _clip(val, _MAX_STR)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, ObjectId):
        return str(val)
    if isinstance(val, dict):
        out: dict[str, Any] = {}
        for k, v in list(val.items())[:40]:
            if isinstance(k, str) and not k.startswith("$"):
                sk = _clip(k, 80)
                out[sk] = _sanitize_value(v, depth + 1)
        return out
    if isinstance(val, list):
        return [_sanitize_value(x, depth + 1) for x in val[:_MAX_LIST]]
    return _clip(str(val), 200)


def _travel_from_item(item: dict[str, Any]) -> dict[str, Any] | None:
    raw = item.get("travel")
    if isinstance(raw, dict):
        return raw
    desc = item.get("description")
    if isinstance(desc, str) and desc.startswith("__TRAVEL_JSON__"):
        try:
            return json.loads(desc[len("__TRAVEL_JSON__") :])
        except json.JSONDecodeError:
            return None
    return None


def _trip_summary(item: dict[str, Any], travel: dict[str, Any]) -> dict[str, Any]:
    snap = travel.get("travelPricingSnapshot")
    ev0: dict[str, Any] = {}
    if isinstance(snap, dict):
        evs = snap.get("events")
        if isinstance(evs, list) and evs and isinstance(evs[0], dict):
            ev0 = evs[0]
    be = travel.get("bookingEstimate") if isinstance(travel.get("bookingEstimate"), dict) else {}
    return {
        "itemRef": _clip(str(item.get("_id", "")), 32),
        "title": _clip(item.get("title"), 200),
        "location": _clip(travel.get("location"), 200),
        "opportunityStatus": _clip(travel.get("opportunityStatus"), 40),
        "tripType": _clip(travel.get("tripType"), 80),
        "tags": [_clip(str(t), 60) for t in (travel.get("tags") or []) if t][:10],
        "costEstimate": travel.get("costEstimate") if isinstance(travel.get("costEstimate"), (int, float)) else None,
        "startDate": _clip(travel.get("startDate"), 32),
        "endDate": _clip(travel.get("endDate"), 32),
        "bookingEstimate": _sanitize_value(be) if be else None,
        "topFlightLine": _clip(ev0.get("topFlightLine"), 300),
        "topHotelLine": _clip(ev0.get("topHotelLine"), 300),
        "destinationQuery": _clip(ev0.get("destinationQuery"), 200),
        "resolvedIata": ev0.get("resolvedIata"),
        "updatedAt": item.get("updatedAt").isoformat() if isinstance(item.get("updatedAt"), datetime) else None,
    }


def build_travel_chat_context(
    db,
    user_id: str,
    *,
    session_id: str | None = None,
    current_page: str | None = None,
    ui_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Load profile, items (travel), teams. Returns a JSON-serializable dict safe to embed in prompts.
    """
    ctx: dict[str, Any] = {
        "userId": _clip(user_id, 120),
        "sessionId": _clip(session_id, 80) if session_id else None,
        "currentPage": _clip(current_page, 120) if current_page else None,
        "profile": None,
        "preferences": {},
        "savedTrips": [],
        "activeTrip": None,
        "selectedFlight": None,
        "selectedHotel": None,
        "savedPlaces": [],
        "policyContext": {
            "note": "Confirm spend limits and approvals with your organization; this assistant gives general guidance only.",
        },
        "integrations": {"calendarConnected": False, "googleConnected": False},
        "teams": [],
        "recentActivity": [],
    }

    ui = ui_state if isinstance(ui_state, dict) else {}
    if ui.get("calendarConnected") is True:
        ctx["integrations"]["calendarConnected"] = True
    if ui.get("googleConnected") is True:
        ctx["integrations"]["googleConnected"] = True

    try:
        prof = db.profiles.find_one({"userId": user_id})
        if prof:
            ctx["profile"] = {
                "displayName": _clip(prof.get("displayName"), 120),
                "bio": _clip(prof.get("bio"), 400),
            }
    except Exception:
        pass

    trips: list[dict[str, Any]] = []
    active: dict[str, Any] | None = None
    try:
        cur = db.items.find({"userId": user_id}).sort("updatedAt", -1).limit(25)
        for item in cur:
            tr = _travel_from_item(item)
            if not tr:
                continue
            summ = _trip_summary(item, tr)
            trips.append(summ)
            st = (tr.get("opportunityStatus") or "").strip().lower()
            if st in ("approved", "submitted", "pending", "booked", "ready_for_approval") and active is None:
                active = summ
    except Exception:
        pass

    ctx["savedTrips"] = trips[:_MAX_LIST]
    ctx["activeTrip"] = active

    if trips:
        t0 = trips[0]
        if t0.get("topFlightLine"):
            ctx["selectedFlight"] = {"summary": t0["topFlightLine"], "tripRef": t0.get("itemRef")}
        if t0.get("topHotelLine"):
            ctx["selectedHotel"] = {"summary": t0["topHotelLine"], "tripRef": t0.get("itemRef")}

    places: list[str] = []
    for t in trips:
        loc = t.get("location")
        if loc and loc not in places:
            places.append(loc)
    ctx["savedPlaces"] = places[:12]

    tags_all: list[str] = []
    for t in trips:
        for x in t.get("tags") or []:
            if x and x not in tags_all:
                tags_all.append(x)
    ctx["preferences"] = {
        "travelTags": tags_all[:15],
        "inferredStyle": "business" if any("client" in (x or "").lower() for x in tags_all) else None,
    }

    try:
        team_cursor = db.teams.find({"memberIds": user_id}).limit(6)
        for tm in team_cursor:
            ctx["teams"].append(
                {
                    "name": _clip(tm.get("name"), 120),
                    "cityPresets": [_clip(c, 80) for c in (tm.get("cityPresets") or []) if c][:8],
                }
            )
    except Exception:
        pass

    ctx["recentActivity"] = [
        {"action": "context_loaded", "detail": f"{len(trips)} travel item(s) in app"},
    ]

    raw = json.dumps(ctx, default=str, ensure_ascii=False)
    if len(raw) > _MAX_JSON_CHARS:
        ctx["truncated"] = True
        ctx["savedTrips"] = ctx["savedTrips"][:8]
        ctx["teams"] = ctx["teams"][:3]
        raw = json.dumps(ctx, default=str, ensure_ascii=False)
        if len(raw) > _MAX_JSON_CHARS:
            ctx["savedTrips"] = ctx["savedTrips"][:5]
            ctx["teams"] = []
    return ctx


def context_used_flags(ctx: dict[str, Any]) -> dict[str, bool]:
    return {
        "hasProfile": bool(ctx.get("profile")),
        "hasSavedTrips": bool(ctx.get("savedTrips")),
        "hasActiveTrip": bool(ctx.get("activeTrip")),
        "hasPreferences": bool((ctx.get("preferences") or {}).get("travelTags")),
        "hasFlightHint": bool(ctx.get("selectedFlight")),
        "hasHotelHint": bool(ctx.get("selectedHotel")),
        "hasTeams": bool(ctx.get("teams")),
    }


def suggested_actions(ctx: dict[str, Any], mode: str | None) -> list[dict[str, str]]:
    """Lightweight UX hints — not model-generated."""
    out: list[dict[str, str]] = []
    if not ctx.get("savedTrips"):
        out.append(
            {
                "label": "Plan a trip",
                "prompt": "Walk me through starting a trip in the app: destination, dates, and what to enter in Plan.",
            }
        )
    if ctx.get("activeTrip"):
        out.append(
            {
                "label": "Refine this trip",
                "prompt": f"Given my current trip context, what should I lock next before booking?",
            }
        )
    else:
        out.append(
            {
                "label": "Estimate costs",
                "prompt": "Give a rough per-day cost band for a domestic client trip using my tags if any; estimates only.",
            }
        )
    if (mode or "").lower() == "analytics":
        out.append(
            {
                "label": "Compare options",
                "prompt": "Compare tradeoffs between economy vs flexible fares for my trip style (estimates).",
            }
        )
    return out[:5]
