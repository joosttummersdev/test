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
    console.log('Waiting before navigation...');
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to login page with retry logic
    let navigationSuccess = false;
    let navigationError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Navigation attempt ${attempt}...`);
        await page.goto('https://app.salesdock.nl/login', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        navigationSuccess = true;
        break;
      } catch (err) {
        navigationError = err;
        console.error(`Navigation attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          console.log('Waiting before retry...');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error(`Navigation failed after 3 attempts: ${navigationError?.message}`);
    }

    // Add delay after navigation
    console.log('Waiting after navigation...');
    await new Promise(r => setTimeout(r, 2000));

    // Wait for login form with retry
    console.log('Waiting for login form...');
    let formFound = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await Promise.all([
          page.waitForSelector('input[name="email"]', { timeout: 30000 }),
          page.waitForSelector('input[name="password"]', { timeout: 30000 })
        ]);
        formFound = true;
        break;
      } catch (err) {
        console.error(`Form detection attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          console.log('Waiting before retry...');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!formFound) {
      throw new Error('Login form not found after 3 attempts');
    }

    // Clear fields first
    await page.$eval('input[name="email"]', (el: any) => el.value = '');
    await page.$eval('input[name="password"]', (el: any) => el.value = '');

    // Fill login form
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);

    // Add delay before clicking
    console.log('Waiting before click...');
    await new Promise(r => setTimeout(r, 2000));

    // Find and click login button
    const submitButton = await page.waitForSelector('button[type="submit"]', {
      timeout: 30000
    });

    if (!submitButton) {
      throw new Error('Login button not found');
    }

    // Click and wait for navigation with retry
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Login attempt ${attempt}...`);
        await Promise.all([
          page.waitForNavigation({ 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          }),
          submitButton.click()
        ]);
        loginSuccess = true;
        break;
      } catch (err) {
        console.error(`Login attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          console.log('Waiting before retry...');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!loginSuccess) {
      throw new Error('Login navigation failed after 3 attempts');
    }

    // Add delay after login navigation
    console.log('Waiting after login...');
    await new Promise(r => setTimeout(r, 2000));

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
      await browser.close();
    }
  }
}