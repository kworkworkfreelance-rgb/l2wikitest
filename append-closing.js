#!/usr/bin/env node
/**
 * Append proper JSON closing brackets to fix the broken file
 * This preserves all content up to the break point
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-pre-append-${timestamp}.json`);

console.log('🔧 Appending closing brackets to canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read and analyze the file
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');
const originalLength = content.length;

console.log(`📄 Original file size: ${(originalLength / 1024 / 1024).toFixed(2)} MB`);

// The file ends in the middle of "archive-vtoraya-profa-item-73-spellhowler-interlude"
// We need to find a safe truncation point before this broken article

// Find position after the last COMPLETE article (archive-vtoraya-profa-item-66-phantom-ranger-interlude)
const lastCompleteArticle = 'archive-vtoraya-profa-item-66-phantom-ranger-interlude';
const lastCompleteIndex = content.lastIndexOf(lastCompleteArticle);

if (lastCompleteIndex === -1) {
  console.error('❌ Could not find marker for last complete article');
  process.exit(1);
}

console.log(`📄 Found last complete article at position ${lastCompleteIndex}`);

// Find where this article ends
// After this article marker, we have: blocks array, closing the article
// Pattern: }]} - close block object, close blocks array, close article
let pos = lastCompleteIndex;
let depth = 0;
let inString = false;
let escaped = false;
let articleStartDepth = -1;

// First, find the article start and track depth
while (pos < content.length) {
  const char = content[pos];
  const code = content.charCodeAt(pos);
  
  // Skip control characters
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
    pos++;
    continue;
  }
  
  if (escaped) {
    escaped = false;
  } else if (char === '\\') {
    escaped = true;
  } else if (char === '"' && !escaped) {
    inString = !inString;
  } else if (!inString) {
    if (char === '{' || char === '[') {
      if (articleStartDepth === -1 && char === '{') {
        articleStartDepth = depth;
      }
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      // Check if we closed this article (returned to articles object level)
      if (articleStartDepth !== -1 && depth <= articleStartDepth - 1) {
        // Found the end of this article object
        break;
      }
    }
  }
  pos++;
}

if (pos >= content.length) {
  console.error('❌ Could not find end of last complete article');
  process.exit(1);
}

console.log(`📄 End of last complete article at position ${pos}`);

// Truncate to this position (keeping the closing brace of the article)
content = content.substring(0, pos + 1);

// Check what comes next in original file - if it's a comma, we were mid-articles
// If it's closing braces, we need to add them
// Since we know the file was broken mid-article, we add the articles closing and root closing

// Add proper closing
content = content.trim();
if (content.endsWith(',')) {
  content = content.slice(0, -1);
}

// Close the articles object, then the root
// The structure is: { "version": ..., "site": ..., "sections": ..., "articles": { ... } }
content += '\n  }\n}';

// Write
fs.writeFileSync(CANONICAL_PATH, content, 'utf8');

console.log(`📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);

// Validate
try {
  const parsed = JSON.parse(content);
  const articleCount = Object.keys(parsed.articles || {}).length;
  const sectionCount = Object.keys(parsed.sections || {}).length;
  console.log(`✅ JSON is valid!`);
  console.log(`   Articles: ${articleCount}`);
  console.log(`   Sections: ${sectionCount}`);
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  
  // Try to fix by adding more closing braces
  console.log('🔄 Attempting to fix by adding more closing braces...');
  content = content.trim();
  if (!content.endsWith('}')) {
    content += '\n}';
  }
  if (!content.endsWith('}\n}')) {
    content += '\n}';
  }
  
  fs.writeFileSync(CANONICAL_PATH, content, 'utf8');
  
  try {
    const parsed = JSON.parse(content);
    const articleCount = Object.keys(parsed.articles || {}).length;
    console.log(`✅ Fixed! Articles: ${articleCount}`);
  } catch (e2) {
    console.error('❌ Still invalid, restoring backup:', e2.message);
    fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
    process.exit(1);
  }
}

console.log('\n✅ Canonical file successfully closed!');
