import type { APIRoute } from 'astro';
import nodeFetch from 'node-fetch';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const post: APIRoute = async ({ request }) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get credentials from request
    const { username, password } = await request.json();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    console.log('Sending request to scraper API...');

    const fetch = globalThis.fetch || nodeFetch;
    
    // Forward request to scraper service
    const response = await fetch('https://scraper-73dv.onrender.com/api/scraper/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scraper test failed');
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data), 
      { 
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error: any) {
    console.error('Scraper test error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unexpected error',
        details: error.stack
      }), 
      { 
        status: error.message.includes('Login failed') ? 401 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
};
