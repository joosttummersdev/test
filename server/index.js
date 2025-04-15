import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

// Puppeteer stealth plugin gebruiken
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "Scraper backend is running" }));

app.post("/api/scraper/test", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  let browser;
  try {
    console.log("🧭 Launching browser...");
    const executablePath = await chromium.executablePath();
    console.log("📍 Executable path:", executablePath);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: "new",
      ignoreHTTPSErrors: true,
    });

    console.log("✅ Browser launched");

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36");

    console.log("🌐 Navigating to Salesdock login page...");
    await page.goto("https://app.salesdock.nl/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("📄 Page loaded");

    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);

    console.log("🔐 Submitting login form...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
      page.click('button[type="submit"]')
    ]);

    const isLoggedIn = await page.$(".dashboard-container");
    if (!isLoggedIn) {
      console.log("❌ Login not successful");
      const html = await page.content();
      console.log("💥 Page HTML after login attempt:\n", html);
      return res.status(401).json({ error: "Login failed. Incorrect credentials or 2FA required." });
    }

    console.log("✅ Logged in!");
    return res.json({ success: true });

  } catch (error) {
    console.error("🔥 Scraper crashed:", error);
    return res.status(500).json({ error: "Internal error in scraper", details: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("🧹 Browser closed");
      } catch (closeErr) {
        console.warn("⚠️ Failed to close browser:", closeErr.message);
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
