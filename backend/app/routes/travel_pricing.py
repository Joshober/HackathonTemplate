from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote_plus

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.services.amadeus_client import AmadeusError, client_or_none as amadeus_client_or_none, summarize_flight_offer
from app.services.duffel_client import DuffelError, client_or_none as duffel_client_or_none, summarize_duffel_offer
from app.services.serpapi_travel import serpapi_google_hotels_enabled, serpapi_google_hotels_offer_rows
from app.services.travel_scrape_options import collect_scraped_options, scrape_enabled

bp = Blueprint("travel_pricing", __name__)


def _pick_flight_backends(amadeus, duffel) -> list[str]:
    """
    Return enabled backends in priority order.
    TRAVEL_FLIGHT_PROVIDER: auto (default), amadeus, duffel, both.
    """
    p = (os.getenv("TRAVEL_FLIGHT_PROVIDER") or "auto").strip().lower()
    if p == "duffel":
        return ["duffel"] if duffel else []
    if p == "amadeus":
        if amadeus:
            return ["amadeus"]
        return ["duffel"] if duffel else []
    if p == "both":
        out: list[str] = []
        if amadeus:
            out.append("amadeus")
        if duffel:
            out.append("duffel")
        return out
    # auto
    out: list[str] = []
    if amadeus:
        out.append("amadeus")
    if duffel:
        out.append("duffel")
    return out


def _response_mode(amadeus, duffel) -> str:
    if amadeus:
        return "amadeus"
    if duffel:
        return "duffel"
    return "links_only"


def _int_env(name: str, default: int, lo: int, hi: int) -> int:
    try:
        v = int((os.getenv(name) or "").strip())
    except (TypeError, ValueError):
        return default
    return max(lo, min(v, hi))


def _money_to_float(raw: Any) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    cleaned = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
    if not cleaned:
        return None
    try:
        n = float(cleaned)
    except (TypeError, ValueError):
        return None
    if n < 0:
        return None
    return n


def _iso_day(raw: Any) -> str | None:
    s = str(raw or "").strip()[:10]
    if len(s) != 10:
        return None
    try:
        datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None
    return s


def _day_range(start_raw: Any, end_raw: Any) -> tuple[str, str] | None:
    s = _iso_day(start_raw)
    e = _iso_day(end_raw)
    if not s and not e:
        return None
    if s and e:
        if s <= e:
            return s, e
        return e, s
    only = s or e
    return only, only


