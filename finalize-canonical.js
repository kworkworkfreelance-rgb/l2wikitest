#!/usr/bin/env node
/**
 * Finalize the canonical JSON file by appending proper closing
 * This works with the original formatted file
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-finalize-${timestamp}.json`);

console.log('🔧 Finalizing canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read the file stats
const stats = fs.statSync(CANONICAL_PATH);
console.log(`📄 Original file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Read the end of the file to understand structure
const fd = fs.openSync(CANONICAL_PATH, 'r');
const bufferSize = 5000;
const buffer = Buffer.alloc(bufferSize);
fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
fs.closeSync(fd);

const ending = buffer.toString('utf8');
const lines = ending.split('\n');

console.log(`📄 Last 10 lines of file:`);
for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
  const linePreview = lines[i].substring(0, 100).replace(/\s+/g, ' ');
  console.log(`   ${i}: ${linePreview}...`);
}

// Check the structure - look for the broken article marker
const brokenArticleInEnding = ending.includes('archive-vtoraya-profa-item-73-spellhowler-interlude');
console.log(`\n🔍 Broken article in ending: ${brokenArticleInEnding}`);

// Strategy: The file ends in the middle of article 73's HTML content
// We need to:
// 1. Remove everything from the start of article 73 onwards
// 2. Add proper closing for article 66 (the last complete article)
// 3. Close the articles object and root

// Read the full file
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');

// Find the position of article 73 start
const article73Start = content.indexOf('"archive-vtoraya-profa-item-73-spellhowler-interlude"');

if (article73Start === -1) {
  console.error('❌ Could not find article 73');
  process.exit(1);
}

console.log(`📄 Article 73 starts at position ${article73Start}`);

// Find the line that contains article 73 start
let lineStart = article73Start;
while (lineStart > 0 && content[lineStart - 1] !== '\n') {
  lineStart--;
}

console.log(`📄 Line containing article 73 starts at position ${lineStart}`);

// Truncate to this position
let truncated = content.substring(0, lineStart);

// Now we need to properly close the previous article (article 66)
// Go back and find where to add the closing braces

// Remove trailing whitespace and commas
truncated = truncated.trim();
while (truncated.endsWith(',') || truncated.endsWith('\n') || truncated.endsWith('\r')) {
  truncated = truncated.slice(0, -1).trim();
}

// Check the last few lines to see what we have
const lastLines = truncated.split('\n').slice(-10);
console.log(`\n📄 Last lines after truncation:`);
lastLines.forEach((line, idx) => {
  const preview = line.substring(0, 80).trim();
  console.log(`   ${idx}: ${preview}`);
});

// Determine what needs to be closed
// Looking at the last lines, we need to close:
// - The blocks array (])
// - The article object (})
// - The articles object (})
// - The root object (})

// Add closing
const closing = `
        }
      ]
    }
  },
  "site": {
    "name": "L2Wiki.Su",
    "subtitle": "База знаний по Lineage II в духе классических community-сайтов",
    "ads": {
      "homeHeader": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },
      "homeSidebar": { "enabled": true, "label": "Рекламный блок (300x250)", "text": "" },
      "homeSectionBreak": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },
      "homeContentBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },
      "articleTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },
      "articleBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },
      "sectionTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" }
    }
  },
  "version": 2,
  "updatedAt": "${new Date().toISOString()}"
}`;

truncated += closing;

// Write
fs.writeFileSync(CANONICAL_PATH, truncated, 'utf8');

console.log(`\n📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);

// Validate
try {
  const parsed = JSON.parse(truncated);
  const articleCount = Object.keys(parsed.articles || {}).length;
  const sectionCount = Object.keys(parsed.sections || {}).length;
  console.log(`✅ JSON is valid!`);
  console.log(`   Articles: ${articleCount}`);
  console.log(`   Sections: ${sectionCount}`);
  console.log('\n✅ Canonical file successfully finalized!');
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  console.log('🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
  process.exit(1);
}
