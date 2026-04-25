#!/usr/bin/env node
/**
 * Merge supplement data into canonical file
 * Fixes the broken canonical file and adds supplement articles
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const SUPPLEMENT_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical-supplement.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

console.log('🔧 Merging supplement into canonical file...\n');

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `canonical-pre-merge-${timestamp}.json`);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

fs.copyFileSync(CANONICAL_PATH, backupPath);
console.log(`✅ Backup created: ${backupPath}`);

// Read supplement
const supplement = JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, 'utf8'));
console.log(`📄 Supplement articles: ${Object.keys(supplement.articles).length}`);

// Read canonical
let canonicalContent = fs.readFileSync(CANONICAL_PATH, 'utf8');
console.log(`📄 Original canonical size: ${(canonicalContent.length / 1024 / 1024).toFixed(2)} MB`);

// Find and truncate at the last complete article
// The file ends mid-article, we need to find where to cut
const lines = canonicalContent.split('\n');
console.log(`📄 Total lines: ${lines.length}`);

// Look for the broken article marker
let truncateLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"archive-vtoraya-profa-item-73-spellhowler-interlude"')) {
    truncateLine = i;
    break;
  }
}

if (truncateLine === -1) {
  console.log('⚠️  Could not find broken article, checking if file is valid...');
  try {
    const test = JSON.parse(canonicalContent);
    console.log(`✅ Canonical file is already valid with ${Object.keys(test.articles).length} articles`);
    // File is valid, just merge supplement
    mergeAndSave(test, supplement);
    return;
  } catch (e) {
    console.log('❌ File is broken and cannot determine truncation point');
    console.log('Attempting to find last valid article...');
    
    // Try to find the last article that ends properly
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('"archive-vtoraya-profa-item-66-phantom-ranger-interlude"')) {
        // Found the last complete article, need to find where it ends
        for (let j = i + 1; j < lines.length && j < i + 50; j++) {
          if (lines[j].trim() === '}' || lines[j].trim() === '},') {
            truncateLine = j + 1;
            break;
          }
        }
        if (truncateLine === -1) truncateLine = i + 20; // Approximate
        break;
      }
    }
  }
}

if (truncateLine === -1) {
  console.error('❌ Cannot determine where to truncate the file');
  process.exit(1);
}

console.log(`📄 Will truncate at line ${truncateLine}`);

// Truncate
const newLines = lines.slice(0, truncateLine);

// Remove trailing comma from last line if present
let lastLine = newLines[newLines.length - 1];
if (lastLine.trim().endsWith(',')) {
  newLines[newLines.length - 1] = lastLine.slice(0, lastLine.lastIndexOf(','));
}

// Add closing for articles object and root
newLines.push('  },'); // Close articles
newLines.push('  "site": {');
newLines.push('    "name": "L2Wiki.Su",');
newLines.push('    "subtitle": "База знаний по Lineage II в духе классических community-сайтов",');
newLines.push('    "ads": {');
newLines.push('      "homeHeader": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },');
newLines.push('      "homeSidebar": { "enabled": true, "label": "Рекламный блок (300x250)", "text": "" },');
newLines.push('      "homeSectionBreak": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },');
newLines.push('      "homeContentBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },');
newLines.push('      "articleTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },');
newLines.push('      "articleBottom": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" },');
newLines.push('      "sectionTop": { "enabled": true, "label": "Рекламный блок (728x90)", "text": "" }');
newLines.push('    }');
newLines.push('  },');
newLines.push('  "version": 2,');
newLines.push(`  "updatedAt": "${new Date().toISOString()}"`);
newLines.push('}');

// Join
let fixedContent = newLines.join('\n');

// Parse the fixed content
let canonical;
try {
  canonical = JSON.parse(fixedContent);
  console.log(`✅ Fixed canonical has ${Object.keys(canonical.articles).length} articles`);
} catch (e) {
  console.error('❌ Failed to parse fixed canonical:', e.message);
  process.exit(1);
}

// Merge supplement
mergeAndSave(canonical, supplement);

function mergeAndSave(canonical, supplement) {
  // Merge articles from supplement
  let added = 0;
  for (const [id, article] of Object.entries(supplement.articles)) {
    if (!canonical.articles[id]) {
      canonical.articles[id] = article;
      added++;
    } else {
      console.log(`⚠️  Article ${id} already exists, skipping`);
    }
  }
  
  console.log(`\n📊 Added ${added} new articles from supplement`);
  
  // Update metadata
  canonical.updatedAt = new Date().toISOString();
  canonical.version = 2;
  
  // Write
  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2), 'utf8');
  
  console.log(`\n📄 New canonical size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📊 Total articles: ${Object.keys(canonical.articles).length}`);
  
  // Validate
  try {
    const test = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    console.log(`✅ Canonical file is valid!`);
    console.log(`\n✅ Successfully merged supplement into canonical file!`);
    
    // Update static-data.js
    updateStaticData(canonical);
  } catch (e) {
    console.error('❌ Validation failed:', e.message);
    process.exit(1);
  }
}

function updateStaticData(database) {
  console.log('\n🔄 Updating static-data.js...');
  
  const staticDataPath = path.join(__dirname, 'assets', 'js', 'static-data.js');
  const staticContent = `/**
 * L2Wiki Static Data Embed
 * Canonical source-of-truth snapshot embedded for public pages.
 * Generated: ${new Date().toISOString()}
 * Source: merge-supplement
 */

window.L2WIKI_SEED_DATA = ${JSON.stringify(database, null, 2)};

console.log('[L2Wiki] Static seed data loaded - ${Object.keys(database.articles || {}).length} articles, ${Object.keys(database.sections || {}).length} sections');
`;
  
  fs.writeFileSync(staticDataPath, staticContent, 'utf8');
  console.log(`✅ static-data.js updated`);
}
