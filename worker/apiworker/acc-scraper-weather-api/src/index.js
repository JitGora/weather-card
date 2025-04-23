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

      // Helper function to create text handlers that trim and push to array
      const createTextHandler = (array) => {
        let currentText = '';
        return {
          text(textChunk) {
            currentText += textChunk.text;
            if (textChunk.lastInTextNode) {
              const trimmedText = currentText.trim();
              if (trimmedText) { // Only push non-empty strings
                array.push(trimmedText);
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
      // Using temporary variables within the handler scope for label/value pairs
      let currentLabel = '';
      let currentValue = '';

      rewriter.on('a.cur-con-weather-card.is-desktop h2.cur-con-weather-card__title', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop p.cur-con-weather-card__subtitle', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body div.temp', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body div.real-feel', createTextHandler(extractedData));
      rewriter.on('a.cur-con-weather-card.is-desktop div.cur-con-weather-card__body span.phrase', createTextHandler(extractedData));

      // Handler for detail items (Wind, Gusts, Air Quality)
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail', {
          element(el) {
              // Reset temps for each detail item
              currentLabel = '';
              currentValue = '';
          },
          // After processing the detail item, push the combined string if both parts were found
          onEndTag(end) {
              if (currentLabel && currentValue) {
                  extractedData.push(`${currentLabel}: ${currentValue}`);
              }
              // Important: Reset even if only one part was found or if nothing was found
              currentLabel = '';
              currentValue = '';
          }
      });
      // Capture label text within the current detail item
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail span.label', {
          text(text) {
              currentLabel += text.text;
              // Trim only when we are sure it's the last text chunk for the label
              if (text.lastInTextNode) currentLabel = currentLabel.trim();
          }
      });
       // Capture value text within the current detail item
      rewriter.on('a.cur-con-weather-card.is-desktop div.spaced-content.detail span.value', {
          text(text) {
              currentValue += text.text;
              // Trim only when we are sure it's the last text chunk for the value
               if (text.lastInTextNode) currentValue = currentValue.trim();
          }
      });

      // --- Extract Hourly Weather Data ---
      rewriter.on('div.hourly-list-wrapper.content-module > h2', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item span.hourly-list__list__item-time', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item span.hourly-list__list__item-temp', createTextHandler(extractedData));
      rewriter.on('div.hourly-list-wrapper.content-module a.hourly-list__list__item div.hourly-list__list__item-precip > span', createTextHandler(extractedData));

      // --- Extract 10-Day Weather Data ---
      // Using temp vars for complex items like date and precipitation
      let currentDailyDate = '';
      let currentPrecipText = '';

      rewriter.on('div.daily-list.content-module > h2', createTextHandler(extractedData));

      // Handle daily items individually
      rewriter.on('div.daily-list.content-module a.daily-list-item', {
          element(el) {
              // Reset accumulators for each new daily item
              currentDailyDate = '';
              currentPrecipText = '';
          },
           onEndTag(end) {
              // Push accumulated precipitation text if any exists
              if (currentPrecipText) {
                 extractedData.push(currentPrecipText.trim());
              }
              // Reset precip text regardless for the next item
              currentPrecipText = '';
           }
      });

      // Date (combines day and date paragraphs)
      rewriter.on('div.daily-list.content-module a.daily-list-item div.date p', {
        text(text) {
           currentDailyDate += text.text;
           if (text.lastInTextNode) {
              // Add a space between day and date parts if needed
              currentDailyDate += ' ';
           }
        },
        // After all <p> tags inside div.date are processed for an item
        onEndTag(end) {
            const trimmedDate = currentDailyDate.trim();
            if (trimmedDate) {
               extractedData.push(trimmedDate);
            }
            // Reset needed here? No, reset happens at the start of the parent 'a.daily-list-item'
        }
      });
      // Needs to be attached *after* the element handler for div.date
      rewriter.on('div.daily-list.content-module a.daily-list-item div.date', {
          onEndTag(end) {
             // This ensures the date text is pushed *after* both p tags are processed
             const trimmedDate = currentDailyDate.trim();
             if (trimmedDate) {
                // Avoid double-pushing if already pushed by p's onEndTag (though that shouldn't happen with current logic)
                // Let's push it here to be safe about timing.
                // extractedData.push(trimmedDate); // Pushing here might duplicate if p handler pushes too.
                // Safest is to let the 'p' handler push and clear currentDailyDate in item's element handler.
             }
             // Clear it here *if* we decide to push here. Let's stick to resetting in the 'a' element handler.
          }
      });


      rewriter.on('div.daily-list.content-module a.daily-list-item span.temp-hi', createTextHandler(extractedData));
      rewriter.on('div.daily-list.content-module a.daily-list-item span.temp-lo', createTextHandler(extractedData));
      rewriter.on('div.daily-list.content-module a.daily-list-item div.phrase > p.no-wrap', createTextHandler(extractedData));
      rewriter.on('div.daily-list.content-module a.daily-list-item div.phrase > span.night > p.no-wrap', createTextHandler(extractedData));
      // Precipitation (captures direct text children)
      rewriter.on('div.daily-list.content-module a.daily-list-item div.precip', {
         text(text) {
            // Only capture direct text children (HTMLRewriter does this by default with text handlers on parent)
            currentPrecipText += text.text;
            // Note: No reliable lastInTextNode here for direct children, handled in parent element's onEndTag
         }
      });


      // --- Extract Sun & Moon Data ---
       // Using temp vars for label/value pairs
       let currentSunMoonLabel = '';
       let currentSunMoonValue = '';
       let currentSunMoonCombined = ''; // To hold assembled "Label Value" string

      rewriter.on('div.sunrise-sunset.content-module > h2', createTextHandler(extractedData));
      rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__item span.sunrise-sunset__phrase', createTextHandler(extractedData));

       // Handler for Rise/Set time items
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item', {
          element(el) {
             // Reset temps for each times-item (Rise or Set)
             currentSunMoonLabel = '';
             currentSunMoonValue = '';
             currentSunMoonCombined = '';
          },
          onEndTag(end) {
             // Combine and push after processing the times-item
             if (currentSunMoonLabel && currentSunMoonValue) {
                currentSunMoonCombined = `${currentSunMoonLabel} ${currentSunMoonValue}`;
                extractedData.push(currentSunMoonCombined.trim());
             }
             // Reset temps
             currentSunMoonLabel = '';
             currentSunMoonValue = '';
             currentSunMoonCombined = '';
          }
       });
       // Capture label text within the current times-item
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item span.sunrise-sunset__times-label', {
          text(text) {
             currentSunMoonLabel += text.text;
             if(text.lastInTextNode) currentSunMoonLabel = currentSunMoonLabel.trim();
          }
       });
        // Capture value text within the current times-item
       rewriter.on('div.sunrise-sunset.content-module div.sunrise-sunset__times-item span.sunrise-sunset__times-value', {
          text(text) {
             currentSunMoonValue += text.text;
              if(text.lastInTextNode) currentSunMoonValue = currentSunMoonValue.trim();
          }
       });

      // --- Process the response ---
      // Pass the response body through the rewriter.
      // This triggers the handlers, which populate the extractedData array.
      await rewriter.transform(response).arrayBuffer(); // We need to consume the body

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