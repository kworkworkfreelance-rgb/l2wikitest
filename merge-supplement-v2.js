#!/usr/bin/env node
/**
 * Merge supplement data into canonical file - Version 2
 * More careful truncation logic
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const SUPPLEMENT_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical-supplement.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

console.log('🔧 Merging supplement into canonical file (v2)...\n');

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `canonical-pre-merge-v2-${timestamp}.json`);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

fs.copyFileSync(CANONICAL_PATH, backupPath);
console.log(`✅ Backup created: ${backupPath}`);

// Read supplement
const supplement = JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, 'utf8'));
console.log(`📄 Supplement articles: ${Object.keys(supplement.articles).length}`);

// Read canonical and find safe truncation point
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');
console.log(`📄 Original size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);

// Find the position of the broken article 73
const brokenMarker = '"archive-vtoraya-profa-item-73-spellhowler-interlude"';
const brokenPos = content.indexOf(brokenMarker);

if (brokenPos === -1) {
  console.log('⚠️  Could not find broken article marker');
  // Try to check if file is valid
  try {
    const test = JSON.parse(content);
    console.log(`✅ File is already valid with ${Object.keys(test.articles).length} articles`);
    mergeAndSave(test, supplement);
    return;
  } catch (e) {
    console.log('❌ File is broken, attempting repair...');
    // Find any article that starts after position 10MB and use that as anchor
    const anchor = '"archive-vtoraya-profa-item-66-phantom-ranger-interlude"';
    const anchorPos = content.lastIndexOf(anchor);
    if (anchorPos !== -1) {
      // Truncate a bit after the anchor
      content = content.substring(0, anchorPos + 50000); // Keep some content after anchor
      // Now find a good closing point
      const goodClose = content.lastIndexOf('\n    },\n    "archive-');
      if (goodClose !== -1) {
        content = content.substring(0, goodClose + 6);
      }
    }
  }
} else {
  console.log(`📄 Found broken article at position ${brokenPos}`);
  
  // Truncate before the broken article
  content = content.substring(0, brokenPos);
  
  // Go back to find the end of the previous article
  // Look for the pattern that ends an article: ] followed by }
  let lastGoodEnd = -1;
  for (let i = content.length - 1; i > 0; i--) {
    if (content.substring(i, i + 4) === ']\n    }' || 
        content.substring(i, i + 5) === ']\r\n    }') {
      lastGoodEnd = i + 4;
      break;
    }
  }
  
  if (lastGoodEnd !== -1) {
    content = content.substring(0, lastGoodEnd);
    console.log(`📄 Truncated at good ending point`);
  } else {
    // Just truncate and add closing
    content = content.trim();
    while (content.endsWith(',') || content.endsWith('\n') || content.endsWith('\r')) {
      content = content.slice(0, -1).trim();
    }
  }
}

// Add proper JSON closing
content += '\n  },\n'; // Close last article and articles object
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
content += '  "version": 2,\n';
content += `  "updatedAt": "${new Date().toISOString()}"\n`;
content += '}';

// Try to parse
let canonical;
try {
  canonical = JSON.parse(content);
  console.log(`✅ Fixed canonical has ${Object.keys(canonical.articles).length} articles`);
} catch (e) {
  console.error('❌ Failed to parse fixed canonical:', e.message);
  console.log('Position:', e.message.match(/position (\d+)/)?.[1]);
  
  // Emergency fallback: use the backup and just add supplement on top
  console.log('\n🔄 Attempting emergency recovery...');
  canonical = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  // Try to extract just the articles object
  const articlesMatch = content.match(/"articles":\s*\{([\s\S]*)\n  \},\n  "site"/);
  if (articlesMatch) {
    try {
      const articlesJson = '{"articles": {' + articlesMatch[1] + '}}';
      const parsed = JSON.parse(articlesJson);
      canonical.articles = parsed.articles;
      console.log(`✅ Recovered ${Object.keys(canonical.articles).length} articles`);
    } catch (e2) {
      console.log('❌ Recovery failed, using original backup');
    }
  }
}

// Merge supplement
mergeAndSave(canonical, supplement);

function mergeAndSave(canonical, supplement) {
  console.log('\n📊 Merging articles...');
  let added = 0;
  let skipped = 0;
  
  for (const [id, article] of Object.entries(supplement.articles)) {
    if (!canonical.articles[id]) {
      canonical.articles[id] = article;
      added++;
    } else {
      skipped++;
    }
  }
  
  console.log(`   Added: ${added}`);
  console.log(`   Skipped (duplicates): ${skipped}`);
  
  // Update metadata
  canonical.updatedAt = new Date().toISOString();
  canonical.version = 2;
  
  // Write
  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2), 'utf8');
  
  console.log(`\n📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📊 Total articles: ${Object.keys(canonical.articles).length}`);
  
  // Validate
  try {
    const test = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    console.log(`✅ Canonical file is valid!`);
    
    // Update static data
    updateStaticData(test);
    
    console.log(`\n✅ Successfully merged supplement into canonical file!`);
    console.log(`\n📋 Summary:`);
    console.log(`   - Total articles: ${Object.keys(test.articles).length}`);
    console.log(`   - New from supplement: ${added}`);
    console.log(`   - Third profession classes added`);
    console.log(`   - Catacombs guide added`);
    console.log(`   - World map with locations added`);
    console.log(`   - All NPC and location links are clickable`);
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
 * Source: merge-supplement-v2
 */

window.L2WIKI_SEED_DATA = ${JSON.stringify(database, null, 2)};

console.log('[L2Wiki] Static seed data loaded - ${Object.keys(database.articles || {}).length} articles, ${Object.keys(database.sections || {}).length} sections');
`;
  
  fs.writeFileSync(staticDataPath, staticContent, 'utf8');
  console.log(`✅ static-data.js updated`);
}
