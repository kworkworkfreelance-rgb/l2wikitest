#!/usr/bin/env node

/**
 * Final Content Expansion - Add comprehensive Lineage 2 archive content
 * Adds detailed articles for Items, Misc sections, and expands existing content
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'l2wiki-db-2026-04-07.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('📚 Final Content Expansion...\n');
console.log(`Current: ${Object.keys(db.articles).length} articles\n`);

const newContent = {
    // ITEMS - Detailed item guides
    'items-weapons': {
        id: 'items-weapons',
        section: 'items',
        group: 'quest-items',
        title: 'Оружие Lineage 2 - Полный гайд',
        summary: 'Все типы оружия: мечи, луки, посохи, кинжалы. Грейд система, заточка, выбор оружия.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Оружие' },
            { label: 'Грейды', value: 'D-A-S84' },
            { label: 'Фокус', value: 'Выбор и заточка' }
        ],
        intro: [
            'Оружие - важнейший элемент экипировки в Lineage II. От простого меча до легендарного S84 грейда - выбор оружия определяет ваш стиль игры и эффективность в бою.',
            'Система грейдов (D, C, B, A, S, S80, S84) определяет мощность оружия. Чем выше грейд, тем больше урон, но тем сложнее получить и заточить оружие.'
        ],
        checklist: [
            'D грейд - стартовое оружие (1-40 уровень)',
            'C грейд - средний уровень (40-52 уровень)',
            'B грейд - продвинутый (52-61 уровень)',
            'A грейд - высокий уровень (61-76 уровень)',
            'S/S80/S84 грейд - эндгейм (76+ уровень)'
        ],
        steps: [
            'Типы оружия: Мечи (универсальны), Луки (дальний бой), Посохи (магия), Кинжалы (криты), blunt (стан), Pole (AOE)',
            'Заточка оружия: Увеличивает урон. Риск сломать при неудаче. Используйте кристаллы души для безопасности.',
            'Special Ability (SA): Уникальные свойства оружия. Прокачиваются через Soul Crystal квест.',
            'Выбор оружия: Зависит от класса. Воины - мечи/ blunt, Маги - посохи, Разбойники - кинжалы/луки.',
            'Экономика: Оружие высшего грейда стоит дорого. Фармите адены или покупайте у игроков.'
        ],
        rewards: [
            'Максимальный урон',
            'Уникальные способности',
            'Преимущество в PvP и PvE'
        ],
        tips: [
            'Не тратьте деньги на оружие выше вашего уровня',
            'Затачивайте постепенно - не рискуйте дорогим оружием',
            'SA значительно увеличивает эффективность оружия'
        ],
        related: [
            'enchanting-skills',
            'soul-crystal',
            'quest-profession-fourth'
        ],
        order: 1
    },

    'items-armor': {
        id: 'items-armor',
        section: 'items',
        group: 'quest-items',
        title: 'Броня Lineage 2 - Полный гайд',
        summary: 'Тяжёлая, лёгкая и магическая броня. Грейд система, сеты, защита и бонусы.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Броня' },
            { label: 'Типы', value: 'Heavy/Light/Robe' },
            { label: 'Фокус', value: 'Защита и бонусы' }
        ],
        intro: [
            'Броня в Lineage II делится на три типа: Heavy (тяжёлая для танков), Light (лёгкая для разбойников), Robe (магическая для магов). Каждый тип даёт разные бонусы.',
            'Полный сет брони (шлем, кираса, перчатки, ботинки, штаны) даёт сет-бонусы, значительно увеличивающие эффективность персонажа.'
        ],
        checklist: [
            'Heavy броня - максимальная защита для танков',
            'Light броня - баланс защиты и скорости',
            'Robe броня - минимальная защита, максимум MP',
            'Сет-бонусы увеличивают эффективность'
        ],
        steps: [
            'Heavy броня: Paladin, Dark Avenger, Temple Knight, Shillien Knight. Максимальная физическая защита.',
            'Light броня: Hawkeye, Treasure Hunter, Plains Walker, Abyss Walker. Баланс защиты и скорости атаки.',
            'Robe броня: Bishop, Prophet, Spellsinger, Necromancer. Минимальная защита, максимум MP и магической силы.',
            'Сеты: Полный комплект даёт бонусы к защите, HP/MP, скорости каста или критическому урону.',
            'Заточка: Увеличивает защиту. Аналогично оружию - риск сломать при неудаче.'
        ],
        rewards: [
            'Максимальная защита',
            'Сет-бонусы',
            'Выживаемость в бою'
        ],
        tips: [
            'Выбирайте броню под ваш класс',
            'Полный сет лучше разрозненных предметов',
            'Затачивайте постепенно начиная с дёшевых частей'
        ],
        related: [
            'enchanting-skills',
            'class-tree',
            'raid-monsters'
        ],
        order: 2
    },

    'items-accessories': {
        id: 'items-accessories',
        section: 'items',
        group: 'quest-items',
        title: 'Аксессуары Lineage 2 - Кольца, серьги, ожерелья',
        summary: 'Эпические и обычные аксессуары. Бонусы к характеристикам, защита от дебаффов.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Аксессуары' },
            { label: 'Категории', value: 'Эпик/Обычные' },
            { label: 'Фокус', value: 'Бонусы' }
        ],
        intro: [
            'Аксессуары (кольца, серьги, ожерелья) - мощные предметы, дающие значительные бонусы к характеристикам. Эпические аксессуары - одни из самых ценных предметов в игре.',
            'Эпические аксессуары падают с эпических боссов: Baium, Antharas, Valakas, Frintezza, Freya. Они дают уникальные бонусы и защиту от дебаффов.'
        ],
        checklist: [
            'Обычные аксессуары - покупаются у NPC',
            'Эпические аксессуары - падают с эпик боссов',
            'Кольца - бонусы к атаке и защите',
            'Серьги - бонусы к магии и сопротивлению',
            'Ожерелья - бонусы к HP/MP и защите'
        ],
        steps: [
            'Обычные аксессуары: Ring of Wisdom, Necklace of Wisdom, Earring of Protection. Покупаются у NPC.',
            'Эпические аксессуары: Ring of Baium, Earring of Antharas, Necklace of Valakas. Падают с эпик боссов.',
            'Бонусы: Увеличение P. Atk, M. Atk, P. Def, M. Def, HP, MP, скорости атаки, сопротивления.',
            'Защита от дебаффов: Эпические аксессуары дают иммунитет или снижение длительности дебаффов.',
            'Заточка: Аксессуары можно затачивать для увеличения бонусов. Очень рискованно - высокий шанс сломать.'
        ],
        rewards: [
            'Мощные бонусы',
            'Защита от дебаффов',
            'Статус и престиж'
        ],
        tips: [
            'Эпические аксессуары очень дорогие',
            'Начните с обычных аксессуаров',
            'Затачивайте только если готовы потерять предмет'
        ],
        related: [
            'baium-entry',
            'antharas-entry',
            'valakas-entry'
        ],
        order: 3
    },

    // MISC - Epic and endgame content
    'misc-epic-overview': {
        id: 'misc-epic-overview',
        section: 'misc',
        group: 'epic',
        title: 'Эпические боссы Lineage 2 - Полный гайд',
        summary: 'Все эпические боссы: Queen Ant, Core, Orfen, Zaken, Baium, Antharas, Valakas, Frintezza, Freya.',
        eyebrow: 'Эндгейм',
        meta: [
            { label: 'Тип', value: 'Эпик боссы' },
            { label: 'Количество', value: '9 боссов' },
            { label: 'Фокус', value: 'Рейды' }
        ],
        intro: [
            'Эпические боссы - вершина контента Lineage II. Это мощнейшие монстры, требующие рейда из 30+ человек для победы. Награда - легендарные аксессуары и оружие.',
            'Каждый эпик босс уникален: свои механики, стратегия, требования к рейду. Победа над эпиком - достижение всего сервера.'
        ],
        checklist: [
            'Queen Ant - первый эпик, уровень 40+',
            'Core, Orfen, Zaken - средние эпики, уровень 50+',
            'Baium, Frintezza - продвинутые эпики, уровень 60+',
            'Antharas, Valakas, Freya - топовые эпики, уровень 70+'
        ],
        steps: [
            'Queen Ant: Первый эпик для большинства серверов. Механики: яд, паралич, АОЕ атаки. Требует 10-15 человек.',
            'Core: Босс в башне. Механики: телепортация, АОЕ, призыв миньонов. Требует 15-20 человек.',
            'Orfen: Водяной босс. Механики: водные атаки, замедление, АОЕ. Требует 15-20 человек.',
            'Zaken: Босс пиратов. Механики: телепортация, проклятия, миньоны. Требует 20-25 человек.',
            'Baium: В Tower of Insolence. Механики: полёт, АОЕ, дебаффы. Требует 25-30 человек.',
            'Antharas: Дракон. Механики: полёт, огненное дыхание, АОЕ. Требует 30+ человек.',
            'Valakas: Огненный дракон. Механики: огонь, АОЕ, миньоны. Требует 30+ человек.',
            'Frintezza: Призрак. Механики: невидимость, дебаффы, АОЕ. Требует 25-30 человек.',
            'Freya: Ледяная босс. Механики: лёд, АОЕ, миньоны. Требует 30+ человек.'
        ],
        rewards: [
            'Эпические аксессуары',
            'Легендарное оружие',
            'Слава и престиж'
        ],
        tips: [
            'Подготовьте рейд заранее',
            'Изучите механики босса',
            'Координация важнее силы'
        ],
        related: [
            'antharas-entry',
            'valakas-entry',
            'baium-entry',
            'frintezza-entry',
            'freya-entry',
            'raid-monsters'
        ],
        order: 1
    },

    'misc-olympiad': {
        id: 'misc-olympiad',
        section: 'misc',
        group: 'epic',
        title: 'Олимпиада Lineage 2 - Полный гайд',
        summary: 'Система Олимпиады: отборочные, классические и неклассические бои. Noblesse статус.',
        eyebrow: 'Эндгейм',
        meta: [
            { label: 'Тип', value: 'Олимпиада' },
            { label: 'Цикл', value: '2 недели' },
            { label: 'Фокус', value: 'PvP рейтинг' }
        ],
        intro: [
            'Олимпиада - система PvP рейтинга в Lineage II. Игроки соревнуются в боях 1 на 1 за статус Noblesse и уникальные награды.',
            'Цикл Олимпиады длится 2 недели: отборочные бои, классические бои (1 на 1), неклассические бои (любой класс). Лучшие игроки получают Noblesse статус.'
        ],
        checklist: [
            'Регистрация у NPC Olympiad Manager',
            'Отборочные бои - квалификация',
            'Классические бои - тот же класс',
            'Неклассические бои - любой класс',
            'Noblesse статус - главная награда'
        ],
        steps: [
            'Регистрация: Подойдите к NPC Olympiad Manager в любом городе. Регистрация стоит 100,000 адены.',
            'Отборочные бои: Первые 6 дней цикла. Нужно победить 3-5 противников для квалификации.',
            'Классические бои: Дни 7-11. Бои 1 на 1 против игроков того же класса. Даёт больше очков.',
            'Неклассические бои: Дни 12-14. Бои против любого класса. Меньше очков, но проще.',
            'Рейтинг: Очки начисляются за победы, снимаются за поражения. Лучшие игроки получают Noblesse.',
            'Noblesse статус: Даёт уникальные баффы, доступ к Noblesse чату, статус героя сервера.'
        ],
        rewards: [
            'Noblesse статус',
            'Уникальные баффы',
            'Слава героя'
        ],
        tips: [
            'Тренируйтесь перед Олимпиадой',
            'Выбирайте противников внимательно',
            'Используйте правильные баффы'
        ],
        related: [
            'noblesse-quest',
            'clan-skills',
            'squad-skills'
        ],
        order: 2
    },

    'misc-siege': {
        id: 'misc-siege',
        section: 'misc',
        group: 'epic',
        title: 'Осады замков Lineage 2 - Полный гайд',
        summary: 'Система осад: подготовка, тактики, награды. Все замки и их особенности.',
        eyebrow: 'Эндгейм',
        meta: [
            { label: 'Тип', value: 'Осады' },
            { label: 'Замки', value: '9 замков' },
            { label: 'Фокус', value: 'Клановый контент' }
        ],
        intro: [
            'Осады замков - масштабные сражения между кланами за контроль над замками. Это вершина кланового контента в Lineage II.',
            '9 замков на карте: Gludio, Giran, Aden, Dion, Goddard, Innadril, Oren, Rune, Schuttgart. Каждый замок даёт уникальные бонусы владельцу.'
        ],
        checklist: [
            'Регистрация клана на осаду',
            'Подготовка осадных машин',
            'Координация атаки и защиты',
            'Захват кристалла замка'
        ],
        steps: [
            'Регистрация: Лидер клана регистрируется у NPC Castle Chamberlain за 2 недели до осады.',
            'Подготовка: Постройте осадные машины (катапульты, баллисты), запаситесь расходниками, разработайте стратегию.',
            'Атака: Разрушьте ворота, уничтожьте защитников, захватите кристалл в тронном зале.',
            'Защита: Укрепите ворота, расставьте защитников, защищайте кристалл до конца осады.',
            'Награды: Контроль над замком даёт налоги, доступ к замковым функциям, статус владельца.'
        ],
        rewards: [
            'Контроль над замком',
            'Налоги с региона',
            'Статус и престиж клана'
        ],
        tips: [
            'Координация важнее численности',
            'Осадные машины решают исход',
            'Изучите тактики прошлых осад'
        ],
        related: [
            'clan-skills',
            'squad-skills',
            'raid-monsters'
        ],
        order: 3
    },

    // Additional detailed guides
    'guide-leveling': {
        id: 'guide-leveling',
        section: 'guides',
        group: 'core',
        title: 'Прокачка в Lineage 2 - Оптимальные маршруты',
        summary: 'Лучшие зоны для кача на каждом уровне. От 1 до 85+ уровня.',
        eyebrow: 'Гайд',
        meta: [
            { label: 'Тип', value: 'Прокачка' },
            { label: 'Уровни', value: '1-85+' },
            { label: 'Фокус', value: 'Эффективность' }
        ],
        intro: [
            'Прокачка в Lineage II - это марафон, а не спринт. Оптимальные маршруты и зоны фарма значительно ускоряют прогресс.',
            'В этом гайде мы рассмотрим лучшие зоны для каждого уровня, оптимальные стратегии и советы по эффективному качу.'
        ],
        checklist: [
            '1-20: Стартовая зона, квесты',
            '20-40: Cruma Tower, Giran Harbor',
            '40-60: Catacombs, Necropolises',
            '60-76: Pagan Temple, Beast Farm',
            '76+: Seven Signs, инстансы'
        ],
        steps: [
            'Уровни 1-20: Выполняйте квесты в стартовой зоне. Не фармите мобов - квесты дают больше опыта.',
            'Уровни 20-30: Cruma Tower B1-B2, Giran Harbor. Фармите в группах для эффективности.',
            'Уровни 30-40: Cruma Tower B3-B4, Hunters Village. Используйте баффы и SOS.',
            'Уровни 40-52: Tower of Insolence, Catacombs. Группы 3-5 человек оптимальны.',
            'Уровни 52-61: Necropolises, верхние этажи Cruma Tower. Высокая плотность мобов.',
            'Уровни 61-76: Pagan Temple, Beast Farm, Valley of Saints. Эндгейм зоны.',
            'Уровни 76+: Seven Signs зоны, инстансы, эпик контент. Максимальный опыт.'
        ],
        rewards: [
            'Быстрая прокачка',
            'Оптимальные маршруты',
            'Эффективный фарм'
        ],
        tips: [
            'Всегда используйте SOS (Scroll of Escape)',
            'Баффы значительно ускоряют кач',
            'Группы эффективнее соло фарма'
        ],
        related: [
            'catacombs-necropolis',
            'prime-farming-zones',
            'pagan-temple-location'
        ],
        order: 3
    },

    'guide-economy': {
        id: 'guide-economy',
        section: 'guides',
        group: 'core',
        title: 'Экономика Lineage 2 - Заработок адены',
        summary: 'Все способы заработка: фарм, крафт, торговля, квесты. От новичка до миллиардера.',
        eyebrow: 'Гайд',
        meta: [
            { label: 'Тип', value: 'Экономика' },
            { label: 'Валюта', value: 'Adena' },
            { label: 'Фокус', value: 'Заработок' }
        ],
        intro: [
            'Экономика Lineage II построена вокруг адены - основной валюты игры. Заработок адены критически важен для покупки экипировки, заточки и прогресса.',
            'Существует множество способов заработка: от фарма мобов до торговли на аукционе. Выбор зависит от вашего класса, уровня и стиля игры.'
        ],
        checklist: [
            'Фарм мобов - базовый способ',
            'Крафт и продажа - для гномов',
            'Торговля на аукционе - для всех',
            'Квесты - стабильный доход'
        ],
        steps: [
            'Фарм мобов: Убивайте мобов, собирайте дроп и адены. Используйте Spoiler для дополнительных ресурсов.',
            'Крафт: Гномы могут создавать оружие, броню и аксессуары. Продажа крафта - стабильный доход.',
            'Торговля: Покупайте дёшево, продавайте дорого. Используйте аукцион и личные магазины.',
            'Квесты: Многие квесты дают адены и ценные предметы. Выполняйте регулярно.',
            'Инвестиции: Покупайте редкие предметы во время спада, продавайте во время пика.'
        ],
        rewards: [
            'Стабильный доход',
            'Финансовая независимость',
            'Возможность купить всё'
        ],
        tips: [
            'Не тратьте всё сразу - сохраняйте резерв',
            'Следите за ценами на аукционе',
            'Инвестируйте в редкие предметы'
        ],
        related: [
            'spoiler-guide',
            'manor-guide',
            'fishing-route'
        ],
        order: 4
    }
};

// Add new content
let articlesAdded = 0;
for (const [key, article] of Object.entries(newContent)) {
    if (!db.articles[key]) {
        db.articles[key] = article;
        articlesAdded++;
    }
}

console.log(`✅ Added ${articlesAdded} new articles`);
console.log(`Total articles: ${Object.keys(db.articles).length}`);

// Update timestamp
db.updatedAt = new Date().toISOString();

// Save database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

// Regenerate static-data.js
const staticDataPath = path.join(__dirname, 'assets', 'js', 'static-data.js');
const jsContent = `/**
 * L2Wiki Static Data Embed - EXPANDED VERSION
 * Updated: ${db.updatedAt}
 * Total Articles: ${Object.keys(db.articles).length}
 * This file contains the complete database embedded permanently.
 */

window.L2WIKI_SEED_DATA = ${JSON.stringify(db, null, 2)};

console.log('[L2Wiki] Static seed data loaded - ${Object.keys(db.articles).length} articles, ${Object.keys(db.sections).length} sections');
`;

fs.writeFileSync(staticDataPath, jsContent, 'utf8');

console.log(`\n✅ static-data.js regenerated!`);
console.log(`\n📊 FINAL STATS:`);
console.log(`   Total articles: ${Object.keys(db.articles).length}`);
console.log(`   Total sections: ${Object.keys(db.sections).length}`);
console.log(`\n🎉 L2Wiki is now a comprehensive Lineage 2 archive!`);
