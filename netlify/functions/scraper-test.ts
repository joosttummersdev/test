import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Configure CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Check for request body
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing request body' })
    };
  }

  // Safely parse JSON body
  let credentials;
  try {
    credentials = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON', details: err.message })
    };
  }

  // Validate required fields
  const { username, password } = credentials;
  if (!username || !password) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Username and password are required' })
    };
  }

  let browser;
  try {
    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreHTTPSErrors: true
    });

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
      waitUntil: 'domcontentloaded', // ✅ Use domcontentloaded instead of networkidle0
      timeout: 60000
    });

    // Add delay after navigation
    await new Promise(r => setTimeout(r, 1000));

    // Wait for login form
    await page.waitForSelector('input[name="email"]', { timeout: 30000 }); // ✅ Increased timeout
    await page.waitForSelector('input[name="password"]', { timeout: 30000 }); // ✅ Increased timeout

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
      timeout: 30000 // ✅ Increased timeout
    });

    if (!submitButton) {
      throw new Error('Login button not found');
    }

    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', // ✅ Use domcontentloaded instead of networkidle0
        timeout: 60000 
      }),
      submitButton.click()
    ]);

    // Add delay after navigation
    await new Promise(r => setTimeout(r, 1000));

    // Check for successful login
    const isLoggedIn = await Promise.race([
      page.waitForSelector('.dashboard-container', { 
        timeout: 30000, // ✅ Increased timeout
        visible: true 
      }).then(() => {
        console.log('Found dashboard container');
        return true;
      }).catch(() => false),
      
      page.waitForSelector('nav.main-menu', {
        timeout: 30000, // ✅ Increased timeout
        visible: true
      }).then(() => {
        console.log('Found navigation menu');
        return true;
      }).catch(() => false)
    ]);

    if (!isLoggedIn) {
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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error processing file:', error);
    return {
      statusCode: error.message.includes('Login failed') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error.message || 'Unexpected error',
        details: error.stack
      })
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};