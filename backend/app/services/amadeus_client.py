"""Amadeus Self-Service (test) API — OAuth + flight/hotel shopping. Keys optional."""

from __future__ import annotations

import os
import time
from typing import Any

import requests

_DEFAULT_HOST = "test.api.amadeus.com"


class AmadeusError(Exception):
    def __init__(self, message: str, status: int | None = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _configured() -> bool:
    cid = (os.getenv("AMADEUS_CLIENT_ID") or "").strip()
    sec = (os.getenv("AMADEUS_CLIENT_SECRET") or "").strip()
    return bool(cid and sec)


def _host() -> str:
    return (os.getenv("AMADEUS_HOST") or _DEFAULT_HOST).strip().lower().replace("https://", "").rstrip("/")


class AmadeusClient:
    def __init__(self) -> None:
        self._client_id = (os.getenv("AMADEUS_CLIENT_ID") or "").strip()
        self._client_secret = (os.getenv("AMADEUS_CLIENT_SECRET") or "").strip()
        self._host = _host()
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    def _ensure_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 30:
            return self._token
        if not self._client_id or not self._client_secret:
            raise AmadeusError("Amadeus is not configured (missing AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET)")
        url = f"https://{self._host}/v1/security/oauth2/token"
        resp = requests.post(
            url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
            timeout=20,
        )
        if not resp.ok:
            raise AmadeusError(f"Amadeus token error: {resp.text[:500]}", status=resp.status_code, body=resp.text)
        data = resp.json()
        tok = data.get("access_token")
        if not tok:
            raise AmadeusError("Amadeus token response missing access_token", body=data)
        self._token = str(tok)
        exp = int(data.get("expires_in") or 1800)
        self._token_expires_at = time.time() + max(60, exp)
        return self._token

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        tok = self._ensure_token()
        url = f"https://{self._host}{path}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {tok}"},
            params=params,
            timeout=25,
        )
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text[:1000]}
        if not resp.ok:
            errs = data.get("errors") if isinstance(data, dict) else None
            msg = errs[0].get("detail") if isinstance(errs, list) and errs else resp.text[:400]
            raise AmadeusError(f"Amadeus API error: {msg}", status=resp.status_code, body=data)
        return data if isinstance(data, dict) else {}

    def resolve_iata(self, keyword: str) -> tuple[str | None, str | None]:
        """Return (iata_code, human_label) for first CITY or AIRPORT match."""
        kw = (keyword or "").strip()
        if not kw:
            return None, None
        data = self._get(
            "/v1/reference-data/locations",
            {"keyword": kw[:120], "subType": "AIRPORT,CITY", "page[limit]": 5},
        )
        rows = data.get("data") or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            code = row.get("iataCode")
            if code and isinstance(code, str) and len(code) >= 3:
                name = row.get("name") or code
                return code.upper()[:3], str(name)[:200]
        return None, None

    def flight_offers(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None,
        adults: int = 1,
        max_offers: int = 5,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "originLocationCode": origin.upper()[:3],
            "destinationLocationCode": destination.upper()[:3],
            "departureDate": departure_date,
            "adults": max(1, min(adults, 9)),
            "currencyCode": "USD",
            "max": max(1, min(max_offers, 10)),
        }
        if return_date:
            params["returnDate"] = return_date
        data = self._get("/v2/shopping/flight-offers", params)
        return list(data.get("data") or [])

    def hotel_offers_for_city(
        self,
        city_keyword: str,
        check_in: str,
        check_out: str,
        adults: int = 1,
        max_hotels: int = 5,
        max_offers_per_hotel: int = 2,
    ) -> list[dict[str, Any]]:
        city_code, _ = self.resolve_iata(city_keyword)
        if not city_code:
            return []
        list_data = self._get(
            "/v1/reference-data/locations/hotels/by-city",
            {"cityCode": city_code},
        )
        hotels = list_data.get("data") or []
        hotel_ids: list[str] = []
        for h in hotels[: max(1, min(max_hotels, 20))]:
            if isinstance(h, dict) and h.get("hotelId"):
                hotel_ids.append(str(h["hotelId"]))
        if not hotel_ids:
            return []
        offers_data = self._get(
            "/v3/shopping/hotel-offers",
            {
                "hotelIds": ",".join(hotel_ids[:10]),
                "checkInDate": check_in,
                "checkOutDate": check_out,
                "adults": max(1, min(adults, 9)),
            },
        )
        out: list[dict[str, Any]] = []
        for block in offers_data.get("data") or []:
            if not isinstance(block, dict):
                continue
            hid = block.get("hotel", {}).get("hotelId") if isinstance(block.get("hotel"), dict) else None
            name = block.get("hotel", {}).get("name") if isinstance(block.get("hotel"), dict) else None
            for off in (block.get("offers") or [])[:max_offers_per_hotel]:
                if not isinstance(off, dict):
                    continue
                price = off.get("price") or {}
                room = off.get("room") if isinstance(off.get("room"), dict) else {}
                est = room.get("typeEstimated") if isinstance(room.get("typeEstimated"), dict) else {}
                out.append(
                    {
                        "hotelId": hid,
                        "hotelName": name,
                        "checkIn": check_in,
                        "checkOut": check_out,
                        "total": price.get("total"),
                        "currency": price.get("currency"),
                        "boardType": est.get("category"),
                    }
                )
        return out


def summarize_flight_offer(offer: dict[str, Any]) -> dict[str, Any]:
    price = offer.get("price") or {}
    itins = offer.get("itineraries") or []
    first = itins[0] if itins else {}
    segs = (first.get("segments") or []) if isinstance(first, dict) else []
    first_seg = segs[0] if segs else {}
    last_seg = segs[-1] if segs else {}
    carrier = ""
    if isinstance(first_seg, dict):
        c = first_seg.get("carrierCode")
        if c:
            carrier = str(c)
    instant = bool(offer.get("instantTicketingRequired"))
    last_tix = offer.get("lastTicketingDate")
    dep_at = None
    arr_at = None
    if isinstance(first_seg, dict) and isinstance(first_seg.get("departure"), dict):
        dep_at = first_seg["departure"].get("at")
    if isinstance(last_seg, dict) and isinstance(last_seg.get("arrival"), dict):
        arr_at = last_seg["arrival"].get("at")
    return {
        "grandTotal": price.get("grandTotal") or price.get("total"),
        "currency": price.get("currency") or "USD",
        "carrierSummary": carrier,
        "departureAt": dep_at,
        "arrivalAt": arr_at,
        "instantTicketingRequired": instant,
        "lastTicketingDate": last_tix,
        "numItineraries": len(itins),
    }


def client_or_none() -> AmadeusClient | None:
    if not _configured():
        return None
    return AmadeusClient()
