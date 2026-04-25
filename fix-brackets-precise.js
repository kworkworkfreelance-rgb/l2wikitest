#!/usr/bin/env node
/**
 * Fix unclosed brackets by finding exact positions
 */

const fs = require('fs');

const content = fs.readFileSync('./data/canonical/l2wiki-canonical.json', 'utf8');
const lines = content.split('\n');

console.log('Анализ структуры...\n');

// Track bracket depth per line
let lineDepths = [];
let openBrackets = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let lineOpen = 0;
  let lineClose = 0;
  
  for (let c of line) {
    if (c === '[') lineOpen++;
    else if (c === ']') lineClose++;
  }
  
  openBrackets += lineOpen - lineClose;
  lineDepths.push({ line: i + 1, depth: openBrackets, open: lineOpen, close: lineClose });
}

// Find lines where depth increases and never decreases back
console.log('Поиск незакрытых массивов...\n');

let unclosedPositions = [];
let currentDepth = 0;
let startLine = 0;

for (let i = 0; i < lineDepths.length; i++) {
  const info = lineDepths[i];
  
  if (info.depth > currentDepth) {
    // Depth increased - track potential unclosed
    if (currentDepth === 0) startLine = info.line;
    currentDepth = info.depth;
  } else if (info.depth < currentDepth) {
    // Depth decreased - some were closed
    currentDepth = info.depth;
  }
  
  // If we're near the end with high depth, record it
  if (i > lineDepths.length - 100 && info.depth > 0) {
    console.log(`Строка ${info.line}: глубина ${info.depth}, открыто ${info.open}, закрыто ${info.close}`);
    console.log(`  ${lines[i].substring(0, 80)}...`);
  }
}

// Find the last article that's properly closed
console.log('\nПоиск последней полной статьи...\n');

let lastCompleteArticle = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('"world-map-locations"') || 
      lines[i].includes('"catacombs-detailed-guide"') ||
      lines[i].includes('"quest-profession-third"')) {
    // Found one of our added articles
    lastCompleteArticle = i;
    break;
  }
}

console.log('Последняя наша статья найдена на строке:', lastCompleteArticle);

// Find a safe truncation point - look for article end pattern
console.log('\nПоиск безопасной точки обрезки...\n');

let truncateAt = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  // Look for pattern: ] followed by } followed by ,
  if (lines[i].trim() === ']' || lines[i].trim() === '],') {
    // Check if next line closes the article
    if (i + 1 < lines.length && (lines[i+1].trim() === '}' || lines[i+1].trim() === '},')) {
      truncateAt = i + 2;
      console.log(`Безопасная точка на строке ${truncateAt}`);
      console.log(`  Строка ${i}: ${lines[i].substring(0, 60)}`);
      console.log(`  Строка ${i+1}: ${lines[i+1].substring(0, 60)}`);
      break;
    }
  }
}

if (truncateAt === -1) {
  console.log('Не удалось найти безопасную точку автоматом');
  // Use the backup approach
  console.log('\nИспользую бэкап без проблемных статей...');
  
  const backup = fs.readFileSync('./data/backups/2026-04-09T08-56-37-923Z-archive-import.json', 'utf8');
  fs.writeFileSync('./data/canonical/l2wiki-canonical.json', backup);
  
  const data = JSON.parse(backup);
  console.log(`Восстановлено: ${Object.keys(data.articles).length} статей`);
  
  // Add only the safe articles
  const supp = JSON.parse(fs.readFileSync('./data/canonical/l2wiki-canonical-supplement.json', 'utf8'));
  let added = 0;
  ['quest-profession-third', 'catacombs-detailed-guide', 'world-map-locations'].forEach(id => {
    if (!data.articles[id]) {
      data.articles[id] = supp.articles[id];
      added++;
    }
  });
  
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync('./data/canonical/l2wiki-canonical.json', JSON.stringify(data, null, 2));
  fs.writeFileSync('./assets/js/static-data.js', 'window.L2WIKI_SEED_DATA = ' + JSON.stringify(data, null, 2) + ';');
  
  console.log(`Добавлено статей: ${added}`);
  console.log('Всего статей:', Object.keys(data.articles).length);
  console.log('✅ Файл исправлен!');
} else {
  console.log(`Обрезка на строке ${truncateAt}...`);
  
  const newLines = lines.slice(0, truncateAt);
  
  // Remove trailing comma if present
  let lastLine = newLines[newLines.length - 1];
  if (lastLine.trim().endsWith(',')) {
    newLines[newLines.length - 1] = lastLine.trim().slice(0, -1);
  }
  
  // Add proper closing
  newLines.push('  },');
  newLines.push('  "site": {');
  newLines.push('    "name": "LWiki.Su",');
  newLines.push('    "subtitle": "База знаний по Lineage II в духе классических community-сайтов"');
  newLines.push('  },');
  newLines.push('  "version": 2,');
  newLines.push(`  "updatedAt": "${new Date().toISOString()}"`);
  newLines.push('}');
  
  const newContent = newLines.join('\n');
  
  try {
    const test = JSON.parse(newContent);
    console.log('✅ Валидный JSON после обрезки');
    console.log(`Статей: ${Object.keys(test.articles).length}`);
    
    fs.writeFileSync('./data/canonical/l2wiki-canonical.json', newContent);
    fs.writeFileSync('./assets/js/static-data.js', 'window.L2WIKI_SEED_DATA = ' + JSON.stringify(test, null, 2) + ';');
    console.log('✅ Файл исправлен и сохранен');
  } catch (e) {
    console.log('❌ Ошибка:', e.message);
  }
}
