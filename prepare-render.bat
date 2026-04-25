@echo off
echo ============================================
echo L2Wiki - Podgotovka k deployu na Render
echo ============================================
echo.

REM Proverka chto my v pravil'noy direktorii
if not exist "server.js" (
    echo ERROR: server.js ne nayden!
    echo Ubedites' chto vy v papke proekta l2Wiki
    pause
    exit /b 1
)
echo OK: server.js nayden

REM Proverka chto static-data.js sushchestvuet
if not exist "assets\js\static-data.js" (
    echo ERROR: static-data.js ne nayden!
    echo Zapustite: node regenerate-static-data.js
    pause
    exit /b 1
)
echo OK: static-data.js nayden

REM Proverka chto JSON backup sushchestvuet
if not exist "l2wiki-db-2026-04-07.json" (
    echo ERROR: l2wiki-db-2026-04-07.json ne nayden!
    echo Etot fayl nuzhen dlya importa dannyh na servere
    pause
    exit /b 1
)
echo OK: l2wiki-db-2026-04-07.json nayden

REM Proverka chto package.json sushchestvuet
if not exist "package.json" (
    echo ERROR: package.json ne nayden!
    pause
    exit /b 1
)
echo OK: package.json nayden

REM Proverka chto render.yaml sushchestvuet
if not exist "render.yaml" (
    echo ERROR: render.yaml ne nayden!
    echo Etot fayl nuzhen dlya avtomaticheskogo deploya
    pause
    exit /b 1
)
echo OK: render.yaml nayden

echo.
echo Ochistka vremennyh faylov...

REM Udalenie node_modules
if exist "node_modules" (
    echo.    Udayayu node_modules/...
    rmdir /s /q node_modules
    echo.    OK: node_modules udalyon
) else (
    echo.    OK: node_modules otsutstvuet
)

REM Udalenie l2wiki.db
if exist "l2wiki.db" (
    echo.    Udayayu l2wiki.db...
    del l2wiki.db
    echo.    OK: l2wiki.db udalyon
) else (
    echo.    OK: l2wiki.db otsutstvuet
)

REM Udalenie backup faylov
if exist "l2wiki-db-backup.json" (
    echo.    Udayayu l2wiki-db-backup.json...
    del l2wiki-db-backup.json
    echo.    OK: l2wiki-db-backup.json udalyon
) else (
    echo.    OK: l2wiki-db-backup.json otsutstvuet
)

echo.
echo ============================================
echo PROEKT GOTOV K DEPLOYU NA RENDER!
echo ============================================
echo.
echo Sleduyushie shagi:
echo.
echo 1. Sozdayte Git repository:
echo    git init
echo    git add .
echo    git commit -m "Initial commit - L2Wiki ready for Render"
echo.
echo 2. Sozdayte repository na GitHub:
echo    git remote add origin https://github.com/USERNAME/l2wiki.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. Zaydite na https://render.com
echo    - Vaydite cherez GitHub
echo    - New + -- Web Service
echo    - Vyberite vash repository l2wiki
echo    - Nastyte:
echo      Name: l2wiki
echo      Region: Frankfurt
echo      Branch: main
echo      Build Command: npm install --production
echo      Start Command: node server.js
echo.
echo 4. Dobav'te Environment Variables:
echo    NODE_ENV = production
echo    JSON_BACKUP_PATH = l2wiki-db-2026-04-07.json
echo.
echo 5. Nazhmite Create Web Service
echo.
echo Polnaya instrukciya: DEPLOY_RENDER.md
echo.
pause
