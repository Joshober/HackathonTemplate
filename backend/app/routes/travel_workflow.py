from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any

import requests
from bson import ObjectId
from flask import Blueprint, jsonify, request

from app.config.openrouter_models import DEFAULT_CHAT_MODEL

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.services.travel_chat_context import (
    build_trip_context,
    get_document_context,
    get_trip_ai_sources,
    get_trip_contacts,
    get_trip_reminders,
)

bp = Blueprint("travel_workflow", __name__)
logger = logging.getLogger(__name__)

_TRAVEL_SENTINEL = "__TRAVEL_JSON__"


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


def _item_is_travel_candidate(doc: dict[str, Any]) -> bool:
    t = doc.get("travel")
    if isinstance(t, dict) and str(t.get("location") or "").strip():
        return True
    desc = doc.get("description")
    return isinstance(desc, str) and desc.startswith(_TRAVEL_SENTINEL)


def _compact_trip_for_brief(doc: dict[str, Any]) -> dict[str, Any]:
    t = doc.get("travel") if isinstance(doc.get("travel"), dict) else {}
    return {
        "title": str(doc.get("title") or "")[:160],
        "location": str(t.get("location") or "")[:160],
        "startDate": str(t.get("startDate") or "")[:14],
        "endDate": str(t.get("endDate") or "")[:14],
        "costEstimate": t.get("costEstimate"),
        "opportunityStatus": str(t.get("opportunityStatus") or "")[:40],
        "tripType": str(t.get("tripType") or "")[:40],
    }


def _pretrip_brief_static() -> dict[str, str]:
    return {
        "companyPolicy": "Flights max $500, Hotels max $200/night.",
        "requirements": "Director approval needed for international destinations.",
        "actionItems": "Ensure passport is valid for 6+ months for London travel.",
    }


def _parse_pretrip_brief_json(raw: str) -> dict[str, str] | None:
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    cp = str(data.get("companyPolicy") or "").strip()
    rq = str(data.get("requirements") or "").strip()
    ai = str(data.get("actionItems") or "").strip()
    if not cp or not rq or not ai:
        return None
    return {
        "companyPolicy": cp[:400],
        "requirements": rq[:400],
        "actionItems": ai[:400],
    }


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


def _detect_trip_intent(message: str, stage: str | None = None) -> dict[str, Any]:
    text = (message or "").strip().lower()
    stage_norm = (stage or "").strip().lower()
    rules = [
        (
            "requirements",
            ("need", "missing", "requirement", "passport", "visa", "eta", "document"),
            "Travel requirements, documents, or readiness question.",
        ),
        (
            "approval",
            ("approval", "approve", "manager", "policy", "rejected", "denied"),
            "Approval status, policy fit, or approver workflow question.",
        ),
        (
            "incident",
            ("delay", "delayed", "canceled", "cancelled", "missed connection", "stranded", "hotel issue", "emergency"),
            "Active disruption or urgent trip issue.",
        ),
        (
            "followup",
            ("expense", "follow-up", "follow up", "closeout", "feedback", "receipt"),
            "Post-trip task or closure question.",
        ),
        (
            "contacts",
            ("contact", "call", "phone", "who do i contact", "support"),
            "Support-routing question.",
        ),
    ]
    for intent, terms, reason in rules:
        if any(term in text for term in terms):
            return {"intent": intent, "confidence": 0.92, "reason": reason}
    if stage_norm == "approve":
        return {"intent": "approval", "confidence": 0.58, "reason": "Approve stage default routing."}
    if stage_norm == "travel":
        return {"intent": "incident", "confidence": 0.54, "reason": "Travel stage default routing."}
    if stage_norm == "return":
        return {"intent": "followup", "confidence": 0.54, "reason": "Return stage default routing."}
    return {"intent": "general", "confidence": 0.4, "reason": "No stronger keyword signal found."}


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


