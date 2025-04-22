# from js import Response

# async def on_fetch(request, env):
#     return Response.new("Hello World!")


import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

def scrape_accuweather(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Current weather data
        current_weather = {
            'location': soup.select_one('.header-loc').get_text(strip=True) if soup.select_one('.header-loc') else None,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': soup.select_one('.cur-con-weather-card__subtitle').get_text(strip=True) if soup.select_one('.cur-con-weather-card__subtitle') else None,
            'temperature': soup.select_one('.temp').get_text(strip=True) if soup.select_one('.temp') else None,
            'real_feel': soup.select_one('.real-feel').get_text(strip=True).replace('RealFeel®', '').strip() if soup.select_one('.real-feel') else None,
            'condition': soup.select_one('.phrase').get_text(strip=True) if soup.select_one('.phrase') else None,
            'details': []
        }
        
        # Current weather details
        for detail in soup.select('.spaced-content.detail'):
            label = detail.select_one('.label').get_text(strip=True) if detail.select_one('.label') else None
            value = detail.select_one('.value').get_text(strip=True) if detail.select_one('.value') else None
            if label and value:
                current_weather['details'].append({
                    'label': label,
                    'value': value
                })
        
        # Today's forecast
        today_forecast = {
            'date': soup.select_one('.today-forecast-card .sub').get_text(strip=True) if soup.select_one('.today-forecast-card .sub') else None,
            'day': {
                'condition': soup.select_one('.today-forecast-card .body-item:nth-of-type(1) p').get_text(strip=True).split(';')[0] if soup.select_one('.today-forecast-card .body-item:nth-of-type(1) p') else None,
                'high': soup.select_one('.today-forecast-card .body-item:nth-of-type(1) b').get_text(strip=True) if soup.select_one('.today-forecast-card .body-item:nth-of-type(1) b') else None
            },
            'night': {
                'condition': soup.select_one('.today-forecast-card .body-item:nth-of-type(2) p').get_text(strip=True) if soup.select_one('.today-forecast-card .body-item:nth-of-type(2) p') else None,
                'low': soup.select_one('.today-forecast-card .body-item:nth-of-type(2) b').get_text(strip=True) if soup.select_one('.today-forecast-card .body-item:nth-of-type(2) b') else None
            }
        }
        
        # Hourly forecast
        hourly_forecast = []
        for hour in soup.select('.hourly-list__list__item')[:12]:  # Get next 12 hours
            hourly_forecast.append({
                'time': hour.select_one('.hourly-list__list__item-time').get_text(strip=True) if hour.select_one('.hourly-list__list__item-time') else None,
                'temperature': hour.select_one('.hourly-list__list__item-temp').get_text(strip=True) if hour.select_one('.hourly-list__list__item-temp') else None,
                'precipitation': hour.select_one('.hourly-list__list__item-precip span').get_text(strip=True) if hour.select_one('.hourly-list__list__item-precip span') else None
            })
        
        # Daily forecast (10-day)
        daily_forecast = []
        for day in soup.select('.daily-list-item')[:10]:  # Get 10 days
            daily_forecast.append({
                'day': day.select_one('.day').get_text(strip=True) if day.select_one('.day') else None,
                'date': day.select_one('.date p:not(.day)').get_text(strip=True) if day.select_one('.date p:not(.day)') else None,
                'high': day.select_one('.temp-hi').get_text(strip=True) if day.select_one('.temp-hi') else None,
                'low': day.select_one('.temp-lo').get_text(strip=True) if day.select_one('.temp-lo') else None,
                'day_condition': day.select_one('.phrase p.no-wrap').get_text(strip=True) if day.select_one('.phrase p.no-wrap') else None,
                'night_condition': day.select_one('.night p.no-wrap').get_text(strip=True) if day.select_one('.night p.no-wrap') else None,
                'precipitation': day.select_one('.precip').get_text(strip=True) if day.select_one('.precip') else None
            })
        
        # Air quality
        air_quality = {
            'status': soup.select_one('.air-quality-module__row__category').get_text(strip=True) if soup.select_one('.air-quality-module__row__category') else None,
            'description': soup.select_one('.air-quality-module__statement').get_text(strip=True) if soup.select_one('.air-quality-module__statement') else None
        }
        
        # Construct final JSON
        weather_data = {
            'current_weather': current_weather,
            'today_forecast': today_forecast,
            'hourly_forecast': hourly_forecast,
            'daily_forecast': daily_forecast,
            'air_quality': air_quality,
            'last_updated': datetime.now().isoformat()
        }
        
        return json.dumps(weather_data, indent=2)
        
    except requests.exceptions.RequestException as e:
        return json.dumps({'error': f"Error fetching the page: {e}"}, indent=2)
    except Exception as e:
        return json.dumps({'error': f"An error occurred: {e}"}, indent=2)

# Example usage
url = "https://www.accuweather.com/en/in/khurja/196449/weather-forecast/196449"
weather_json = scrape_accuweather(url)
print(weather_json)