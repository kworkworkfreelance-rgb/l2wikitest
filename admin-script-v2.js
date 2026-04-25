// ═══════════════════════════════════════════════════════════════
// L2WIKI ADMIN PANEL - ENHANCED VERSION WITH L2 DATABASE
// ═══════════════════════════════════════════════════════════════

let db = null;
let SQL = null;
let currentUser = 'admin';
let currentEditingArticle = null;
let currentEditingSection = null;

// SQL.js initialization with error handling
async function initDatabase() {
    try {
        const response = await fetch('https://sql.js.org/dist/sql-wasm.wasm');
        const buffer = await response.arrayBuffer();
        SQL = await window.initSqlJs({ wasmBinary: buffer });

        // Load or create database
        const savedDb = localStorage.getItem('l2wiki_db');
        if (savedDb) {
            try {
                const data = new Uint8Array(JSON.parse(savedDb));
                db = new SQL.Database(data);
                // Check if needs initialization with default data
                const sections = db.exec('SELECT COUNT(*) as count FROM sections');
                if (sections[0].values[0][0] === 0) {
                    console.log('Empty database, initializing with L2 data...');
                    initializeL2Database();
                }
            } catch (e) {
                console.error('Error loading DB:', e);
                db = new SQL.Database();
                createTables();
                initializeL2Database();
            }
        } else {
            db = new SQL.Database();
            createTables();
            initializeL2Database();
        }

        saveDatabase();
        updateAdminDashboard();
    } catch (error) {
        console.error('Database initialization failed:', error);
        showNotification('Ошибка инициализации базы данных', 'error');
    }
}

// Create database tables
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            section TEXT,
            summary TEXT,
            content TEXT,
            eyebrow TEXT,
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(section) REFERENCES sections(id)
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            data LONGTEXT,
            section TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert default admin user
    try {
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashPassword('admin')]);
    } catch (e) {
        // User already exists
    }
}

