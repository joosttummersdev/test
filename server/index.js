import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

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
    // Launch browser with detailed error handling
    try {
      const path = await chromium.executablePath();
      console.log("📍 Chromium path:", path);

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: path,
        headless: "new",
        ignoreHTTPSErrors: true,
      });

      console.log("✅ Browser launched");
    } catch (launchErr) {
      console.error("🔥 Failed to launch browser:", launchErr.message);
      return res.status(500).json({ error: "Puppeteer launch failed", details: launchErr.message });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to login page
    await page.goto('https://app.salesdock.nl/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Fill login form
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);

    // Submit form and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('button[type="submit"]')
    ]);

    // Check for successful login
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('.dashboard-container, nav.main-menu');
    });

    if (!isLoggedIn) {
      const html = await page.content();
      console.log('💥 Page HTML after login attempt:\n', html);

      const errorText = await page.evaluate(() => {
        const errorElement = document.querySelector('.alert-danger, .error-message');
        return errorElement ? errorElement.textContent : null;
      });

      throw new Error(errorText || 'Login failed');
    }

    res.json({ success: true, message: 'Login successful' });

  } catch (error) {
    console.error('Error:', error);
    res.status(401).json({ 
      error: error.message || 'Login failed',
      details: error.stack
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("🧹 Browser closed successfully");
      } catch (closeErr) {
        console.error("⚠️ Error closing browser:", closeErr.message);
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
