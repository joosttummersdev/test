import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import puppeteer from 'npm:puppeteer-extra@3.3.6';
import StealthPlugin from 'npm:puppeteer-extra-plugin-stealth@2.11.2';
import chromium from 'npm:@sparticuz/chromium@121.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Add stealth plugin
    puppeteer.use(StealthPlugin());

    // Get credentials from request
    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    console.log('Launching browser...');

    // Launch browser with proper configuration
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true
    });

    try {
      console.log('Browser launched successfully');
      const page = await browser.newPage();
      
      // Set longer timeout for navigation
      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(60000);

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      // Enable request interception
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Log navigation events
      page.on('load', () => console.log(`Page loaded: ${page.url()}`));
      page.on('error', error => console.log(`Page error: ${error.message}`));
      page.on('pageerror', error => console.log(`JS error: ${error.message}`));
      page.on('console', msg => console.log(`Console: ${msg.text()}`));

      // Navigate to login page with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('https://app.salesdock.nl/login', {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 60000
          });
          break;
        } catch (error) {
          console.log(`Navigation attempt failed (${retries} retries left):`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds before retry
        }
      }

      // Wait for login form
      await page.waitForSelector('input[name="email"]', { timeout: 30000 });
      await page.waitForSelector('input[name="password"]', { timeout: 30000 });

      // Fill login form
      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);

      // Find and click login button
      const submitButton = await page.waitForSelector('button[type="submit"]', {
        timeout: 30000
      });

      if (!submitButton) {
        throw new Error('Login button not found');
      }

      // Click and wait for navigation
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 60000 
        }),
        submitButton.click()
      ]);

      // Check for successful login
      const isLoggedIn = await Promise.race([
        page.waitForSelector('.dashboard-container', { 
          timeout: 30000,
          visible: true 
        }).then(() => {
          console.log('Found dashboard container');
          return true;
        }).catch(() => false),
        
        page.waitForSelector('nav.main-menu', {
          timeout: 30000,
          visible: true
        }).then(() => {
          console.log('Found navigation menu');
          return true;
        }).catch(() => false)
      ]);

      if (!isLoggedIn) {
        console.log('Page content after login attempt:', await page.content());
        
        const errorText = await page.evaluate(() => {
          const errorElement = document.querySelector('.alert-danger, .error-message');
          return errorElement ? errorElement.textContent : null;
        });

        if (errorText) {
          console.log('Found error message:', errorText);
          throw new Error(`Login failed: ${errorText.trim()}`);
        }

        throw new Error('Login failed: Could not verify successful login');
      }

      console.log('Login successful');

      return new Response(
        JSON.stringify({ success: true }), 
        { 
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
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
});