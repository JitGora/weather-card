// worker.js

// The URL to scrape
const url = "https://www.accuweather.com/en/in/khurja/196449/weather-forecast/196449";

// Headers to mimic a browser request
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// --- Helper function to decode common HTML entities ---
function decodeEntities(encodedString) {
    if (!encodedString) return '';
    // Basic replacements for common entities found
    return encodedString
        .replace(/&#xB0;/g, '°') // Degree symbol
        .replace(/&#x27;/g, "'") // Apostrophe
        .replace(/&amp;/g, '&')  // Ampersand
        .replace(/&quot;/g, '"') // Quote
        .replace(/&lt;/g, '<')   // Less than
        .replace(/&gt;/g, '>')   // Greater than
        // Add more replacements here if needed
        .trim(); // Also trim whitespace here for consistency
}


export default {
  async fetch(request, env, ctx) {
    // Array to store the extracted data items
    const extractedData = [];

    try {
      // Fetch the page content
      const response = await fetch(url, { headers: headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText} for URL: ${url}`);
      }

      // --- Set up HTMLRewriter Handlers ---
      const rewriter = new HTMLRewriter();

      // Helper function to create text handlers that trim, decode and push to array
      const createTextHandler = (array) => {
        let currentText = '';
        return {
          text(textChunk) {
            currentText += textChunk.text;
            if (textChunk.lastInTextNode) {
              const decodedText = decodeEntities(currentText); // Decode here
              if (decodedText) { // Only push non-empty strings
                array.push(decodedText);
              }
              currentText = ''; // Reset for next element potentially matching the selector
            }
          }
        };
      };

      // --- Extract Header City Name and Temperature ---
      rewriter.on('a.header-city-link h1.header-loc', createTextHandler(extractedData));
      rewriter.on('a.header-city-link span.header-temp', createTextHandler(extractedData));

      // --- Extract Today's Weather Data ---
      rewriter.on('div.today-forecast-card.content-module > a div.card-header.spaced-content > h2', createTextHandler(extractedData));
      rewriter.on('div.today-forecast-card.content-module > a div.card-header.spaced-content > p.sub', createTextHandler(extractedData));
      rewriter.on('div.today-forecast-card.content-module > a div.body > div.body-item:nth-child(1) > p', createTextHandler(extractedData));
      rewriter.on('div.today-forecast-card.content-module > a div.body > div.body-item:nth-child(2) > p', createTextHandler(extractedData));

      // --- Extract Current Weather Data ---
      let currentLabel = '';
      let currentValue = '';

      rewriter.on('a.cur-con-weather-card.is-desktop h2.cur-con-weather-card__title', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop p.cur-con-weather-card__subtitle', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body div.temp', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body div.real-feel', createTextHandler(extractedData)); // Handles RealFeel® correctly now
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body span.phrase', createTextHandler(extractedData));

      // Handler for detail items (Wind, Gusts, Air Quality)
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail', {
          element(el) {
              currentLabel = '';
              currentValue = '';
          },
          onEndTag(end) {
              // Ensure parts are decoded *before* combining
              const decodedLabel = decodeEntities(currentLabel);
              const decodedValue = decodeEntities(currentValue);
              if (decodedLabel && decodedValue) {
                  extractedData.push(`${decodedLabel}: ${decodedValue}`);
              }
              currentLabel = '';
              currentValue = '';
          }
      });
      // Capture label text within the current detail item
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail span.label', {
          text(text) {
              currentLabel += text.text;
              // No decoding here, done before push in parent handler
          }
      });
       // Capture value text within the current detail item
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail span.value', {
          text(text) {
              currentValue += text.text;
               // No decoding here, done before push in parent handler
          }
      });

      // --- Extract Hourly Weather Data ---
      rewriter.on('div.hourly-list-wrapper.content-module > h2', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item span.hourly-list__list__item-time', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item span.hourly-list__list__item-temp', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item div.hourly-list__list__item-precip > span', createTextHandler(extractedData));

      // --- Extract 10-Day Weather Data ---
      let currentDailyDate = '';
      let currentPrecipText = '';
      let currentDailyItemParts = { date: '', hi: '', lo: '', dayPhrase: '', nightPhrase: '', precip: '' }; // Store parts for one item

      rewriter.on('div.daily-list.content-module > h2', createTextHandler(extractedData));

       // Handle daily items individually
       rewriter.on('div.daily-list.content-module a.daily-list-item', {
           element(el) {
               // Reset temporary storage for each new daily item
               currentDailyDate = '';
               currentPrecipText = '';
               currentDailyItemParts = { date: '', hi: '', lo: '', dayPhrase: '', nightPhrase: '', precip: '' };
           },
           onEndTag(end) {
               // Push accumulated/decoded data for the completed item in desired order
               if (currentDailyItemParts.date) extractedData.push(currentDailyItemParts.date);
               if (currentDailyItemParts.hi) extractedData.push(currentDailyItemParts.hi);
               if (currentDailyItemParts.lo) extractedData.push(currentDailyItemParts.lo);
               if (currentDailyItemParts.dayPhrase) extractedData.push(currentDailyItemParts.dayPhrase);
               if (currentDailyItemParts.nightPhrase) extractedData.push(currentDailyItemParts.nightPhrase);
               // Push accumulated precipitation text if any exists, decode it first
               const decodedPrecip = decodeEntities(currentPrecipText);
               if (decodedPrecip) {
                   extractedData.push(decodedPrecip);
               }
               // Reset accumulators (though element handler already does this)
               currentDailyDate = '';
               currentPrecipText = '';
           }
       });

      // Date (combines day and date paragraphs) - Accumulate raw text
       rewriter.on('div.daily-list.content-module a.daily-list-item div.date p', {
           text(text) {
               currentDailyDate += text.text + (text.lastInTextNode ? ' ' : ''); // Add space between parts
           }
       });
       // Process accumulated date text when the div.date ends for an item
       rewriter.on('div.daily-list.content-module a.daily-list-item div.date', {
           onEndTag(end) {
               currentDailyItemParts.date = decodeEntities(currentDailyDate); // Decode and store
           }
       });


       // High Temp - Use a dedicated text handler to decode and store
       rewriter.on('div.daily-list.content-module a.daily-list-item span.temp-hi', {
           text(text) { if (text.lastInTextNode) currentDailyItemParts.hi = decodeEntities(text.text); }
       });
        // Low Temp - Use a dedicated text handler to decode and store
       rewriter.on('div.daily-list.content-module a.daily-list-item span.temp-lo', {
            text(text) { if (text.lastInTextNode) currentDailyItemParts.lo = decodeEntities(text.text); }
       });
       // Day Phrase - Use a dedicated text handler to decode and store
       rewriter.on('div.daily-list.content-module a.daily-list-item div.phrase > p.no-wrap', {
           text(text) { if (text.lastInTextNode) currentDailyItemParts.dayPhrase = decodeEntities(text.text); }
       });
       // Night Phrase - Use a dedicated text handler to decode and store
       rewriter.on('div.daily-list.content-module a.daily-list-item div.phrase > span.night > p.no-wrap', {
            text(text) { if (text.lastInTextNode) currentDailyItemParts.nightPhrase = decodeEntities(text.text); }
       });

       // Precipitation (accumulates direct text children)
       rewriter.on('div.daily-list.content-module a.daily-list-item div.precip', {
           text(text) {
               currentPrecipText += text.text;
               // Decoding happens in parent's onEndTag
           }
       });


      // --- Extract Sun & Moon Data ---
       let currentSunMoonLabel = '';
       let currentSunMoonValue = '';

      rewriter.on('div.sunrise-sunset.content-module > h2', createTextHandler(extractedData));
      rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__item span.sunrise-sunset__phrase', createTextHandler(extractedData));

       // Handler for Rise/Set time items
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item', {
          element(el) {
             currentSunMoonLabel = '';
             currentSunMoonValue = '';
          },
          onEndTag(end) {
             // Decode parts *before* combining
             const decodedLabel = decodeEntities(currentSunMoonLabel);
             const decodedValue = decodeEntities(currentSunMoonValue);
             if (decodedLabel && decodedValue) {
                extractedData.push(`${decodedLabel} ${decodedValue}`);
             }
             currentSunMoonLabel = '';
             currentSunMoonValue = '';
          }
       });
       // Capture label text within the current times-item
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item span.sunrise-sunset__times-label', {
          text(text) {
             currentSunMoonLabel += text.text;
             // No decoding here, done in parent's onEndTag
          }
       });
        // Capture value text within the current times-item
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item span.sunrise-sunset__times-value', {
          text(text) {
             currentSunMoonValue += text.text;
             // No decoding here, done in parent's onEndTag
          }
       });

      // --- Process the response ---
      await rewriter.transform(response).arrayBuffer();

      // --- Prepare and return the response ---
      if (extractedData.length > 0) {
        const output = extractedData.join('\n');
        return new Response(output, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } else {
        return new Response("No weather data found using the specified structure.", {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

    } catch (e) {
      console.error(`Worker Error: ${e.message}`);
      console.error(e.stack);
      return new Response(`Error fetching or parsing weather data: ${e.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};