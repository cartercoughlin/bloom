#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');

// Generate version based on current timestamp
const version = `bloom-budget-v${Date.now()}`;

// Replace the cache name
const updatedContent = swContent.replace(
  /const CACHE_NAME = '[^']+'/,
  `const CACHE_NAME = '${version}'`
);

fs.writeFileSync(swPath, updatedContent);
console.log(`Updated service worker cache version to: ${version}`);
