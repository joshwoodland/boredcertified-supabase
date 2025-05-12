#!/usr/bin/env node

/**
 * This script finds all Supabase client imports in the codebase that need to be migrated
 * to the new standardized approach.
 * 
 * Usage:
 * node scripts/find-supabase-imports.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the old import patterns to search for
const importPatterns = [
  // Old server imports
  `import { createClient } from '@/app/utils/supabase/server'`,
  `import { createClient } from "@/app/utils/supabase/server"`,
  `from '@/app/utils/supabase/server'`,
  `from "@/app/utils/supabase/server"`,
  
  // Old admin imports
  `import { createAdminClient } from '@/app/utils/supabase/server-admin'`,
  `import { createAdminClient } from "@/app/utils/supabase/server-admin"`,
  `from '@/app/utils/supabase/server-admin'`,
  `from "@/app/utils/supabase/server-admin"`,
  
  // Old browser imports
  `import { createBrowserClient } from '@supabase/ssr'`,
  `import { createBrowserClient } from "@supabase/ssr"`,
  
  // Old direct imports
  `import supabase from '@/app/lib/supabaseServer'`,
  `import supabase from "@/app/lib/supabaseServer"`,
  `from '@/app/lib/supabaseServer'`,
  `from "@/app/lib/supabaseServer"`,
  
  // Browser direct imports
  `import { supabase } from '@/app/lib/supabaseBrowser'`,
  `import { supabase } from "@/app/lib/supabaseBrowser"`,
  `from '@/app/lib/supabaseBrowser'`,
  `from "@/app/lib/supabaseBrowser"`,
];

// Folders to exclude from the search (node_modules is excluded by default)
const excludedFolders = [
  '.git',
  'node_modules',
  '.next',
  'app/lib/supabase', // Skip the new standardized files
];

// Extensions to include in the search
const includedExtensions = ['.js', '.jsx', '.ts', '.tsx'];

// Import counts for statistics
const importCounts = {
  total: 0,
  files: new Set(),
  patterns: {}
};

// Initialize pattern counts
importPatterns.forEach(pattern => {
  importCounts.patterns[pattern] = 0;
});

/**
 * Check if a file should be processed based on its extension and path
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!includedExtensions.includes(ext)) return false;
  
  for (const folder of excludedFolders) {
    if (filePath.includes(`/${folder}/`)) return false;
  }
  
  return true;
}

/**
 * Search for import patterns in a file
 */
function searchImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let fileHasMatches = false;
    
    for (const pattern of importPatterns) {
      if (content.includes(pattern)) {
        importCounts.patterns[pattern]++;
        importCounts.total++;
        fileHasMatches = true;
        console.log(`\x1b[33m${filePath}\x1b[0m: Found \x1b[36m${pattern}\x1b[0m`);
      }
    }
    
    if (fileHasMatches) {
      importCounts.files.add(filePath);
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
}

/**
 * Main function to start the search
 */
function main() {
  console.log('\n\x1b[1mSearching for Supabase client imports to migrate...\x1b[0m\n');
  
  // Use git ls-files to list all tracked files in the repo
  try {
    const output = execSync('git ls-files', { encoding: 'utf-8' });
    const files = output.split('\n').filter(file => file && shouldProcessFile(file));
    
    files.forEach(searchImportsInFile);
    
    // Print summary
    console.log('\n\x1b[1m=== Migration Summary ===\x1b[0m');
    console.log(`\x1b[32mFound ${importCounts.total} imports in ${importCounts.files.size} files to migrate\x1b[0m`);
    
    // Pattern breakdown
    console.log('\n\x1b[1mImport Pattern Breakdown:\x1b[0m');
    for (const [pattern, count] of Object.entries(importCounts.patterns)) {
      if (count > 0) {
        console.log(`- \x1b[36m${pattern}\x1b[0m: ${count} occurrences`);
      }
    }
    
    console.log('\n\x1b[1mNext Steps:\x1b[0m');
    console.log('1. Migrate each file to use the new standardized imports from @/app/lib/supabase');
    console.log('2. Add null checks for client instances');
    console.log('3. Update any client initialization logic');
    console.log('\nSee README-supabase-client-standardization.md for detailed migration instructions');
    
  } catch (error) {
    console.error('Error executing git ls-files:', error.message);
  }
}

main();
