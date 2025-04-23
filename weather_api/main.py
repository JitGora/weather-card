import requests
from bs4 import BeautifulSoup
import sys
from flask import Flask, jsonify, request, Response

# Initialize Flask app
app = Flask(__name__)

# The URL to scrape - hardcoded as per the request
SCRAPING_URL = "https://www.accuweather.com/en/in/khurja/196449/weather-forecast/196449"

# --- Scraping Logic (Encapsulated in a function) ---
def scrape_weather_data(url):
    """Fetches and scrapes weather data from the given URL."""
    extracted_data_list = []

    try:
        # Fetch the page content
        response = requests.get(url)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        # Parse the HTML
        soup = BeautifulSoup(response.content, 'html.parser')

        # --- Extract Header City Name and Temperature ---
        header_city_link = soup.select_one("a.header-city-link")
        if header_city_link:
            city_name_h1 = header_city_link.select_one("h1.header-loc")
            if city_name_h1:
                extracted_data_list.append(city_name_h1.get_text(strip=True))
            header_temp_span = header_city_link.select_one("span.header-temp")
            if header_temp_span:
                extracted_data_list.append(header_temp_span.get_text(strip=True))

        # --- Extract Today's Weather Data ---
        today_card = soup.select_one("div.today-forecast-card.content-module > a")
        if today_card:
            today_header = today_card.select_one("div.card-header.spaced-content > h2")
            if today_header:
                extracted_data_list.append(today_header.get_text(strip=True))
            today_date = today_card.select_one("div.card-header.spaced-content > p.sub")
            if today_date:
                extracted_data_list.append(today_date.get_text(strip=True))
            day_forecast_p = today_card.select_one("div.body > div.body-item:nth-child(1) > p")
            if day_forecast_p:
                extracted_data_list.append(day_forecast_p.get_text(strip=True))
            night_forecast_p = today_card.select_one("div.body > div.body-item:nth-child(2) > p")
            if night_forecast_p:
                extracted_data_list.append(night_forecast_p.get_text(strip=True))

        # --- Extract Current Weather Data ---
        current_card = soup.select_one("a.cur-con-weather-card.is-desktop.lbar-panel.content-module")
        if current_card:
            current_header = current_card.select_one("div.title-container > h2.cur-con-weather-card__title")
            if current_header:
                extracted_data_list.append(current_header.get_text(strip=True))
            current_timestamp = current_card.select_one("div.title-container > p.cur-con-weather-card__subtitle")
            if current_timestamp:
                extracted_data_list.append(current_timestamp.get_text(strip=True))
            current_temp = current_card.select_one("div.cur-con-weather-card__body div.forecast-container div.temp")
            if current_temp:
                extracted_data_list.append(current_temp.get_text(strip=True))
            real_feel = current_card.select_one("div.cur-con-weather-card__body div.forecast-container div.real-feel")
            if real_feel:
                extracted_data_list.append(real_feel.get_text(strip=True))
            current_phrase = current_card.select_one("div.cur-con-weather-card__body span.phrase")
            if current_phrase:
                extracted_data_list.append(current_phrase.get_text(strip=True))
            details_container = current_card.select_one("div.cur-con-weather-card__panel.details-container")
            if details_container:
                detail_items = details_container.select("div.spaced-content.detail")
                for detail in detail_items:
                    label_span = detail.select_one("span.label")
                    value_span = detail.select_one("span.value")
                    if label_span and value_span:
                        extracted_data_list.append(f"{label_span.get_text(strip=True)}: {value_span.get_text(strip=True)}")

        # --- Extract Hourly Weather Data ---
        hourly_header = soup.select_one("div.hourly-list-wrapper.content-module > h2")
        if hourly_header:
            extracted_data_list.append(hourly_header.get_text(strip=True))
        hourly_list_container = soup.select_one("div.hourly-list-wrapper.content-module div.hourly-list__list")
        if hourly_list_container:
            hourly_items = hourly_list_container.select("a.hourly-list__list__item")
            for item in hourly_items:
                time_span = item.select_one("span.hourly-list__list__item-time")
                if time_span:
                    extracted_data_list.append(time_span.get_text(strip=True))
                temp_span = item.select_one("span.hourly-list__list__item-temp")
                if temp_span:
                    extracted_data_list.append(temp_span.get_text(strip=True))
                precip_span = item.select_one("div.hourly-list__list__item-precip > span")
                if precip_span:
                     extracted_data_list.append(precip_span.get_text(strip=True))

        # --- Extract 10-Day Weather Data ---
        daily_header = soup.select_one("div.daily-list.content-module > h2")
        if daily_header:
            extracted_data_list.append(daily_header.get_text(strip=True))
        daily_list_body = soup.select_one("div.daily-list.content-module div.daily-list-body")
        if daily_list_body:
            daily_items = daily_list_body.select("a.daily-list-item")
            for item in daily_items:
                date_div = item.select_one("div.date")
                if date_div:
                    date_text = " ".join([p.get_text(strip=True) for p in date_div.select("p") if p.get_text(strip=True)])
                    if date_text:
                        extracted_data_list.append(date_text)
                temp_hi_span = item.select_one("span.temp-hi")
                if temp_hi_span:
                    extracted_data_list.append(temp_hi_span.get_text(strip=True))
                temp_lo_span = item.select_one("span.temp-lo")
                if temp_lo_span:
                    extracted_data_list.append(temp_lo_span.get_text(strip=True))
                day_phrase_p = item.select_one("div.phrase > p.no-wrap")
                if day_phrase_p:
                    extracted_data_list.append(day_phrase_p.get_text(strip=True))
                night_phrase_p = item.select_one("div.phrase > span.night > p.no-wrap")
                if night_phrase_p:
                    extracted_data_list.append(night_phrase_p.get_text(strip=True))
                precip_div = item.select_one("div.precip")
                if precip_div:
                    precip_text = "".join(precip_div.find_all(string=True, recursive=False)).strip()
                    if precip_text:
                        extracted_data_list.append(precip_text)

        # --- Extract Sun & Moon Data ---
        sun_moon_header = soup.select_one("div.sunrise-sunset.content-module > h2")
        if sun_moon_header:
            extracted_data_list.append(sun_moon_header.get_text(strip=True))
        sun_moon_body = soup.select_one("div.sunrise-sunset.content-module div.sunrise-sunset__body")
        if sun_moon_body:
            sun_moon_items = sun_moon_body.select("div.sunrise-sunset__item")
            for item in sun_moon_items:
                phrase_span = item.select_one("span.sunrise-sunset__phrase")
                if phrase_span:
                    extracted_data_list.append(phrase_span.get_text(strip=True))
                rise_item = item.select_one("div.sunrise-sunset__times-item:nth-child(1)")
                if rise_item:
                    rise_label = rise_item.select_one("span.sunrise-sunset__times-label")
                    rise_value = rise_item.select_one("span.sunrise-sunset__times-value")
                    if rise_label and rise_value:
                        extracted_data_list.append(f"{rise_label.get_text(strip=True)} {rise_value.get_text(strip=True)}")
                set_item = item.select_one("div.sunrise-sunset__times-item:nth-child(2)")
                if set_item:
                    set_label = set_item.select_one("span.sunrise-sunset__times-label")
                    set_value = set_item.select_one("span.sunrise-sunset__times-value")
                    if set_label and set_value:
                        extracted_data_list.append(f"{set_label.get_text(strip=True)} {set_value.get_text(strip=True)}")

        return extracted_data_list

    except requests.exceptions.RequestException as e:
        # Return a tuple with an error message and the original exception
        return {"error": f"Error fetching the page: {e}"}
    except Exception as e:
        # Catch any other parsing or extraction errors
        return {"error": f"An unexpected error occurred during scraping: {e}"}

# --- Flask Routes ---

@app.route('/')
def index():
    """Simple welcome page."""
    return "Weather Scraper Flask App. Go to /api/weather to get data."

@app.route('/api/weather', methods=['GET'])
def get_weather_data():
    """Endpoint to return scraped weather data as JSON."""
    data = scrape_weather_data(SCRAPING_URL)

    # Check if the scraping function returned an error dictionary
    if isinstance(data, dict) and "error" in data:
        return jsonify(data), 500 # Return error message and 500 status code
    elif not data:
         return jsonify({"message": "No data found using the specified structure."}), 404 # Or 200 with an empty list depending on preference
    else:
        # Return the list of extracted data as a JSON array
        return jsonify(data)

# --- Running the app (Development Server) ---
if __name__ == '__main__':
    # WARNING: Do NOT use debug=True or app.run() in a production environment!
    # Use a production WSGI server like Gunicorn or uWSGI instead.
    print("Running Flask development server. DO NOT USE IN PRODUCTION.")
    print("Go to http://127.0.0.1:5000/api/weather")
    app.run(debug=True) # debug=True for development, turn off for production