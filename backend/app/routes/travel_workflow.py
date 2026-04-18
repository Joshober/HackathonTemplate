from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from bson import ObjectId
from flask import Blueprint, jsonify, request

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth

bp = Blueprint("travel_workflow", __name__)


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _to_float(raw: Any) -> float | None:
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v < 0:
        return None
    return v


def _iso_day(raw: Any) -> str | None:
    s = str(raw or "").strip()[:10]
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    return None


def _incident_severity(kind: str, details: str) -> str:
    k = (kind or "").strip().lower()
    d = (details or "").lower()
    if k in {"medical", "security"}:
        return "high"
    if k in {"cancellation", "missed_connection"}:
        return "high"
    if k == "delay":
        return "high" if any(x in d for x in ("overnight", "stranded", "no hotel")) else "medium"
    if k in {"policy_exception", "hotel_issue"}:
        return "medium"
    return "low"


def _escalation_for_incident(kind: str, severity: str) -> dict[str, str]:
    if severity == "high":
        return {
            "level": "travel_desk",
            "reason": "This issue can materially impact itinerary continuity or traveler safety.",
            "contact": "Travel Desk + manager escalation channel",
            "actionNow": "Escalate now and request assisted rebooking with policy override if needed.",
        }
    if kind == "policy_exception":
        return {
            "level": "manager",
            "reason": "Policy exception requested; manager sign-off is required.",
            "contact": "Manager approval channel",
            "actionNow": "Send manager-ready exception request with business justification.",
        }
    if kind == "hotel_issue":
        return {
            "level": "travel_desk",
            "reason": "Hotel-side issue may require central support for relocation/refund.",
            "contact": "Travel Desk hotline",
            "actionNow": "Open a relocation/refund case with booking details.",
        }
    return {
        "level": "monitor",
        "reason": "Issue appears manageable with self-service actions.",
        "contact": "Self-service; travel desk if resolution stalls",
        "actionNow": "Try self-service options first, then escalate if unresolved after one attempt.",
    }


def _build_incident_options(kind: str) -> list[dict[str, str]]:
    k = (kind or "").strip().lower()
    if k == "cancellation":
        return [
            {
                "id": "rebook-nearest",
                "title": "Rebook to nearest policy-compliant option",
                "details": "Choose the earliest comparable route within policy class and fare constraints.",
                "actionType": "rebook",
            },
            {
                "id": "request-override",
                "title": "Request policy override for critical meeting",
                "details": "If no compliant route protects the business objective, escalate for approval.",
                "actionType": "policy",
            },
            {
                "id": "desk-handoff",
                "title": "Hand off to travel desk",
                "details": "Provide locator, city pair, and urgency to get managed re-accommodation.",
                "actionType": "contact",
            },
        ]
    if k == "missed_connection":
        return [
            {
                "id": "same-day-alt",
                "title": "Try same-day alternate connection",
                "details": "Prioritize options with minimal arrival delay and compliant fare class.",
                "actionType": "rebook",
            },
            {
                "id": "overnight-support",
                "title": "Request overnight support if stranded",
                "details": "Ask travel desk to assist with lodging and duty-of-care alignment.",
                "actionType": "contact",
            },
            {
                "id": "meeting-adjust",
                "title": "Notify stakeholders of revised ETA",
                "details": "Send quick ETA update to host, manager, and meeting participants.",
                "actionType": "self_service",
            },
        ]
    if k == "delay":
        return [
            {
                "id": "monitor-window",
                "title": "Monitor delay window and gate changes",
                "details": "Track updates every 15-20 minutes before forcing a rebooking decision.",
                "actionType": "self_service",
            },
            {
                "id": "protect-connection",
                "title": "Protect onward connection",
                "details": "Pre-hold fallback segment if connection risk rises above tolerance.",
                "actionType": "rebook",
            },
            {
                "id": "inform-team",
                "title": "Notify manager/host with revised ETA",
                "details": "Keep stakeholders informed to reduce downstream disruption.",
                "actionType": "self_service",
            },
        ]
    if k == "hotel_issue":
        return [
            {
                "id": "front-desk-fix",
                "title": "Attempt onsite resolution",
                "details": "Request room move or issue correction at front desk first.",
                "actionType": "self_service",
            },
            {
                "id": "document-proof",
                "title": "Capture evidence for reimbursement",
                "details": "Save photos, receipts, and staff notes for policy-safe reimbursement.",
                "actionType": "self_service",
            },
            {
                "id": "relocate-support",
                "title": "Escalate for relocation support",
                "details": "Travel desk can move booking when quality/safety thresholds are not met.",
                "actionType": "contact",
            },
        ]
    if k == "policy_exception":
        return [
            {
                "id": "build-justification",
                "title": "Draft business justification",
                "details": "Include meeting impact, alternatives reviewed, and expected cost delta.",
                "actionType": "policy",
            },
            {
                "id": "manager-submit",
                "title": "Send exception request for approval",
                "details": "Submit to manager/travel approver with structured rationale.",
                "actionType": "contact",
            },
            {
                "id": "fallback-compliant",
                "title": "Keep compliant fallback ready",
                "details": "Maintain policy-compliant backup if exception is denied.",
                "actionType": "rebook",
            },
        ]
    return [
        {
            "id": "summarize",
            "title": "Summarize the issue clearly",
            "details": "Capture what happened, who is impacted, and by when.",
            "actionType": "self_service",
        },
        {
            "id": "option-scan",
            "title": "Evaluate 2-3 alternatives",
            "details": "Compare time impact, policy impact, and expected cost.",
            "actionType": "self_service",
        },
        {
            "id": "escalate-if-blocked",
            "title": "Escalate if blocked",
            "details": "If no acceptable option exists, hand off to travel desk.",
            "actionType": "contact",
        },
    ]


