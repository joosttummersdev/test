import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';

// Add stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
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

    // Navigate to login page with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto('https://app.salesdock.nl/login', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await page.waitForTimeout(5000); // Wait before retry
      }
    }

    // Wait for login form
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });
    await page.waitForSelector('input[name="password"]', { timeout: 30000 });

    // Clear fields first
    await page.$eval('input[name="email"]', (el) => el.value = '');
    await page.$eval('input[name="password"]', (el) => el.value = '');

    // Fill login form
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.send('✅ Scraper backend is running');
});

app.listen(port, () => {
  console.log(`Scraper API server running at http://localhost:${port}`);
});
