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
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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

    // Navigate to login page
    await page.goto('https://app.salesdock.nl/login', {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 60000
    });

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

    // Check for successful login
    const isLoggedIn = await Promise.race([
      page.waitForSelector('.dashboard-container', { 
        timeout: 10000,
        visible: true 
      }).then(() => true).catch(() => false),
      
      page.waitForSelector('nav.main-menu', {
        timeout: 10000,
        visible: true
      }).then(() => true).catch(() => false)
    ]);

    if (!isLoggedIn) {
      const errorText = await page.evaluate(() => {
        const errorElement = document.querySelector('.alert-danger, .error-message');
        return errorElement ? errorElement.textContent : null;
      });

      if (errorText) {
        throw new Error(`Login failed: ${errorText.trim()}`);
      }

      throw new Error('Login failed: Could not verify successful login');
    }

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
    if (browser) await browser.close();
  }
}