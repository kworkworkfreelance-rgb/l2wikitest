#!/usr/bin/env node
/**
 * Clean and close the broken canonical JSON file
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-pre-close-${timestamp}.json`);

console.log('🔧 Cleaning and closing canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read the file
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');

// Find where we are - look for the last complete article
// We need to find the pattern of a complete article and truncate after it
const lastCompletePattern = /"archive-vtoraya-profa-item-66-phantom-ranger-interlude":\s*\{[\s\S]*?"blocks":\s*\[[\s\S]*?\]\s*\}/;

if (lastCompletePattern.test(content)) {
  // Find the position after the last complete article
  const matches = [...content.matchAll(/"archive-vtoraya-profa-item-\d+-[^"]+":\s*\{/g)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const startPos = lastMatch.index;
    
    // Find the end of this article (the closing of blocks array and article object)
    // Look for the pattern: ] followed by } at article level
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;
    let pos = startPos;
    
    while (pos < content.length) {
      const char = content[pos];
      
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"' && !escaped) {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
        
        // Check if we completed the article
        if (braceCount === 0 && bracketCount === 0 && pos > startPos + 100) {
          // Found the end of this article
          break;
        }
      }
      pos++;
    }
    
    // Truncate to here
    content = content.substring(0, pos + 1);
    console.log(`📄 Truncated at position ${pos}`);
  }
}

// Now add proper closing
content = content.trim();
if (content.endsWith(',')) {
  content = content.slice(0, -1);
}

// Add closing braces for articles object and root
content += '\n  },\n';

// Add site section if missing
if (!content.includes('"site":')) {
  content += '  "site": {\n';
  content += '    "name": "L2Wiki.Su",\n';
  content += '    "subtitle": "База знаний по Lineage II",\n';
  content += '    "ads": {}\n';
  content += '  },\n';
}

content += '  "version": 2,\n';
content += '  "updatedAt": "' + new Date().toISOString() + '"\n';
content += '}\n';

// Write the cleaned content
fs.writeFileSync(CANONICAL_PATH, content);

console.log('\n✅ Canonical file cleaned and closed!');
console.log(`📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);

// Verify it's valid JSON
try {
  const testData = JSON.parse(content);
  const articleCount = Object.keys(testData.articles || {}).length;
  console.log(`✅ JSON is valid! Articles: ${articleCount}`);
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  console.log('🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
  process.exit(1);
}
