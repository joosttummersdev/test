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

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.88 Safari/537.36');

    // Block images, fonts, etc.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Add delay before navigation
    await new Promise(r => setTimeout(r, 1000));

    // Navigation retries
    const url = 'https://app.salesdock.nl/login';
    let success = false;
    let navError;

    for (let i = 1; i <= 3; i++) {
      console.log(`Navigation attempt ${i}...`);
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        success = true;
        break;
      } catch (err) {
        navError = err;
        console.error(`Navigation attempt ${i} failed:`, err);
        if (i < 3) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!success) {
      throw new Error(`Navigation failed after 3 attempts: ${navError?.message || 'Unknown error'}`);
    }

    console.log('Navigation successful');

    // Add delay after navigation
    await new Promise(r => setTimeout(r, 1000));

    // Wait for login form
    await Promise.all([
      page.waitForSelector('input[name="email"]', { timeout: 30000 }),
      page.waitForSelector('input[name="password"]', { timeout: 30000 })
    ]);

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
    console.error('SCRAPER ERROR:', err);
    return res.status(500).json({ 
      error: 'Scraper failed', 
      details: err instanceof Error ? err.message : String(err)
    });
  } finally {
    console.log('Ensuring browser is closed...');
    if (browser) await browser.close();
    console.log('Browser cleanup complete');
  }
}