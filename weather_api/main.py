import requests
from bs4 import BeautifulSoup
import sys

# The URL to scrape
url = "https://www.accuweather.com/en/in/seethal/2072058/weather-forecast/2072058"

# We will find these elements based on their structure

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
        # Extract City Name
        city_name_h1 = header_city_link.select_one("h1.header-loc")
        if city_name_h1:
            extracted_data_list.append(city_name_h1.get_text(strip=True))

        # Extract Header Temperature
        header_temp_span = header_city_link.select_one("span.header-temp")
        if header_temp_span:
             # Get text including the unit, get_text(strip=True) handles the span inside
            extracted_data_list.append(header_temp_span.get_text(strip=True))


    # --- Extract Today's Weather Data ---
    today_card = soup.select_one("div.today-forecast-card.content-module > a")

    if today_card:
        # Select the Today's Weather header
        today_header = today_card.select_one("div.card-header.spaced-content > h2")
        if today_header:
            extracted_data_list.append(today_header.get_text(strip=True))

        # Select the date
        today_date = today_card.select_one("div.card-header.spaced-content > p.sub")
        if today_date:
            extracted_data_list.append(today_date.get_text(strip=True))

        # Select the Day forecast phrase and Hi Temp
        day_forecast_p = today_card.select_one("div.body > div.body-item:nth-child(1) > p")
        if day_forecast_p:
            extracted_data_list.append(day_forecast_p.get_text(strip=True))

        # Select the Night forecast phrase and Lo Temp
        night_forecast_p = today_card.select_one("div.body > div.body-item:nth-child(2) > p")
        if night_forecast_p:
            extracted_data_list.append(night_forecast_p.get_text(strip=True))

    # --- Extract Current Weather Data ---
    current_card = soup.select_one("a.cur-con-weather-card.is-desktop.lbar-panel.content-module") # Using a more specific selector for the current weather card link

    if current_card:
        # Select the Current Weather header
        current_header = current_card.select_one("div.title-container > h2.cur-con-weather-card__title")
        if current_header:
            extracted_data_list.append(current_header.get_text(strip=True))

        # Select the timestamp
        current_timestamp = current_card.select_one("div.title-container > p.cur-con-weather-card__subtitle")
        if current_timestamp:
            extracted_data_list.append(current_timestamp.get_text(strip=True))

        # Select the Current Temperature
        current_temp = current_card.select_one("div.cur-con-weather-card__body div.forecast-container div.temp")
        if current_temp:
            extracted_data_list.append(current_temp.get_text(strip=True))

        # Select the RealFeel Temperature
        real_feel = current_card.select_one("div.cur-con-weather-card__body div.forecast-container div.real-feel")
        if real_feel:
             extracted_data_list.append(real_feel.get_text(strip=True))


        # Select the Current condition phrase
        current_phrase = current_card.select_one("div.cur-con-weather-card__body span.phrase")
        if current_phrase:
            extracted_data_list.append(current_phrase.get_text(strip=True))

        # Select details (Wind, Wind Gusts, Air Quality)
        details_container = current_card.select_one("div.cur-con-weather-card__panel.details-container")
        if details_container:
            # Find all individual detail items
            detail_items = details_container.select("div.spaced-content.detail")
            for detail in detail_items:
                label_span = detail.select_one("span.label")
                value_span = detail.select_one("span.value")
                if label_span and value_span:
                    # Combine label and value for clearer output, e.g., "Wind: WNW 13 km/h"
                    extracted_data_list.append(f"{label_span.get_text(strip=True)}: {value_span.get_text(strip=True)}")


    # --- Extract Hourly Weather Data ---
    # Select the Hourly Weather header
    hourly_header = soup.select_one("div.hourly-list-wrapper.content-module > h2")
    if hourly_header:
        extracted_data_list.append(hourly_header.get_text(strip=True))

    # Find the main container that holds the list of hourly items
    hourly_list_container = soup.select_one("div.hourly-list-wrapper.content-module div.hourly-list__list")

    if hourly_list_container:
        # Select all individual hourly forecast items within the container
        hourly_items = hourly_list_container.select("a.hourly-list__list__item")

        # Iterate through each hourly item and extract the relevant data
        for item in hourly_items:
            # Select time relative to the current item <a> tag
            time_span = item.select_one("span.hourly-list__list__item-time")
            if time_span:
                extracted_data_list.append(time_span.get_text(strip=True))

            # Select temperature relative to the current item <a> tag
            temp_span = item.select_one("span.hourly-list__list__item-temp")
            if temp_span:
                extracted_data_list.append(temp_span.get_text(strip=True))

            # Select precipitation percentage relative to the current item <a> tag
            precip_span = item.select_one("div.hourly-list__list__item-precip > span")
            if precip_span:
                 extracted_data_list.append(precip_span.get_text(strip=True))

    # --- Extract 10-Day Weather Data ---
    # Select the 10-Day Weather header
    daily_header = soup.select_one("div.daily-list.content-module > h2")
    if daily_header:
        extracted_data_list.append(daily_header.get_text(strip=True))

    # Find the container that holds the list of daily items
    daily_list_body = soup.select_one("div.daily-list.content-module div.daily-list-body")

    if daily_list_body:
        # Select all individual daily forecast items within the container
        daily_items = daily_list_body.select("a.daily-list-item")

        # Iterate through each daily item and extract the relevant data
        for item in daily_items:
            # Day and Date (combine text from both paragraphs in the date div)
            date_div = item.select_one("div.date")
            if date_div:
                date_text = " ".join([p.get_text(strip=True) for p in date_div.select("p") if p.get_text(strip=True)])
                if date_text:
                    extracted_data_list.append(date_text)

            # High Temperature
            temp_hi_span = item.select_one("span.temp-hi")
            if temp_hi_span:
                extracted_data_list.append(temp_hi_span.get_text(strip=True))

            # Low Temperature
            temp_lo_span = item.select_one("span.temp-lo")
            if temp_lo_span:
                extracted_data_list.append(temp_lo_span.get_text(strip=True))

            # Day Phrase
            day_phrase_p = item.select_one("div.phrase > p.no-wrap")
            if day_phrase_p:
                extracted_data_list.append(day_phrase_p.get_text(strip=True))

            # Night Phrase
            night_phrase_p = item.select_one("div.phrase > span.night > p.no-wrap")
            if night_phrase_p:
                extracted_data_list.append(night_phrase_p.get_text(strip=True))

            # Precipitation Percentage
            precip_div = item.select_one("div.precip")
            if precip_div:
                # Get all text nodes and join them, removing whitespace
                precip_text = "".join(precip_div.find_all(string=True, recursive=False)).strip()
                if precip_text:
                     extracted_data_list.append(precip_text)

    # --- Extract Sun & Moon Data ---
    # Select the Sun & Moon header
    sun_moon_header = soup.select_one("div.sunrise-sunset.content-module > h2")
    if sun_moon_header:
        extracted_data_list.append(sun_moon_header.get_text(strip=True))

    # Find the container that holds the Sun and Moon items
    sun_moon_body = soup.select_one("div.sunrise-sunset.content-module div.sunrise-sunset__body")

    if sun_moon_body:
        # Select all individual Sun/Moon items within the container
        sun_moon_items = sun_moon_body.select("div.sunrise-sunset__item")

        # Iterate through each item and extract the relevant data
        for item in sun_moon_items:
            # Phrase (Daylight duration or Moon Phase)
            phrase_span = item.select_one("span.sunrise-sunset__phrase")
            if phrase_span:
                extracted_data_list.append(phrase_span.get_text(strip=True))

            # Rise time label and value (first sunrise-sunset__times-item)
            rise_item = item.select_one("div.sunrise-sunset__times-item:nth-child(1)")
            if rise_item:
                rise_label = rise_item.select_one("span.sunrise-sunset__times-label")
                rise_value = rise_item.select_one("span.sunrise-sunset__times-value")
                if rise_label and rise_value:
                    extracted_data_list.append(f"{rise_label.get_text(strip=True)} {rise_value.get_text(strip=True)}")

            # Set time label and value (second sunrise-sunset__times-item)
            set_item = item.select_one("div.sunrise-sunset__times-item:nth-child(2)")
            if set_item:
                set_label = set_item.select_one("span.sunrise-sunset__times-label")
                set_value = set_item.select_one("span.sunrise-sunset__times-value")
                if set_label and set_value:
                    extracted_data_list.append(f"{set_label.get_text(strip=True)} {set_value.get_text(strip=True)}")


    # --- Print the extracted data line by line ---
    if extracted_data_list:
        for item in extracted_data_list:
            print(item)
    else:
        print("No weather data found using the specified structure.", file=sys.stderr)


except requests.exceptions.RequestException as e:
    print(f"Error fetching the page: {e}", file=sys.stderr)
    sys.exit(1) # Exit with a non-zero status code to indicate an error
except Exception as e:
    print(f"An unexpected error occurred: {e}", file=sys.stderr)
    sys.exit(1) # Exit with a non-zero status code