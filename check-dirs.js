import fs from 'fs';
import path from 'path';

function listDirectoryContents(dir) {
  console.log(`\nContents of ${dir}:`);
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      console.log(`- ${item} (${stats.isDirectory() ? 'directory' : 'file'})`);
    });
  } catch (err) {
    console.error(`Error reading ${dir}:`, err.message);
  }
}

// Check current directory
console.log('Current working directory:', process.cwd());
listDirectoryContents('.');

// Check parent directory
listDirectoryContents('..');

// Check specific important directories
const dirsToCheck = [
  'src',
  'public',
  'supabase',
  'netlify',
  'server'
];

dirsToCheck.forEach(dir => {
  if (fs.existsSync(dir)) {
    listDirectoryContents(dir);
  }
});