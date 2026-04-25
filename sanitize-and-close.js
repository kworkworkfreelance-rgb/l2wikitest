#!/usr/bin/env node
/**
 * Sanitize control characters and properly close the canonical JSON file
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-sanitized-${timestamp}.json`);

console.log('🔧 Sanitizing and closing canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Stream process the file to remove control characters
console.log('🧹 Removing control characters...');

const tempPath = CANONICAL_PATH + '.temp';
const readStream = fs.createReadStream(CANONICAL_PATH, { encoding: 'utf8' });
const writeStream = fs.createWriteStream(tempPath, { encoding: 'utf8' });

let chunkCount = 0;
let controlCharsRemoved = 0;

readStream.on('data', (chunk) => {
  chunkCount++;
  
  // Replace control characters (0-31) except tab(9), newline(10), carriage return(13)
  // with empty string or space depending on context
  let cleaned = '';
  for (let i = 0; i < chunk.length; i++) {
    const code = chunk.charCodeAt(i);
    if (code < 32) {
      if (code === 9 || code === 10 || code === 13) {
        // Keep tab, newline, carriage return
        cleaned += chunk[i];
      } else {
        // Remove other control characters
        controlCharsRemoved++;
        // Replace with space if between non-whitespace chars to avoid concatenation issues
        if (i > 0 && i < chunk.length - 1) {
          const prev = chunk.charCodeAt(i - 1);
          const next = chunk.charCodeAt(i + 1);
          if (prev > 32 && next > 32) {
            cleaned += ' ';
          }
        }
      }
    } else {
      cleaned += chunk[i];
    }
  }
  
  writeStream.write(cleaned);
});

readStream.on('end', () => {
  writeStream.end();
  console.log(`   Processed ${chunkCount} chunks, removed ${controlCharsRemoved} control chars`);
});

writeStream.on('finish', () => {
  // Replace original with cleaned version
  fs.renameSync(tempPath, CANONICAL_PATH);
  
  // Now read and properly close the file
  console.log('\n🔒 Closing JSON structure...');
  
  let content = fs.readFileSync(CANONICAL_PATH, 'utf8');
  
  // Find position of broken article
  const brokenArticleMarker = '"archive-vtoraya-profa-item-73-spellhowler-interlude"';
  const brokenPos = content.indexOf(brokenArticleMarker);
  
  if (brokenPos === -1) {
    console.log('⚠️  Could not find broken article marker, checking if already valid...');
    try {
      JSON.parse(content);
      console.log('✅ File is already valid JSON!');
      return;
    } catch (e) {
      console.error('❌ Not valid JSON:', e.message);
      process.exit(1);
    }
  }
  
  console.log(`📄 Found broken article at position ${brokenPos}`);
  
  // Find line start for this position
  let lineStart = brokenPos;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  // Truncate
  content = content.substring(0, lineStart);
  
  // Remove trailing comma and whitespace
  content = content.trim().replace(/,\s*$/, '');
  
  // Add proper closing
  content += '\n  },\n'; // Close articles object
  
  // Add site section if missing
  if (!content.includes('"site":')) {
    content += '  "site": {\n';
    content += '    "name": "L2Wiki.Su",\n';
    content += '    "subtitle": "База знаний по Lineage II в духе классических community-сайтов",\n';
    content += '    "ads": {}\n';
    content += '  },\n';
  }
  
  content += '  "version": 2,\n';
  content += '  "updatedAt": "' + new Date().toISOString() + '"\n';
  content += '}';
  
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
    console.log('\n✅ Canonical file successfully sanitized and closed!');
  } catch (e) {
    console.error('❌ JSON validation error:', e.message);
    console.log('🔄 Restoring from backup...');
    fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
    console.log('✅ Backup restored');
    process.exit(1);
  }
});
