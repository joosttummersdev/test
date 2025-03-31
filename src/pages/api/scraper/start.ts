import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabaseClient';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Define admin pages
const ADMIN_PAGES = [
  'askwadraat',
  'premium_servicedesk',
  'vattenfall',
  '1crew-vattenfall',
  'hosted-energy'
];

async function loginWithRetry(page: any, credentials: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Login attempt ${attempt}...`);
      
      // Navigate to login page
      console.log('Navigating to login page...');
      await page.goto('https://app.salesdock.nl/login', {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });
      
      // Log current URL
      console.log('Current URL:', await page.url());
      
      // Wait for login form
      console.log('Waiting for login form...');
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      
      // Clear fields first
      console.log('Clearing input fields...');
      await page.$eval('input[name="email"]', (el: any) => el.value = '');
      await page.$eval('input[name="password"]', (el: any) => el.value = '');
      
      // Fill login form
      console.log('Filling login form...');
      await page.type('input[name="email"]', credentials.username);
      await page.type('input[name="password"]', credentials.password);
      
      // Find and click login button
      console.log('Looking for login button...');
      const submitButton = await page.waitForSelector('button[type="submit"]', {
        timeout: 10000
      });

      if (!submitButton) {
        throw new Error('Login button not found');
      }

      // Click and wait for navigation
      console.log('Clicking login button...');
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000 
        }),
        submitButton.click()
      ]);

      // Log new URL after navigation
      console.log('Post-login URL:', await page.url());

      // Take screenshot
      await page.screenshot({ 
        path: '/tmp/post-login.png',
        fullPage: true 
      });

      // Check for successful login
      console.log('Checking login status...');
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
        console.log('Page content after login attempt:', await page.content());
        
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
      return;
    } catch (error) {
      console.error(`Login attempt ${attempt} failed:`, error.message);
      
      await page.screenshot({ 
        path: `/tmp/login-error-${attempt}.png`,
        fullPage: true 
      });
      
      if (attempt === maxRetries) throw error;
      
      console.log(`Retrying in ${attempt} seconds...`);
      await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
}

async function scrapeSalesdock(config: any) {
  console.log('Starting Salesdock scraper...');

  // Set up userDataDir path
  const userDataDir = path.join(process.cwd(), 'puppeteer-profile');
  console.log('Using userDataDir:', userDataDir);
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir, // Use persistent user data directory
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ]
  });

  try {
    console.log('Browser launched');
    const page = await browser.newPage();
    
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

    // Log console messages
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('error', err => console.error('Browser error:', err));
    page.on('pageerror', err => console.error('Page error:', err));

    // Log responses
    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        console.error(`HTTP ${status} for ${url}`);
      } else {
        console.log(`HTTP ${status} for ${url}`);
      }
    });

    // Login with retry
    await loginWithRetry(page, config.credentials);

    const allSales = [];

    // Scrape each admin page
    for (const adminPage of ADMIN_PAGES) {
      try {
        console.log(`\nProcessing ${adminPage}...`);
        
        // Navigate to admin page first
        const adminUrl = `https://app.salesdock.nl/${adminPage}/admin`;
        console.log('Navigating to admin page:', adminUrl);
        
        await page.goto(adminUrl, {
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000
        });

        console.log('Current URL:', await page.url());
        await page.screenshot({ 
          path: `/tmp/${adminPage}-admin.png`,
          fullPage: true 
        });

        // Check access
        const hasAccess = await page.evaluate(() => {
          const accessDenied = document.querySelector('.access-denied, .error-403');
          return !accessDenied;
        });

        if (!hasAccess) {
          console.log(`No access to ${adminPage}, skipping...`);
          continue;
        }

        // Navigate to sales page
        const salesUrl = `https://app.salesdock.nl/${adminPage}/sales`;
        console.log('Navigating to sales page:', salesUrl);
        
        await page.goto(salesUrl, {
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000
        });

        console.log('Current URL:', await page.url());
        await page.screenshot({ 
          path: `/tmp/${adminPage}-sales.png`,
          fullPage: true 
        });

        // Find sales table
        const tableSelector = await Promise.race([
          page.waitForSelector('table.sales-table', { timeout: 10000 })
            .then(() => 'table.sales-table'),
          page.waitForSelector('.sales-grid', { timeout: 10000 })
            .then(() => '.sales-grid')
        ]).catch(() => null);

        if (!tableSelector) {
          console.log(`No sales table found for ${adminPage}`);
          console.log('Page content:', await page.content());
          continue;
        }

        // Extract sales data
        const sales = await page.evaluate((selector) => {
          const sales = [];
          const rows = document.querySelectorAll(`${selector} tbody tr`);

          rows.forEach((row) => {
            try {
              const cells = row.querySelectorAll('td');
              
              if (cells.length >= 6) {
                const link = cells[0]?.querySelector('a')?.href;
                const reference = link?.split('/').pop();
                
                const sale = {
                  reference,
                  customer: {
                    name: cells[1]?.textContent?.trim(),
                  },
                  supplier: cells[2]?.textContent?.trim(),
                  product: cells[3]?.textContent?.trim(),
                  status: cells[4]?.textContent?.trim(),
                  created_at: cells[5]?.textContent?.trim(),
                  link,
                  admin_page: window.location.pathname.split('/')[1]
                };
                
                sales.push(sale);
              }
            } catch (error) {
              console.error('Error processing row:', error);
            }
          });

          return sales;
        }, tableSelector);

        console.log(`Found ${sales.length} sales in ${adminPage}`);

        // Get sale details
        for (const sale of sales.slice(0, 10)) {
          if (sale.reference) {
            try {
              const detailUrl = `https://app.salesdock.nl/${adminPage}/sales/${sale.reference}`;
              console.log('Fetching sale details:', detailUrl);
              
              await page.goto(detailUrl, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 30000
              });

              await page.screenshot({ 
                path: `/tmp/${adminPage}-sale-${sale.reference}.png`,
                fullPage: true 
              });

              await page.waitForSelector('.sale-details, .details-container', { 
                timeout: 10000 
              });

              const details = await page.evaluate(() => {
                const getFieldValue = (label: string) => {
                  const selectors = [
                    `label:contains("${label}") + input`,
                    `label:contains("${label}") + div`,
                    `[data-label="${label}"]`,
                    `.form-group:contains("${label}") input`,
                    `.form-group:contains("${label}") .form-control`
                  ];

                  for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                      return element.value || element.textContent?.trim() || null;
                    }
                  }
                  return null;
                };

                return {
                  customer: {
                    name: getFieldValue('Naam'),
                    email: getFieldValue('E-mail'),
                    phone: getFieldValue('Telefoon'),
                    address: getFieldValue('Adres'),
                    postal_code: getFieldValue('Postcode'),
                    city: getFieldValue('Plaats')
                  },
                  energy: {
                    electricity_usage: getFieldValue('Elektriciteitsverbruik'),
                    gas_usage: getFieldValue('Gasverbruik'),
                    current_supplier: getFieldValue('Huidige leverancier'),
                    ean_electricity: getFieldValue('EAN Elektriciteit'),
                    ean_gas: getFieldValue('EAN Gas')
                  },
                  contract: {
                    start_date: getFieldValue('Startdatum'),
                    duration: getFieldValue('Looptijd'),
                    product_type: getFieldValue('Product'),
                    payment_method: getFieldValue('Betaalwijze'),
                    iban: getFieldValue('IBAN')
                  }
                };
              });

              allSales.push({
                ...sale,
                details
              });

              // Random delay
              const delay = Math.random() * 2000 + 1000;
              await new Promise(r => setTimeout(r, delay));
            } catch (error) {
              console.error(`Error fetching details for sale ${sale.reference}:`, error);
              await page.screenshot({ 
                path: `/tmp/${adminPage}-sale-${sale.reference}-error.png`,
                fullPage: true 
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${adminPage}:`, error);
        await page.screenshot({ 
          path: `/tmp/${adminPage}-error.png`,
          fullPage: true 
        });
      }
    }

    return allSales;
  } finally {
    await browser.close();
  }
}

export const post: APIRoute = async ({ request }) => {
  try {
    const { configId } = await request.json();

    // Get config
    const { data: config, error: configError } = await supabase
      .from('scraper_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError) throw configError;

    // Validate credentials
    if (!config.credentials?.username || !config.credentials?.password) {
      throw new Error('Missing credentials in scraper config');
    }

    // Create run
    const { data: run, error: runError } = await supabase
      .from('scraper_runs')
      .insert({
        config_id: configId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (runError) throw runError;

    // Start scraping
    (async () => {
      try {
        console.log('Starting scraper run...');
        const sales = await scrapeSalesdock(config);
        console.log(`Scraped ${sales.length} sales`);

        if (sales.length > 0) {
          const { error: insertError } = await supabase
            .from('scraper_results')
            .insert(
              sales.map(sale => ({
                run_id: run.id,
                type: 'sale',
                data: sale,
                processed: false
              }))
            );

          if (insertError) throw insertError;
        }

        // Update run status
        await supabase
          .from('scraper_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            stats: {
              total_items: sales.length,
              success: true
            }
          })
          .eq('id', run.id);

        // Update config
        await supabase
          .from('scraper_configs')
          .update({
            last_run_at: new Date().toISOString()
          })
          .eq('id', configId);

      } catch (error) {
        console.error('Scraping error:', error);

        await supabase
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: error.message,
            stats: {
              success: false,
              error: error.message
            }
          })
          .eq('id', run.id);
      }
    })();

    return new Response(
      JSON.stringify({ success: true }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error starting scraper:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};