#!/bin/bash

# 🚀 L2Wiki - Подготовка к деплою на Render
# Этот скрипт подготовит ваш проект для загрузки на Render

echo "🚀 L2Wiki - Подготовка к деплою на Render"
echo "=========================================="
echo ""

# 1. Проверка что мы в правильной директории
if [ ! -f "server.js" ]; then
    echo "❌ Ошибка: server.js не найден!"
    echo "Убедитесь что вы в папке проекта l2Wiki"
    exit 1
fi

echo "✅ Папка проекта найдена"

# 2. Проверка что static-data.js существует
if [ ! -f "assets/js/static-data.js" ]; then
    echo "❌ Ошибка: static-data.js не найден!"
    echo "Запустите: node regenerate-static-data.js"
    exit 1
fi

echo "✅ static-data.js найден"

# 3. Проверка что JSON backup существует
if [ ! -f "l2wiki-db-2026-04-07.json" ]; then
    echo "❌ Ошибка: l2wiki-db-2026-04-07.json не найден!"
    echo "Этот файл нужен для импорта данных на сервере"
    exit 1
fi

echo "✅ l2wiki-db-2026-04-07.json найден"

# 4. Проверка что package.json существует
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден!"
    exit 1
fi

echo "✅ package.json найден"

# 5. Проверка что render.yaml существует
if [ ! -f "render.yaml" ]; then
    echo "❌ Ошибка: render.yaml не найден!"
    echo "Этот файл нужен для автоматического деплоя"
    exit 1
fi

echo "✅ render.yaml найден"

echo ""
echo "🗑️  Очистка временных файлов..."

# 6. Удаление node_modules
if [ -d "node_modules" ]; then
    echo "   🗑️  Удаляю node_modules/..."
    rm -rf node_modules/
    echo "   ✅ node_modules удалён"
else
    echo "   ✅ node_modules уже отсутствует"
fi

# 7. Удаление l2wiki.db
if [ -f "l2wiki.db" ]; then
    echo "   🗑️  Удаляю l2wiki.db..."
    rm l2wiki.db
    echo "   ✅ l2wiki.db удалён"
else
    echo "   ✅ l2wiki.db уже отсутствует"
fi

# 8. Удаление backup файлов
if [ -f "l2wiki-db-backup.json" ]; then
    echo "   🗑️  Удаляю l2wiki-db-backup.json..."
    rm l2wiki-db-backup.json
    echo "   ✅ l2wiki-db-backup.json удалён"
else
    echo "   ✅ l2wiki-db-backup.json уже отсутствует"
fi

echo ""
echo "📦 Подготовка Git..."

# 9. Git status
echo "   📊 Git статус:"
git status --short

echo ""
echo "📝 Следующие шаги:"
echo ""
echo "1️⃣  Создайте Git репозиторий:"
echo "    git init"
echo "    git add ."
echo "    git commit -m \"Initial commit - L2Wiki ready for Render\""
echo ""
echo "2️⃣  Создайте репозиторий на GitHub:"
echo "    git remote add origin https://github.com/ВАШ_USERNAME/l2wiki.git"
echo "    git branch -M main"
echo "    git push -u origin main"
echo ""
echo "3️⃣  Зайдите на https://render.com"
echo "    - Войдите через GitHub"
echo "    - New + → Web Service"
echo "    - Выберите ваш репозиторий l2wiki"
echo "    - Настройте:"
echo "      Name: l2wiki"
echo "      Region: Frankfurt"
echo "      Branch: main"
echo "      Build Command: npm install --production"
echo "      Start Command: node server.js"
echo "    - Добавьте Environment Variables:"
echo "      NODE_ENV = production"
echo "      JSON_BACKUP_PATH = l2wiki-db-2026-04-07.json"
echo "    - Нажмите Create Web Service"
echo ""
echo "4️⃣  Подождите 2-3 минуты"
echo "    Откройте ваш сайт!"
echo ""
echo "📖 Полная инструкция: DEPLOY_RENDER.md"
echo ""
echo "✅ Проект готов к деплою на Render!"
echo ""