@bp.route("/travel/pretrip-brief/generate", methods=["POST"])
@require_auth
def generate_pretrip_brief(user_id):
    """LLM-generated Pre-Trip Brief (policy, requirements, action items) from the user's saved trips."""
    data = request.get_json(silent=True) or {}
    db = get_db()
    trips: list[dict[str, Any]] = []
    item_id = str(data.get("itemId") or "").strip()
    if item_id:
        doc = _load_item_for_user(db, user_id, item_id)
        if doc and _item_is_travel_candidate(doc):
            trips.append(_compact_trip_for_brief(doc))
    else:
        for doc in db.items.find({"userId": user_id}).sort("updatedAt", -1).limit(48):
            if _item_is_travel_candidate(doc):
                trips.append(_compact_trip_for_brief(doc))
            if len(trips) >= 14:
                break

    payload = {"trips": trips}
    ctx = json.dumps(payload, default=str)[:12000]

    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        out = _pretrip_brief_static()
        return jsonify({**out, "privacy": _privacy_meta(), "source": "static"}), 200

    model = os.getenv("OPENROUTER_CHAT_MODEL", DEFAULT_CHAT_MODEL)
    system = (
        "You write concise corporate travel briefs. Output must be valid JSON only, no markdown. "
        "Each string is one sentence or two very short sentences, plain language, actionable."
    )
    user_msg = (
        "Using the user's trips JSON, produce a Pre-Trip Brief with exactly these keys:\n"
        'companyPolicy — realistic caps/guardrails (flights/hotel/per-diem style) informed by destinations and cost hints;\n'
        "requirements — approvals, international rules, duty of care, documentation;\n"
        "actionItems — concrete next steps (passport/visa/ETA, bookings, meetings).\n"
        "If trips is empty, still output sensible defaults for a business traveler.\n"
        "Trips JSON:\n"
        f"{ctx}"
    )
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": (request.headers.get("Origin") or "")[:512],
                "X-Title": "Travel Copilot Pre-Trip Brief",
            },
            json={
                "model": model,
                "temperature": 0.35,
                "max_tokens": 500,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
            },
            timeout=55,
        )
        body = resp.json() if resp.content else {}
        if not resp.ok:
            logger.warning("pretrip-brief OpenRouter status=%s", resp.status_code)
            out = _pretrip_brief_static()
            return jsonify({**out, "privacy": _privacy_meta(), "source": "static"}), 200
        choices = body.get("choices") if isinstance(body, dict) else None
        if not isinstance(choices, list) or not choices:
            out = _pretrip_brief_static()
            return jsonify({**out, "privacy": _privacy_meta(), "source": "static"}), 200
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        raw_content = (msg or {}).get("content") if isinstance(msg, dict) else None
        parsed = _parse_pretrip_brief_json(str(raw_content or ""))
        if not parsed:
            out = _pretrip_brief_static()
            return jsonify({**out, "privacy": _privacy_meta(), "source": "static"}), 200
        return jsonify({**parsed, "privacy": _privacy_meta(), "source": "model"}), 200
    except (requests.RequestException, KeyError, TypeError, ValueError) as e:
        logger.warning("pretrip-brief failed: %s", e)
        out = _pretrip_brief_static()
        return jsonify({**out, "privacy": _privacy_meta(), "source": "static"}), 200


