import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabaseClient';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';

// Add stealth plugin
puppeteer.use(StealthPlugin());

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

    // Helper to send debug log
    const log = async (message: string) => {
      await supabase.channel('scraper_debug').send({
        type: 'broadcast',
        event: 'log',
        payload: { message }
      });
    };

    // Start debug run in background
    (async () => {
      let browser;
      try {
        await log('Starting browser...');
        
        // Launch browser with proper configuration
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: 'new',
          ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Log navigation events
        page.on('load', () => log(`Page loaded: ${page.url()}`));
        page.on('error', error => log(`Page error: ${error.message}`));
        page.on('pageerror', error => log(`JS error: ${error.message}`));
        page.on('console', msg => log(`Console: ${msg.text()}`));

        // Log network requests
        page.on('request', request => {
          log(`Request: ${request.method()} ${request.url()}`);
        });

        page.on('requestfailed', request => {
          log(`Failed request: ${request.url()} (${request.failure()?.errorText})`);
        });

        page.on('response', response => {
          const status = response.status();
          if (status >= 400) {
            log(`Error response: ${response.url()} (${status})`);
          }
        });

        // Start scraping based on config type
        if (config.type === 'salesdock') {
          await log('Navigating to Salesdock login page...');
          await page.goto('https://app.salesdock.nl/login');
          
          // Fill login form
          await log('Filling login form...');
          await page.type('input[name="email"]', config.credentials.username);
          await page.type('input[name="password"]', config.credentials.password);
          
          // Submit form
          await log('Submitting login form...');
          await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
          ]);
          
          // Check login status
          const isLoggedIn = await page.evaluate(() => {
            return !!document.querySelector('.dashboard-container, nav.main-menu');
          });

          if (!isLoggedIn) {
            const errorText = await page.evaluate(() => {
              const error = document.querySelector('.alert-danger, .error-message');
              return error ? error.textContent : null;
            });

            throw new Error(`Login failed: ${errorText || 'Unknown error'}`);
          }

          await log('Login successful');
          
          // Navigate to admin page
          await log('Navigating to admin page...');
          await page.goto('https://app.salesdock.nl/vattenfall/admin');
          
          // Check for sales data
          await log('Checking for sales data...');
          const hasSales = await page.evaluate(() => {
            return !!document.querySelector('.sales-table, .sales-grid');
          });
          
          if (hasSales) {
            await log('Found sales data');
          } else {
            await log('No sales data found');
          }
        } else if (config.type === 'hostedenergy') {
          await log('Navigating to Hosted Energy login page...');
          await page.goto('https://admin.hostedenergy.nl/login');
          
          // Fill login form
          await log('Filling login form...');
          await page.type('input[name="email"]', config.credentials.username);
          await page.type('input[name="password"]', config.credentials.password);
          
          // Submit form
          await log('Submitting login form...');
          await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
          ]);
          
          // Check login status
          const isLoggedIn = await page.evaluate(() => {
            return !!document.querySelector('.dashboard, .admin-panel');
          });

          if (!isLoggedIn) {
            const errorText = await page.evaluate(() => {
              const error = document.querySelector('.alert-danger, .error-message');
              return error ? error.textContent : null;
            });

            throw new Error(`Login failed: ${errorText || 'Unknown error'}`);
          }

          await log('Login successful');
          
          // Navigate to transactions page
          await log('Navigating to transactions page...');
          await page.goto('https://admin.hostedenergy.nl/transactions');
          
          // Check for transaction data
          await log('Checking for transaction data...');
          const hasTransactions = await page.evaluate(() => {
            return !!document.querySelector('.transactions-table, .transaction-list');
          });
          
          if (hasTransactions) {
            await log('Found transaction data');
          } else {
            await log('No transaction data found');
          }
        }

        // Close browser
        await browser.close();
        await log('Debug run completed');

        // Update run status
        await supabase
          .from('scraper_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            stats: {
              success: true
            }
          })
          .eq('id', run.id);

      } catch (error: any) {
        await log(`Error: ${error.message}`);
        
        await supabase
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: error.message
          })
          .eq('id', run.id);
          
        if (browser) {
          await browser.close();
        }
      }
    })();

    return new Response(
      JSON.stringify({ success: true }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};