"""
Admin-only team mutations and coverage helpers.
Regular members use routes in teams.py; these functions enforce admin email.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.services.google_calendar import is_range_free_on_google_calendar
from app.services.roles import is_admin_email


def _parse_oid(team_id: str) -> ObjectId | None:
    try:
        return ObjectId(team_id)
    except InvalidId:
        return None


def _normalize_windows(raw: list) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if not isinstance(raw, list):
        return out
    for row in raw:
        if not isinstance(row, dict):
            continue
        try:
            sd = date.fromisoformat(str(row.get("startDate") or "")[:10])
            ed = date.fromisoformat(str(row.get("endDate") or "")[:10])
        except ValueError:
            continue
        if sd > ed:
            continue
        out.append({"startDate": sd.isoformat(), "endDate": ed.isoformat()})
        if len(out) >= 24:
            break
    return out


def _window_overlaps_range(w_start: date, w_end: date, r_start: date, r_end: date) -> bool:
    return w_start <= r_end and w_end >= r_start


def remove_team_member_as_admin(
    db,
    team_id: str,
    target_user_id: str,
    admin_email: str,
) -> dict[str, Any]:
    """Remove another user from the team. Admin only."""
    em = (admin_email or "").strip().lower()
    if not is_admin_email(em):
        return {"ok": False, "error": "Admin access required"}
    oid = _parse_oid(team_id)
    if not oid:
        return {"ok": False, "error": "Invalid team id"}
    tid = (target_user_id or "").strip()
    if not tid:
        return {"ok": False, "error": "target user required"}
    team = db.teams.find_one({"_id": oid})
    if not team:
        return {"ok": False, "error": "Team not found"}
    mids = team.get("memberIds") or []
    if tid not in mids:
        return {"ok": False, "error": "User is not a member of this team"}
    db.teams.update_one(
        {"_id": oid},
        {"$pull": {"memberIds": tid}, "$set": {"updatedAt": datetime.utcnow()}},
    )
    # Clear stored availability for removed member (optional hygiene)
    db.teams.update_one(
        {"_id": oid},
        {"$unset": {f"manualAvailability.{tid}": "", f"manualBudget.{tid}": ""}},
    )
    return {"ok": True, "teamId": team_id, "removedUserId": tid}


def update_team_member_availability_as_admin(
    db,
    team_id: str,
    target_user_id: str,
    windows: list,
    admin_email: str,
) -> dict[str, Any]:
    """Set manual availability windows for a member. Admin only."""
    em = (admin_email or "").strip().lower()
    if not is_admin_email(em):
        return {"ok": False, "error": "Admin access required"}
    oid = _parse_oid(team_id)
    if not oid:
        return {"ok": False, "error": "Invalid team id"}
    tid = (target_user_id or "").strip()
    if not tid:
        return {"ok": False, "error": "target user required"}
    team = db.teams.find_one({"_id": oid})
    if not team:
        return {"ok": False, "error": "Team not found"}
    mids = team.get("memberIds") or []
    if tid not in mids:
        return {"ok": False, "error": "User is not a member of this team"}
    norm = _normalize_windows(windows)
    db.teams.update_one(
        {"_id": oid},
        {
            "$set": {
                f"manualAvailability.{tid}": norm,
                "updatedAt": datetime.utcnow(),
            }
        },
    )
    return {"ok": True, "teamId": team_id, "userId": tid, "windows": norm}


def find_replacement_members(
    db,
    team_id: str,
    range_start: str,
    range_end: str,
    unavailable_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Coverage suggestions for a date range:
    1) Google Calendar FreeBusy when the member has connected Calendar (authoritative when returned).
    2) Else manual availability windows from the team document.
    3) Else unknown (still listed for manual follow-up).
    """
    oid = _parse_oid(team_id)
    if not oid:
        return {"ok": False, "error": "Invalid team id", "candidates": []}
    try:
        rs = date.fromisoformat(range_start[:10])
        re = date.fromisoformat(range_end[:10])
    except ValueError:
        return {"ok": False, "error": "Invalid date range", "candidates": []}
    if re < rs:
        re = rs

    team = db.teams.find_one({"_id": oid})
    if not team:
        return {"ok": False, "error": "Team not found", "candidates": []}

    manual_map = team.get("manualAvailability") if isinstance(team.get("manualAvailability"), dict) else {}
    mids: list[str] = list(team.get("memberIds") or [])
    u_avoid = (unavailable_user_id or "").strip()

    strong: list[dict[str, Any]] = []
    weak: list[dict[str, Any]] = []
    sources_used: set[str] = set()

    for uid in mids:
        if uid == u_avoid:
            continue
        udoc = db.users.find_one({"userId": uid}) or {}
        prof = db.profiles.find_one({"userId": uid}) or {}
        name = (prof.get("displayName") or udoc.get("name") or "").strip() or None
        email = (udoc.get("email") or "").strip() or None

        cal_free = is_range_free_on_google_calendar(db, uid, rs, re)
        if cal_free is not None:
            sources_used.add("google_calendar")
            if cal_free:
                strong.append(
                    {
                        "userId": uid,
                        "displayName": name,
                        "email": email,
                        "reason": "Google Calendar shows no busy blocks overlapping these dates (primary).",
                        "fit": "likely_available",
                        "source": "google_calendar",
                    }
                )
            else:
                weak.append(
                    {
                        "userId": uid,
                        "displayName": name,
                        "email": email,
                        "reason": "Google Calendar shows busy time overlapping these dates.",
                        "fit": "likely_busy",
                        "source": "google_calendar",
                    }
                )
            continue

        wins = manual_map.get(uid) if isinstance(manual_map, dict) else None
        if not isinstance(wins, list) or not wins:
            weak.append(
                {
                    "userId": uid,
                    "displayName": name,
                    "email": email,
                    "reason": "No Calendar connected and no manual availability—verify directly.",
                    "fit": "unknown_availability",
                    "source": "manual",
                }
            )
            sources_used.add("manual")
            continue
        ok = False
        for w in wins:
            if not isinstance(w, dict):
                continue
            try:
                ws = date.fromisoformat(str(w.get("startDate") or "")[:10])
                we = date.fromisoformat(str(w.get("endDate") or "")[:10])
            except ValueError:
                continue
            if _window_overlaps_range(ws, we, rs, re):
                ok = True
                break
        sources_used.add("manual")
        row = {
            "userId": uid,
            "displayName": name,
            "email": email,
            "reason": (
                "Manual availability overlaps the requested window."
                if ok
                else "No overlapping manual window for these dates."
            ),
            "fit": "likely_available" if ok else "likely_busy",
            "source": "manual",
        }
        if ok:
            strong.append(row)
        else:
            weak.append(row)

    src = "mixed"
    if sources_used == {"google_calendar"}:
        src = "google_calendar"
    elif sources_used == {"manual"}:
        src = "manual"

    return {
        "ok": True,
        "teamId": team_id,
        "range": {"start": rs.isoformat(), "end": re.isoformat()},
        "likelyAvailable": strong,
        "otherMembers": weak,
        "coverageSourceSummary": src,
    }