@bp.route("/copilot/classify-intent", methods=["POST"])
@require_auth
def classify_copilot_intent(user_id):
    del user_id
    data = request.get_json(silent=True) or {}
    message = str(data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    stage = str(data.get("journeyStage") or data.get("stage") or "").strip().lower() or None
    return jsonify(_detect_trip_intent(message, stage)), 200


@bp.route("/copilot/requirements-check", methods=["POST"])
@require_auth
def copilot_requirements_check(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item = None
    item_id = str(data.get("itemId") or data.get("tripId") or "").strip()
    if item_id:
        item = _load_item_for_user(db, user_id, item_id)
        if item is None:
            return jsonify({"error": "tripId not found for user"}), 404

    base = _base_trip_fields(data, item)
    destination = base["destination"]
    start = base["startDate"]
    end = base["endDate"]
    required: list[str] = []
    missing: list[str] = []
    warnings: list[str] = []

    if destination:
        required.append("Destination confirmed")
    else:
        missing.append("Destination")
    if start and end:
        required.append("Travel dates confirmed")
    else:
        missing.append("Complete travel dates")

    doc_ctx = get_document_context(db, user_id) or {}
    docs = doc_ctx.get("documents") if isinstance(doc_ctx.get("documents"), list) else []
    visa_hits: list[str] = []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        if doc.get("tripSummary"):
            required.append("Parsed itinerary available")
        for vr in doc.get("visaRequirements") or []:
            if isinstance(vr, dict):
                requirement = str(vr.get("requirement") or "").strip()
                country = str(vr.get("country") or "").strip()
                if requirement:
                    visa_hits.append(f"{country}: {requirement}" if country else requirement)
        if doc.get("policyHighlights"):
            required.append("Policy rules extracted")

    if visa_hits:
        required.extend(visa_hits[:4])
    elif destination and re.search(r"\b(london|uk|europe|asia|mexico|canada|international)\b", destination.lower()):
        warnings.append("International destination detected but no parsed visa or ETA requirement was found.")

    if not docs:
        missing.append("Parsed itinerary or policy document")
        warnings.append("Upload and parse travel documents for grounded requirements.")

    if base["costEstimate"] is None:
        warnings.append("Cost estimate is missing, so approval guidance may be incomplete.")

    next_step = (
        "Upload and parse your itinerary document."
        if not docs
        else "Fill the highest-impact missing trip field before requesting approval."
        if missing
        else "Review the requirement list and complete the open traveler actions."
    )

    return jsonify(
        {
            "requiredItems": required[:8],
            "missingItems": missing[:8],
            "warnings": warnings[:6],
            "nextStep": next_step,
            "privacy": _privacy_meta(),
        }
    ), 200


def _approval_draft_static(destination: str, start: str | None, end: str | None, cost_est: float | None, required_by: list[str]) -> str:
    dest_part = f"to {destination}" if destination else "for a business trip"
    dates_part = f" from {start} to {end}" if start and end else ""
    cost_part = f", estimated at ${cost_est:,.0f}" if cost_est is not None else ""
    approver_part = (
        " and ".join(required_by).replace("_", " ") if required_by else "the travel team"
    )
    return (
        f"Hi — I'd like to request approval for a business trip {dest_part}{dates_part}{cost_part}. "
        f"This trip requires sign-off from {approver_part} per company policy. "
        "I've reviewed the available booking options and selected the most policy-compliant choice. "
        "Please let me know if you need any additional details or justification."
    )


def _generate_approval_draft(
    destination: str,
    start: str | None,
    end: str | None,
    cost_est: float | None,
    required_by: list[str],
    reasons: list[str],
    trip_title: str,
    referer: str,
) -> str:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        return _approval_draft_static(destination, start, end, cost_est, required_by)

    model = os.getenv("OPENROUTER_CHAT_MODEL", DEFAULT_CHAT_MODEL)
    dest_part = f"to {destination}" if destination else "for a business trip"
    dates_part = f" from {start} to {end}" if start and end else ""
    cost_part = f", estimated at ${cost_est:,.0f}" if cost_est is not None else ""
    approver_part = " and ".join(required_by).replace("_", " ") if required_by else "the travel team"
    reasons_part = " ".join(reasons) if reasons else "standard policy applies."
    title_hint = f" (trip: {trip_title})" if trip_title else ""

    user_msg = (
        f"Write a short, professional approval request message (3-5 sentences, plain English, no markdown) "
        f"from a business traveler to their approver for a trip{dest_part}{dates_part}{cost_part}{title_hint}. "
        f"Approver(s): {approver_part}. Policy context: {reasons_part} "
        "The message should briefly state purpose, dates, cost, and ask for approval. "
        "Do not use bullet points. Output only the message text, nothing else."
    )

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": referer[:512],
                "X-Title": "Travel Copilot Approval Draft",
            },
            json={
                "model": model,
                "temperature": 0.4,
                "max_tokens": 200,
                "messages": [
                    {
                        "role": "system",
                        "content": "You write concise corporate travel approval request messages. Output only the message text, no extra commentary.",
                    },
                    {"role": "user", "content": user_msg},
                ],
            },
            timeout=30,
        )
        if not resp.ok:
            return _approval_draft_static(destination, start, end, cost_est, required_by)
        body = resp.json() if resp.content else {}
        choices = body.get("choices") if isinstance(body, dict) else None
        if isinstance(choices, list) and choices:
            msg = choices[0].get("message") if isinstance(choices[0], dict) else None
            content = (msg or {}).get("content") if isinstance(msg, dict) else None
            if content and isinstance(content, str) and content.strip():
                return content.strip()[:800]
    except Exception as e:
        logger.warning("approval draft LLM failed: %s", e)

    return _approval_draft_static(destination, start, end, cost_est, required_by)


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

    if status in {"needs_changes", "rejected"}:
        approval_status = "needs_changes"
    elif status in {"approved", "booked", "completed"}:
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
        "needs_changes": "Approval needs changes before booking — review the fix suggestions below.",
    }.get(approval_status, "Approval status is being assessed.")

    approval_draft = _generate_approval_draft(
        destination=destination,
        start=base["startDate"],
        end=base["endDate"],
        cost_est=cost_est,
        required_by=sorted(list(set(required_by))),
        reasons=reasons,
        trip_title=str(item.get("title") or "") if item else "",
        referer=request.headers.get("Origin") or "",
    )

    # Urgency level based on days until travel start
    urgency = "none"
    start_date_str = base.get("startDate") or ""
    if start_date_str:
        try:
            from datetime import date as _date
            start_dt = _date.fromisoformat(start_date_str[:10])
            days_away = (start_dt - _date.today()).days
            if days_away <= 3:
                urgency = "high"
            elif days_away <= 7:
                urgency = "medium"
            elif days_away <= 21:
                urgency = "low"
        except Exception:
            pass

    # Copilot-voice message Kelli sees as the headline
    fix_count = len(fixes)
    if approval_status == "approved":
        copilot_message = "You're approved — ready to book whenever you are."
    elif approval_status == "not_required":
        copilot_message = "Good news: this trip doesn't need manager approval. You can book directly."
    elif approval_status == "submitted":
        copilot_message = "Your approval request is submitted. I'll flag anything that needs your attention."
    elif approval_status == "pending":
        copilot_message = "Approval is in review. Sit tight — I'll flag anything that needs your attention."
    elif approval_status == "needs_changes":
        copilot_message = f"Something needs fixing before this can be approved. I found {fix_count} item{'s' if fix_count != 1 else ''} to address."
    elif fix_count > 0:
        copilot_message = f"Approval is required — I found {fix_count} thing{'s' if fix_count != 1 else ''} to resolve before you can submit."
    else:
        copilot_message = "Approval is required for this trip. I've prepared a request you can send right now."

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
                "approvalDraft": approval_draft,
            },
            "plainLanguageStatus": plain,
            "copilotMessage": copilot_message,
            "requestDraft": approval_draft,
            "urgency": urgency,
            "privacy": _privacy_meta(),
        }
    ), 200