def _load_item_for_user(db, user_id: str, item_id: str) -> dict[str, Any] | None:
    try:
        oid = ObjectId(item_id)
    except Exception:
        return None
    return db.items.find_one({"_id": oid, "userId": user_id})


def _base_trip_fields(data: dict[str, Any], item: dict[str, Any] | None) -> dict[str, Any]:
    travel = item.get("travel") if item and isinstance(item.get("travel"), dict) else {}
    travel = travel if isinstance(travel, dict) else {}
    destination = str(
        data.get("destination")
        or travel.get("location")
        or ""
    ).strip()
    start = _iso_day(data.get("startDate") or travel.get("startDate"))
    end = _iso_day(data.get("endDate") or travel.get("endDate"))
    cost = _to_float(data.get("costEstimate") if "costEstimate" in data else travel.get("costEstimate"))
    trip_type = str(data.get("tripType") or travel.get("tripType") or "business").strip().lower()
    return {
        "destination": destination,
        "startDate": start,
        "endDate": end,
        "costEstimate": cost,
        "tripType": trip_type,
        "travel": travel,
    }


def _privacy_meta() -> dict[str, Any]:
    return {
        "redactionApplied": True,
        "retainedFields": [
            "destination",
            "startDate",
            "endDate",
            "costEstimate",
            "tripType",
            "approvalStatus",
            "teamMemberCount",
        ],
        "excludedFields": [
            "paymentCardNumber",
            "passportNumber",
            "loyaltyIds",
            "freeformPersonalNotes",
            "exactStreetAddress",
        ],
    }


