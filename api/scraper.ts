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
    // Launch browser with specific Chrome flags
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreHTTPSErrors: true,
      timeout: 60000
    });

    const page = await browser.newPage();
    
    // Set longer timeout for navigation
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.88 Safari/537.36');

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Add delay before navigation
    await new Promise(r => setTimeout(r, 2000));

    // Navigation with retries
    let success = false;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Navigation attempt ${attempt}...`);
        await page.goto('https://app.salesdock.nl/login', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        success = true;
        break;
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!success) {
      throw new Error(`Navigation failed after 3 attempts: ${lastError?.message}`);
    }

    // Wait for login form with increased timeouts
    await Promise.all([
      page.waitForSelector('input[name="email"]', { timeout: 30000 }),
      page.waitForSelector('input[name="password"]', { timeout: 30000 })
    ]);

    // Clear and fill form fields
    await page.$eval('input[name="email"]', (el: any) => el.value = '');
    await page.$eval('input[name="password"]', (el: any) => el.value = '');
    
    await page.type('input[name="email"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    // Add delay before clicking
    await new Promise(r => setTimeout(r, 2000));

    // Click login button
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
        timeout: 30000 
      }),
      submitButton.click()
    ]);

    // Add delay after navigation
    await new Promise(r => setTimeout(r, 2000));

    // Check for successful login
    const isLoggedIn = await Promise.race([
      page.waitForSelector('.dashboard-container', { 
        timeout: 30000,
        visible: true 
      }).then(() => true).catch(() => false),
      
      page.waitForSelector('nav.main-menu', {
        timeout: 30000,
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
  } catch (error: any) {
    console.error('SCRAPER ERROR:', error);
    return res.status(error.message.includes('Login failed') ? 401 : 500).json({ 
      error: error.message,
      details: error.stack 
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}