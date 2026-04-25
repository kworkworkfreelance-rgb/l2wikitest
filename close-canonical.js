#!/usr/bin/env node
/**
 * Simple script to properly close the broken canonical JSON file
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-pre-close-${timestamp}.json`);

console.log('🔧 Closing canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read the very end of the file
const stats = fs.statSync(CANONICAL_PATH);
const fileSize = stats.size;

// Read last 200 bytes to check the exact ending
const fd = fs.openSync(CANONICAL_PATH, 'r');
const buffer = Buffer.alloc(500);
fs.readSync(fd, buffer, 0, 500, Math.max(0, fileSize - 500));
fs.closeSync(fd);

const ending = buffer.toString('utf8');
const trimmedEnding = ending.trim();

console.log('\n📄 Current ending (last 300 chars):');
console.log(trimmedEnding.slice(-300));

// Determine what needs to be added
// Based on the structure, we need to:
// 1. Close the HTML block content (if inside a block)
// 2. Close the blocks array
// 3. Close the article object
// 4. Close the articles object
// 5. Close the root object

let closing = '';

// Check if we're inside a block's HTML content
if (trimmedEnding.includes('"html": "') && !trimmedEnding.includes('"html": ""')) {
  // We're inside an HTML string, need to close quotes and braces
  // Find how many opening braces we have without closing
  const openBraces = (trimmedEnding.match(/\{/g) || []).length;
  const closeBraces = (trimmedEnding.match(/\}/g) || []).length;
  const openBrackets = (trimmedEnding.match(/\[/g) || []).length;
  const closeBrackets = (trimmedEnding.match(/\]/g) || []).length;
  
  const needCloseBraces = openBraces - closeBraces;
  const needCloseBrackets = openBrackets - closeBrackets;
  
  console.log(`\n🔍 Analysis:`);
  console.log(`  - Open braces: ${openBraces}, Close braces: ${closeBraces}, Need: ${needCloseBraces}`);
  console.log(`  - Open brackets: ${openBrackets}, Close brackets: ${closeBrackets}, Need: ${needCloseBrackets}`);
  
  // Close the HTML string (add closing quote)
  // Close the block object
  // Close the blocks array
  // Close the article object  
  // Close the articles object
  // Close the root object
  closing = '"\n        }\n      ]\n    }\n  }\n}';
} else {
  // Just need standard closing
  closing = '\n  }\n}';
}

// Append the closing
fs.appendFileSync(CANONICAL_PATH, closing);

console.log('\n✅ Canonical file closed properly!');
console.log(`📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);

// Verify it's valid JSON
try {
  const testData = fs.readFileSync(CANONICAL_PATH, 'utf8');
  JSON.parse(testData);
  console.log('✅ JSON is now valid!');
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  console.log('🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
}
