from __future__ import annotations

import os
from datetime import datetime, timedelta
from urllib.parse import quote_plus

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.services.amadeus_client import AmadeusError, client_or_none as amadeus_client_or_none, summarize_flight_offer
from app.services.duffel_client import DuffelError, client_or_none as duffel_client_or_none, summarize_duffel_offer
from app.services.travel_scrape_options import collect_scraped_options, scrape_enabled

bp = Blueprint("travel_pricing", __name__)


def _pick_flight_backend(amadeus, duffel) -> str:
    """amadeus | duffel | none — TRAVEL_FLIGHT_PROVIDER: auto (default), amadeus, duffel, both."""
    p = (os.getenv("TRAVEL_FLIGHT_PROVIDER") or "auto").strip().lower()
    if p == "duffel":
        return "duffel" if duffel else "none"
    if p == "amadeus":
        return "amadeus" if amadeus else ("duffel" if duffel else "none")
    if p == "both":
        if amadeus:
            return "amadeus"
        return "duffel" if duffel else "none"
    # auto
    if amadeus:
        return "amadeus"
    if duffel:
        return "duffel"
    return "none"


def _response_mode(amadeus, duffel) -> str:
    if amadeus:
        return "amadeus"
    if duffel:
        return "duffel"
    return "links_only"


def _deep_links(origin_iata: str, city: str, outbound: str, inbound: str | None) -> dict[str, str | None]:
    city_q = quote_plus(city or "travel")
    flights_q = quote_plus(f"flights from {origin_iata} to {city} on {outbound}")
    hotels_q = quote_plus(f"hotels in {city} check in {outbound}")
    extra = f" return {inbound}" if inbound else ""
    flights_q2 = quote_plus(f"flights from {origin_iata} to {city} on {outbound}{extra}")
    return {
        "googleFlightsSearch": f"https://www.google.com/travel/flights?q={flights_q2}",
        "googleHotelsSearch": f"https://www.google.com/travel/hotels?q={hotels_q}",
        "googleFlightsShort": f"https://www.google.com/travel/flights?q={flights_q}",
        "kayakExploreHint": f"https://www.kayak.com/explore/{origin_iata.upper()}-{city_q}?depart={outbound}",
    }


def _flight_bookable_amadeus(offers: list) -> dict:
    if not offers:
        return {"bookable": False, "reason": "No flight offers returned for these parameters."}
    summ0 = summarize_flight_offer(offers[0])
    if summ0.get("instantTicketingRequired"):
        return {
            "bookable": True,
            "reason": "Offers returned; instant ticketing flagged on a fare — confirm rules on the airline.",
        }
    return {
        "bookable": True,
        "reason": "Amadeus returned flight offers — verify fare and ticketing deadlines before purchase.",
    }


def _flight_bookable_duffel(offers: list) -> dict:
    if not offers:
        return {"bookable": False, "reason": "No flight offers returned for these parameters."}
    pay = offers[0].get("payment_requirements") if isinstance(offers[0].get("payment_requirements"), dict) else {}
    if pay.get("requires_instant_payment"):
        return {
            "bookable": True,
            "reason": "Duffel: instant payment required — confirm fare rules before booking.",
        }
    return {
        "bookable": True,
        "reason": "Duffel returned offers — check expires_at and airline conditions before purchase.",
    }


def _hotel_bookable_summary(rows: list) -> dict:
    if not rows:
        return {"bookable": False, "reason": "No hotel offers returned (inventory or city resolution)."}
    return {
        "bookable": True,
        "reason": "Hotel rate rows returned — confirm cancellation policy on the property site.",
    }


def _links_only_flight_hotel() -> tuple[dict, dict]:
    u = "Bookability unknown without a flight API (Amadeus or Duffel)."
    return (
        {
            "offers": [],
            "error": "No flight API configured — set AMADEUS_* or DUFFEL_ACCESS_TOKEN, or use deep links.",
            "bookable": None,
            "reason": u,
        },
        {
            "offers": [],
            "error": "Amadeus not configured — use deep links for hotels.",
            "bookable": None,
            "reason": "Hotel live rates need Amadeus keys in this template.",
        },
    )


def _ensure_checkout_after_checkin(check_in: str, check_out: str) -> str:
    try:
        a = datetime.strptime(check_in[:10], "%Y-%m-%d")
        b = datetime.strptime(check_out[:10], "%Y-%m-%d")
        if b <= a:
            return (a + timedelta(days=1)).strftime("%Y-%m-%d")
        return check_out[:10]
    except ValueError:
        try:
            a = datetime.strptime(check_in[:10], "%Y-%m-%d")
            return (a + timedelta(days=1)).strftime("%Y-%m-%d")
        except ValueError:
            return check_out[:10]


