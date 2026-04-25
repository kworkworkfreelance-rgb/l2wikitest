// Скрипт для исправления невалидного JSON в static-data.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'assets', 'js', 'static-data.js');

console.log('🔍 Проверяю static-data.js...');

const content = fs.readFileSync(filePath, 'utf8');

// Находим JSON часть
const startIdx = content.indexOf('{');
const endIdx = content.lastIndexOf('}');

if (startIdx === -1 || endIdx === -1) {
    console.error('❌ Не найден JSON в файле');
    process.exit(1);
}

const jsonStr = content.substring(startIdx, endIdx + 1);

// Проверяем валидность JSON
try {
    JSON.parse(jsonStr);
    console.log('✅ JSON валидный!');
    console.log(`📊 Размер: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB`);
} catch (e) {
    console.log('❌ JSON невалидный:', e.message);
    console.log('🔧 Исправляю...');

    // Пробуем исправить - ищем последнюю закрывающую скобку перед ошибкой
    // и обрезаем всё что после
    let lastGoodEnd = -1;
    
    // Попробуем найти правильную структуру
    for (let i = jsonStr.length - 1; i >= 0; i--) {
        if (jsonStr[i] === '}') {
            const candidate = jsonStr.substring(0, i + 1);
            try {
                JSON.parse(candidate);
                lastGoodEnd = i + 1;
                console.log(`✅ Нашёл правильную закрывающую скобку на позиции ${i}`);
                break;
            } catch (e2) {
                continue;
            }
        }
    }

    if (lastGoodEnd > 0) {
        const fixedJson = jsonStr.substring(0, lastGoodEnd);
        const newContent = content.substring(0, startIdx) + fixedJson;
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('✅ Файл исправлен!');
        
        // Проверим снова
        const newContent2 = fs.readFileSync(filePath, 'utf8');
        const newJson = newContent2.substring(newContent2.indexOf('{'), newContent2.lastIndexOf('}') + 1);
        try {
            JSON.parse(newJson);
            console.log('✅ JSON теперь валидный!');
            console.log(`📊 Размер: ${(newJson.length / 1024 / 1024).toFixed(2)} MB`);
        } catch (e) {
            console.log('❌ Всё ещё невалидный:', e.message);
            process.exit(1);
        }
    } else {
        console.error('❌ Не удалось исправить автоматически');
        process.exit(1);
    }
}