def _middle_day(start_day: str, end_day: str) -> str:
    try:
        a = datetime.strptime(start_day, "%Y-%m-%d")
        b = datetime.strptime(end_day, "%Y-%m-%d")
    except ValueError:
        return start_day
    lo = min(a, b)
    hi = max(a, b)
    mid = lo + timedelta(days=(hi - lo).days // 2)
    return mid.strftime("%Y-%m-%d")


def _ranges_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return a_start <= b_end and a_end >= b_start


def _approval_signal(raw: Any) -> float:
    try:
        f = float(raw)
        return max(0.0, min(1.0, f))
    except (TypeError, ValueError):
        return 0.5


def _deep_links(
    origin_iata: str,
    city: str,
    outbound: str,
    inbound: str | None,
    hotel_check_in: str | None = None,
    hotel_check_out: str | None = None,
) -> dict[str, str | None]:
    city_q = quote_plus(city or "travel")
    flights_q = quote_plus(f"flights from {origin_iata} to {city} on {outbound}")
    hi = _iso_day(hotel_check_in) or (_iso_day(outbound) if outbound else None)
    ho = _iso_day(hotel_check_out) or (_iso_day(inbound) if inbound else None)
    stay_tail = f" check out {ho}" if ho else ""
    if hi:
        hotels_q = quote_plus(f"hotels in {city} check in {hi}{stay_tail}")
    else:
        hotels_q = quote_plus(f"hotels in {city}")
    extra = f" return {inbound}" if inbound else ""
    flights_q2 = quote_plus(f"flights from {origin_iata} to {city} on {outbound}{extra}")
    return {
        "googleFlightsSearch": f"https://www.google.com/travel/flights?q={flights_q2}",
        "googleHotelsSearch": f"https://www.google.com/travel/hotels?q={hotels_q}",
        "googleFlightsShort": f"https://www.google.com/travel/flights?q={flights_q}",
        "kayakExploreHint": f"https://www.kayak.com/explore/{origin_iata.upper()}-{city_q}?depart={outbound}",
    }


def _flight_bookable_any(offers: list[dict[str, Any]], reason: str | None = None) -> dict[str, Any]:
    if not offers:
        return {"bookable": False, "reason": "No flight offers returned for these parameters."}
    return {"bookable": True, "reason": reason or "Flight offers returned — verify fare rules before booking."}


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


def _hotel_without_amadeus_block(scrape_on: bool, deep_links: dict[str, Any] | None = None) -> dict:
    """Duffel/other flights can work without Amadeus; hotels use SerpAPI, deep links, and scrape."""
    _ = scrape_on
    gh = (deep_links or {}).get("googleHotelsSearch") if isinstance(deep_links, dict) else None
    offers: list[dict[str, Any]] = []
    if isinstance(gh, str) and gh.strip():
        offers.append(
            {
                "hotelId": None,
                "hotelName": "Google Hotels (search this trip)",
                "checkIn": None,
                "checkOut": None,
                "total": None,
                "currency": "USD",
                "boardType": "deep_link",
                "distanceMinutes": None,
                "distanceHint": None,
                "listingUrl": gh.strip()[:2000],
                "source": "deep_link",
            }
        )
    reason = (
        "No Amadeus hotel API — with SERPAPI_API_KEY set, Google Hotels rates load automatically "
        "(disable with TRAVEL_SERPAPI_GOOGLE_HOTELS=0). Otherwise use the links below."
        if not offers
        else "No hotel API — use the link below; with SerpAPI you also get priced listings when configured."
    )
    return {
        "offers": offers,
        "error": None,
        "bookable": True,
        "reason": reason,
    }


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


def _extract_amadeus_legs(offer: dict[str, Any]) -> tuple[str | None, str | None, str | None, str | None]:
    itins = offer.get("itineraries") if isinstance(offer.get("itineraries"), list) else []
    out_dep = out_arr = ret_dep = ret_arr = None
    if itins and isinstance(itins[0], dict):
        segs = itins[0].get("segments") if isinstance(itins[0].get("segments"), list) else []
        if segs and isinstance(segs[0], dict):
            dep = segs[0].get("departure")
            if isinstance(dep, dict):
                out_dep = dep.get("at")
        if segs and isinstance(segs[-1], dict):
            arr = segs[-1].get("arrival")
            if isinstance(arr, dict):
                out_arr = arr.get("at")
    if len(itins) > 1 and isinstance(itins[1], dict):
        segs = itins[1].get("segments") if isinstance(itins[1].get("segments"), list) else []
        if segs and isinstance(segs[0], dict):
            dep = segs[0].get("departure")
            if isinstance(dep, dict):
                ret_dep = dep.get("at")
        if segs and isinstance(segs[-1], dict):
            arr = segs[-1].get("arrival")
            if isinstance(arr, dict):
                ret_arr = arr.get("at")
    return out_dep, out_arr, ret_dep, ret_arr


def _extract_duffel_legs(offer: dict[str, Any]) -> tuple[str | None, str | None, str | None, str | None]:
    slices = offer.get("slices") if isinstance(offer.get("slices"), list) else []
    out_dep = out_arr = ret_dep = ret_arr = None
    if slices and isinstance(slices[0], dict):
        segs = slices[0].get("segments") if isinstance(slices[0].get("segments"), list) else []
        if segs and isinstance(segs[0], dict):
            out_dep = segs[0].get("departing_at")
        if segs and isinstance(segs[-1], dict):
            out_arr = segs[-1].get("arriving_at")
    if len(slices) > 1 and isinstance(slices[1], dict):
        segs = slices[1].get("segments") if isinstance(slices[1].get("segments"), list) else []
        if segs and isinstance(segs[0], dict):
            ret_dep = segs[0].get("departing_at")
        if segs and isinstance(segs[-1], dict):
            ret_arr = segs[-1].get("arriving_at")
    return out_dep, out_arr, ret_dep, ret_arr


def _normalize_flight_options(
    amadeus_raw: list[dict[str, Any]],
    duffel_raw: list[dict[str, Any]],
    cap: int,
) -> list[dict[str, Any]]:
    opts: list[dict[str, Any]] = []
    for i, offer in enumerate(amadeus_raw):
        s = summarize_flight_offer(offer)
        out_dep, out_arr, ret_dep, ret_arr = _extract_amadeus_legs(offer)
        opts.append(
            {
                "optionId": f"amadeus-{i + 1}",
                "source": "amadeus",
                "grandTotal": s.get("grandTotal"),
                "currency": s.get("currency") or "USD",
                "carrierSummary": s.get("carrierSummary"),
                "departureAt": s.get("departureAt"),
                "arrivalAt": s.get("arrivalAt"),
                "instantTicketingRequired": bool(s.get("instantTicketingRequired")),
                "lastTicketingDate": s.get("lastTicketingDate"),
                "outboundDepartureAt": out_dep,
                "outboundArrivalAt": out_arr,
                "returnDepartureAt": ret_dep,
                "returnArrivalAt": ret_arr,
            }
        )
    for i, offer in enumerate(duffel_raw):
        s = summarize_duffel_offer(offer)
        out_dep, out_arr, ret_dep, ret_arr = _extract_duffel_legs(offer)
        opts.append(
            {
                "optionId": f"duffel-{i + 1}",
                "source": "duffel",
                "grandTotal": s.get("grandTotal"),
                "currency": s.get("currency") or "USD",
                "carrierSummary": s.get("carrierSummary"),
                "departureAt": s.get("departureAt"),
                "arrivalAt": s.get("arrivalAt"),
                "instantTicketingRequired": bool(s.get("instantTicketingRequired")),
                "lastTicketingDate": s.get("lastTicketingDate"),
                "outboundDepartureAt": out_dep,
                "outboundArrivalAt": out_arr,
                "returnDepartureAt": ret_dep,
                "returnArrivalAt": ret_arr,
            }
        )

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for o in opts:
        key = "|".join(
            [
                str(o.get("currency") or ""),
                str(o.get("grandTotal") or ""),
                str(o.get("outboundDepartureAt") or o.get("departureAt") or ""),
                str(o.get("returnDepartureAt") or ""),
                str(o.get("carrierSummary") or ""),
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(o)

    deduped.sort(key=lambda x: (_money_to_float(x.get("grandTotal")) or 10**9, str(x.get("source") or "")))
    return deduped[:cap]


def _normalize_hotel_options(
    offers: list[dict[str, Any]],
    deep_links: dict[str, Any],
    cap: int,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, o in enumerate(offers):
        total = o.get("total")
        key = "|".join(
            [
                str(o.get("hotelName") or o.get("hotelId") or ""),
                str(o.get("listingUrl") or ""),
                str(total or ""),
                str(o.get("checkIn") or ""),
                str(o.get("checkOut") or ""),
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "optionId": f"hotel-{i + 1}",
                "hotelId": o.get("hotelId"),
                "hotelName": o.get("hotelName"),
                "checkIn": o.get("checkIn"),
                "checkOut": o.get("checkOut"),
                "total": total,
                "currency": o.get("currency") or "USD",
                "boardType": o.get("boardType"),
                "distanceMinutes": o.get("distanceMinutes"),
                "distanceHint": o.get("distanceHint"),
                "listingUrl": o.get("listingUrl"),
                "source": o.get("source") or "hotel_api",
            }
        )
    if not out and deep_links.get("googleHotelsSearch"):
        out.append(
            {
                "optionId": "hotel-link-1",
                "hotelId": None,
                "hotelName": "Google Hotels link",
                "checkIn": None,
                "checkOut": None,
                "total": None,
                "currency": "USD",
                "boardType": "links_only",
                "distanceMinutes": None,
                "distanceHint": None,
                "listingUrl": deep_links.get("googleHotelsSearch"),
                "source": "deep_link",
            }
        )
    out.sort(key=lambda x: (_money_to_float(x.get("total")) or 10**9, str(x.get("hotelName") or "")))
    return out[:cap]


def _attendance_for_row(outbound: str | None, inbound: str | None, raw: dict[str, Any]) -> dict[str, Any]:
    ob = _iso_day(outbound)
    ib = _iso_day(inbound) or ob
    if not ob or not ib:
        return {
            "canAttend": None,
            "score": 0.5,
            "eventStartDate": None,
            "eventEndDate": None,
            "assumedEventDate": None,
            "evaluation": "unknown",
        }
    stay_start, stay_end = (ob, ib) if ob <= ib else (ib, ob)
    ev_range = _day_range(raw.get("eventStartDate"), raw.get("eventEndDate"))
    if not ev_range:
        mid = _middle_day(stay_start, stay_end)
        return {
            "canAttend": True,
            "score": 0.7,
            "eventStartDate": mid,
            "eventEndDate": mid,
            "assumedEventDate": mid,
            "evaluation": "assumed_midpoint",
        }
    can = _ranges_overlap(stay_start, stay_end, ev_range[0], ev_range[1])
    return {
        "canAttend": can,
        "score": 1.0 if can else 0.0,
        "eventStartDate": ev_range[0],
        "eventEndDate": ev_range[1],
        "assumedEventDate": None,
        "evaluation": "event_dates",
    }


def _build_bundle_options(
    flight_options: list[dict[str, Any]],
    hotel_options: list[dict[str, Any]],
    attendance_score: float,
    approval_signal: float,
    cap: int,
) -> list[dict[str, Any]]:
    if not flight_options:
        return []
    combos: list[dict[str, Any]] = []
    if not hotel_options:
        hotel_options = [
            {
                "optionId": "hotel-none",
                "hotelName": "Hotel not priced",
                "total": None,
                "currency": "USD",
                "source": "none",
                "listingUrl": None,
            }
        ]
    for fi, f in enumerate(flight_options):
        f_total = _money_to_float(f.get("grandTotal"))
        f_cur = str(f.get("currency") or "USD")
        for hi, h in enumerate(hotel_options):
            h_total = _money_to_float(h.get("total"))
            numeric_total = (f_total or 0.0) + (h_total or 0.0) if (f_total is not None or h_total is not None) else None
            rank_total = numeric_total if numeric_total is not None else (f_total or 10**9)
            combos.append(
                {
                    "bundleId": f"b-{fi + 1}-{hi + 1}",
                    "flightOptionId": f.get("optionId"),
                    "hotelOptionId": h.get("optionId"),
                    "flightSource": f.get("source"),
                    "hotelSource": h.get("source"),
                    "currency": f_cur or str(h.get("currency") or "USD"),
                    "flightTotal": f_total,
                    "hotelTotal": h_total,
                    "totalEstimated": numeric_total,
                    "rankTotal": rank_total,
                }
            )
    finite_totals = [c["rankTotal"] for c in combos if isinstance(c.get("rankTotal"), (int, float)) and c["rankTotal"] < 10**8]
    min_total = min(finite_totals) if finite_totals else None
    for c in combos:
        rt = c.get("rankTotal")
        price_norm = 0.0
        if isinstance(rt, (int, float)) and min_total and rt > 0:
            price_norm = max(0.0, min(1.0, min_total / rt))
        score = (attendance_score * 0.5) + (approval_signal * 0.2) + (price_norm * 0.3)
        c["score"] = round(score * 100, 2)
        c["scoreBreakdown"] = {
            "attendance": round(attendance_score, 4),
            "approval": round(approval_signal, 4),
            "price": round(price_norm, 4),
        }
    combos.sort(key=lambda x: (-(x.get("score") or 0), x.get("rankTotal") or 10**9))
    out = []
    for c in combos[:cap]:
        cc = dict(c)
        cc.pop("rankTotal", None)
        out.append(cc)
    return out


def _window_summaries(out_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for ev in out_events:
        ob = _iso_day(ev.get("outboundDate"))
        ib = _iso_day(ev.get("inboundDate"))
        if not ob:
            continue
        ib = ib or ob
        key = f"{ob}|{ib}"
        g = grouped.get(key)
        if g is None:
            g = {
                "windowStart": ob,
                "windowEnd": ib,
                "tripCount": 0,
                "cheapestFlight": None,
                "cheapestHotel": None,
                "cheapestBundle": None,
                "assumptionFlags": set(),
            }
            grouped[key] = g
        g["tripCount"] += 1
        for o in ev.get("flightOptions") or []:
            n = _money_to_float(o.get("grandTotal"))
            if n is None:
                continue
            if g["cheapestFlight"] is None or n < g["cheapestFlight"]:
                g["cheapestFlight"] = n
        for o in ev.get("hotelOptions") or []:
            n = _money_to_float(o.get("total"))
            if n is None:
                continue
            if g["cheapestHotel"] is None or n < g["cheapestHotel"]:
                g["cheapestHotel"] = n
        for b in ev.get("bundleOptions") or []:
            n = b.get("totalEstimated")
            if not isinstance(n, (int, float)):
                continue
            if g["cheapestBundle"] is None or n < g["cheapestBundle"]:
                g["cheapestBundle"] = n
        for flag in ev.get("assumptionFlags") or []:
            if isinstance(flag, str) and flag:
                g["assumptionFlags"].add(flag)
    out: list[dict[str, Any]] = []
    for row in grouped.values():
        out.append(
            {
                "windowStart": row["windowStart"],
                "windowEnd": row["windowEnd"],
                "tripCount": row["tripCount"],
                "cheapestFlight": row["cheapestFlight"],
                "cheapestHotel": row["cheapestHotel"],
                "cheapestBundle": row["cheapestBundle"],
                "assumptionFlags": sorted(list(row["assumptionFlags"])),
            }
        )
    out.sort(key=lambda x: (x.get("windowStart") or "", x.get("windowEnd") or ""))
    return out


def compute_pricing_preview(origin_iata: str, events: list[dict[str, Any]]) -> dict[str, Any]:
    amadeus = amadeus_client_or_none()
    duffel = duffel_client_or_none()
    backends = _pick_flight_backends(amadeus, duffel)
    scrape_on = scrape_enabled()
    mode = _response_mode(amadeus, duffel)

    flight_cap = _int_env("TRAVEL_MATRIX_FLIGHT_CAP", 12, 3, 40)
    hotel_cap = _int_env("TRAVEL_MATRIX_HOTEL_CAP", 10, 3, 30)
    bundle_cap = _int_env("TRAVEL_MATRIX_BUNDLE_CAP", 20, 3, 80)
    fetch_amadeus_max = max(5, flight_cap)
    fetch_duffel_max = max(8, flight_cap)

    out_events: list[dict[str, Any]] = []

    for raw in events:
        if not isinstance(raw, dict):
            continue
        item_id = raw.get("itemId")
        title = str(raw.get("title") or "Trip")[:300]
        dest_q = str(raw.get("destinationQuery") or raw.get("location") or "").strip()
        ob = _iso_day(raw.get("outboundDate"))
        ib = _iso_day(raw.get("inboundDate"))
        ch_in = _iso_day(raw.get("checkIn") or ob)
        ch_out = _iso_day(raw.get("checkOut") or ib or ob)
        if ch_in and ch_out:
            ch_out = _ensure_checkout_after_checkin(ch_in, ch_out)
        elif ch_in:
            ch_out = _ensure_checkout_after_checkin(ch_in, ch_in)
        try:
            adults = max(1, min(int(raw.get("adults") or 1), 9))
        except (TypeError, ValueError):
            adults = 1
        approval_signal = _approval_signal(raw.get("approvalSignal"))
        attendance = _attendance_for_row(ob, ib, raw)
        assumption_flags: list[str] = []
        if attendance.get("evaluation") == "assumed_midpoint":
            assumption_flags.append("event_time_assumed_from_window_midpoint")
        if attendance.get("canAttend") is False:
            assumption_flags.append("trip_window_misses_event_dates")

        row: dict[str, Any] = {
            "itemId": item_id,
            "title": title,
            "destinationQuery": dest_q,
            "outboundDate": ob,
            "inboundDate": ib or ob,
            "deepLinks": _deep_links(origin_iata, dest_q or "destination", ob or "", ib),
            "resolvedDestination": None,
            "flightSource": "+".join(backends) if backends else "none",
            "attendance": attendance,
        }

        dest_code: str | None = None
        dest_label: str | None = None
        if amadeus and dest_q:
            try:
                dest_code, dest_label = amadeus.resolve_iata(dest_q)
            except AmadeusError:
                dest_code, dest_label = None, None
        if duffel and dest_q and not dest_code:
            try:
                dest_code, dest_label = duffel.suggest_airport_iata(dest_q)
            except DuffelError:
                dest_code, dest_label = None, None
        if dest_code or dest_label:
            row["resolvedDestination"] = {"iata": dest_code, "label": dest_label}

        amadeus_flight_raw: list[dict[str, Any]] = []
        duffel_flight_raw: list[dict[str, Any]] = []
        flight_errors: list[str] = []
        if not (dest_q and ob):
            flight_errors.append("Need destination and outbound date for flight search.")
        elif not backends:
            flight_errors.append("Neither Amadeus nor Duffel is configured — use deep links.")
        elif not dest_code:
            flight_errors.append("Could not resolve destination to an airport IATA code.")
        else:
            if "amadeus" in backends and amadeus:
                try:
                    amadeus_flight_raw = amadeus.flight_offers(
                        origin_iata, dest_code, ob, ib, adults=adults, max_offers=fetch_amadeus_max
                    )
                except AmadeusError as e:
                    flight_errors.append(str(e))
            if "duffel" in backends and duffel:
                try:
                    duffel_flight_raw = duffel.search_flight_offers(
                        origin_iata, dest_code, ob, ib, adults=adults, max_offers=fetch_duffel_max
                    )
                except DuffelError as e:
                    flight_errors.append(str(e))

        flight_options = _normalize_flight_options(amadeus_flight_raw, duffel_flight_raw, cap=flight_cap)
        flight_summaries = [
            {
                "grandTotal": o.get("grandTotal"),
                "currency": o.get("currency"),
                "carrierSummary": o.get("carrierSummary"),
                "departureAt": o.get("departureAt"),
                "arrivalAt": o.get("arrivalAt"),
                "instantTicketingRequired": o.get("instantTicketingRequired"),
                "lastTicketingDate": o.get("lastTicketingDate"),
                "numItineraries": 2 if o.get("returnDepartureAt") else 1,
                "source": o.get("source"),
            }
            for o in flight_options
        ]
        if not flight_options:
            assumption_flags.append("no_live_flight_offer_rows")
        row["flightOptions"] = flight_options
        row["flight"] = {
            "offers": flight_summaries,
            "error": "; ".join(flight_errors) if flight_errors and not flight_summaries else None,
            **_flight_bookable_any(
                flight_summaries,
                reason="Flight options returned across providers — verify fare rules before booking."
                if flight_summaries
                else (flight_errors[0] if flight_errors else "No flight offers returned for these parameters."),
            ),
        }

        hotel_rows: list[dict[str, Any]] = []
        hotel_errs: list[str] = []
        if ch_in and ch_out and dest_q:
            if amadeus:
                try:
                    hotel_rows.extend(amadeus.hotel_offers_for_city(dest_q, ch_in, ch_out, adults=adults))
                except AmadeusError as e:
                    hotel_errs.append(str(e))
            if serpapi_google_hotels_enabled():
                gh_offers, gh_err = serpapi_google_hotels_offer_rows(
                    dest_q, ch_in[:10], ch_out[:10], adults=adults, max_properties=max(10, hotel_cap)
                )
                if gh_offers:
                    hotel_rows.extend(gh_offers)
                elif not gh_err:
                    hotel_errs.append("SerpAPI Google Hotels returned no properties for this search.")
                if gh_err:
                    hotel_errs.append(gh_err)
        else:
            hotel_errs.append("Missing check-in/check-out or destination for hotel search.")

        if not amadeus and not serpapi_google_hotels_enabled() and not hotel_rows:
            row["hotel"] = _hotel_without_amadeus_block(scrape_on, row.get("deepLinks"))
        else:
            dists = [x["distanceMinutes"] for x in hotel_rows if isinstance(x.get("distanceMinutes"), (int, float))]
            avg_dist = int(round(sum(dists) / len(dists))) if dists else None
            dist_summary = (
                f"Avg ~{avg_dist} min across these listings (Google Hotels transit hints; not exact venue distance)."
                if avg_dist is not None
                else None
            )
            row["hotel"] = {
                "offers": hotel_rows[: max(8, hotel_cap)],
                "error": "; ".join(hotel_errs) if hotel_errs else None,
                **_hotel_bookable_summary(hotel_rows),
                "averageDistanceMinutes": avg_dist,
                "distanceSummary": dist_summary,
            }
        hotel_options = _normalize_hotel_options(row["hotel"].get("offers") or [], row["deepLinks"], cap=hotel_cap)
        # UI and clients read `hotel.offers`; normalization may add deep-link rows only there.
        if not row["hotel"].get("offers") and hotel_options:
            row["hotel"]["offers"] = [
                {
                    "hotelName": h.get("hotelName"),
                    "hotelId": h.get("hotelId"),
                    "total": h.get("total"),
                    "currency": h.get("currency"),
                    "listingUrl": h.get("listingUrl"),
                    "distanceMinutes": h.get("distanceMinutes"),
                    "distanceHint": h.get("distanceHint"),
                    "boardType": h.get("boardType"),
                    "source": h.get("source"),
                    "checkIn": h.get("checkIn"),
                    "checkOut": h.get("checkOut"),
                }
                for h in hotel_options
            ]
            if row["hotel"].get("bookable") is False and not (row["hotel"].get("error") or "").strip():
                row["hotel"]["bookable"] = True
                row["hotel"]["reason"] = (
                    row["hotel"].get("reason")
                    or "Use the hotel links below — enable Amadeus or SerpAPI for live rate rows."
                )

        if not any(_money_to_float(h.get("total")) is not None for h in hotel_options):
            assumption_flags.append("hotel_rates_unpriced_links_or_scrape_only")
        row["hotelOptions"] = hotel_options

        row["scrapedOptions"] = []
        row["scrapeNote"] = None
        if scrape_on and ob:
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

        bundles = _build_bundle_options(
            flight_options=row["flightOptions"],
            hotel_options=row["hotelOptions"],
            attendance_score=float(attendance.get("score") or 0.0),
            approval_signal=approval_signal,
            cap=bundle_cap,
        )
        row["bundleOptions"] = bundles
        row["assumptionFlags"] = assumption_flags
        row["matrixSummary"] = {
            "flightOptionsCount": len(row["flightOptions"]),
            "hotelOptionsCount": len(row["hotelOptions"]),
            "bundleOptionsCount": len(row["bundleOptions"]),
            "bestBundleTotal": bundles[0].get("totalEstimated") if bundles else None,
            "bestBundleScore": bundles[0].get("score") if bundles else None,
        }
        out_events.append(row)

    return {
        "mode": mode,
        "flightBackend": "+".join(backends) if backends else "none",
        "flightBackends": backends,
        "scrapeEnabled": scrape_on,
        "matrixCaps": {
            "flightOptions": flight_cap,
            "hotelOptions": hotel_cap,
            "bundleOptions": bundle_cap,
        },
        "windowSummaries": _window_summaries(out_events),
        "tripEvaluations": out_events,
        "events": out_events,
    }


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
    return jsonify(compute_pricing_preview(origin_iata=origin_iata, events=events)), 200
