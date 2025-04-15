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
    console.log('🧭 Launching browser...');

    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreHTTPSErrors: true
    });

    try {
      console.log('✅ Browser launched successfully');
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
      console.log('⏳ Adding pre-navigation delay...');
      await new Promise(r => setTimeout(r, 1000));

      // Navigate to login page
      console.log('🧭 Navigating to login page...');
      await page.goto('https://app.salesdock.nl/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Add delay after navigation
      console.log('⏳ Adding post-navigation delay...');
      await new Promise(r => setTimeout(r, 1000));

      // Wait for login form
      console.log('📧 Waiting for email field...');
      await page.waitForSelector('input[name="email"]', { timeout: 30000 });
      console.log('🔑 Waiting for password field...');
      await page.waitForSelector('input[name="password"]', { timeout: 30000 });

      // Clear fields first
      console.log('🧹 Clearing input fields...');
      await page.$eval('input[name="email"]', el => el.value = '');
      await page.$eval('input[name="password"]', el => el.value = '');

      // Fill login form
      console.log('✍️ Filling login form...');
      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);

      // Add delay before clicking
      console.log('⏳ Adding pre-click delay...');
      await new Promise(r => setTimeout(r, 1000));

      // Find and click login button
      console.log('🔍 Looking for login button...');
      const submitButton = await page.waitForSelector('button[type="submit"]', {
        timeout: 30000
      });

      if (!submitButton) {
        throw new Error('Login button not found');
      }

      // Click and wait for navigation
      console.log('🔐 Submitting login form...');
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        }),
        submitButton.click()
      ]);

      // Add delay after navigation
      console.log('⏳ Adding post-login delay...');
      await new Promise(r => setTimeout(r, 1000));

      // Check for successful login
      console.log('🔍 Checking login status...');
      const isLoggedIn = await Promise.race([
        page.waitForSelector('.dashboard-container', { 
          timeout: 30000,
          visible: true 
        }).then(() => {
          console.log('✅ Found dashboard container');
          return true;
        }).catch(() => false),
        
        page.waitForSelector('nav.main-menu', {
          timeout: 30000,
          visible: true
        }).then(() => {
          console.log('✅ Found navigation menu');
          return true;
        }).catch(() => false)
      ]);

      if (!isLoggedIn) {
        console.log('❌ Login verification failed, checking for error message...');
        const html = await page.content();
        console.log('💥 Page HTML after login attempt:\n', html);

        const errorText = await page.evaluate(() => {
          const errorElement = document.querySelector('.alert-danger, .error-message');
          return errorElement ? errorElement.textContent : null;
        });

        if (errorText) {
          console.log('❌ Found error message:', errorText);
          throw new Error(`Login failed: ${errorText.trim()}`);
        }

        throw new Error('Login failed: Could not verify successful login');
      }

      console.log('✅ Login successful');
      return res.json({ success: true });

    } finally {
      if (browser) {
        console.log('🧹 Closing browser...');
        await browser.close();
      }
    }
  } catch (error: any) {
    console.error('SCRAPER ERROR:', error);
    return res.status(error.message.includes('Login failed') ? 401 : 500).json({ 
      error: error.message || 'Unexpected error',
      details: error.stack
    });
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
