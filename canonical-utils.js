/**
 * Утилиты для работы с l2wiki-canonical.json
 * Позволяет редактировать отдельные секции без загрузки всего файла
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');
const TEMP_DIR = path.join(__dirname, 'data', 'canonical', 'temp');

/**
 * Читает конкретную секцию из канонического файла
 */
function readSection(sectionPath) {
    console.log(`Чтение секции: ${sectionPath}`);
    
    const data = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    const keys = sectionPath.split('.');
    let result = data;
    
    for (const key of keys) {
        result = result[key];
        if (!result) {
            console.error(`Секция не найдена: ${sectionPath}`);
            return null;
        }
    }
    
    return result;
}

/**
 * Сохраняет секцию во временный файл для редактирования
 */
function exportSection(sectionPath, fileName) {
    const section = readSection(sectionPath);
    if (!section) return false;
    
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    const filePath = path.join(TEMP_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(section, null, 2), 'utf8');
    console.log(`Секция экспортирована: ${filePath}`);
    
    return filePath;
}

/**
 * Обновляет секцию в каноническом файле из временного файла
 */
function importSection(sectionPath, tempFileName) {
    const tempPath = path.join(TEMP_DIR, tempFileName);
    
    if (!fs.existsSync(tempPath)) {
        console.error(`Временный файл не найден: ${tempPath}`);
        return false;
    }
    
    const newSectionData = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    const data = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    
    const keys = sectionPath.split('.');
    let current = data;
    
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = newSectionData;
    
    // Обновляем timestamp
    data.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Секция обновлена: ${sectionPath}`);
    
    return true;
}

/**
 * Показывает статистику по секциям
 */
function showStats() {
    const data = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    
    console.log('\n=== Статистика канонического файла ===');
    console.log(`Версия: ${data.version}`);
    console.log(`Обновлено: ${data.updatedAt}`);
    console.log(`Сайт: ${data.site.name}`);
    
    if (data.sections) {
        console.log('\n--- Секции ---');
        Object.keys(data.sections).forEach(key => {
            const section = data.sections[key];
            const entryCount = section.entries ? section.entries.length : 
                              (section.groups ? section.groups.length : 0);
            console.log(`  ${key}: ${section.title} (${entryCount} элементов)`);
        });
    }
    
    console.log('\n--- Рекламные блоки ---');
    Object.keys(data.site.ads).forEach(key => {
        const ad = data.site.ads[key];
        console.log(`  ${key}: ${ad.enabled ? 'включен' : 'выключен'}`);
    });
}

/**
 * Создает бэкап перед изменениями
 */
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, 'data', 'backups', `${timestamp}-canonical-backup.json`);
    
    if (!fs.existsSync(path.join(__dirname, 'data', 'backups'))) {
        fs.mkdirSync(path.join(__dirname, 'data', 'backups'), { recursive: true });
    }
    
    fs.copyFileSync(CANONICAL_PATH, backupPath);
    console.log(`Бэкап создан: ${backupPath}`);
    
    return backupPath;
}

// CLI интерфейс
const command = process.argv[2];

switch (command) {
    case 'read':
        const sectionPath = process.argv[3];
        if (!sectionPath) {
            console.error('Укажите путь к секции, например: sections.quests');
            process.exit(1);
        }
        console.log(JSON.stringify(readSection(sectionPath), null, 2));
        break;
        
    case 'export':
        const exportPath = process.argv[3];
        const exportFile = process.argv[4] || `${exportPath.replace(/\./g, '-')}.json`;
        if (!exportPath) {
            console.error('Укажите путь к секции, например: sections.quests');
            process.exit(1);
        }
        exportSection(exportPath, exportFile);
        break;
        
    case 'import':
        const importPath = process.argv[3];
        const importFile = process.argv[4];
        if (!importPath || !importFile) {
            console.error('Укажите путь к секции и файл, например: sections.quests quests-temp.json');
            process.exit(1);
        }
        createBackup();
        importSection(importPath, importFile);
        break;
        
    case 'stats':
        showStats();
        break;
        
    case 'backup':
        createBackup();
        break;
        
    default:
        console.log(`
Использование:
  node canonical-utils.js read <section.path>     - Читает секцию
  node canonical-utils.js export <section.path> [file] - Экспортирует секцию
  node canonical-utils.js import <section.path> <file> - Импортирует секцию
  node canonical-utils.js stats                   - Показывает статистику
  node canonical-utils.js backup                  - Создает бэкап

Примеры:
  node canonical-utils.js export site.ads site-ads.json
  node canonical-utils.js read sections.quests
  node canonical-utils.js import site.ads site-ads.json
        `);
}
