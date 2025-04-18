import type { APIRoute } from 'astro';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';

puppeteer.use(StealthPlugin());

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export const post: APIRoute = async ({ request }) => {
  let browser;
  try {
    // Get credentials from request
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
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
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Add delay after navigation
      await new Promise(r => setTimeout(r, 1000));

      // Wait for login form
      await page.waitForSelector('input[name="email"]', { timeout: 30000 });
      await page.waitForSelector('input[name="password"]', { timeout: 30000 });

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
        timeout: 30000
      });

      if (!submitButton) {
        throw new Error('Login button not found');
      }

      // Click and wait for navigation
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        }),
        submitButton.click()
      ]);

      // Add delay after navigation
      await new Promise(r => setTimeout(r, 1000));

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
        const html = await page.content();
        console.log("💥 Page HTML after login attempt:\n", html);

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
        { headers: corsHeaders }
      );
    } finally {
      if (browser) {
        await browser.close();
      }
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
        headers: corsHeaders
      }
    );
  }
};

export const get: APIRoute = async () => {
  return new Response(
    JSON.stringify({ error: "Use POST method with JSON body containing username and password." }), 
    { 
      status: 405,
      headers: corsHeaders
    }
  );
};
