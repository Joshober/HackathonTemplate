"""Duffel Flights API (test or live token). Optional env DUFFEL_ACCESS_TOKEN."""

from __future__ import annotations

import os
from typing import Any

import requests

BASE = "https://api.duffel.com"


class DuffelError(Exception):
    def __init__(self, message: str, status: int | None = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _token() -> str | None:
    t = (os.getenv("DUFFEL_ACCESS_TOKEN") or "").strip()
    return t or None


def _headers(tok: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {tok}",
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _parse_errors(data: dict[str, Any]) -> str:
    errs = data.get("errors")
    if isinstance(errs, list) and errs:
        e0 = errs[0]
        if isinstance(e0, dict):
            return str(e0.get("message") or e0.get("title") or e0)[:400]
    return str(data.get("meta") or data)[:400]


class DuffelClient:
    def __init__(self, token: str) -> None:
        self._token = token

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = requests.get(
            f"{BASE}{path}",
            headers=_headers(self._token),
            params=params or {},
            timeout=25,
        )
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text[:800]}
        if not resp.ok:
            msg = _parse_errors(data) if isinstance(data, dict) else resp.text[:400]
            raise DuffelError(f"Duffel API error: {msg}", status=resp.status_code, body=data)
        return data if isinstance(data, dict) else {}

    def _post(self, path: str, params: dict[str, Any] | None = None, json_body: dict | None = None) -> dict[str, Any]:
        resp = requests.post(
            f"{BASE}{path}",
            headers=_headers(self._token),
            params=params or {},
            json=json_body,
            timeout=60,
        )
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text[:800]}
        if not resp.ok:
            msg = _parse_errors(data) if isinstance(data, dict) else resp.text[:400]
            raise DuffelError(f"Duffel API error: {msg}", status=resp.status_code, body=data)
        return data if isinstance(data, dict) else {}

    def suggest_airport_iata(self, query: str) -> tuple[str | None, str | None]:
        q = (query or "").strip()
        if not q:
            return None, None
        data = self._get("/places/suggestions", {"query": q[:80]})
        rows = data.get("data") or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            code = row.get("iata_code")
            if isinstance(code, str) and len(code) == 3:
                name = row.get("name") or code
                return code.upper(), str(name)[:200]
        return None, None

    def search_flight_offers(
        self,
        origin_iata: str,
        destination_iata: str,
        departure_date: str,
        return_date: str | None,
        adults: int = 1,
        max_offers: int = 8,
        supplier_timeout_ms: int = 25000,
    ) -> list[dict[str, Any]]:
        o = origin_iata.strip().upper()[:3]
        d = destination_iata.strip().upper()[:3]
        slices: list[dict[str, str]] = [
            {"origin": o, "destination": d, "departure_date": departure_date[:10]},
        ]
        if return_date:
            slices.append({"origin": d, "destination": o, "departure_date": return_date[:10]})
        passengers = [{"type": "adult"} for _ in range(max(1, min(adults, 9)))]
        body = {
            "data": {
                "type": "offer_request",
                "slices": slices,
                "passengers": passengers,
                "cabin_class": "economy",
            }
        }
        params = {"return_offers": "true", "supplier_timeout": str(supplier_timeout_ms)}
        out = self._post("/air/offer_requests", params=params, json_body=body)
        inner = out.get("data") or {}
        offers = list(inner.get("offers") or [])
        return offers[:max_offers]


def summarize_duffel_offer(offer: dict[str, Any]) -> dict[str, Any]:
    slices = offer.get("slices") or []
    first_slice = slices[0] if slices and isinstance(slices[0], dict) else {}
    segs = first_slice.get("segments") or [] if isinstance(first_slice, dict) else []
    first_seg = segs[0] if segs and isinstance(segs[0], dict) else {}
    last_seg = segs[-1] if segs and isinstance(segs[-1], dict) else {}
    mc = first_seg.get("marketing_carrier") if isinstance(first_seg.get("marketing_carrier"), dict) else {}
    carrier = str(mc.get("iata_code") or "")
    pay = offer.get("payment_requirements") if isinstance(offer.get("payment_requirements"), dict) else {}
    return {
        "grandTotal": offer.get("total_amount"),
        "currency": offer.get("total_currency") or "USD",
        "carrierSummary": carrier,
        "departureAt": first_seg.get("departing_at"),
        "arrivalAt": last_seg.get("arriving_at"),
        "instantTicketingRequired": bool(pay.get("requires_instant_payment")),
        "lastTicketingDate": pay.get("payment_required_by") or offer.get("expires_at"),
        "numItineraries": len(slices),
        "source": "duffel",
    }


def client_or_none() -> DuffelClient | None:
    tok = _token()
    if not tok:
        return None
    return DuffelClient(tok)
