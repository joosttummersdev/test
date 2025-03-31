import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreHTTPSErrors: true
    });
    console.log('Browser launched successfully');

    const page = await browser.newPage();
    console.log('New page created');
    
    // Set longer timeout for navigation
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    console.log('Timeouts configured');

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    console.log('Viewport and user agent set');

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    console.log('Request interception enabled');

    // Add delay before navigation
    console.log('Waiting before navigation...');
    await new Promise(r => setTimeout(r, 1000));

    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto('https://app.salesdock.nl/login', {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 60000
    });
    console.log('Navigation complete');

    // Add delay after navigation
    console.log('Waiting after navigation...');
    await new Promise(r => setTimeout(r, 1000));

    // Wait for login form
    console.log('Waiting for login form...');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    console.log('Login form found');

    // Clear fields first
    console.log('Clearing input fields...');
    await page.$eval('input[name="email"]', (el: any) => el.value = '');
    await page.$eval('input[name="password"]', (el: any) => el.value = '');

    // Fill login form
    console.log('Filling login form...');
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);

    // Add delay before clicking
    console.log('Waiting before click...');
    await new Promise(r => setTimeout(r, 1000));

    // Find and click login button
    console.log('Looking for login button...');
    const submitButton = await page.waitForSelector('button[type="submit"]', {
      timeout: 10000
    });

    if (!submitButton) {
      throw new Error('Login button not found');
    }

    // Click and wait for navigation
    console.log('Clicking login button...');
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000 
      }),
      submitButton.click()
    ]);
    console.log('Post-login navigation complete');

    // Add delay after navigation
    console.log('Waiting after login...');
    await new Promise(r => setTimeout(r, 1000));

    // Check for successful login
    console.log('Checking login status...');
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
      console.log('Login verification failed, checking for error message...');
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
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof Error) {
      console.error('SCRAPER ERROR:', err.message);
      return res.status(err.message.includes('Login failed') ? 401 : 500).json({ 
        error: err.message,
        details: err.stack 
      });
    } else {
      console.error('SCRAPER ERROR: Unknown error occurred');
      return res.status(500).json({ 
        error: 'Unknown error occurred'
      });
    }
  } finally {
    if (browser) {
      console.log('Ensuring browser is closed...');
      await browser.close();
      console.log('Browser cleanup complete');
    }
  }
}