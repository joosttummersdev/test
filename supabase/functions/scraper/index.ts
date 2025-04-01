import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import puppeteer from 'npm:puppeteer-core@19.11.1';
import chromium from 'npm:@sparticuz/chromium@112.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let browser;
  try {
    const { transactionId, environment } = await req.json();

    if (!transactionId || !environment) {
      throw new Error('Transaction ID and environment are required');
    }

    console.log('Launching browser...');

    // Launch browser with proper configuration
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreHTTPSErrors: true
    });

    try {
      console.log('Browser launched successfully');
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

      // Login based on environment type
      if (environment.type === 'hostedenergy') {
        await loginToHostedEnergy(page, environment);
      } else if (environment.type === 'salesdock') {
        await loginToSalesdock(page, environment);
      }

      // Navigate to transaction and extract data
      const data = await scrapeTransaction(page, transactionId, environment);

      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  } catch (error: any) {
    console.error('SCRAPER ERROR:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unexpected error',
        details: error.stack
      }),
      {
        status: error.message.includes('Login failed') ? 401 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

async function loginToHostedEnergy(page: any, environment: any) {
  await page.goto('https://admin.hostedenergy.nl/login');
  await page.waitForSelector('input[name="email"]');
  await page.type('input[name="email"]', environment.credentials.username);
  await page.type('input[name="password"]', environment.credentials.password);
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);
}

async function loginToSalesdock(page: any, environment: any) {
  const baseUrl = environment.settings.base_url;
  await page.goto(`${baseUrl}/login`);
  await page.waitForSelector('input[name="email"]');
  await page.type('input[name="email"]', environment.credentials.username);
  await page.type('input[name="password"]', environment.credentials.password);
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);
}

async function scrapeTransaction(page: any, transactionId: string, environment: any) {
  const baseUrl = environment.settings.base_url;
  await page.goto(`${baseUrl}/transactions/${transactionId}`);
  
  // Wait for transaction details to load
  await page.waitForSelector('.transaction-details', { timeout: 30000 });

  // Extract data using specific selectors
  const data = await page.evaluate(() => {
    const getText = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? el.textContent?.trim() : null;
    };

    const getNumeric = (selector: string) => {
      const text = getText(selector);
      if (!text) return null;
      return parseFloat(text.replace(/[^0-9,]/g, '').replace(',', '.'));
    };

    return {
      product: {
        name: getText('.product-name'),
        type: getText('.product-type'),
        supplier: getText('.supplier-name')
      },
      status: getText('.status'),
      validUntil: getText('.valid-until'),
      organization: getText('.organization'),
      seller: getText('.seller'),
      annualCosts: getNumeric('.annual-costs'),
      monthlyCosts: getNumeric('.monthly-costs'),
      customer: {
        businessName: getText('.business-name'),
        contactPerson: getText('.contact-person'),
        kvkNumber: getText('.kvk-number'),
        deliveryAddress: getText('.delivery-address'),
        correspondenceAddress: getText('.correspondence-address'),
        iban: getText('.iban'),
        ibanName: getText('.iban-name'),
        contact: {
          name: getText('.contact-name'),
          email: getText('.contact-email'),
          phone: getText('.contact-phone'),
          dateOfBirth: getText('.date-of-birth')
        }
      },
      energy: {
        type: getText('.energy-type'),
        eanCode: getText('.ean-code'),
        dualMeter: getText('.dual-meter') === 'Ja',
        usage: getNumeric('.energy-usage'),
        feedback: getNumeric('.energy-feedback'),
        residentialUse: getText('.residential-use') === 'Ja',
        estimatedUsage: getText('.estimated-usage')
      },
      options: {
        isRelocation: getText('.is-relocation') === 'Ja',
        desiredSwitchDate: getText('.switch-date'),
        paymentMethod: getText('.payment-method')
      }
    };
  });

  return data;
}