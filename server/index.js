import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

// Add stealth plugin
puppeteer.use(StealthPlugin());

const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Root endpoint to check if server is running
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/scraper/test', (req, res) => {
  console.log('GET /api/scraper/test called');
  res.json({ success: true, message: 'Scraper API is accessible' });
});

app.post('/api/scraper/test', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let browser;
  try {
    console.log('🧭 Launching browser...');
    
    // Launch browser with proper error handling
    try {
      const path = await chromium.executablePath();
      console.log('📍 Chromium path:', path);

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: path,
        headless: 'new',
        ignoreHTTPSErrors: true
      });

      console.log('✅ Browser launched successfully');
    } catch (launchErr) {
      console.error('🔥 Browser launch failed:', launchErr);
      return res.status(500).json({
        error: 'Failed to launch browser',
        details: launchErr.message
      });
    }

    // Check if browser was created successfully
    if (!browser) {
      console.error("❗ Browser was not created.");
      return res.status(500).json({ error: "Browser not available after launch attempt" });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Navigate to login page with error handling
    try {
      console.log('🌐 Navigating to login page...');
      await page.goto('https://app.salesdock.nl/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      console.log('📄 Login page loaded');
    } catch (navigationErr) {
      console.error('❌ Navigation failed:', navigationErr);
      return res.status(500).json({
        error: 'Failed to load login page',
        details: navigationErr.message
      });
    }

    // Wait for and fill form fields
    try {
      await page.waitForSelector('input[name="email"]', { timeout: 30000 });
      await page.waitForSelector('input[name="password"]', { timeout: 30000 });

      // Clear fields first
      await page.$eval('input[name="email"]', el => el.value = '');
      await page.$eval('input[name="password"]', el => el.value = '');

      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);
    } catch (formErr) {
      console.error('❌ Form interaction failed:', formErr);
      return res.status(500).json({
        error: 'Failed to interact with login form',
        details: formErr.message
      });
    }

    // Submit form and check result
    try {
      console.log('🔐 Submitting login form...');
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        }),
        page.click('button[type="submit"]')
      ]);

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
        console.log('💥 Page HTML after login attempt:\n', html);

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

      console.log('✅ Login successful');
      return res.json({ success: true });

    } catch (loginErr) {
      console.error('❌ Login failed:', loginErr);
      return res.status(401).json({
        error: loginErr.message || 'Login failed',
        details: loginErr.stack
      });
    }

  } catch (error) {
    console.error('SCRAPER ERROR:', error);
    return res.status(500).json({ 
      error: error.message || 'Unexpected error',
      details: error.stack
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('🧹 Browser closed successfully');
      } catch (closeErr) {
        console.error('⚠️ Error closing browser:', closeErr);
      }
    }
  }
});

// Catch-all route
app.use('*', (req, res) => {
  console.log(`Received request for: ${req.originalUrl}`);
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} at ${new Date().toISOString()}`);
});
