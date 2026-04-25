#!/usr/bin/env node
/**
 * Precisely close the canonical JSON file at line 115673
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const BACKUP_SOURCE = path.join(__dirname, 'data', 'backups', 'canonical-sanitized-2026-04-11T07-33-43-076Z.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-precise-close-${timestamp}.json`);

console.log('🔧 Precisely closing canonical JSON file...\n');

// Use the sanitized backup as source (it has control chars removed)
if (!fs.existsSync(BACKUP_SOURCE)) {
  console.error('❌ Sanitized backup not found');
  process.exit(1);
}

// Create new backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(BACKUP_SOURCE, BACKUP_PATH);
fs.copyFileSync(BACKUP_SOURCE, CANONICAL_PATH);
console.log(`✅ Working with sanitized backup`);

// Read the file line by line to find line 115673
console.log('📄 Reading file to find line 115673...');

const content = fs.readFileSync(CANONICAL_PATH, 'utf8');
const lines = content.split('\n');

console.log(`   Total lines: ${lines.length}`);

// Line 115673 should be:       "aliases": [ or similar within article 73
// We want to truncate before the article 73 starts
// Article 73 starts around line 115648 based on earlier reads

// Find the line with "archive-vtoraya-profa-item-73-spellhowler-interlude"
let article73StartLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"archive-vtoraya-profa-item-73-spellhowler-interlude"')) {
    article73StartLine = i;
    break;
  }
}

if (article73StartLine === -1) {
  console.error('❌ Could not find article 73 start line');
  process.exit(1);
}

console.log(`📄 Article 73 starts at line ${article73StartLine + 1} (0-indexed: ${article73StartLine})`);

// We need to truncate at the line BEFORE article 73 starts
// But we need to properly close article 66 first
// Article 66 ends somewhere before article 73

// Find article 66 end - look for the closing of its blocks array
let truncateLine = article73StartLine;

// Go back to find a good closing point
while (truncateLine > 0) {
  const line = lines[truncateLine].trim();
  // Look for patterns that indicate end of an article
  if (line === '}' || line === '},' || line === ']' || line === '],') {
    // Check if this looks like end of article (followed by another article start or closing)
    if (line === '}' || line === '},') {
      // This could be end of article 66
      truncateLine++; // Include this line
      break;
    }
  }
  truncateLine--;
}

if (truncateLine <= 0) {
  // Fallback: just truncate before article 73
  truncateLine = article73StartLine;
}

console.log(`📄 Will truncate at line ${truncateLine}`);

// Truncate
const newLines = lines.slice(0, truncateLine);

// Check if we ended properly
let lastLine = newLines[newLines.length - 1].trim();
console.log(`📄 Last line before closing: "${lastLine.substring(0, 100)}..."`);

// Add proper closing
// Remove trailing comma from last line if present
if (lastLine.endsWith(',')) {
  newLines[newLines.length - 1] = newLines[newLines.length - 1].trim().slice(0, -1);
}

// Add closing structure
newLines.push('    },');  // Close the last complete article
newLines.push('  },');     // Close articles object
newLines.push('  "site": {');
newLines.push('    "name": "L2Wiki.Su",');
newLines.push('    "subtitle": "База знаний по Lineage II в духе классических community-сайтов",');
newLines.push('    "ads": {}');
newLines.push('  },');
newLines.push('  "version": 2,');
newLines.push('  "updatedAt": "' + new Date().toISOString() + '"');
newLines.push('}');

// Write
const newContent = newLines.join('\n');
fs.writeFileSync(CANONICAL_PATH, newContent, 'utf8');

console.log(`📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`📄 New line count: ${newLines.length}`);

// Validate
try {
  const parsed = JSON.parse(newContent);
  const articleCount = Object.keys(parsed.articles || {}).length;
  const sectionCount = Object.keys(parsed.sections || {}).length;
  console.log(`✅ JSON is valid!`);
  console.log(`   Articles: ${articleCount}`);
  console.log(`   Sections: ${sectionCount}`);
  console.log('\n✅ Canonical file successfully closed!');
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  console.log('🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
  process.exit(1);
}
