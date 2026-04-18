"""Lightweight non-LLM helpers for admin recommendations (extensible)."""

from __future__ import annotations

from typing import Any


def summarize_destination_fit(
    trip_location: str | None,
    trip_tags: list[str] | None,
    season_hint: str | None,
) -> dict[str, Any]:
    """Placeholder rules engine — extend with real scoring later."""
    loc = (trip_location or "").strip()
    tags = [t.lower() for t in (trip_tags or []) if isinstance(t, str)]
    notes = []
    if "beach" in tags and season_hint and "winter" in season_hint.lower():
        notes.append("Beach-oriented tags may clash with winter season in some regions—validate hemisphere and microclimate.")
    if not loc:
        notes.append("Destination not set—cannot score fit.")
    return {"location": loc or None, "heuristicNotes": notes or ["none"]}


def flag_price_inconsistency(pricing_review: dict[str, Any] | None) -> list[str]:
    if not isinstance(pricing_review, dict):
        return []
    flags = pricing_review.get("flags") or []
    if isinstance(flags, list):
        return [str(f) for f in flags if f and str(f) != "none"]
    return []
