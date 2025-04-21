import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as cheerio from 'cheerio'

const app = new Hono()

// Enable CORS
app.use('*', cors())

// Hardcoded API key for development
const FIRE_CRAWL_API_KEY = 'fc-bd74b398b4cc48899e6456h4536h4356' // Replace with your actual key

// Helper function to scrape AccuWeather
async function scrapeWeather(locationKey: string) {
  const url = `https://www.accuweather.com/en/in/seethal/${locationKey}/weather-forecast/${locationKey}`
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRE_CRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url,
        includeTags: [
          'div.today-forecast-card',
          'div.cur-con-weather-card',
          'div.daily-list-item',
          'div.hourly-list__list__item'
        ]
      })
    })

    if (!response.ok) throw new Error('Failed to fetch data')
    
    const data = await response.json()
    return parseWeatherData(data.markdown)
  } catch (error) {
    console.error('Scraping error:', error)
    throw error
  }
}

// Parse the markdown into structured JSON
function parseWeatherData(markdown: string) {
  const $ = cheerio.load(markdown)
  
  const currentWeather = {
    temperature: $('div.cur-con-weather-card__body div.temp').text().trim(),
    realFeel: $('div.real-feel span.value').text().trim(),
    condition: $('div.cur-con-weather-card__body span.phrase').text().trim(),
    wind: $('div.details-container div.spaced-content:contains("Wind") span.value').text().trim(),
    humidity: $('div.details-container div.spaced-content:contains("Humidity") span.value').text().trim(),
    icon: $('div.cur-con-weather-card__body img.icon').attr('src')
  }

  const hourlyForecast = $('div.hourly-list__list__item').map((i, el) => ({
    time: $(el).find('span.hourly-list__list__item-time').text().trim(),
    temperature: $(el).find('span.hourly-list__list__item-temp').text().trim(),
    condition: $(el).find('img.hourly-list__list__item-icon').attr('alt') || '',
    precipitation: $(el).find('div.hourly-list__list__item-precip').text().trim(),
    icon: $(el).find('img.hourly-list__list__item-icon').attr('src')
  })).get()

  const dailyForecast = $('a.daily-list-item').map((i, el) => ({
    date: $(el).find('div.date p.day').text().trim(),
    highTemp: $(el).find('div.temp span.temp-hi').text().trim(),
    lowTemp: $(el).find('div.temp span.temp-lo').text().trim(),
    dayCondition: $(el).find('div.phrase').text().trim(),
    nightCondition: $(el).find('p.no-wrap span.night').text().trim(),
    precipitation: $(el).find('div.precip').text().trim(),
    dayIcon: $(el).find('img.icon').attr('src'),
    nightIcon: $(el).find('img.night-icon').attr('src')
  })).get()

  return {
    currentWeather,
    hourlyForecast: hourlyForecast.slice(0, 12), // Next 12 hours
    dailyForecast: dailyForecast.slice(0, 5),    // Next 5 days
    timestamp: new Date().toISOString()
  }
}

// API Routes
app.get('/', (c) => c.text('Weather API - Use /:locationKey'))

app.get('/:locationKey', async (c) => {
  const locationKey = c.req.param('locationKey')

  try {
    const weatherData = await scrapeWeather(locationKey)
    return c.json(weatherData)
  } catch (error) {
    return c.json({ error: 'Failed to fetch weather data' }, 500)
  }
})

export default app