// Initialize database with Lineage 2 data
function initializeL2Database() {
    // SECTIONS
    const sections = [
        { id: 'quests', name: 'КВЕСТЫ', description: 'Все доступные квесты на сервере', icon: '🎯' },
        { id: 'npcs', name: 'ПЕРСОНАЖИ', description: 'Непс и торговцы', icon: '👤' },
        { id: 'locations', name: 'ЛОКАЦИИ', description: 'Области и подземелья', icon: '🗺️' },
        { id: 'monsters', name: 'МОНСТРЫ', description: 'Враги и их характеристики', icon: '👹' },
        { id: 'items', name: 'ПРЕДМЕТЫ', description: 'Оружие, броня, прочее', icon: '⚔️' },
        { id: 'professions', name: 'ПРОФЕССИИ', description: 'Классы и развитие', icon: '👨‍💼' },
        { id: 'skills', name: 'НАВЫКИ', description: 'Способности и умения', icon: '⚡' },
        { id: 'clans', name: 'КЛАНЫ', description: 'Информация о кланах', icon: '🏰' },
    ];

    sections.forEach((s) => {
        try {
            db.run('INSERT INTO sections (id, name, description, icon) VALUES (?, ?, ?, ?)', [s.id, s.name, s.description, s.icon]);
        } catch (e) {
            // Section already exists
        }
    });

    // ARTICLES - QUESTS
    const quests = [
        {
            id: 'quest-profession-first',
            title: 'На профессию',
            section: 'quests',
            summary: 'Первый квест на получение профессии',
            content: `## НА ПРОФЕССИЮ

Первое испытание каждого персонажа. После уровня 15-18 вы должны выбрать профессию.

### Требования:
- Уровень: 15-18
- Локация: Главная деревня
- NPC: Гатекипер
- Награда: Щит учеников + опыт

### Этапы:
1. Поговорите с Гатекипером в главной деревне
2. Получите щит "Щит учеников"
3. Пройдите испытание
4. Вернитесь и выберите профессию

### Награды:
- Опыт: 3,000,000
- Предметы: Щит учеников
- Доступ к "классовым" квестам`,
            eyebrow: 'ОСНОВНОЙ КВЕСТ',
        },
        {
            id: 'quest-wolf-collar',
            title: 'Волчий ошейник',
            section: 'quests',
            summary: 'Квест на получение боевого питомца',
            content: `## ВОЛЧИЙ ОШЕЙНИК

Получите вашего первого питомца - молодого волка.

### Требования:
- Уровень: 16+
- Враги: Серые волки (Болотистые земли)
- Нужно собрать: 10 волчьих волос

### Враги:
- Серый волк (Уровень 15, HP 800)
  - Волчий волос (100%)
  - Серебро: 500-1000

### Награды:
- Молодой волк (питомец)
- Опыт: 1,500,000
- Ошейник питомца

### Характеристики питомца:
- ATK: 45, DEF: 10
- Уровень: 1/85
- Способен к развитию`,
            eyebrow: 'ПИТОМЕЦ',
        },
        {
            id: 'quest-mage-training',
            title: 'Обучение мага',
            section: 'quests',
            summary: 'Квест для магов на получение магических навыков',
            content: `## ОБУЧЕНИЕ МАГА

Специальный квест для магов на усиление магии.

### Требования:
- Класс: Маг или выше
- Уровень: 20+
- Локация: Магическая башня

### Враги:
- Магический голем (Уровень 22, HP 2000)
- Маг нижних миров (Уровень 21, HP 1500)

### Этапы:
1. Поговорите с Архимагом
2. Победите 5 магических големов
3. Собрите 5 кристаллов силы
4. Вернитесь к Архимагу

### Награды:
- Опыт: 5,000,000
- Навык: Магический щит
- Посох обучения
- Мана: +200`,
            eyebrow: 'СПЕЦИАЛИЗИРОВАННЫЙ',
        },
        {
            id: 'quest-transformation',
            title: 'Трансформация',
            section: 'quests',
            summary: 'Эпический квест на превращение',
            content: `## ТРАНСФОРМАЦИЯ

Превратитесь в легендарное существо!

### Требования:
- Уровень: 76+
- Нужно собрать:
  - Кристалл трансформации (редкая добыча)
  - Слеза древнего дракона
  - 5 символов божественной власти

### Враги для сбора:
- Ледяной дракон (Кристалл трансформации)
- Огненный великан (Слеза)
- Божественный страж (Символы)

### Эффект:
Вы получите способность трансформироваться в мощного монстра на 1 час.

### Награды:
- Форма трансформации
- Опыт: 50,000,000
- Легендарная броня`,
            eyebrow: 'ЭПИЧЕСКИЙ',
        },
    ];

    quests.forEach((q, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                q.id,
                q.title,
                q.section,
                q.summary,
                q.content,
                q.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Quest already exists:', q.id);
        }
    });

    // ARTICLES - NPCS
    const npcs = [
        {
            id: 'npc-gatekeeper',
            title: 'Гатекипер',
            section: 'npcs',
            summary: 'Страж входа, раздаёт первые квесты',
            content: `## ГАТЕКИПЕР

Верный защитник входа в главную деревню. Встречает каждого новичка.

### Расположение:
- Главная деревня
- Координаты: (100, 200)
- Доступен: 24/7

### Диалоги:
- "Добро пожаловать, путник!"
- "Готов ли ты к приключениям?"

### Доступные квесты:
1. На профессию (15+)
2. На амулет дружбы (10+)
3. На щит учеников (5+)

### Услуги:
- Телепортация в разные локации
- Покупка предметов новичка
- Информация о квестах`,
            eyebrow: 'ГЛАВНЫЙ NPC',
        },
        {
            id: 'npc-merchant',
            title: 'Торговец Богини',
            section: 'npcs',
            summary: 'Главный торговец предметами',
            content: `## ТОРГОВЕЦ БОГИНИ

Самый богатый торговец на континенте. Продаёт редкие предметы.

### Расположение:
- Священное святилище
- Координаты: (500, 500)

### Товары:
- Зелья (исцеления, маны, баффы)
- Броня (все уровни)
- Оружие (стандартное)
- Аксессуары
- Свитки и книги умений

### Цены:
- Низкие на булыжники
- Средние на железные предметы
- Высокие на легендарные вещи

### Скидки:
- Предоставляются за:
  - Высокий уровень (76+)
  - Членство в клане
  - Выполнение квестов`,
            eyebrow: 'ТОРГОВЕЦ',
        },
        {
            id: 'npc-priestess',
            title: 'Жрица света',
            section: 'npcs',
            summary: 'Жрица, дающая благословения',
            content: `## ЖРИЦА СВЕТА

Святая жрица святилища. Даёт мощные благословения.

### Расположение:
- Святилище света
- На алтаре в центре

### Услуги:
- Благословения (на 1 час)
  - Предоставляет +20% HP
  - +15% Мана
  - Компенсирует опасность
- Очищение проклятий
- Воскрешение (если вы умрёте)

### Благословения доступны за:
- 10,000 адены
- 1 молитва богини
- Кристалл света

### Эффекты:
- 20% больше здоровья
- 15% больше маны
- 10% больше скорости атаки`,
            eyebrow: 'СВЯТАЯ',
        },
    ];

    npcs.forEach((n, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                n.id,
                n.title,
                n.section,
                n.summary,
                n.content,
                n.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('NPC already exists:', n.id);
        }
    });

    // ARTICLES - LOCATIONS
    const locations = [
        {
            id: 'location-catacombs',
            title: 'Катакомбы Некрополя',
            section: 'locations',
            summary: 'Древние гробницы, полные нежити',
            content: `## КАТАКОМБЫ НЕКРОПОЛЯ

Опасное подземелье с множеством врагов и сокровищ.

### Координаты:
- X: 1234, Y: 5678
- Уровень зоны: 18-25

### Враги:
- Скелет (18-20)
- Черепушка (20-22)
- Привидение (22-25)
- БОСС: Главный Костяк (25, HP 20000)

### Добыча:
- Кость (алхимия)
- Древнее кольцо
- Серебро: 5000-10000
- Эликсир маны

### Время возрождения:
- Обычные враги: 10 минут
- Боссы: 4 часа

### Опасность:
- Ловушки с шипами
- Ямы
- Проклятые врата`,
            eyebrow: 'ПОДЗЕМЕЛЬЕ',
        },
        {
            id: 'location-swamp',
            title: 'Болотистые земли',
            section: 'locations',
            summary: 'Болото с волками и ядом',
            content: `## БОЛОТИСТЫЕ ЗЕМЛИ

Заболоченная местность, идеальная для новичков.

### Враги:
- Серый волк (15, HP 800)
- Ядовитая лягушка (14, HP 600)
- Мантис (16, HP 900)

### Добыча:
- Волчий волос (для квеста)
- Кожа лягушки
- Яд (алхимия)
- Серебро: 1000-2000

### Навыки:
- Здесь легко монстры
- Идеально для уровней 14-18
- Мирная зона в центре

### Опасности:
- Мантисы могут быть опасны в группах
- Временами появляются враги выше уровня`,
            eyebrow: 'НОВИЧКАМ',
        },
        {
            id: 'location-dragons-valley',
            title: 'Долина драконов',
            section: 'locations',
            summary: 'Легендарное место гнёздышка драконов',
            content: `## ДОЛИНА ДРАКОНОВ

Легендарное место обитания самых мощных драконов.

### Координаты:
- X: 8888, Y: 8888
- Уровень зоны: 75+

### Боссы:
- Ледяной дракон (HP 100000)
  - Слеза дракона (редко)
  - Кольцо драконов (легендарное)
- Огненный дракон (HP 95000)
  - Огненный кристалл
  - Жемчуга драконов

### Добыча:
- Чешуя дракона
- Слёзы драконов
- Когти (легендарные)
- Золото: 100000+

### Опасности:
- Требуется группа 8+ человек
- Боссы возрождаются раз в сутки
- Область контролируется кланами`,
            eyebrow: 'ДЛЯ ОПЫТНЫХ',
        },
    ];

    locations.forEach((l, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                l.id,
                l.title,
                l.section,
                l.summary,
                l.content,
                l.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Location already exists:', l.id);
        }
    });

    // ARTICLES - MONSTERS
    const monsters = [
        {
            id: 'monster-grey-wolf',
            title: 'Серый волк',
            section: 'monsters',
            summary: 'Обычный враг Болотистых земель',
            content: `## СЕРЫЙ ВОЛК

Дикий волк, живущий в болотах. Первый враг новичков.

### Характеристики:
- Уровень: 15
- HP: 800 | MP: 150
- ATK: 42 | DEF: 25
- AtkSpd: 300

### Добыча:
- Волчий волос (100%)
- Волчий зуб (50%)
- Серебро: 500-1000

### Умения:
- Боевой рык (оглушение на 2 сек)
- Прыжок (смещение на 5 метров)

### Стратегия:
- Волки часто ходят группами (2-3)
- Используйте щит для защиты
- Держите дистанцию с магией`,
            eyebrow: 'НОВИЧКАМ',
        },
        {
            id: 'monster-fire-dragon',
            title: 'Огненный дракон',
            section: 'monsters',
            summary: 'Легендарный босс-дракон',
            content: `## ОГНЕННЫЙ ДРАКОН

Самый мощный огненный дракон, обитающий в Долине.

### Характеристики:
- Уровень: 78
- HP: 95,000 | MP: 50,000
- ATK: 2500 | DEF: 1500
- Магическая защита: 800

### Добыча:
- Огненный кристалл (редко)
- Жемчуга драконов (редко)
- Огненная чешуя (100%)
- Золото: 50,000-100,000

### Умения:
- Огненный взрыв (AoE урон всем в радиусе)
- Хвостом взмах (урон в линию)
- Огневой щит (защита 50%)
- Ревущий удар (оглушение)

### Слабости:
- Ледяная магия (-30% урона)
- Вода (-20% урона)

### Рекомендации:
- Требуется группа из 10+ опытных игроков
- Носите ледяное зелье
- Атакуйте вместе, чтобы победить быстрее`,
            eyebrow: 'БОСС',
        },
        {
            id: 'monster-skeleton-guard',
            title: 'Страж-скелет',
            section: 'monsters',
            summary: 'Воин-нежить из катакомб',
            content: `## СТРАЖ-СКЕЛЕТ

Вооруженный скелет, охраняющий катакомбы.

### Характеристики:
- Уровень: 20
- HP: 1200 | MP: 200
- ATK: 60 | DEF: 40
- Резистенс магии: 20%

### Снаряжение:
- Длинный меч
- Костяной щит

### Добыча:
- Костяная пыль (70%)
- Меч скелета (редко)
- Серебро: 2000-4000
- Кость (100%)

### Умения:
- Мощный удар (1,5x урона)
- Защитная стойка (DEF +30% на 5 сек)
- Толчок щитом (отбросит врага назад)

### Стратегия боя:
- Медленнее чем волки, но сильнее
- Избегайте фронтальной атаки
- Атакуйте с боков и сзади`,
            eyebrow: 'СРЕДНИЙ',
        },
    ];

    monsters.forEach((m, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                m.id,
                m.title,
                m.section,
                m.summary,
                m.content,
                m.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Monster already exists:', m.id);
        }
    });

    // ARTICLES - ITEMS
    const items = [
        {
            id: 'item-long-sword',
            title: 'Длинный меч',
            section: 'items',
            summary: 'Стандартное оружие для воина',
            content: `## ДЛИННЫЙ МЕЧ

Классическое оружие воина всех времен.

### Характеристики:
- Урон: 25-35
- Вес: 45 LB
- Материал: Железо
- Тип: Двуручное оружие

### Требования:
- Уровень: 1+
- STR: 10+

### Бонусы:
- +2% к скорости атаки
- +5% к крит. удару

### Как получить:
- Купить у Торговца (5000 адены)
- Выпадает с врагов уровня 5+
- Выполнить квест "Первый меч"

### Улучшения:
- Может быть улучшен до +20
- Каждый уровень +1 к урону`,
            eyebrow: 'ОРУЖИЕ',
        },
        {
            id: 'item-mana-potion',
            title: 'Зелье маны',
            section: 'items',
            summary: 'Восстанавливает 100 MP',
            content: `## ЗЕЛЬЕ МАНЫ

Волшебное зелье для восстановления магической энергии.

### Характеристики:
- Восстанавливает: 100 MP
- Время восстановления: 10 сек
- Вес: 5 LB
- Цвет: Синий

### Использование:
- Нажмите на зелье в инвентаре
- Мана восстановится мгновенно

### Где купить:
- Торговец Богини (200 адены за штуку)
- Храм священный (180 адены)

### Где найти:
- В сундуках подземелья
- Выпадает с магов
- Награда за квесты

### Порядок использования:
- В магических боях
- Во время лечения после боя
- Перед важным квестом`,
            eyebrow: 'ЗЕЛЬЕ',
        },
        {
            id: 'item-dragon-scale',
            title: 'Чешуя дракона',
            section: 'items',
            summary: 'Легендарный материал из драконов',
            content: `## ЧЕШУЯ ДРАКОНА

Редчайший материал - чешуя от легендарного дракона.

### Характеристики:
- Материал: Нечеловеческий
- Редкость: ЛЕГЕНДАРНАЯ
- Вес: 20 LB
- Прочность: Вечная

### Применение:
- Крафт легендарной брони
- Создание магических артефактов
- Для самых мощных зачаров

### Как получить:
- Убить Огненного дракона (редко)
- Убить Ледяного дракона (редко)
- Торговля с другими игроками (дорого)

### Стоимость:
- Цена на аукционе: 500,000+ адены
- Редкость: 1 на сервере в неделю

### Рецепты с использованием:
- Броня демона (легендарная)
- Магический посох архимага
- Кольцо величия`,
            eyebrow: 'ЛЕГЕНДА',
        },
    ];

    items.forEach((i, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                i.id,
                i.title,
                i.section,
                i.summary,
                i.content,
                i.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Item already exists:', i.id);
        }
    });

    // ARTICLES - PROFESSIONS (CLASSES)
    const professions = [
        {
            id: 'class-warrior',
            title: 'Воин',
            section: 'professions',
            summary: 'Мастер меча и щита',
            content: `## ВОИН

Мощный боец, специализирующийся на рукопашном бою и защите.

### Характеристики:
- HP: +300% к базовому
- ATK: +250%
- DEF: +350%
- Мана: -50%

### Основные умения:
- Мощный удар (1.5x урона)
- Вихрь меча (KoAoE все вокруг)
- Боевой клич (ATK +30%)
- Щитовой удар (оглушение)

### Профессиональные ветки:
1. **Паладин** (Защита + Магия)
2. **Берсеркер** (ATK + Скорость)
3. **Рыцарь** (DEF + Лидерство)

### Рекомендации:
- Подходит для новичков
- Идеален в групповых боях
- Хорошая зарплата в партиях`,
            eyebrow: 'БОЕЦ',
        },
        {
            id: 'class-mage',
            title: 'Маг',
            section: 'professions',
            summary: 'Повелитель магических сил',
            content: `## МАГ

Мастер магии и элементальных сил.

### Характеристики:
- Мана: +500%
- МВ (Магический урон): +400%
- DEF: -30%
- HP: -20%

### Основные умения:
- Огненный взрыв (AoE урон)
- Ледяной щит (поглощение урона)
- Телепортация (бегство на 10м)
- Магический щит (MTA +50%)

### Специализации:
1. **Архимаг** (Урон + Контроль)
2. **Ледяной маг** (Замораживание)
3. **Огненный маг** (AoE урон)

### Преимущества:
- Огромный AoE урон
- Контроль над полем боя
- Незаменим в подземельях`,
            eyebrow: 'МАГ',
        },
        {
            id: 'class-archer',
            title: 'Лучник',
            section: 'professions',
            summary: 'Мастер дальнего боя',
            content: `## ЛУЧНИК

Специалист дальнего боя, наносящий точные критические удары.

### Характеристики:
- ATK: +200%
- Криты: +40%
- Дальность: +200м
- AtkSpd: +25%

### Основные умения:
- Точный выстрел (300% урона)
- Град стрел (множество снарядов)
- Уклон (Evade +50% на 5сек)
- Ловушка для врагов (замораживание)

### Специализации:
1. **Охотник** (Ловушки + Выслеживание)
2. **Снайпер** (Критический урон)
3. **Рейнджер** (Скорость + Бег)

### Роль в группе:
- Физический DPS
- Контроль расстояния
- Отличная мобильность`,
            eyebrow: 'СТРЕЛОК',
        },
    ];

    professions.forEach((p, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                p.id,
                p.title,
                p.section,
                p.summary,
                p.content,
                p.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Profession already exists:', p.id);
        }
    });

    // ARTICLES - SKILLS
    const skills = [
        {
            id: 'skill-power-strike',
            title: 'Мощный удар',
            section: 'skills',
            summary: 'Базовый навык воина - увеличенный урон',
            content: `## МОЩНЫЙ УДАР

Фундаментальный боевой навык, наносящий мощный одиночный удар.

### Характеристики:
- Урон: 150% от ATK
- Cooldown: 5 сек
- Мана: 30
- Радиус: Цель

### Требования:
- Класс: Воин+
- Уровень навыка: изучен с 1-го уровня

### Эффекты:
- Наносит в 1.5 раза больше урона
- Может оглушить врага (-20% шанс)

### Развитие:
- Уровень 1-10: +10% урона за уровень
- Уровень 11-20: +15% урона за уровень
- Уровень 21-30: +20% урона за уровень

### Комбо:
- Мощный удар + Щитовой удар = оглушение
- Мощный удар + Вихрь = больше урона`,
            eyebrow: 'БАЗОВЫЙ',
        },
        {
            id: 'skill-fireball',
            title: 'Огненный шар',
            section: 'skills',
            summary: 'Магический огненный снаряд',
            content: `## ОГНЕННЫЙ ШАР

Классический магический снаряд, поражающий врага огнем.

### Характеристики:
- Урон: 200% от МВ
- Cooldown: 3 сек
- Мана: 80
- Радиус: 5м (до цели)

### Требования:
- Класс: Маг+
- Уровень: 10+

### Эффекты:
- Попадание гарантировано
- Может вызвать горение (DOT на 10 сек)
- +50% урона по огненно-уязвимым врагам

### Развитие:
- Уровень 1: Базовая версия (200% урона)
- Уровень 10: +300 урона к базе
- Уровень 20: Огненный взрыв (AoE)`,
            eyebrow: 'МАГИЯ',
        },
    ];

    skills.forEach((s, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                s.id,
                s.title,
                s.section,
                s.summary,
                s.content,
                s.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Skill already exists:', s.id);
        }
    });

    // ARTICLES - CLANS
    const clans = [
        {
            id: 'clan-dragons-dawn',
            title: 'Рассвет Драконов',
            section: 'clans',
            summary: 'Ведущий клан сервера',
            content: `## РАССВЕТ ДРАКОНОВ

Один из самых мощных и влиятельных кланов на сервере.

### Информация:
- Лидер: БогВойны
- Члены: 150+
- Уровень клана: 9
- Касса клана: 100,000,000 адены

### Активность:
- Контролирует замок Гиран
- Организует рейды на боссов
- Проводит турниры по PvP

### Преимущества членства:
- Скидка на краски (25%)
- Баффы клана (+10% HP)
- Помощь в быстром прохождении
- Участие в массовых боях

### История:
- Создан 3 года назад
- Выиграли все осады замков
- Лучший клан на сервере по репутации

### Требования:
- Уровень: 60+
- PvP ранг: 100+
- Рекомендация от члена клана`,
            eyebrow: 'ТОП КЛАН',
        },
    ];

    clans.forEach((c, idx) => {
        try {
            db.run('INSERT INTO articles (id, title, section, summary, content, eyebrow, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                c.id,
                c.title,
                c.section,
                c.summary,
                c.content,
                c.eyebrow,
                idx,
            ]);
        } catch (e) {
            console.log('Clan already exists:', c.id);
        }
    });

    saveDatabase();
    updateSearchContent();
}

