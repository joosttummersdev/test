import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import puppeteer from 'npm:puppeteer-core@19.11.1';
import chromium from 'npm:@sparticuz/chromium@112.0.0';

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
    // Get credentials from request
    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    console.log('Launching browser...');

    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
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

      // Add delay before navigation
      await new Promise(r => setTimeout(r, 1000));

      // Navigate to login page
      await page.goto('https://app.salesdock.nl/login', {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });

      // Add delay after navigation
      await new Promise(r => setTimeout(r, 1000));

      // Wait for login form
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });

      // Clear fields first
      await page.$eval('input[name="email"]', (el: any) => el.value = '');
      await page.$eval('input[name="password"]', (el: any) => el.value = '');

      // Fill login form
      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);

      // Add delay before clicking
      await new Promise(r => setTimeout(r, 1000));

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

      // Add delay after navigation
      await new Promise(r => setTimeout(r, 1000));

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
  } catch (error: any) {
    console.error('SCRAPER ERROR:', error);
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
});