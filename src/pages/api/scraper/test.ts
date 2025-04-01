import type { APIRoute } from 'astro';

export const get: APIRoute = async () => {
  return new Response("✅ API works via GET", {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
};

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