// Hash password (simple encoding)
function hashPassword(password) {
    return btoa(password);
}

// Verify password
function verifyPassword(password, hash) {
    return btoa(password) === hash;
}

// Save database to localStorage
function saveDatabase() {
    try {
        const data = db.export();
        const arr = Array.from(data);
        localStorage.setItem('l2wiki_db', JSON.stringify(arr));
    } catch (e) {
        console.error('Error saving database:', e);
    }
}

// Update frontend search content in real-time
function updateSearchContent() {
    try {
        const articles = db.exec('SELECT id, title, section FROM articles WHERE id IS NOT NULL');
        const content = [];
        if (articles.length > 0 && articles[0].values.length > 0) {
            articles[0].values.forEach((row) => {
                content.push({ id: row[0], title: row[1], section: row[2] });
            });
        }
        window.L2WIKI_CONTENT = content;
        localStorage.setItem('l2wiki_content', JSON.stringify(content));
        // Trigger search update if it exists
        if (window.searchUI) {
            window.searchUI.initializeContent();
        }
    } catch (e) {
        console.error('Error updating search content:', e);
    }
}

// Login handler
function handleLogin() {
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
        showNotification('Заполните все поля!', 'warning');
        return;
    }

    try {
        const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);
        if (result.length > 0 && result[0].values.length > 0) {
            const user = result[0].values[0];
            if (verifyPassword(password, user[2])) {
                currentUser = username;
                localStorage.setItem(
                    'l2wiki_session',
                    JSON.stringify({
                        user: username,
                        loginTime: new Date(),
                        timeout: 24 * 60 * 60 * 1000, // 24 hours
                    })
                );
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'flex';
                showNotification('Вы вошли!', 'success');
                updateAdminDashboard();
            } else {
                showNotification('Неверный пароль!', 'error');
            }
        } else {
            showNotification('Пользователь не найден!', 'error');
        }
    } catch (e) {
        console.error('Login error:', e);
        showNotification('Ошибка входа!', 'error');
    }
}

