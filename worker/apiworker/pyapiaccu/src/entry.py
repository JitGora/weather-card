# from js import Response

# async def on_fetch(request, env):
#     return Response.new("Hello World!")

import json
import re  # you can replace this by `import regex as re` if you prefer
from datetime import datetime

import requests


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0 Safari/537.36"
)


def _extract_next_data(html: str) -> dict:
    """
    Pull the JSON string out of the   <script id="__NEXT_DATA__">  tag
    and load it into a Python dict.
    """
    m = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not m:
        raise ValueError("Unable to locate __NEXT_DATA__ in page source")

    return json.loads(m.group(1))


def _find_query(queries: list[dict], key_part: str) -> dict | None:
    """
    Convenience helper – AccuWeather stores multiple GraphQL queries
    in   dehydratedState["queries"].
    We grab the one whose 'queryKey' contains the fragment we want.
    """
    for q in queries:
        for fragment in q.get("queryKey", []):
            if isinstance(fragment, str) and key_part in fragment:
                return q.get("state", {}).get("data")
    return None


def scrape_accuweather(url: str) -> str:
    """
    Scrape the AccuWeather *web* page (no API key needed) and return
    a JSON string similar to what your BeautifulSoup version produced.
    """
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as exc:
        return json.dumps({"error": f"Network‑error: {exc}"}, indent=2)

    try:
        # 1. Pull the big piece of JSON out of the page
        next_data = _extract_next_data(html)

        # 2. That JSON has the interesting bits tucked away in:
        #    props → pageProps → dehydratedState → queries
        queries = (
            next_data.get("props", {})
            .get("pageProps", {})
            .get("dehydratedState", {})
            .get("queries", [])
        )

        # --------------------------------------------------------------------
        # 3. CURRENT CONDITIONS
        # --------------------------------------------------------------------
        current_blob = _find_query(queries, "current-conditions")
        current_weather = {
            "location": (
                current_blob.get("headline", {}).get("canonicalLocationName")
                if current_blob
                else None
            ),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M"),
            "temperature": None,
            "real_feel": None,
            "condition": None,
            "details": [],
        }

        if current_blob:
            temp = current_blob.get("temperature")
            rf_temp = current_blob.get("realFeelTemperature")

            if temp:
                current_weather["temperature"] = (
                    f'{temp["value"]}°{temp["unit"]}'
                    if isinstance(temp, dict)
                    else temp
                )
            if rf_temp:
                current_weather["real_feel"] = (
                    f'{rf_temp["value"]}°{rf_temp["unit"]}'
                    if isinstance(rf_temp, dict)
                    else rf_temp
                )

            current_weather["condition"] = current_blob.get("weatherText")

            # Example extra details we can safely expose
            for label in (
                "humidity",
                "pressure",
                "cloudCover",
                "wind",
                "visibility",
            ):
                if label in current_blob and current_blob[label] is not None:
                    val = current_blob[label]
                    # wind & some others come back as dicts, others as numbers
                    if isinstance(val, dict) and "value" in val:
                        text_val = f'{val["value"]} {val.get("unit", "")}'.strip()
                    else:
                        text_val = str(val)
                    current_weather["details"].append(
                        {"label": label.replace("_", " ").title(), "value": text_val}
                    )

        # --------------------------------------------------------------------
        # 4. HOURLY FORECAST  (take first 12 hours)
        # --------------------------------------------------------------------
        hourly_blob = _find_query(queries, "hourly")
        hourly_forecast = []
        if hourly_blob and isinstance(hourly_blob, list):
            for hour in hourly_blob[:12]:
                hourly_forecast.append(
                    {
                        "time": hour.get("dateTime"),
                        "temperature": (
                            f'{hour["temperature"]["value"]}°{hour["temperature"]["unit"]}'
                            if hour.get("temperature")
                            else None
                        ),
                        "precipitation": f"{hour.get('precipitationProbability', '--')}%",
                    }
                )

        # --------------------------------------------------------------------
        # 5. DAILY FORECAST (10‑day)
        # --------------------------------------------------------------------
        daily_blob = _find_query(queries, "10day")
        daily_forecast = []
        if daily_blob and isinstance(daily_blob, list):
            for day in daily_blob[:10]:
                daily_forecast.append(
                    {
                        "day": day.get("date"),
                        "high": (
                            f'{day["temperature"]["maximum"]["value"]}°{day["temperature"]["maximum"]["unit"]}'
                            if day.get("temperature")
                            else None
                        ),
                        "low": (
                            f'{day["temperature"]["minimum"]["value"]}°{day["temperature"]["minimum"]["unit"]}'
                            if day.get("temperature")
                            else None
                        ),
                        "day_condition": day.get("day", {}).get("iconPhrase"),
                        "night_condition": day.get("night", {}).get("iconPhrase"),
                        "precipitation": f'{day.get("day", {}).get("precipitationProbability", "--")}%'
                        f' / {day.get("night", {}).get("precipitationProbability", "--")}%'
                        ,
                    }
                )

        # --------------------------------------------------------------------
        # 6. AIR QUALITY
        # --------------------------------------------------------------------
        air_blob = _find_query(queries, "air-quality")
        air_quality = {
            "status": air_blob.get("category") if air_blob else None,
            "description": air_blob.get("text") if air_blob else None,
        }

        # --------------------------------------------------------------------
        # 7. Assemble final JSON
        # --------------------------------------------------------------------
        weather_data = {
            "current_weather": current_weather,
            "hourly_forecast": hourly_forecast,
            "daily_forecast": daily_forecast,
            "air_quality": air_quality,
            "last_updated": datetime.now().isoformat(timespec="seconds"),
        }
        return json.dumps(weather_data, indent=2)

    except Exception as exc:
        return json.dumps({"error": f"Parser‑error: {exc}"}, indent=2)


# ─────────────────────────────
# Example quick test
# ─────────────────────────────
if __name__ == "__main__":
    print(
        scrape_accuweather(
            "https://www.accuweather.com/en/in/khurja/196449/weather-forecast/196449"
        )
    )