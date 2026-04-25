#!/usr/bin/env node
/**
 * Simple approach: find the last complete article ending and close from there
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-simple-close-${timestamp}.json`);

console.log('🔧 Simple close for canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Read the file
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');

console.log(`📄 Original file size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);

// Look for patterns that indicate end of a complete article with blocks
// Pattern: }]\n    } - closing block array and article object
const endPatterns = [
  /"\s*}\s*]\s*\n\s*}\s*,?\s*\n\s*"archive-vtoraya-profa-item-73/,  // End of article 66 followed by 73
  /"archive-vtoraya-profa-item-66-phantom-ranger-interlude"[\s\S]{0,50000}?"\s*}\s*]\s*\n\s*}/,  // Article 66 complete
];

let truncatePos = -1;

for (const pattern of endPatterns) {
  const match = content.match(pattern);
  if (match) {
    // For the first pattern, we want to truncate before article 73 starts
    if (pattern.toString().includes('archive-vtoraya-profa-item-73')) {
      truncatePos = match.index;
    } else {
      // For article 66 end, we want to include it
      truncatePos = match.index + match[0].length;
    }
    console.log(`📄 Found pattern match at position ${match.index}`);
    break;
  }
}

if (truncatePos === -1) {
  // Fallback: find the position of the broken article and truncate before it
  const brokenArticlePos = content.indexOf('"archive-vtoraya-profa-item-73-spellhowler-interlude"');
  if (brokenArticlePos !== -1) {
    // Find the start of this line
    let lineStart = brokenArticlePos;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    truncatePos = lineStart;
    console.log(`📄 Found broken article at position ${brokenArticlePos}, truncating at line start ${truncatePos}`);
  }
}

if (truncatePos === -1) {
  console.error('❌ Could not find truncation point');
  process.exit(1);
}

// Truncate
content = content.substring(0, truncatePos);

// Remove trailing comma if present
content = content.trim().replace(/,\s*$/, '');

// Add closing braces
// Close articles object, then root object
content += '\n  },\n';

// Add site section (it might be missing since we truncated)
if (!content.includes('"site":')) {
  content += '  "site": {\n';
  content += '    "name": "L2Wiki.Su",\n';
  content += '    "subtitle": "База знаний по Lineage II в духе классических community-сайтов",\n';
  content += '    "ads": {\n';
  content += '      "homeHeader": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },\n';
  content += '      "homeSidebar": { "enabled": true, "label": "Рекламный блок (300x250)", "text": "" },\n';
  content += '      "homeSectionBreak": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },\n';
  content += '      "homeContentBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },\n';
  content += '      "articleTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },\n';
  content += '      "articleBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },\n';
  content += '      "sectionTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" }\n';
  content += '    }\n';
  content += '  },\n';
}

// Add version and timestamp
content += '  "version": 2,\n';
content += '  "updatedAt": "' + new Date().toISOString() + '"\n';
content += '}';

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
  console.log('🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
  process.exit(1);
}

console.log('\n✅ Canonical file successfully closed!');
