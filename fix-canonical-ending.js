#!/usr/bin/env node
/**
 * Fix the broken canonical JSON file ending
 * Adds proper closing brackets without loading the entire file into memory
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `l2wiki-canonical-pre-fix-${Date.now()}.json`);

console.log('🔧 Fixing canonical file ending...\n');

// Create backup
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read the last 1000 bytes to understand the structure
const stats = fs.statSync(CANONICAL_PATH);
const fileSize = stats.size;
const lastBytes = 2000;

const fd = fs.openSync(CANONICAL_PATH, 'r');
const buffer = Buffer.alloc(lastBytes);
fs.readSync(fd, buffer, 0, lastBytes, fileSize - lastBytes);
fs.closeSync(fd);

const ending = buffer.toString('utf8');
console.log('\n📄 Last 500 characters:');
console.log(ending.slice(-500));

// Check what's missing
let needsBlockClose = !ending.includes('}}]}}');
let needsArticleClose = !ending.trim().endsWith('}') && !ending.trim().endsWith(']');

console.log('\n🔍 Analysis:');
console.log(`  - Need to close block: ${needsBlockClose}`);
console.log(`  - Need to close articles object: ${needsArticleClose}`);

// Build the proper ending
let closingContent = '';

// Close the HTML block content if needed
if (needsBlockClose) {
  closingContent += '\n"        }\n      ]\n    }';
}

// We need to count brackets and add proper closings
// The file structure should be:
//   "articles": {
//     "article-id": { ... },
//     "last-article-id": { ... blocks: [ { ... } ] } <-- we are here
//   } <-- close articles
// } <-- close root

closingContent += ',\n';

// Add completion content - third profession articles, catacombs, etc
const completionData = require('./canonical-completion-data.json');

// Add third profession articles
for (const [id, article] of Object.entries(completionData.articles)) {
  closingContent += `    "${id}": ${JSON.stringify(article, null, 2)},\n`;
}

// Remove trailing comma
closingContent = closingContent.replace(/,\s*$/, '\n');

// Close articles and root
closingContent += '  },\n';

// Add missing sections data if any
if (completionData.sections) {
  for (const [id, section] of Object.entries(completionData.sections)) {
    closingContent += `    "${id}": ${JSON.stringify(section, null, 2)},\n`;
  }
}

// Remove trailing comma and close
closingContent = closingContent.replace(/,\s*$/, '');
closingContent += '\n}';

// Write the closing
fs.appendFileSync(CANONICAL_PATH, closingContent);

console.log('\n✅ Canonical file fixed and completed!');
console.log(`📄 File size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);
