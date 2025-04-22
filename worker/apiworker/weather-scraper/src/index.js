import cheerio from "cheerio";

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/116 Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    try {
      const { searchParams } = new URL(request.url);
      const pageURL = searchParams.get('url');
      if (!pageURL) {
        return json({ error: 'Missing ?url=' }, 400);
      }

      const htmlResp = await fetch(pageURL, { headers: { 'User-Agent': UA } });
      if (!htmlResp.ok) {
        return json({ error: `AccuWeather responded ${htmlResp.status}` }, 502);
      }
      const html = await htmlResp.text();
      const data = scrape(html);
      data.last_updated = new Date().toISOString();
      return json(data);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

function scrape(html) {
  const $ = cheerio.load(html);

  const current_weather = {
    location: $('.header-loc').text().trim() || null,
    date: new Date().toISOString().slice(0, 10),
    time: $('.cur-con-weather-card__subtitle').text().trim() || null,
    temperature: $('.temp').first().text().trim() || null,
    real_feel: $('.real-feel').text().replace('RealFeel®', '').trim() || null,
    condition: $('.phrase').first().text().trim() || null,
    details: []
  };

  $('.spaced-content.detail').each((_, el) => {
    const label = $(el).find('.label').text().trim();
    const value = $(el).find('.value').text().trim();
    if (label && value) current_weather.details.push({ label, value });
  });

  const today_forecast = {
    date: $('.today-forecast-card .sub').first().text().trim() || null,
    day: {
      condition: $('.today-forecast-card .body-item:nth-of-type(1) p')
        .first()
        .text()
        .split(';')[0]
        .trim() || null,
      high: $('.today-forecast-card .body-item:nth-of-type(1) b')
        .first()
        .text()
        .trim() || null
    },
    night: {
      condition: $('.today-forecast-card .body-item:nth-of-type(2) p')
        .first()
        .text()
        .trim() || null,
      low: $('.today-forecast-card .body-item:nth-of-type(2) b')
        .first()
        .text()
        .trim() || null
    }
  };

  const hourly_forecast = [];
  $('.hourly-list__list__item')
    .slice(0, 12)
    .each((_, el) => {
      hourly_forecast.push({
        time: $(el).find('.hourly-list__list__item-time').text().trim() || null,
        temperature: $(el).find('.hourly-list__list__item-temp').text().trim() || null,
        precipitation: $(el).find('.hourly-list__list__item-precip span').text().trim() || null
      });
    });

  const daily_forecast = [];
  $('.daily-list-item')
    .slice(0, 10)
    .each((_, el) => {
      daily_forecast.push({
        day: $(el).find('.day').text().trim() || null,
        date: $(el).find('.date p:not(.day)').text().trim() || null,
        high: $(el).find('.temp-hi').text().trim() || null,
        low: $(el).find('.temp-lo').text().trim() || null,
        day_condition: $(el).find('.phrase p.no-wrap').text().trim() || null,
        night_condition: $(el).find('.night p.no-wrap').text().trim() || null,
        precipitation: $(el).find('.precip').text().trim() || null
      });
    });

  const air_quality = {
    status: $('.air-quality-module__row__category').text().trim() || null,
    description: $('.air-quality-module__statement').text().trim() || null
  };

  return { current_weather, today_forecast, hourly_forecast, daily_forecast, air_quality };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8' }
  });
}