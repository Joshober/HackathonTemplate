"""Weather via Open-Meteo (free, no API key). Geocode location then fetch current weather."""

import requests


def get_weather(location: str) -> str:
    """
    Get current weather for a place name (e.g. "Lamoni, Iowa" or "Lamoni Iowa").
    Returns a short summary string or an error message.
    """
    # Normalize: remove extra commas, collapse spaces (some APIs prefer "City State" over "City, State")
    location = (location or "").strip().replace(",", " ").replace("  ", " ").strip()
    if not location:
        return "Error: no location provided. Pass a city name, e.g. 'Lamoni Iowa' or 'London'."

    try:
        # Geocode: get lat/lon for the place
        geo = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": location, "count": 5},
            timeout=10,
        )
        geo.raise_for_status()
        data = geo.json()
        results = data.get("results") or []
        # If full string (e.g. "Lamoni Iowa") returns nothing, try first word (e.g. "Lamoni")
        if not results and " " in location:
            geo2 = requests.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location.split()[0], "count": 5},
                timeout=10,
            )
            geo2.raise_for_status()
            results = (geo2.json().get("results") or [])[:1]
        if not results:
            return f"No location found for '{location}'. Try a different spelling or add state/country (e.g. 'Lamoni Iowa')."

        r = results[0]
        lat = r.get("latitude")
        lon = r.get("longitude")
        name = r.get("name", "")
        admin1 = (r.get("admin1") or "").strip()  # state/region
        country = (r.get("country_code") or "").strip()
        display_name = name
        if admin1:
            display_name += f", {admin1}"
        if country:
            display_name += f" ({country})"

        # Current weather
        weather = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation",
                "timezone": "auto",
            },
            timeout=10,
        )
        weather.raise_for_status()
        w = weather.json()
        cur = w.get("current") or {}

        temp = cur.get("temperature_2m")
        unit = w.get("current_units", {}).get("temperature_2m", "°C")
        humidity = cur.get("relative_humidity_2m")
        code = cur.get("weather_code", 0)
        wind = cur.get("wind_speed_10m")
        wind_unit = w.get("current_units", {}).get("wind_speed_10m", "km/h")
        precip = cur.get("precipitation", 0)

        # WMO weather codes: 0=clear, 1-3=clouds, 45,48=fog, 51-67=rain, 71-77=snow, 80-82=showers, 95-99=thunderstorm
        code_desc = {
            0: "clear",
            1: "mainly clear",
            2: "partly cloudy",
            3: "overcast",
            45: "foggy",
            48: "depositing rime fog",
            51: "light drizzle",
            61: "light rain",
            63: "moderate rain",
            65: "heavy rain",
            71: "light snow",
            73: "moderate snow",
            75: "heavy snow",
            80: "light showers",
            81: "showers",
            82: "heavy showers",
            95: "thunderstorm",
            96: "thunderstorm with hail",
            99: "thunderstorm with heavy hail",
        }
        condition = code_desc.get(code, f"code {code}")

        parts = [f"Weather for {display_name}: {temp}{unit}, {condition}."]
        if humidity is not None:
            parts.append(f"Humidity {humidity}%.")
        if wind is not None:
            parts.append(f"Wind {wind} {wind_unit}.")
        if precip is not None and float(precip or 0) > 0:
            parts.append(f"Precipitation: {precip} mm.")

        return " ".join(parts)
    except requests.RequestException as e:
        return f"Weather API error: {e!s}"
    except Exception as e:
        return f"Weather error: {e!s}"
