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
        "primaryTrip": None,
        "selectedFlight": None,
        "selectedHotel": None,
        "savedPlaces": [],
        "policyContext": {
            "note": "Confirm spend limits and approvals with your organization; this assistant gives general guidance only.",
            "checklist": [
                "Spend limits and class of service vs policy",
                "Pre-approval or manager sign-off if required",
                "Receipts and per-diem rules",
                "Insurance / duty of care for international legs",
            ],
        },
        "integrations": {"calendarConnected": False, "googleConnected": False},
        "teams": [],
        "recentActivity": [],
        "clientHints": {},
        "contextQuality": None,
        "privacy": {
            "redactionApplied": True,
            "retainedFields": [
                "displayName",
                "trip title",
                "destination",
                "trip dates",
                "trip status",
                "cost estimate",
                "team city presets",
            ],
            "excludedFields": [
                "passwords",
                "payment card numbers",
                "passport numbers",
                "raw auth tokens",
                "freeform private notes",
            ],
            "note": "Context is minimized before LLM use; only travel-planning-relevant fields are included.",
        },
    }

    ui = ui_state if isinstance(ui_state, dict) else {}
    if ui.get("calendarConnected") is True:
        ctx["integrations"]["calendarConnected"] = True
    if ui.get("googleConnected") is True:
        ctx["integrations"]["googleConnected"] = True
    for key in ("activeTeamId", "journeyStage", "focusedTripId"):
        raw = ui.get(key)
        if raw is not None and str(raw).strip():
            ctx["clientHints"][_clip(str(key), 40)] = _clip(str(raw), 120)

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
    ctx["primaryTrip"] = active if active else (trips[0] if trips else None)

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

    ctx["contextQuality"] = _compute_context_quality(ctx)

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


def _compute_context_quality(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Human-readable summary of how complete the user's trip context is + gaps to fill.
    Helps the model prioritize App context and ask one focused question when needed.
    """
    pt = ctx.get("primaryTrip") or ctx.get("activeTrip")
    if not isinstance(pt, dict):
        return {
            "summaryLine": "No saved travel items with trip metadata in app context.",
            "completeness": {
                "hasDestination": False,
                "hasDates": False,
                "hasCostEstimate": False,
                "hasFlightOrHotelHints": False,
                "hasApprovalOrStatus": False,
            },
            "gaps": ["Add or save a trip in Plan with destination and dates"],
        }

    loc = (pt.get("location") or "").strip()
    dq = (pt.get("destinationQuery") or "").strip()
    has_dest = bool(loc or dq)
    sd = (pt.get("startDate") or "").strip()
    ed = (pt.get("endDate") or "").strip()
    has_dates = bool(sd and ed)
    ce = pt.get("costEstimate")
    has_cost = isinstance(ce, (int, float))
    has_fh = bool(pt.get("topFlightLine") or pt.get("topHotelLine"))
    st = (pt.get("opportunityStatus") or "").strip()
    has_st = bool(st)

    gaps: list[str] = []
    if not has_dest:
        gaps.append("destination not set in saved trip")
    if not has_dates:
        gaps.append("start/end dates incomplete")
    if not has_cost and not (isinstance(pt.get("bookingEstimate"), dict) and pt.get("bookingEstimate")):
        gaps.append("no cost estimate in app context")
    if not has_fh:
        gaps.append("no flight/hotel snapshot lines in context")
    if not has_st:
        gaps.append("approval / trip status not shown in context")

    summary = _clip(pt.get("title"), 120) or "Saved trip"
    if loc:
        summary += f" → {_clip(loc, 80)}"
    elif dq:
        summary += f" → {_clip(dq, 80)}"
    if sd and ed:
        summary += f" ({sd} – {ed})"

    return {
        "tripRef": pt.get("itemRef"),
        "summaryLine": summary,
        "completeness": {
            "hasDestination": has_dest,
            "hasDates": has_dates,
            "hasCostEstimate": has_cost,
            "hasFlightOrHotelHints": has_fh,
            "hasApprovalOrStatus": has_st,
        },
        "gaps": gaps[:8] if gaps else [],
    }


def context_used_flags(ctx: dict[str, Any]) -> dict[str, bool]:
    cq = ctx.get("contextQuality") if isinstance(ctx.get("contextQuality"), dict) else {}
    comp = cq.get("completeness") if isinstance(cq.get("completeness"), dict) else {}
    return {
        "hasProfile": bool(ctx.get("profile")),
        "hasSavedTrips": bool(ctx.get("savedTrips")),
        "hasActiveTrip": bool(ctx.get("activeTrip")),
        "hasPrimaryTrip": bool(ctx.get("primaryTrip")),
        "hasPreferences": bool((ctx.get("preferences") or {}).get("travelTags")),
        "hasFlightHint": bool(ctx.get("selectedFlight")),
        "hasHotelHint": bool(ctx.get("selectedHotel")),
        "hasTeams": bool(ctx.get("teams")),
        "contextHasDestination": bool(comp.get("hasDestination")),
        "contextHasDates": bool(comp.get("hasDates")),
        "contextHasCost": bool(comp.get("hasCostEstimate")),
        "contextHasGaps": bool(cq.get("gaps")),
    }


def suggested_actions(ctx: dict[str, Any], mode: str | None) -> list[dict[str, str]]:
    """Lightweight UX hints — not model-generated."""
    out: list[dict[str, str]] = []
    cq = ctx.get("contextQuality") if isinstance(ctx.get("contextQuality"), dict) else {}
    gaps = cq.get("gaps") if isinstance(cq.get("gaps"), list) else []
    summ = (cq.get("summaryLine") or "").strip()

    if not ctx.get("savedTrips"):
        out.append(
            {
                "label": "Plan a trip",
                "prompt": "Walk me through starting a trip in the app: destination, dates, and what to enter in Plan.",
            }
        )
    elif ctx.get("activeTrip") or ctx.get("primaryTrip"):
        out.append(
            {
                "label": "Refine this trip",
                "prompt": "Given my saved trip in app context, what should I lock next before booking? End with one clear next step.",
            }
        )
        if gaps:
            out.append(
                {
                    "label": "Fill context gaps",
                    "prompt": f"My app context may be incomplete ({'; '.join(gaps[:3])}). What single detail should I add first and why?",
                }
            )
    else:
        out.append(
            {
                "label": "Estimate costs",
                "prompt": "Give a rough per-day cost band for a domestic client trip using my tags if any; label [Web search] vs [App context].",
            }
        )

    if summ and "→" in summ:
        out.append(
            {
                "label": "Sources for this trip",
                "prompt": f"For my trip ({summ}), separate what comes from [App context] vs anything you would get from [Web search]. End with a next step.",
            }
        )

    if (mode or "").lower() == "analytics":
        out.append(
            {
                "label": "Compare options",
                "prompt": "Compare tradeoffs between economy vs flexible fares for my trip style (estimates). Flag missing data.",
            }
        )
    elif (mode or "").lower() == "personal_assistant":
        out.append(
            {
                "label": "Next step checklist",
                "prompt": "From my app context, give a 3-item checklist and the single most important next action before I travel.",
            }
        )

    return out[:6]
