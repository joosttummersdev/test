import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import puppeteer from 'npm:puppeteer-extra@3.3.6';
import StealthPlugin from 'npm:puppeteer-extra-plugin-stealth@2.11.2';

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

  let browser;
  try {
    // Add stealth plugin
    puppeteer.use(StealthPlugin());

    // Get credentials from request
    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-accelerated-2d-canvas',
        '--window-size=1920,1080'
      ],
      timeout: 60000
    });

    try {
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

      // Log network requests
      page.on('request', request => {
        console.log(`Request: ${request.method()} ${request.url()}`);
      });

      page.on('requestfailed', request => {
        console.log(`Failed request: ${request.url()} (${request.failure()?.errorText})`);
      });

      page.on('response', response => {
        const status = response.status();
        if (status >= 400) {
          console.log(`Error response: ${response.url()} (${status})`);
        }
      });

      // Navigate to login page
      await page.goto('https://app.salesdock.nl/login', {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });

      // Log current URL
      console.log('Current URL:', await page.url());

      // Wait for login form
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });

      // Clear fields first
      await page.$eval('input[name="email"]', (el: any) => el.value = '');
      await page.$eval('input[name="password"]', (el: any) => el.value = '');

      // Fill login form
      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);

      // Find and click login button
      const submitButton = await page.waitForSelector('button[type="submit"]', {
        timeout: 10000
      });

      if (!submitButton) {
        throw new Error('Login button not found');
      }

      // Click and wait for navigation
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000 
        }),
        submitButton.click()
      ]);

      // Log new URL after navigation
      console.log('Post-login URL:', await page.url());

      // Take screenshot
      await page.screenshot({ 
        path: '/tmp/post-login.png',
        fullPage: true 
      });

      // Check for successful login
      const isLoggedIn = await Promise.race([
        page.waitForSelector('.dashboard-container', { 
          timeout: 10000,
          visible: true 
        }).then(() => {
          console.log('Found dashboard container');
          return true;
        }).catch(() => false),
        
        page.waitForSelector('nav.main-menu', {
          timeout: 10000,
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
  } catch (error) {
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