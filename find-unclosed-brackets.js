#!/usr/bin/env node
/**
 * Find unclosed brackets in JSON file
 */

const fs = require('fs');

const content = fs.readFileSync('./data/canonical/l2wiki-canonical.json', 'utf8');
const lines = content.split('\n');

console.log('Поиск незакрытых скобок...\n');

let openBraces = 0;
let openBrackets = 0;
let bracePositions = [];
let bracketPositions = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '{') {
      openBraces++;
      bracePositions.push({ line: i + 1, col: j + 1, type: '{' });
    } else if (c === '}') {
      openBraces--;
      bracePositions.pop();
    } else if (c === '[') {
      openBrackets++;
      bracketPositions.push({ line: i + 1, col: j + 1, type: '[' });
    } else if (c === ']') {
      openBrackets--;
      bracketPositions.pop();
    }
  }
}

console.log(`Открытых фигурных скобок: ${openBraces}`);
console.log(`Открытых квадратных скобок: ${openBrackets}`);

if (openBrackets > 0) {
  console.log('\n❌ Незакрытые квадратные скобки:');
  console.log('Последние 10 позиций открывающих скобок:');
  bracketPositions.slice(-10).forEach(p => {
    console.log(`  [${p.type}] Строка ${p.line}, колонка ${p.col}`);
  });
  
  console.log('\nНужно закрыть скобки в конце файла');
  console.log('Добавляем закрывающие скобки...');
  
  // Add closing brackets
  let newContent = content;
  for (let i = 0; i < openBrackets; i++) {
    newContent += ']';
  }
  
  // Backup first
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync('./data/canonical/l2wiki-canonical.json', `./data/backups/canonical-before-bracket-fix-${timestamp}.json`);
  
  // Write fixed file
  fs.writeFileSync('./data/canonical/l2wiki-canonical.json', newContent);
  
  // Validate
  try {
    const test = JSON.parse(newContent);
    console.log('\n✅ Файл исправлен и валиден!');
    console.log(`Статей: ${Object.keys(test.articles).length}`);
    
    // Update static-data
    fs.writeFileSync('./assets/js/static-data.js', 'window.L2WIKI_SEED_DATA = ' + JSON.stringify(test, null, 2) + ';');
    console.log('✅ static-data.js обновлен');
  } catch (e) {
    console.log('\n❌ После добавления скобок всё равно ошибка:', e.message);
  }
} else {
  console.log('✅ Все скобки закрыты');
}
