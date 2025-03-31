import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabaseClient';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

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

    // Helper to send screenshot
    const sendScreenshot = async (screenshots: string[]) => {
      await supabase.channel('scraper_debug').send({
        type: 'broadcast',
        event: 'screenshot',
        payload: { screenshots }
      });
    };

    // Start debug run
    try {
      await log('Starting browser...');
      
      const browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1920,1080'
        ]
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

      // Take screenshots
      const screenshots: string[] = [];
      const takeScreenshot = async (name: string) => {
        const path = `/tmp/debug-${name}-${Date.now()}.png`;
        await page.screenshot({ path, fullPage: true });
        screenshots.push(path);
        await sendScreenshot(screenshots);
      };

      // Start scraping
      await log('Navigating to login page...');
      await page.goto('https://app.salesdock.nl/login');
      await takeScreenshot('login');

      // Fill login form
      await log('Filling login form...');
      await page.type('input[name="email"]', config.credentials.username);
      await page.type('input[name="password"]', config.credentials.password);
      await takeScreenshot('login-filled');

      // Submit form
      await log('Submitting login form...');
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);
      await takeScreenshot('post-login');

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
            screenshots: screenshots.length,
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
    }

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