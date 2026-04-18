"""
Multi-day weather for a destination using Open-Meteo (no API key).
Separate from app.services.weather.get_weather (current conditions only).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import requests

# WMO weather codes — rough buckets for outdoor activities
_RAIN_SNOW_CODES = frozenset(
    list(range(51, 68)) + list(range(71, 78)) + list(range(80, 83)) + list(range(95, 100))
)
_BAD_OUTDOOR_CODES = _RAIN_SNOW_CODES | {45, 48}  # fog


def _geocode(location: str) -> tuple[float, float, str] | None:
    loc = (location or "").strip().replace(",", " ").replace("  ", " ").strip()
    if not loc:
        return None
    try:
        geo = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": loc, "count": 3},
            timeout=12,
        )
        geo.raise_for_status()
        results = geo.json().get("results") or []
        if not results and " " in loc:
            geo = requests.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": loc.split()[0], "count": 2},
                timeout=12,
            )
            geo.raise_for_status()
            results = geo.json().get("results") or []
        if not results:
            return None
        r = results[0]
        lat, lon = r.get("latitude"), r.get("longitude")
        if lat is None or lon is None:
            return None
        name = r.get("name", "")
        admin1 = (r.get("admin1") or "").strip()
        country = (r.get("country_code") or "").strip()
        label = name
        if admin1:
            label += f", {admin1}"
        if country:
            label += f" ({country})"
        return float(lat), float(lon), label
    except (requests.RequestException, TypeError, ValueError):
        return None


def get_weather_for_destination_and_dates(
    destination: str,
    start_date: str | date | None,
    end_date: str | date | None,
) -> dict[str, Any]:
    """
    Return normalized forecast summary for [start_date, end_date] inclusive.
    Dates as ISO strings 'YYYY-MM-DD' or date objects.
    """
    g = _geocode(destination)
    if not g:
        return {
            "ok": False,
            "error": f"Could not geocode destination: {destination!r}",
            "destinationLabel": None,
            "daily": [],
        }
    lat, lon, label = g

    try:
        if isinstance(start_date, str):
            sd = date.fromisoformat(start_date[:10])
        elif isinstance(start_date, date):
            sd = start_date
        else:
            sd = date.today()
        if isinstance(end_date, str):
            ed = date.fromisoformat(end_date[:10])
        elif isinstance(end_date, date):
            ed = end_date
        else:
            ed = sd + timedelta(days=6)
    except ValueError:
        sd = date.today()
        ed = sd + timedelta(days=6)
    if ed < sd:
        ed = sd

    if (ed - sd).days > 14:
        ed = sd + timedelta(days=14)

    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "weathercode,precipitation_sum,temperature_2m_max,temperature_2m_min",
                "timezone": "auto",
                "start_date": sd.isoformat(),
                "end_date": ed.isoformat(),
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily") or {}
        times = daily.get("time") or []
        codes = daily.get("weathercode") or []
        precip = daily.get("precipitation_sum") or []
        tmax = daily.get("temperature_2m_max") or []
        tmin = daily.get("temperature_2m_min") or []
        rows = []
        for i, t in enumerate(times):
            rows.append(
                {
                    "date": t,
                    "weatherCode": int(codes[i]) if i < len(codes) and codes[i] is not None else None,
                    "precipitationMm": float(precip[i]) if i < len(precip) and precip[i] is not None else None,
                    "tempMax": float(tmax[i]) if i < len(tmax) and tmax[i] is not None else None,
                    "tempMin": float(tmin[i]) if i < len(tmin) and tmin[i] is not None else None,
                }
            )
        return {
            "ok": True,
            "destinationLabel": label,
            "latitude": lat,
            "longitude": lon,
            "daily": rows,
            "queriedRange": {"start": sd.isoformat(), "end": ed.isoformat()},
        }
    except requests.RequestException as e:
        return {
            "ok": False,
            "error": str(e),
            "destinationLabel": label,
            "daily": [],
        }


def evaluate_weather_fit(
    weather_data: dict[str, Any],
    activity_types: list[str] | None = None,
) -> dict[str, Any]:
    """
    Classify trip weather vs activities: suitable | caution | poor_fit.
    activity_types: lowercase hints e.g. 'beach', 'hiking', 'ski', 'indoor', 'meetings'
    """
    acts = [a.strip().lower() for a in (activity_types or []) if isinstance(a, str) and a.strip()]
    daily = weather_data.get("daily") if isinstance(weather_data, dict) else None
    if not isinstance(daily, list) or not daily:
        return {
            "fit": "unknown",
            "summary": "Insufficient weather data to score the trip.",
            "badDayFraction": None,
        }

    bad_days = 0
    for row in daily:
        code = row.get("weatherCode")
        precip = row.get("precipitationMm")
        if code is None:
            continue
        c = int(code)
        is_bad = c in _BAD_OUTDOOR_CODES
        if precip is not None and float(precip) > 8:
            is_bad = True
        if is_bad:
            bad_days += 1

    n = len(daily)
    frac = bad_days / n if n else 0.0

    indoor_heavy = any(x in acts for x in ("indoor", "meetings", "conference", "museum"))
    outdoor_heavy = any(
        x in acts
        for x in (
            "beach",
            "hiking",
            "outdoor",
            "golf",
            "sightseeing",
            "walking",
        )
    )
    ski = any(x in acts for x in ("ski", "snow", "snowboard"))

    if ski:
        frac = max(0.0, frac - 0.15)

    if indoor_heavy and not outdoor_heavy:
        fit = "suitable" if frac < 0.6 else "caution"
        summary = (
            "Weather has some rough days, but indoor-focused plans should be fine."
            if fit == "caution"
            else "Weather looks workable for an indoor-leaning itinerary."
        )
    elif frac >= 0.55:
        fit = "poor_fit"
        summary = "Several days show rain, storms, or poor outdoor conditions—outdoor experience may suffer."
    elif frac >= 0.28:
        fit = "caution"
        summary = "Mixed conditions: plan backups for outdoor activities."
    else:
        fit = "suitable"
        summary = "Overall conditions look favorable for typical outdoor plans."

    return {
        "fit": fit,
        "summary": summary,
        "badDayFraction": round(frac, 3),
        "daysEvaluated": n,
        "badDaysApprox": bad_days,
    }
