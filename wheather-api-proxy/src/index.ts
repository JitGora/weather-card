export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle OPTIONS method for CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Client-Id, CF-Access-Client-Secret',
        }
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        }
      });
    }

    // Extract the path from the worker URL
    const url = new URL(request.url);
    const path = url.pathname;

    // Construct the target API URL using environment variables
    const apiUrl = `${env.API_BASE_URL}${path}`;

    try {
      // Forward the request to the API provider with required headers
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'CF-Access-Client-Id': env.CF_Access_Client_Id,
          'CF-Access-Client-Secret': env.CF_Access_Client_Secret,
          // Optionally forward other headers from the original request
          ...Object.fromEntries(request.headers)
        }
      });

      // Create a new response with the API body and status, adding CORS headers
      const corsResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'Access-Control-Allow-Origin': '*',
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      });

      return corsResponse;
    } catch (error) {
      // Handle errors with CORS headers
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }
  }
};

interface Env {
  API_BASE_URL: string;
  CF_Access_Client_Id: string;
  CF_Access_Client_Secret: string;
}