@bp.route("/travel/approvals/submit", methods=["POST"])
@require_auth
def submit_approval(user_id):
    data = request.get_json(silent=True) or {}
    db = get_db()

    item_id = str(data.get("itemId") or "").strip()
    if not item_id:
        return jsonify({"error": "itemId is required"}), 400

    item = _load_item_for_user(db, user_id, item_id)
    if item is None:
        return jsonify({"error": "itemId not found for user"}), 404

    now_str = _now_iso()
    travel = item.get("travel") if isinstance(item.get("travel"), dict) else {}
    updated_travel = {
        **travel,
        "opportunityStatus": "submitted",
        "submittedAt": now_str,
    }

    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid itemId"}), 400

    db.items.update_one(
        {"_id": oid, "userId": user_id},
        {"$set": {"travel": updated_travel, "updatedAt": datetime.utcnow()}},
    )

    return jsonify(
        {
            "plainLanguageStatus": "Your approval request is submitted and awaiting decision.",
            "submittedAt": now_str,
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


@bp.route("/trips/<trip_id>/context", methods=["GET"])
@require_auth
def get_trip_context(user_id, trip_id):
    db = get_db()
    ctx = build_trip_context(db, user_id, trip_id)
    if ctx is None:
        return jsonify({"error": "tripId not found for user"}), 404
    return jsonify(ctx), 200


@bp.route("/trips/<trip_id>/contacts", methods=["GET"])
@require_auth
def trip_contacts(user_id, trip_id):
    db = get_db()
    payload = get_trip_contacts(db, user_id, trip_id)
    if payload is None:
        return jsonify({"error": "tripId not found for user"}), 404
    return jsonify(payload), 200


@bp.route("/trips/<trip_id>/reminders", methods=["GET"])
@require_auth
def trip_reminders(user_id, trip_id):
    db = get_db()
    payload = get_trip_reminders(db, user_id, trip_id)
    if payload is None:
        return jsonify({"error": "tripId not found for user"}), 404
    return jsonify(payload), 200


@bp.route("/audit/trips/<trip_id>/ai-sources", methods=["GET"])
@require_auth
def trip_ai_sources(user_id, trip_id):
    db = get_db()
    payload = get_trip_ai_sources(db, user_id, trip_id)
    if payload is None:
        return jsonify({"error": "tripId not found for user"}), 404
    return jsonify(payload), 200
