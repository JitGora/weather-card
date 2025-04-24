export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      // Only allow GET requests
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
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
  
        // Return the API response to the client
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (error) {
        // Handle errors
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
  
  interface Env {
    API_BASE_URL: string;
    CF_Access_Client_Id: string;
    CF_Access_Client_Secret: string;
  }