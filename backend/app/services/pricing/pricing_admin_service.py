"""
Admin price updates on travel items (Mongo `items.travel` merge).
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.services.roles import is_admin_email


def validate_price_value(raw: Any) -> tuple[float | None, str | None]:
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None, "Price must be a number"
    if math.isnan(v) or math.isinf(v):
        return None, "Invalid price"
    if v < 0:
        return None, "Price must be >= 0"
    if v > 1_000_000_000:
        return None, "Price exceeds maximum allowed"
    return round(v, 2), None


def update_item_travel_cost_estimate(
    db,
    item_id: str,
    new_price: float,
    admin_email: str,
    *,
    currency: str | None = None,
) -> dict[str, Any]:
    """
    Set `travel.costEstimate` on an item (admin only). Does not touch Amadeus snapshots.
    """
    em = (admin_email or "").strip().lower()
    if not is_admin_email(em):
        return {"ok": False, "error": "Admin access required"}
    try:
        oid = ObjectId(item_id)
    except InvalidId:
        return {"ok": False, "error": "Invalid item id"}
    v, err = validate_price_value(new_price)
    if err:
        return {"ok": False, "error": err}
    item = db.items.find_one({"_id": oid})
    if not item:
        return {"ok": False, "error": "Item not found"}
    prev_travel = item.get("travel") if isinstance(item.get("travel"), dict) else {}
    old = prev_travel.get("costEstimate")
    merged = dict(prev_travel)
    merged["costEstimate"] = v
    if currency and isinstance(currency, str) and len(currency.strip()) <= 8:
        merged["costCurrency"] = currency.strip().upper()
    db.items.update_one(
        {"_id": oid},
        {"$set": {"travel": merged, "updatedAt": datetime.utcnow()}},
    )
    return {
        "ok": True,
        "itemId": item_id,
        "oldCostEstimate": old,
        "newCostEstimate": v,
        "currency": merged.get("costCurrency"),
    }


def review_pricing_snapshot_flags(travel: dict[str, Any] | None) -> dict[str, Any]:
    """
    Lightweight consistency hints for LLM / admin (no external API).
    """
    if not isinstance(travel, dict):
        return {"flags": [], "note": "No travel metadata"}
    flags: list[str] = []
    ce = travel.get("costEstimate")
    be = travel.get("bookingEstimate") if isinstance(travel.get("bookingEstimate"), dict) else {}
    total = be.get("total") if isinstance(be.get("total"), (int, float)) else None
    if isinstance(ce, (int, float)) and isinstance(total, (int, float)):
        if abs(float(ce) - float(total)) / max(float(total), 1.0) > 0.35:
            flags.append("costEstimate differs materially from bookingEstimate.total")
    if travel.get("travelPricingSnapshot") and not isinstance(ce, (int, float)):
        flags.append("Has pricing snapshot but no simple costEstimate field")
    return {"flags": flags or ["none"], "costEstimate": ce, "bookingTotal": total}
