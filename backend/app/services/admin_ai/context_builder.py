"""Normalize Mongo + request fields for Admin AI Solver (safe, bounded JSON)."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.services.pricing.pricing_admin_service import review_pricing_snapshot_flags
from app.services.weather_forecast import (
    evaluate_weather_fit,
    get_weather_for_destination_and_dates,
)

_MAX = 400
_CLIP_LIST = 20


def _clip(s: Any, n: int = _MAX) -> str:
    if s is None:
        return ""
    t = " ".join(str(s).split())
    return t[:n] + ("…" if len(t) > n else "")


def _oid(s: str | None) -> ObjectId | None:
    if not s or not isinstance(s, str):
        return None
    try:
        return ObjectId(s.strip())
    except InvalidId:
        return None


def _travel_from_item(item: dict) -> dict | None:
    t = item.get("travel")
    return t if isinstance(t, dict) else None


def build_admin_ai_context(
    db,
    *,
    admin_user_id: str,
    admin_email: str,
    current_page: str | None,
    selected_team_id: str | None,
    selected_trip_id: str | None,
    selected_date_range: dict | None,
    extra_ui: dict | None,
) -> dict[str, Any]:
    ctx: dict[str, Any] = {
        "adminUserId": _clip(admin_user_id, 80),
        "adminEmail": _clip(admin_email, 120),
        "currentPage": _clip(current_page, 120) if current_page else None,
        "selectedTeamId": _clip(selected_team_id, 32) if selected_team_id else None,
        "selectedTripId": _clip(selected_trip_id, 32) if selected_trip_id else None,
        "selectedDateRange": None,
        "team": None,
        "trip": None,
        "pricingReview": None,
        "weatherForTrip": None,
        "weatherFit": None,
        "replacementCandidates": None,
        "promptConfig": None,
        "recentAuditTail": [],
    }

    dr = selected_date_range if isinstance(selected_date_range, dict) else None
    if dr:
        ctx["selectedDateRange"] = {
            "start": _clip(dr.get("start"), 16),
            "end": _clip(dr.get("end"), 16),
        }

    # Optional prompt overrides from app_settings
    try:
        doc = db.app_settings.find_one({"_id": "admin_ai"}) or {}
        if isinstance(doc, dict):
            ctx["promptConfig"] = {
                "systemPromptExtra": _clip(doc.get("systemPromptExtra"), 2000) or None,
                "version": doc.get("version"),
            }
    except Exception:
        pass

    team_oid = _oid(selected_team_id)
    if team_oid:
        team = db.teams.find_one({"_id": team_oid})
        if team:
            mids = list(team.get("memberIds") or [])[:_CLIP_LIST]
            members = []
            manual_map = team.get("manualAvailability") if isinstance(team.get("manualAvailability"), dict) else {}
            budget_map = team.get("manualBudget") if isinstance(team.get("manualBudget"), dict) else {}
            for uid in mids:
                u = db.users.find_one({"userId": uid}) or {}
                p = db.profiles.find_one({"userId": uid}) or {}
                wins = manual_map.get(uid) if isinstance(manual_map, dict) else []
                if not isinstance(wins, list):
                    wins = []
                b = budget_map.get(uid) if isinstance(budget_map, dict) else {}
                members.append(
                    {
                        "userId": _clip(uid, 80),
                        "displayName": _clip(p.get("displayName") or u.get("name"), 80),
                        "email": _clip(u.get("email"), 120),
                        "manualWindows": wins[:12],
                        "budgetMin": (b or {}).get("min"),
                        "budgetMax": (b or {}).get("max"),
                    }
                )
            ctx["team"] = {
                "teamId": str(team_oid),
                "name": _clip(team.get("name"), 120),
                "memberCount": len(team.get("memberIds") or []),
                "members": members,
            }

            # Replacement heuristic if range present
            if dr and dr.get("start") and dr.get("end"):
                from app.services.team.team_admin_service import find_replacement_members

                ctx["replacementCandidates"] = find_replacement_members(
                    db,
                    str(team_oid),
                    str(dr.get("start"))[:10],
                    str(dr.get("end"))[:10],
                )

    trip_oid = _oid(selected_trip_id)
    if trip_oid:
        item = db.items.find_one({"_id": trip_oid})
        if item:
            tr = _travel_from_item(item) or {}
            ctx["trip"] = {
                "itemId": str(trip_oid),
                "title": _clip(item.get("title"), 200),
                "ownerUserId": _clip(item.get("userId"), 80),
                "teamId": str(item["teamId"]) if item.get("teamId") else None,
                "location": _clip(tr.get("location"), 200),
                "startDate": _clip(tr.get("startDate"), 32),
                "endDate": _clip(tr.get("endDate"), 32),
                "tripType": _clip(tr.get("tripType"), 80),
                "tags": [_clip(t, 60) for t in (tr.get("tags") or []) if t][:10],
                "activities": [_clip(t, 80) for t in (tr.get("activities") or []) if t][:15]
                if isinstance(tr.get("activities"), list)
                else [],
                "costEstimate": tr.get("costEstimate"),
                "costCurrency": tr.get("costCurrency"),
            }
            ctx["pricingReview"] = review_pricing_snapshot_flags(tr)
            dest = (tr.get("location") or tr.get("destinationQuery") or "").strip()
            sd = tr.get("startDate") or (dr or {}).get("start")
            ed = tr.get("endDate") or (dr or {}).get("end")
            if dest and sd and ed:
                wf = get_weather_for_destination_and_dates(dest, str(sd)[:10], str(ed)[:10])
                acts = []
                if isinstance(tr.get("activities"), list):
                    acts = [str(x) for x in tr.get("activities") if x][:12]
                elif isinstance(tr.get("tripType"), str):
                    acts = [tr["tripType"]]
                fit = evaluate_weather_fit(wf, acts)
                ctx["weatherForTrip"] = wf if wf.get("ok") else {"ok": False, "error": wf.get("error")}
                ctx["weatherFit"] = fit

    # Recent audit tail
    try:
        cur = (
            db.admin_ai_audit.find({})
            .sort("createdAt", -1)
            .limit(8)
        )
        for row in cur:
            ctx["recentAuditTail"].append(
                {
                    "action": _clip(row.get("action"), 80),
                    "actorEmail": _clip(row.get("actorEmail"), 80),
                    "createdAt": row["createdAt"].isoformat() if row.get("createdAt") else None,
                    "ok": row.get("ok"),
                }
            )
    except Exception:
        pass

    if isinstance(extra_ui, dict) and extra_ui:
        ctx["uiHints"] = {k: extra_ui[k] for k in list(extra_ui.keys())[:20]}

    return ctx


def context_summary_flags(ctx: dict) -> dict[str, bool]:
    return {
        "hasTeam": bool(ctx.get("team")),
        "hasTrip": bool(ctx.get("trip")),
        "hasWeather": bool(ctx.get("weatherForTrip", {}).get("ok")),
        "hasReplacementList": bool(ctx.get("replacementCandidates", {}).get("ok")),
    }
