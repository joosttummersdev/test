import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';
import path from 'path';

// Get environment variables with fallbacks
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'https://jvurixmxrkgyzeqxwcvs.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dXJpeG14cmtneXplcXh3Y3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNTY5MzIsImV4cCI6MjA1ODgzMjkzMn0.bIxHpWYRvddWIqtby7N5dEJ6GXx1YOh0s86_tCRzc70';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dXJpeG14cmtneXplcXh3Y3ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzI1NjkzMiwiZXhwIjoyMDU4ODMyOTMyfQ.TfrBTmZOhnq-0CufkJX9Xu2hRWI2mYUhXJ3vkfXvA9E';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    speedInsights: {
      enabled: true,
    },
    imageService: true,
    devImageService: 'sharp',
    imagesConfig: {
      sizes: [640, 750, 828, 1080, 1200, 1920],
      domains: ['jvurixmxrkgyzeqxwcvs.supabase.co'],
      formats: ['image/avif', 'image/webp'],
    },
    maxDuration: 60
  }),
  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*.tsx', '**/pages/**/*.tsx']
    }), 
    tailwind()
  ],
  server: {
    host: true,
    port: 4321,
    timeout: 120000,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey, X-Client-Info",
      "Access-Control-Allow-Credentials": "true"
    }
  },
  vite: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(supabaseServiceRoleKey)
    },
    build: {
      sourcemap: true
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    }
  }
});