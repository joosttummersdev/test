import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Add stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
const port = 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("✅ Scraper backend is live!");
});

// Test login endpoint
app.post('/api/scraper/test', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let browser;
  try {
    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
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
    await page.$eval('input[name="email"]', (el) => el.value = '');
    await page.$eval('input[name="password"]', (el) => el.value = '');

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
      const errorText = await page.evaluate(() => {
        const errorElement = document.querySelector('.alert-danger, .error-message');
        return errorElement ? errorElement.textContent : null;
      });

      if (errorText) {
        throw new Error(`Login failed: ${errorText.trim()}`);
      }

      throw new Error('Login failed: Could not verify successful login');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(error.message.includes('Login failed') ? 401 : 500).json({ 
      error: error.message,
      details: error.stack
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(__dirname, '../dist');

// Serve static files from Astro if the directory exists
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));

  // Only set up the fallback route if we have a frontend
  app.get('*', (req, res) => {
    const indexPath = path.join(clientPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("❌ Not Found");
    }
  });
}

app.listen(port, () => {
  console.log(`Scraper API server running at http://localhost:${port}`);
});