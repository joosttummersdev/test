import type { APIRoute } from 'astro';

export const post: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: true,
      message: "✅ Mock: scraper connected!",
      data: {
        result: "login successful",
        timestamp: new Date().toISOString()
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};
