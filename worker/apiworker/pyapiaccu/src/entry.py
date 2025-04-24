from js import Response, fetch
import json

async def on_fetch(request, env):
    try:
        # Target URL (could also pass this as a request parameter)
        url = "https://www.accuweather.com/en/in/khurja/196449/weather-forecast/196449"
        
        # Fetch the page with headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
        response = await fetch(url, headers=headers)
        
        if not response.ok:
            return Response.json(
                {"error": f"Failed to fetch: {response.status}"},
                status=response.status
            )
        
        html = await response.text()
        
        # Process the HTML (using Pyodide's built-in HTML parser)
        from pyodide.ffi import create_proxy
        from js import DOMParser, document
        
        parser = DOMParser.new()
        doc = parser.parseFromString(html, "text/html")
        
        # Helper function to query the DOM
        def query_text(selector):
            el = doc.querySelector(selector)
            return el.textContent.strip() if el else None
        
        # Extract data
        data = {
            "location": query_text("a.header-city-link h1.header-loc"),
            "current_temp": query_text("a.header-city-link span.header-temp"),
            "current_weather": {
                "time": query_text("a.cur-con-weather-card p.cur-con-weather-card__subtitle"),
                "temp": query_text("a.cur-con-weather-card div.temp"),
                "realfeel": query_text("a.cur-con-weather-card div.real-feel"),
                "condition": query_text("a.cur-con-weather-card span.phrase"),
                "wind": query_text("a.cur-con-weather-card span.label:-soup-contains('Wind') + span.value"),
                "air_quality": query_text("a.cur-con-weather-card span.label:-soup-contains('Air Quality') + span.value")
            },
            "hourly": [],
            "daily": []
        }
        
        # Hourly forecast
        hourly_items = doc.querySelectorAll("a.hourly-list__list__item")
        for item in hourly_items:
            data["hourly"].append({
                "time": item.querySelector("span.hourly-list__list__item-time").textContent.strip(),
                "temp": item.querySelector("span.hourly-list__list__item-temp").textContent.strip(),
                "precip": item.querySelector("div.hourly-list__list__item-precip span").textContent.strip()
            })
        
        # Daily forecast
        daily_items = doc.querySelectorAll("a.daily-list-item")
        for item in daily_items:
            data["daily"].append({
                "date": " ".join(p.textContent.strip() for p in item.querySelectorAll("div.date p")),
                "high": item.querySelector("span.temp-hi").textContent.strip(),
                "low": item.querySelector("span.temp-lo").textContent.strip(),
                "day_condition": item.querySelector("div.phrase > p.no-wrap").textContent.strip(),
                "night_condition": item.querySelector("div.phrase > span.night > p.no-wrap").textContent.strip(),
                "precip": item.querySelector("div.precip").textContent.strip()
            })
        
        # Sun/Moon data
        data["astronomy"] = {
            "daylight": query_text("span.sunrise-sunset__phrase:-soup-contains('hrs')"),
            "sunrise": query_text("span.sunrise-sunset__times-value:-soup-contains('AM')"),
            "sunset": query_text("span.sunrise-sunset__times-value:-soup-contains('PM')"),
            "moon_phase": query_text("span.sunrise-sunset__phrase:-soup-contains('Moon')")
        }
        
        return Response.json(data)
        
    except Exception as e:
        return Response.json(
            {"error": str(e)},
            status=500
        )