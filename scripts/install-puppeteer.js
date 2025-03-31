import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // Create cache directory in temp folder
  const cacheDir = path.join(os.tmpdir(), 'puppeteer-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log('Cache directory created successfully:', cacheDir);

  // Set environment variables for installation
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  process.env.PUPPETEER_DOWNLOAD_HOST = 'https://npmmirror.com/mirrors';

  // Install Chrome browser
  console.log('Installing Chrome...');
  execSync(`cross-env PUPPETEER_CACHE_DIR="${cacheDir}" PUPPETEER_DOWNLOAD_HOST="https://npmmirror.com/mirrors" puppeteer browsers install chrome --path="${cacheDir}"`, {
    stdio: 'inherit'
  });

  console.log('Chrome installation completed successfully');
} catch (error) {
  console.error('Error during installation:', error);
  console.log('Continuing with installation despite Chrome download error...');
  // Exit with success code even if Chrome install fails
  process.exit(0);
}