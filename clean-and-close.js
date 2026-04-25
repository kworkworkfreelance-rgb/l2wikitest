#!/usr/bin/env node
/**
 * Clean control characters and close the canonical JSON file
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, 'data', 'backups', `canonical-pre-clean-${timestamp}.json`);

console.log('🔧 Cleaning control characters and closing canonical JSON file...\n');

// Create backup
if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
}
fs.copyFileSync(CANONICAL_PATH, BACKUP_PATH);
console.log(`✅ Backup created: ${BACKUP_PATH}`);

// Stream read and clean
let content = fs.readFileSync(CANONICAL_PATH, 'utf8');

// Find the problematic area - search for the last valid complete article
// The pattern we look for is the end of archive-vtoraya-profa-item-66-phantom-ranger-interlude
const searchPattern = 'archive-vtoraya-profa-item-66-phantom-ranger-interlude';
const lastIndex = content.lastIndexOf(searchPattern);

if (lastIndex === -1) {
  console.error('❌ Could not find the last complete article marker');
  process.exit(1);
}

console.log(`📄 Found last complete article at position ${lastIndex}`);

// Find the end of this article (look for the closing of its blocks array)
// After archive-vtoraya-profa-item-66 we should find }]} to close the article
let searchStart = lastIndex + searchPattern.length;
let pos = searchStart;
let depth = 0;
let inString = false;
let escaped = false;
let foundEnd = false;

// Look for the end of this article object
while (pos < content.length && !foundEnd) {
  const char = content[pos];
  
  if (escaped) {
    escaped = false;
  } else if (char === '\\') {
    escaped = true;
  } else if (char === '"' && !escaped) {
    inString = !inString;
  } else if (!inString) {
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      // Check if we're back at article level (depth should be 2: root.articles.article)
      if (depth <= 2) {
        // Look ahead to see if this is followed by }, or just }
        let ahead = pos + 1;
        while (ahead < content.length && /\s/.test(content[ahead])) ahead++;
        if (content[ahead] === ']' || content[ahead] === '}') {
          // Found the end
          foundEnd = true;
          break;
        }
      }
    }
  }
  pos++;
}

if (!foundEnd) {
  console.log('⚠️  Could not find exact end, using fallback truncation');
  // Fallback: look for the last occurrence of "}]}" pattern which typically ends an article with blocks
  const endPattern = /"\s*}\s*]\s*}\s*$/;
  
  // Search backwards from end for the pattern
  pos = content.length - 1;
  let braceCount = 0;
  let searchDepth = 0;
  
  // Simple approach: find the position where we have complete braces
  // Count from the beginning
  depth = 0;
  inString = false;
  escaped = false;
  pos = 0;
  let lastValidPos = 0;
  
  while (pos < content.length) {
    const char = content[pos];
    
    // Skip control characters (0-31 except tab, newline, carriage return)
    const code = content.charCodeAt(pos);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      // Control character - skip it
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
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
      }
      
      // Track valid positions (where we could end)
      if (depth === 2 && (char === '}' || char === ']')) {
        // Look ahead
        let ahead = pos + 1;
        while (ahead < Math.min(content.length, pos + 10) && /\s/.test(content[ahead])) ahead++;
        if (content[ahead] === '"' || content[ahead] === '}' || content[ahead] === ']') {
          lastValidPos = pos;
        }
      }
    }
    pos++;
  }
  
  pos = lastValidPos;
}

console.log(`📄 Truncating at position ${pos}`);

// Truncate and add proper closing
content = content.substring(0, pos + 1);

// Remove any trailing incomplete JSON
const lastBrace = content.lastIndexOf('}');
const lastBracket = content.lastIndexOf(']');
const lastValidEnd = Math.max(lastBrace, lastBracket);

if (lastValidEnd > 0) {
  content = content.substring(0, lastValidEnd + 1);
}

// Add proper closing structure
content = content.trim();
if (content.endsWith(',')) {
  content = content.slice(0, -1);
}

// Determine what we need to close based on current depth
depth = 0;
inString = false;
escaped = false;
for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (escaped) {
    escaped = false;
  } else if (char === '\\') {
    escaped = true;
  } else if (char === '"' && !escaped) {
    inString = !inString;
  } else if (!inString) {
    if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
  }
}

console.log(`🔍 Current depth: ${depth}`);

// Add closing braces
let closing = '';
for (let i = 0; i < depth; i++) {
  closing += '\n}';
}

content += closing;

// Add metadata if missing
if (!content.includes('"version"')) {
  // Remove the last } and add version/updatetime then close
  content = content.slice(0, -1);
  content += ',\n  "version": 2,\n';
  content += '  "updatedAt": "' + new Date().toISOString() + '"\n';
  content += '}';
}

// Write cleaned content
fs.writeFileSync(CANONICAL_PATH, content, 'utf8');

console.log('\n✅ Canonical file cleaned and closed!');
console.log(`📄 New file size: ${(fs.statSync(CANONICAL_PATH).size / 1024 / 1024).toFixed(2)} MB`);

// Validate
try {
  const parsed = JSON.parse(content);
  const articleCount = Object.keys(parsed.articles || {}).length;
  console.log(`✅ JSON is valid! Articles: ${articleCount}`);
} catch (e) {
  console.error('❌ JSON validation error:', e.message);
  console.error('Position:', e.message.match(/position (\d+)/)?.[1]);
  
  console.log('\n🔄 Restoring from backup...');
  fs.copyFileSync(BACKUP_PATH, CANONICAL_PATH);
  console.log('✅ Backup restored');
  process.exit(1);
}