// Update dashboard with counts
function updateAdminDashboard() {
    try {
        const sections = db.exec('SELECT COUNT(*) FROM sections');
        const articles = db.exec('SELECT COUNT(*) FROM articles');
        const images = db.exec('SELECT COUNT(*) FROM images');

        document.getElementById('articlesCount').textContent = articles[0]?.values[0]?.[0] || 0;
        document.getElementById('sectionsCount').textContent = sections[0]?.values[0]?.[0] || 0;
        document.getElementById('imagesCount').textContent = images[0]?.values[0]?.[0] || 0;

        loadArticles();
        loadSections();
    } catch (e) {
        console.error('Dashboard update error:', e);
    }
}

// Load and display sections
function loadSections() {
    try {
        const sections = db.exec('SELECT id, name, icon FROM sections ORDER BY name');
        const select = document.getElementById('articleSection');
        if (select && sections.length > 0) {
            select.innerHTML = '<option value="">Выберите раздел</option>';
            sections[0].values.forEach((row) => {
                const option = document.createElement('option');
                option.value = row[0];
                option.textContent = (row[2] || '') + ' ' + row[1];
                select.appendChild(option);
            });
        }

        // Load sections list
        const container = document.getElementById('sectionsTable');
        if (container) {
            container.innerHTML = '';
            sections[0]?.values.forEach((row) => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div style="flex:1">
                        <div class="list-item-title">${row[2]} ${row[1]}</div>
                    </div>
                    <button onclick="editSection('${row[0]}')" class="btn-icon">✏️</button>
                    <button onclick="if(confirm('Удалить раздел и все статьи?')) deleteSection('${row[0]}')" class="btn-icon">🗑️</button>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Load sections error:', e);
    }
}

// Load and display articles
function loadArticles() {
    try {
        const articles = db.exec('SELECT id, title, section, summary FROM articles ORDER BY section, order_index');
        const container = document.getElementById('articlesTable');
        if (container && articles.length > 0) {
            container.innerHTML = '';
            articles[0].values.forEach((row) => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div style="flex:1">
                        <div class="list-item-title">${row[1]}</div>
                        <div class="list-item-info">${row[3] || 'Нет описания'}</div>
                        <div class="list-item-meta">ID: ${row[0]} | Раздел: ${row[2]}</div>
                    </div>
                    <button onclick="editArticle('${row[0]}')" class="btn-icon">✏️</button>
                    <button onclick="if(confirm('Удалить статью?')) deleteArticle('${row[0]}')" class="btn-icon">🗑️</button>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Load articles error:', e);
    }
}

// Save article
function saveArticle() {
    const id = document.getElementById('articleId')?.value?.trim();
    const title = document.getElementById('articleTitle')?.value?.trim();
    const section = document.getElementById('articleSection')?.value;
    const summary = document.getElementById('articleSummary')?.value?.trim();
    const content = document.getElementById('articleContent')?.value?.trim();
    const eyebrow = document.getElementById('articleEyebrow')?.value?.trim();

    if (!id || !title || !section) {
        showNotification('Заполните обязательные поля (ID, Название, Раздел)!', 'warning');
        return;
    }

    try {
        const existing = db.exec('SELECT id FROM articles WHERE id = ?', [id]);

        if (existing.length > 0 && existing[0].values.length > 0) {
            // Update
            db.run(
                `
                UPDATE articles SET title=?, section=?, summary=?, content=?, eyebrow=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            `,
                [title, section, summary, content, eyebrow, id]
            );
        } else {
            // Insert
            db.run(
                `
                INSERT INTO articles (id, title, section, summary, content, eyebrow)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
                [id, title, section, summary, content, eyebrow]
            );
        }

        saveDatabase();
        updateSearchContent();
        updateAdminDashboard();
        document.getElementById('articleForm').style.display = 'none';
        showNotification('Статья сохранена!', 'success');
        resetArticleForm();
    } catch (e) {
        console.error('Save article error:', e);
        showNotification('Ошибка при сохранении!', 'error');
    }
}

// Delete article
function deleteArticle(id) {
    try {
        db.run('DELETE FROM articles WHERE id = ?', [id]);
        saveDatabase();
        updateSearchContent();
        updateAdminDashboard();
        showNotification('Статья удалена!', 'success');
    } catch (e) {
        console.error('Delete article error:', e);
        showNotification('Ошибка при удалении!', 'error');
    }
}

// Edit article
function editArticle(id) {
    try {
        const result = db.exec('SELECT * FROM articles WHERE id = ?', [id]);
        if (result.length > 0 && result[0].values.length > 0) {
            const article = result[0].values[0];
            document.getElementById('articleId').value = article[0];
            document.getElementById('articleTitle').value = article[1];
            document.getElementById('articleSection').value = article[2];
            document.getElementById('articleSummary').value = article[3] || '';
            document.getElementById('articleContent').value = article[4] || '';
            document.getElementById('articleEyebrow').value = article[5] || '';
            document.getElementById('articleForm').style.display = 'block';
            currentEditingArticle = id;
        }
    } catch (e) {
        console.error('Edit article error:', e);
    }
}

// Save section
function saveSection() {
    const id = document.getElementById('sectionId')?.value?.trim();
    const name = document.getElementById('sectionName')?.value?.trim();
    const description = document.getElementById('sectionDesc')?.value?.trim();
    const icon = document.getElementById('sectionIcon')?.value?.trim();

    if (!id || !name) {
        showNotification('Заполните ID и Название!', 'warning');
        return;
    }

    try {
        const existing = db.exec('SELECT id FROM sections WHERE id = ?', [id]);

        if (existing.length > 0 && existing[0].values.length > 0) {
            db.run('UPDATE sections SET name=?, description=?, icon=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
                name,
                description,
                icon,
                id,
            ]);
        } else {
            db.run('INSERT INTO sections (id, name, description, icon) VALUES (?, ?, ?, ?)', [id, name, description, icon]);
        }

        saveDatabase();
        updateAdminDashboard();
        document.getElementById('sectionForm').style.display = 'none';
        showNotification('Раздел сохранен!', 'success');
        resetSectionForm();
    } catch (e) {
        console.error('Save section error:', e);
        showNotification('Ошибка при сохранении!', 'error');
    }
}

// Delete section
function deleteSection(id) {
    try {
        db.run('DELETE FROM articles WHERE section = ?', [id]);
        db.run('DELETE FROM sections WHERE id = ?', [id]);
        saveDatabase();
        updateSearchContent();
        updateAdminDashboard();
        showNotification('Раздел и его статьи удалены!', 'success');
    } catch (e) {
        console.error('Delete section error:', e);
        showNotification('Ошибка при удалении!', 'error');
    }
}

// Edit section
function editSection(id) {
    try {
        const result = db.exec('SELECT * FROM sections WHERE id = ?', [id]);
        if (result.length > 0 && result[0].values.length > 0) {
            const section = result[0].values[0];
            document.getElementById('sectionId').value = section[0];
            document.getElementById('sectionName').value = section[1];
            document.getElementById('sectionDesc').value = section[2] || '';
            document.getElementById('sectionIcon').value = section[3] || '';
            document.getElementById('sectionForm').style.display = 'block';
            currentEditingSection = id;
        }
    } catch (e) {
        console.error('Edit section error:', e);
    }
}

// Change password
function changePassword() {
    const oldPass = document.getElementById('oldPassword')?.value;
    const newPass = document.getElementById('newPassword')?.value;
    const confirmPass = document.getElementById('confirmPassword')?.value;

    if (!oldPass || !newPass || !confirmPass) {
        showNotification('Заполните все поля!', 'warning');
        return;
    }

    if (newPass !== confirmPass) {
        showNotification('Пароли не совпадают!', 'error');
        return;
    }

    try {
        const result = db.exec('SELECT password FROM users WHERE username = ?', [currentUser]);
        if (result.length > 0 && verifyPassword(oldPass, result[0].values[0][0])) {
            db.run('UPDATE users SET password = ? WHERE username = ?', [hashPassword(newPass), currentUser]);
            saveDatabase();
            showNotification('Пароль изменен!', 'success');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showNotification('Старый пароль неверный!', 'error');
        }
    } catch (e) {
        console.error('Password change error:', e);
        showNotification('Ошибка!', 'error');
    }
}

// Export database
function exportDatabase() {
    try {
        const data = db.export();
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `l2wiki_backup_${new Date().toISOString().split('T')[0]}.db`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('База данных загружена!', 'success');
    } catch (e) {
        console.error('Export error:', e);
        showNotification('Ошибка при загрузке!', 'error');
    }
}

// Import database
function importDatabase(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            db = new SQL.Database(data);
            saveDatabase();
            updateSearchContent();
            updateAdminDashboard();
            showNotification('База данных загружена!', 'success');
        } catch (error) {
            console.error('Import error:', error);
            showNotification('Ошибка при загрузке файла!', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Helper functions
function resetArticleForm() {
    document.getElementById('articleId').value = '';
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleSection').value = '';
    document.getElementById('articleSummary').value = '';
    document.getElementById('articleContent').value = '';
    document.getElementById('articleEyebrow').value = '';
    currentEditingArticle = null;
}

function resetSectionForm() {
    document.getElementById('sectionId').value = '';
    document.getElementById('sectionName').value = '';
    document.getElementById('sectionDesc').value = '';
    document.getElementById('sectionIcon').value = '';
    currentEditingSection = null;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideIn 0.3s;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function logout() {
    localStorage.removeItem('l2wiki_session');
    location.reload();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const session = localStorage.getItem('l2wiki_session');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            const loginTime = new Date(sessionData.loginTime);
            const now = new Date();
            if (now - loginTime < sessionData.timeout) {
                currentUser = sessionData.user;
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'flex';
                initDatabase();
                return;
            }
        } catch (e) {
            console.error('Session check error:', e);
        }
    }

    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';

    // Setup login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.onclick = handleLogin;
    }

    // Enter key on password field
    const passwordField = document.getElementById('loginPassword');
    if (passwordField) {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Initialize database
    initDatabase();
});
