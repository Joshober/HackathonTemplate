from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import quote_plus

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.services.amadeus_client import AmadeusError, client_or_none, summarize_flight_offer
from app.services.travel_scrape_options import collect_scraped_options, scrape_enabled

bp = Blueprint("travel_pricing", __name__)


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


def _flight_bookable_summary(offers: list) -> dict:
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
        "reason": "Test API returned flight offers — verify fare and ticketing deadlines before purchase.",
    }


def _hotel_bookable_summary(rows: list) -> dict:
    if not rows:
        return {"bookable": False, "reason": "No hotel offers returned (inventory or city resolution)."}
    return {
        "bookable": True,
        "reason": "Hotel rate rows returned — confirm cancellation policy on the property site.",
    }


def _links_only_flight_hotel() -> tuple[dict, dict]:
    u = "Bookability unknown without Amadeus API."
    return (
        {"offers": [], "error": "Amadeus not configured — use deep links to compare live sites.", "bookable": None, "reason": u},
        {"offers": [], "error": "Amadeus not configured — use deep links to compare live sites.", "bookable": None, "reason": u},
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

    amadeus = client_or_none()
    mode = "amadeus" if amadeus else "links_only"
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
        }

        flight_offers_raw: list = []
        flight_err: str | None = None
        hotel_rows: list = []
        hotel_err: str | None = None

        if amadeus and dest_q and ob:
            try:
                code, label = amadeus.resolve_iata(dest_q)
                row["resolvedDestination"] = {"iata": code, "label": label}
                if code:
                    flight_offers_raw = amadeus.flight_offers(
                        origin_iata, code, ob, ib, adults=adults, max_offers=5
                    )
                else:
                    flight_err = "Could not resolve destination to an IATA city/airport code."
            except AmadeusError as e:
                flight_err = str(e)

            if ch_in:
                try:
                    hotel_rows = amadeus.hotel_offers_for_city(dest_q, ch_in, ch_out or ch_in, adults=adults)
                except AmadeusError as e:
                    hotel_err = str(e)
            else:
                hotel_err = "Missing check-in date for hotel search."
        elif not amadeus:
            fblk, hblk = _links_only_flight_hotel()
            row["flight"] = fblk
            row["hotel"] = hblk
            row["scrapedOptions"] = []
            row["scrapeNote"] = None
            if scrape_enabled():
                opts, serr = collect_scraped_options(origin_iata, dest_q or "travel", ob or "2026-06-01", ib)
                row["scrapedOptions"] = opts
                if serr:
                    row["scrapeNote"] = serr
            out_events.append(row)
            continue
        else:
            flight_err = flight_err or "Need destination and outbound date for flight search."
            if not ch_in:
                hotel_err = hotel_err or "Need check-in date for hotel search."

        fs = _flight_bookable_summary(flight_offers_raw)
        row["flight"] = {
            "offers": [summarize_flight_offer(o) for o in flight_offers_raw],
            "error": flight_err,
            **fs,
        }
        hs = _hotel_bookable_summary(hotel_rows)
        row["hotel"] = {
            "offers": hotel_rows[:8],
            "error": hotel_err,
            **hs,
        }

        row["scrapedOptions"] = []
        row["scrapeNote"] = None
        if scrape_enabled() and ob:
            opts, serr = collect_scraped_options(origin_iata, dest_q or "travel", ob, ib)
            row["scrapedOptions"] = opts
            if serr:
                row["scrapeNote"] = serr

        out_events.append(row)

    return jsonify({"mode": mode, "scrapeEnabled": scrape_enabled(), "events": out_events}), 200
