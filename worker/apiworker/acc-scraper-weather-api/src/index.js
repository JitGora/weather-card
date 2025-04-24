export default {
  async fetch(request, env) {
    try {
      // Only allow GET requests
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Define the target API URL (you can make this configurable via env if needed)
      const API_URL = 'https://api.weatherapi.com/v1/forecast.json';

      // Get location from query params
      const url = new URL(request.url);
      const location = url.searchParams.get('location') || 'Seethal,Rajasthan';
      const days = url.searchParams.get('days') || '10';

      // Construct the cache key
      const cacheKey = new Request(`${API_URL}?key=${env.API_KEY}&q=${location}&days=${days}`, request);
      const cache = caches.default;

      // Try to get response from cache first
      let response = await cache.match(cacheKey);

      if (!response) {
        // Make the API request with required headers
        const apiResponse = await fetch(`${API_URL}?key=${env.API_KEY}&q=${location}&days=${days}`, {
          headers: {
            'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
            'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
            'Content-Type': 'application/json'
          }
        });

        if (!apiResponse.ok) {
          throw new Error(`API request failed with status ${apiResponse.status}`);
        }

        // Clone the response to store in cache
        response = new Response(apiResponse.body, apiResponse);
        response.headers.append('Cache-Control', 's-maxage=3600'); // Cache for 1 hour

        // Store the response in cache
        await cache.put(cacheKey, response.clone());
      }

      // Set CORS headers
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

    } catch (error) {
      // Error handling
      console.error('Error:', error);
      return new Response(JSON.stringify({
        error: error.message || 'An error occurred',
        status: 500
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};