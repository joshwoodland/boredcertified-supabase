/**
 * Clean Build Script
 * 
 * This script helps clean up old Next.js build artifacts to ensure
 * that no outdated code is being served.
 * 
 * Usage:
 * node scripts/clean-build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to clean
const DIRS_TO_CLEAN = [
  '.next',
  'node_modules/.cache',
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Logs a message with color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Removes a directory recursively
 */
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    log(`Removing ${dir}...`, colors.yellow);
    fs.rmSync(dir, { recursive: true, force: true });
    log(`✓ Removed ${dir}`, colors.green);
    return true;
  }
  return false;
}

/**
 * Main function
 */
function main() {
  log('🧹 Starting clean build process...', colors.cyan);
  
  // Clean directories
  let cleaned = false;
  for (const dir of DIRS_TO_CLEAN) {
    if (removeDir(dir)) {
      cleaned = true;
    }
  }
  
  if (!cleaned) {
    log('No directories needed cleaning.', colors.blue);
  }
  
  // Run npm commands
  log('\n📦 Reinstalling dependencies...', colors.magenta);
  try {
    execSync('npm install', { stdio: 'inherit' });
    log('✓ Dependencies reinstalled', colors.green);
    
    log('\n🔨 Rebuilding the application...', colors.magenta);
    execSync('npm run build', { stdio: 'inherit' });
    log('✓ Application rebuilt successfully', colors.green);
    
    log('\n✅ Clean build completed successfully!', colors.cyan);
    log('You can now start the application with: npm run dev', colors.blue);
  } catch (error) {
    log(`\n❌ Error during build process: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the script
main();
