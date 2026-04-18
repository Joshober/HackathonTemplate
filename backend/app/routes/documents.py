"""Document parsing route — POST /api/travel/documents/parse.

Accepts extracted text from a travel document (itinerary, policy, booking confirmation)
and uses OpenRouter (Gemini) to extract structured trip data, storing it in MongoDB
for use as copilot context in subsequent chat requests.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

import requests
from flask import Blueprint, jsonify, request

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.config.openrouter_models import DEFAULT_CHAT_MODEL

bp = Blueprint("documents", __name__)

_EXTRACTION_PROMPT = """You are a travel document intelligence system. Extract structured information from the travel document text below.

Return ONLY valid JSON in exactly this schema (no markdown, no explanation):
{
  "destinations": ["list of city/country names mentioned"],
  "travelDates": {
    "departureDate": "YYYY-MM-DD or null",
    "returnDate": "YYYY-MM-DD or null",
    "durationDays": null
  },
  "flights": [
    {
      "flightNumber": "e.g. BA456 or null",
      "from": "origin city/airport",
      "to": "destination city/airport",
      "departureTime": "time string or null",
      "arrivalTime": "time string or null",
      "date": "YYYY-MM-DD or null",
      "airline": "airline name or null"
    }
  ],
  "hotels": [
    {
      "name": "hotel name",
      "city": "city",
      "checkIn": "YYYY-MM-DD or null",
      "checkOut": "YYYY-MM-DD or null"
    }
  ],
  "layovers": [
    {
      "city": "layover city",
      "duration": "duration string e.g. '2h 15m' or null"
    }
  ],
  "visaRequirements": [
    {
      "country": "destination country",
      "requirement": "e.g. 'Visa required', 'ETA required', 'Visa on arrival', 'No visa required'",
      "note": "any important detail or null"
    }
  ],
  "policyHighlights": ["list of any policy rules mentioned, e.g. 'Economy class only', 'Pre-approval required over $1500'"],
  "risks": ["list of risks, warnings, or action items the traveler should know"],
  "tripSummary": "One sentence plain English summary of the trip"
}

If a field cannot be determined from the document, use null or an empty array. Do not invent data not present in the document.

Travel document text:
"""


def _call_openrouter_extraction(text: str, api_key: str) -> dict:
    """Call OpenRouter to extract structured data from document text."""
    model = os.getenv("OPENROUTER_CHAT_MODEL", DEFAULT_CHAT_MODEL)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": _EXTRACTION_PROMPT + text[:12000],
            }
        ],
        "temperature": 0.1,
        "max_tokens": 2000,
        "response_format": {"type": "json_object"},
    }
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "Travel Copilot Document Parser",
        },
        json=payload,
        timeout=45,
    )
    resp.raise_for_status()
    result = resp.json()
    content = result["choices"][0]["message"]["content"]
    return json.loads(content)


@bp.route("/travel/documents/parse", methods=["POST"])
@require_auth
def parse_document(user_id):
    """
    Parse a travel document and store structured extraction in MongoDB.

    Body (JSON):
      text: str  — extracted text from the document (required)
      documentName: str — original file name (optional)
      documentType: str — 'itinerary' | 'policy' | 'booking' | 'other' (optional)
    """
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    if len(text) > 50_000:
        text = text[:50_000]

    document_name = (data.get("documentName") or "").strip()[:200]
    document_type = (data.get("documentType") or "itinerary").strip().lower()
    if document_type not in {"itinerary", "policy", "booking", "other"}:
        document_type = "other"

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return jsonify({"error": "OPENROUTER_API_KEY is not configured"}), 500

    try:
        extracted = _call_openrouter_extraction(text, api_key)
    except (requests.RequestException, KeyError, json.JSONDecodeError, IndexError) as e:
        return jsonify({"error": f"Extraction failed: {str(e)[:200]}"}), 502

    now = datetime.utcnow()
    db = get_db()

    doc = {
        "userId": user_id,
        "documentName": document_name,
        "documentType": document_type,
        "extracted": extracted,
        "rawTextPreview": text[:500],
        "createdAt": now,
        "updatedAt": now,
    }

    # Replace the most recent document of same type for this user (upsert by userId+type)
    db.tripDocuments.update_one(
        {"userId": user_id, "documentType": document_type},
        {"$set": doc},
        upsert=True,
    )

    return jsonify(
        {
            "success": True,
            "documentType": document_type,
            "extracted": extracted,
            "message": f"Document parsed and stored as context for your copilot.",
        }
    ), 200


@bp.route("/travel/documents", methods=["GET"])
@require_auth
def get_documents(user_id):
    """Return all parsed documents for the current user."""
    db = get_db()
    docs = list(
        db.tripDocuments.find(
            {"userId": user_id},
            {"_id": 0, "rawTextPreview": 0},
        ).sort("updatedAt", -1).limit(10)
    )
    for d in docs:
        for k in ("createdAt", "updatedAt"):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
    return jsonify({"documents": docs}), 200


@bp.route("/travel/documents/<document_type>", methods=["DELETE"])
@require_auth
def delete_document(user_id, document_type):
    """Delete a parsed document by type."""
    db = get_db()
    db.tripDocuments.delete_one({"userId": user_id, "documentType": document_type})
    return jsonify({"success": True}), 200
