"""Aggregate MongoDB-backed context for the travel copilot chat."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from bson import ObjectId

_MAX_DOC_CHARS = 3_000

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


def _find_trip_item(db, user_id: str, trip_id: str) -> dict[str, Any] | None:
    try:
        oid = ObjectId(trip_id)
    except Exception:
        return None
    try:
        return db.items.find_one({"_id": oid, "userId": user_id})
    except Exception:
        return None


def _item_to_trip_context(item: dict[str, Any]) -> dict[str, Any]:
    travel = _travel_from_item(item) or {}
    summary = _trip_summary(item, travel)
    return {
        "itemRef": summary.get("itemRef"),
        "title": summary.get("title"),
        "location": summary.get("location"),
        "opportunityStatus": summary.get("opportunityStatus"),
        "tripType": summary.get("tripType"),
        "tags": summary.get("tags"),
        "costEstimate": summary.get("costEstimate"),
        "startDate": summary.get("startDate"),
        "endDate": summary.get("endDate"),
        "bookingEstimate": summary.get("bookingEstimate"),
        "topFlightLine": summary.get("topFlightLine"),
        "topHotelLine": summary.get("topHotelLine"),
        "destinationQuery": summary.get("destinationQuery"),
        "resolvedIata": summary.get("resolvedIata"),
        "approval": _sanitize_value(travel.get("approval")) if isinstance(travel.get("approval"), dict) else None,
        "checklist": _sanitize_value(travel.get("checklist")) if isinstance(travel.get("checklist"), list) else [],
        "followUps": _sanitize_value(travel.get("followUps")) if isinstance(travel.get("followUps"), list) else [],
        "incidents": _sanitize_value(travel.get("incidents")) if isinstance(travel.get("incidents"), list) else [],
        "privacy": _sanitize_value(travel.get("privacy")) if isinstance(travel.get("privacy"), dict) else None,
        "updatedAt": summary.get("updatedAt"),
    }


def build_travel_chat_context(
    db,
    user_id: str,
    *,
    session_id: str | None = None,
    current_page: str | None = None,
    ui_state: dict[str, Any] | None = None,
    focused_trip_id: str | None = None,
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
    wanted_trip_id = (focused_trip_id or "").strip()
    try:
        cur = db.items.find({"userId": user_id}).sort("updatedAt", -1).limit(25)
        for item in cur:
            tr = _travel_from_item(item)
            if not tr:
                continue
            summ = _trip_summary(item, tr)
            trips.append(summ)
            if wanted_trip_id and str(item.get("_id")) == wanted_trip_id:
                active = summ
                continue
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


def build_trip_context(
    db,
    user_id: str,
    trip_id: str,
    *,
    session_id: str | None = None,
    current_page: str | None = None,
    ui_state: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    item = _find_trip_item(db, user_id, trip_id)
    if not item:
        return None

    base = build_travel_chat_context(
        db,
        user_id,
        session_id=session_id,
        current_page=current_page,
        ui_state=ui_state,
        focused_trip_id=trip_id,
    )
    trip = _item_to_trip_context(item)
    base["savedTrips"] = [trip]
    base["activeTrip"] = trip
    base["primaryTrip"] = trip
    if trip.get("topFlightLine"):
        base["selectedFlight"] = {"summary": trip["topFlightLine"], "tripRef": trip.get("itemRef")}
    if trip.get("topHotelLine"):
        base["selectedHotel"] = {"summary": trip["topHotelLine"], "tripRef": trip.get("itemRef")}
    base["contextQuality"] = _compute_context_quality(base)
    return base


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


def get_document_context(db, user_id: str) -> dict[str, Any] | None:
    """
    Fetch the most recently parsed travel documents for a user and return
    a compact, prompt-safe summary. Returns None if no documents found.
    """
    try:
        docs = list(
            db.tripDocuments.find({"userId": user_id})
            .sort("updatedAt", -1)
            .limit(3)
        )
    except Exception:
        return None

    if not docs:
        return None

    result: dict[str, Any] = {"documents": []}
    for doc in docs:
        extracted = doc.get("extracted")
        if not isinstance(extracted, dict):
            continue
        entry: dict[str, Any] = {
            "documentType": doc.get("documentType", "other"),
            "documentName": _clip(doc.get("documentName"), 100),
            "tripSummary": _clip(extracted.get("tripSummary"), 200),
            "destinations": [_clip(str(d), 80) for d in (extracted.get("destinations") or [])[:8]],
            "travelDates": extracted.get("travelDates"),
            "visaRequirements": [
                {k: _clip(str(v), 200) for k, v in vr.items()}
                for vr in (extracted.get("visaRequirements") or [])[:6]
                if isinstance(vr, dict)
            ],
            "risks": [_clip(str(r), 200) for r in (extracted.get("risks") or [])[:6]],
            "policyHighlights": [_clip(str(p), 200) for p in (extracted.get("policyHighlights") or [])[:6]],
            "flights": [
                {k: _clip(str(v), 100) for k, v in f.items()}
                for f in (extracted.get("flights") or [])[:5]
                if isinstance(f, dict)
            ],
            "hotels": [
                {k: _clip(str(v), 100) for k, v in h.items()}
                for h in (extracted.get("hotels") or [])[:4]
                if isinstance(h, dict)
            ],
            "layovers": [
                {k: _clip(str(v), 80) for k, v in lv.items()}
                for lv in (extracted.get("layovers") or [])[:4]
                if isinstance(lv, dict)
            ],
        }
        result["documents"].append(entry)

    if not result["documents"]:
        return None

    raw = json.dumps(result, ensure_ascii=False)
    if len(raw) > _MAX_DOC_CHARS:
        for entry in result["documents"]:
            entry.pop("flights", None)
            entry.pop("hotels", None)
            entry.pop("layovers", None)

    return result


def get_trip_contacts(db, user_id: str, trip_id: str) -> dict[str, Any] | None:
    item = _find_trip_item(db, user_id, trip_id)
    if not item:
        return None
    travel = _travel_from_item(item) or {}
    destination = _clip(travel.get("location"), 120)
    contacts = [
        {
            "type": "travel_desk",
            "label": "Travel Desk",
            "value": "travel-support@lockton-demo.local",
            "availability": "24/7 for disruption support",
        },
        {
            "type": "manager",
            "label": "Manager Approval Channel",
            "value": "manager@lockton-demo.local",
            "availability": "Business hours",
        },
        {
            "type": "emergency",
            "label": "Emergency Assistance",
            "value": "+1-800-555-0110",
            "availability": "24/7 emergency only",
        },
    ]
    if destination:
        contacts.append(
            {
                "type": "destination",
                "label": "Destination Support Note",
                "value": f"Keep hotel and airline support numbers handy for {destination}.",
                "availability": "Trip-specific guidance",
            }
        )
    return {"tripId": trip_id, "contacts": contacts}


def get_trip_reminders(db, user_id: str, trip_id: str) -> dict[str, Any] | None:
    item = _find_trip_item(db, user_id, trip_id)
    if not item:
        return None
    travel = _travel_from_item(item) or {}
    reminders: list[dict[str, Any]] = []
    for task in (travel.get("checklist") or [])[:10]:
        if isinstance(task, dict) and str(task.get("status") or "").lower() != "done":
            reminders.append(
                {
                    "id": str(task.get("id") or f"checklist-{len(reminders)+1}"),
                    "label": _clip(task.get("label"), 160),
                    "type": "pre_trip",
                    "status": "open",
                }
            )
    for task in (travel.get("followUps") or [])[:10]:
        if isinstance(task, dict) and str(task.get("status") or "").lower() == "open":
            reminders.append(
                {
                    "id": str(task.get("id") or f"followup-{len(reminders)+1}"),
                    "label": _clip(task.get("label"), 160),
                    "type": "post_trip",
                    "status": "open",
                    "dueDate": _clip(task.get("dueDate"), 32),
                }
            )
    if not reminders:
        reminders.append(
            {
                "id": "review-trip-context",
                "label": "Review trip details and confirm nothing critical is missing.",
                "type": "general",
                "status": "open",
            }
        )
    return {"tripId": trip_id, "reminders": reminders[:12]}


def get_trip_ai_sources(db, user_id: str, trip_id: str) -> dict[str, Any] | None:
    item = _find_trip_item(db, user_id, trip_id)
    if not item:
        return None
    travel = _travel_from_item(item) or {}
    sources: list[dict[str, Any]] = [
        {
            "sourceType": "trip_item",
            "label": _clip(item.get("title"), 160) or "Saved trip",
            "fields": [
                x
                for x, ok in (
                    ("destination", bool(travel.get("location"))),
                    ("dates", bool(travel.get("startDate") and travel.get("endDate"))),
                    ("costEstimate", isinstance(travel.get("costEstimate"), (int, float))),
                    ("approval", isinstance(travel.get("approval"), dict)),
                    ("checklist", isinstance(travel.get("checklist"), list) and bool(travel.get("checklist"))),
                    ("followUps", isinstance(travel.get("followUps"), list) and bool(travel.get("followUps"))),
                    ("incidents", isinstance(travel.get("incidents"), list) and bool(travel.get("incidents"))),
                )
                if ok
            ],
        }
    ]
    doc_ctx = get_document_context(db, user_id)
    for doc in (doc_ctx or {}).get("documents", []):
        if not isinstance(doc, dict):
            continue
        sources.append(
            {
                "sourceType": "parsed_document",
                "label": _clip(doc.get("documentName") or doc.get("documentType"), 160),
                "documentType": _clip(doc.get("documentType"), 40),
                "fields": [
                    x
                    for x, ok in (
                        ("tripSummary", bool(doc.get("tripSummary"))),
                        ("destinations", bool(doc.get("destinations"))),
                        ("travelDates", isinstance(doc.get("travelDates"), dict)),
                        ("visaRequirements", bool(doc.get("visaRequirements"))),
                        ("policyHighlights", bool(doc.get("policyHighlights"))),
                        ("risks", bool(doc.get("risks"))),
                    )
                    if ok
                ],
            }
        )
    return {"tripId": trip_id, "sources": sources}


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