@bp.route("/travel/pricing-preview", methods=["POST"])
@require_auth
def pricing_preview(user_id):
    _ = user_id
    body = request.get_json(silent=True) or {}
    origin_iata = (body.get("originIata") or "").strip().upper()[:3]
    events = body.get("events")
    if not origin_iata or len(origin_iata) != 3:
        return jsonify({"error": "originIata must be a 3-letter IATA code (e.g. ORD)."}), 400
    if not isinstance(events, list) or not events:
        return jsonify({"error": "events must be a non-empty array."}), 400

    amadeus = amadeus_client_or_none()
    duffel = duffel_client_or_none()
    flight_backend = _pick_flight_backend(amadeus, duffel)
    mode = _response_mode(amadeus, duffel)
    out_events: list[dict] = []

    for raw in events:
        if not isinstance(raw, dict):
            continue
        item_id = raw.get("itemId")
        title = str(raw.get("title") or "Trip")[:300]
        dest_q = str(raw.get("destinationQuery") or raw.get("location") or "").strip()
        ob = str(raw.get("outboundDate") or "").strip()
        ib = str(raw.get("inboundDate") or "").strip() or None
        ch_in = str(raw.get("checkIn") or ob).strip()
        ch_out = str(raw.get("checkOut") or ib or ob).strip()
        if ch_in and ch_out:
            ch_out = _ensure_checkout_after_checkin(ch_in, ch_out)
        try:
            adults = max(1, min(int(raw.get("adults") or 1), 9))
        except (TypeError, ValueError):
            adults = 1

        row: dict = {
            "itemId": item_id,
            "title": title,
            "destinationQuery": dest_q,
            "deepLinks": _deep_links(origin_iata, dest_q or "destination", ob or "", ib),
            "resolvedDestination": None,
            "flightSource": flight_backend,
        }

        dest_code: str | None = None
        dest_label: str | None = None
        if amadeus and dest_q:
            try:
                dest_code, dest_label = amadeus.resolve_iata(dest_q)
            except AmadeusError:
                dest_code, dest_label = None, None
        if flight_backend == "duffel" and duffel and dest_q and (not dest_code):
            try:
                dest_code, dest_label = duffel.suggest_airport_iata(dest_q)
            except DuffelError:
                dest_code, dest_label = None, None

        if dest_code or dest_label:
            row["resolvedDestination"] = {"iata": dest_code, "label": dest_label}

        flight_summaries: list = []
        flight_err: str | None = None
        amadeus_flight_raw: list = []
        duffel_flight_raw: list = []

        if flight_backend == "amadeus" and amadeus and dest_q and ob:
            if not dest_code:
                try:
                    dest_code, dest_label = amadeus.resolve_iata(dest_q)
                    row["resolvedDestination"] = {"iata": dest_code, "label": dest_label}
                except AmadeusError as e:
                    flight_err = str(e)
            if dest_code and not flight_err:
                try:
                    amadeus_flight_raw = amadeus.flight_offers(
                        origin_iata, dest_code, ob, ib, adults=adults, max_offers=5
                    )
                    flight_summaries = [summarize_flight_offer(o) for o in amadeus_flight_raw]
                except AmadeusError as e:
                    flight_err = str(e)
            elif not dest_code and not flight_err:
                flight_err = "Could not resolve destination to an IATA city/airport code."
        elif flight_backend == "duffel" and duffel and dest_q and ob:
            if not dest_code:
                try:
                    dest_code, dest_label = duffel.suggest_airport_iata(dest_q)
                    row["resolvedDestination"] = {"iata": dest_code, "label": dest_label}
                except DuffelError as e:
                    flight_err = str(e)
            if dest_code and not flight_err:
                try:
                    duffel_flight_raw = duffel.search_flight_offers(
                        origin_iata, dest_code, ob, ib, adults=adults, max_offers=8
                    )
                    flight_summaries = [summarize_duffel_offer(o) for o in duffel_flight_raw]
                except DuffelError as e:
                    flight_err = str(e)
            elif not dest_code and not flight_err:
                flight_err = "Duffel could not resolve destination to an airport IATA code."
        else:
            if not (dest_q and ob):
                flight_err = "Need destination and outbound date for flight search."
            elif flight_backend == "none":
                flight_err = "Neither Amadeus nor Duffel is configured — use deep links."

        if flight_err and not flight_summaries:
            fs = {"bookable": False, "reason": flight_err}
        elif duffel_flight_raw:
            fs = _flight_bookable_duffel(duffel_flight_raw)
        elif amadeus_flight_raw:
            fs = _flight_bookable_amadeus(amadeus_flight_raw)
        else:
            fs = {
                "bookable": False,
                "reason": flight_err or "No flight offers returned for these parameters.",
            }

        row["flight"] = {
            "offers": flight_summaries,
            "error": flight_err if not flight_summaries else None,
            **fs,
        }

        hotel_rows: list = []
        hotel_err: str | None = None
        if not amadeus:
            _, hblk = _links_only_flight_hotel()
            row["hotel"] = hblk
        elif ch_in and dest_q:
            try:
                hotel_rows = amadeus.hotel_offers_for_city(dest_q, ch_in, ch_out or ch_in, adults=adults)
            except AmadeusError as e:
                hotel_err = str(e)
            hs = _hotel_bookable_summary(hotel_rows)
            row["hotel"] = {
                "offers": hotel_rows[:8],
                "error": hotel_err,
                **hs,
            }
        else:
            hotel_err = "Missing check-in or destination for hotel search."
            hs = _hotel_bookable_summary([])
            row["hotel"] = {
                "offers": [],
                "error": hotel_err,
                **hs,
            }

        row["scrapedOptions"] = []
        row["scrapeNote"] = None
        if scrape_enabled() and ob:
            opts, serr = collect_scraped_options(
                origin_iata,
                dest_q or "travel",
                ob,
                ib,
                destination_iata=dest_code,
            )
            row["scrapedOptions"] = opts
            if serr:
                row["scrapeNote"] = serr

        out_events.append(row)

    return (
        jsonify(
            {
                "mode": mode,
                "flightBackend": flight_backend,
                "scrapeEnabled": scrape_enabled(),
                "events": out_events,
            }
        ),
        200,
    )