@bp.route("/travel/checklist/generate", methods=["POST"])
@require_auth
def generate_checklist(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item = None
    item_id = str(data.get("itemId") or "").strip()
    if item_id:
        item = _load_item_for_user(db, user_id, item_id)
        if item is None:
            return jsonify({"error": "itemId not found for user"}), 404

    base = _base_trip_fields(data, item)
    destination = base["destination"]
    start = base["startDate"]
    end = base["endDate"]
    cost_est = base["costEstimate"]
    trip_type = base["tripType"]
    is_international = bool(re.search(r"\b(uk|london|europe|asia|mexico|canada|international)\b", destination.lower()))

    checklist: list[dict[str, Any]] = [
        {
            "id": "trip-basics",
            "label": "Confirm destination, dates, and meeting purpose",
            "status": "done" if destination and start and end else "pending",
            "source": "trip",
            "note": "Trip basics must be complete before approval or booking.",
        },
        {
            "id": "policy-review",
            "label": "Review policy fit (air class, hotel class, refundable requirements)",
            "status": "pending",
            "source": "policy",
            "note": "Use company travel policy as source of truth.",
        },
        {
            "id": "approval-readiness",
            "label": "Prepare approval package with business justification",
            "status": "pending",
            "source": "approval",
            "note": "Copilot can draft this automatically.",
        },
        {
            "id": "booking-options",
            "label": "Compare 2-3 booking options with tradeoffs",
            "status": "pending",
            "source": "trip",
            "note": "Document cost, flexibility, and policy impact.",
        },
    ]

    if is_international:
        checklist.append(
            {
                "id": "intl-docs",
                "label": "Validate passport/visa and international duty-of-care requirements",
                "status": "pending",
                "source": "risk",
                "note": "International travel generally needs extra document checks.",
            }
        )

    risk_flags: list[str] = []
    if not start or not end:
        risk_flags.append("Missing travel dates limits policy and approval precision.")
    if cost_est is not None and cost_est >= 1800:
        risk_flags.append("Estimated trip spend may require manager approval.")
    if is_international:
        risk_flags.append("International route detected; confirm travel documents and safety advisories.")

    tradeoffs = [
        "Lower fare options can increase change-risk if nonrefundable.",
        "Higher-flex fares often reduce disruption cost during delays/cancellations.",
        "Closest hotel can improve meeting reliability but may exceed nightly policy caps.",
    ]

    return jsonify(
        {
            "checklist": checklist,
            "summary": "Checklist generated from current trip metadata and policy guardrails.",
            "riskFlags": risk_flags,
            "tradeoffs": tradeoffs,
            "privacy": _privacy_meta(),
        }
    ), 200


@bp.route("/travel/approvals/prepare", methods=["POST"])
@require_auth
def prepare_approval(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item = None
    item_id = str(data.get("itemId") or "").strip()
    if item_id:
        item = _load_item_for_user(db, user_id, item_id)
        if item is None:
            return jsonify({"error": "itemId not found for user"}), 404

    base = _base_trip_fields(data, item)
    destination = base["destination"]
    cost_est = base["costEstimate"]
    travel = base["travel"]

    status = str(travel.get("opportunityStatus") or data.get("status") or "draft").strip().lower()
    required_by: list[str] = []
    reasons: list[str] = []
    fixes: list[str] = []

    if cost_est is not None and cost_est >= 1500:
        required_by.append("manager")
        reasons.append("Estimated cost is above the standard self-approve threshold.")
    if "international" in destination.lower() or re.search(r"\b(london|europe|asia|mexico|canada)\b", destination.lower()):
        required_by.append("travel_desk")
        reasons.append("Destination appears international and needs compliance confirmation.")
    if not required_by:
        reasons.append("No hard approval trigger detected from available trip metadata.")

    if not destination:
        fixes.append("Add destination to the trip card.")
    if not base["startDate"] or not base["endDate"]:
        fixes.append("Add complete start/end travel dates.")
    if cost_est is None:
        fixes.append("Add a rough cost estimate to speed approval review.")

    if status in {"approved", "booked", "completed"}:
        approval_status = "approved"
    elif status in {"submitted", "pending"}:
        approval_status = status
    elif required_by:
        approval_status = "required"
    else:
        approval_status = "not_required"

    timeline = [
        {
            "step": "draft_trip",
            "status": "done" if destination else "pending",
            "detail": "Trip draft captured with destination and timing.",
        },
        {
            "step": "prepare_request",
            "status": "done" if not fixes else "pending",
            "detail": "Approval request package includes rationale and expected spend.",
        },
        {
            "step": "manager_review",
            "status": "pending" if "manager" in required_by else "n/a",
            "detail": "Manager sign-off for spend/risk exceptions.",
        },
        {
            "step": "travel_desk_review",
            "status": "pending" if "travel_desk" in required_by else "n/a",
            "detail": "Travel desk validates policy and duty-of-care constraints.",
        },
    ]

    plain = {
        "not_required": "No explicit approval trigger found; you can proceed while still checking policy.",
        "required": "Approval is needed before booking.",
        "submitted": "Approval request is submitted and awaiting decision.",
        "pending": "Approval is in review. Copilot can suggest fast fixes if blocked.",
        "approved": "Trip is approved for booking.",
        "needs_changes": "Approval needs changes before booking.",
    }.get(approval_status, "Approval status is being assessed.")

    return jsonify(
        {
            "approval": {
                "status": approval_status,
                "requiredBy": sorted(list(set(required_by))),
                "reasons": reasons,
                "fixes": fixes,
                "timeline": timeline,
                "submittedAt": travel.get("submittedAt"),
                "decisionAt": travel.get("decisionAt"),
            },
            "plainLanguageStatus": plain,
            "privacy": _privacy_meta(),
        }
    ), 200


@bp.route("/travel/incidents/triage", methods=["POST"])
@require_auth
def triage_incident(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item = None
    item_id = str(data.get("itemId") or "").strip()
    if item_id:
        item = _load_item_for_user(db, user_id, item_id)
        if item is None:
            return jsonify({"error": "itemId not found for user"}), 404

    kind = str(data.get("type") or "other").strip().lower()
    details = str(data.get("details") or "").strip()
    severity = _incident_severity(kind, details)
    escalation = _escalation_for_incident(kind, severity)
    incident_id = f"inc-{uuid.uuid4().hex[:10]}"
    options = _build_incident_options(kind)

    destination = ""
    if item and isinstance(item.get("travel"), dict):
        destination = str(item["travel"].get("location") or "").strip()

    summary = (
        f"{kind.replace('_', ' ').title()} reported"
        + (f" for {destination}." if destination else ".")
        + " Copilot generated immediate options and escalation guidance."
    )
    incident = {
        "id": incident_id,
        "type": kind,
        "severity": severity,
        "summary": summary,
        "createdAt": _now_iso(),
        "details": details[:500],
        "options": options,
        "escalation": escalation,
    }

    return jsonify(
        {
            "incident": incident,
            "escalationRecommended": escalation.get("level") in {"travel_desk", "manager", "emergency"},
            "nextStep": escalation.get("actionNow"),
            "privacy": _privacy_meta(),
        }
    ), 200


@bp.route("/travel/followups/generate", methods=["POST"])
@require_auth
def generate_followups(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item = None
    item_id = str(data.get("itemId") or "").strip()
    if item_id:
        item = _load_item_for_user(db, user_id, item_id)
        if item is None:
            return jsonify({"error": "itemId not found for user"}), 404

    travel = item.get("travel") if item and isinstance(item.get("travel"), dict) else {}
    travel = travel if isinstance(travel, dict) else {}

    due_base = datetime.utcnow()
    followups = [
        {
            "id": "expense-report",
            "type": "expense",
            "label": "Submit expense report and receipts",
            "dueDate": (due_base).strftime("%Y-%m-%d"),
            "status": "open",
            "owner": "traveler",
        },
        {
            "id": "trip-feedback",
            "type": "feedback",
            "label": "Share quick trip outcome/feedback",
            "dueDate": (due_base).strftime("%Y-%m-%d"),
            "status": "open",
            "owner": "traveler",
        },
        {
            "id": "close-approval",
            "type": "compliance",
            "label": "Close approval and compliance tracking items",
            "dueDate": (due_base).strftime("%Y-%m-%d"),
            "status": "open",
            "owner": "copilot",
        },
    ]
    if travel.get("tripType") == "post_trip":
        followups.append(
            {
                "id": "publish-summary",
                "type": "communication",
                "label": "Publish trip summary for team visibility",
                "dueDate": (due_base).strftime("%Y-%m-%d"),
                "status": "open",
                "owner": "traveler",
            }
        )

    return jsonify(
        {
            "followUps": followups,
            "summary": "Post-trip actions generated for closure and compliance.",
            "privacy": _privacy_meta(),
        }
    ), 200


@bp.route("/travel/escalate", methods=["POST"])
@require_auth
def escalate_issue(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    tickets = db.tickets

    incident_id = str(data.get("incidentId") or "").strip() or f"inc-{uuid.uuid4().hex[:8]}"
    item_id = str(data.get("itemId") or "").strip() or None
    reason = str(data.get("reason") or "Travel issue escalation").strip()[:600]
    preferred = str(data.get("contactPreference") or "travel_desk").strip().lower()
    if preferred not in {"travel_desk", "manager", "emergency"}:
        preferred = "travel_desk"

    now = datetime.utcnow()
    doc = {
        "title": "Travel escalation",
        "description": reason,
        "status": "open",
        "type": "travel_escalation",
        "incidentId": incident_id,
        "itemId": item_id,
        "contactPreference": preferred,
        "userId": user_id,
        "createdAt": now,
        "updatedAt": now,
    }
    result = tickets.insert_one(doc)

    return jsonify(
        {
            "escalationId": str(result.inserted_id),
            "incidentId": incident_id,
            "status": "opened",
            "contact": preferred,
            "message": "Escalation opened. Share this reference with the travel desk for rapid support.",
            "privacy": _privacy_meta(),
        }
    ), 200
