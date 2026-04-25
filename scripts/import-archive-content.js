const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();

const { RAW_DIR, ensureStorageDirs, publishCanonical, readCanonical } = require('../lib/canonical-store');
const { deepClone, normalizeDatabase, normalizeId } = require('../lib/rich-content-schema');
const manualQuestBackfill = require('./manual-quest-backfill');

const ROOT_DIR = path.resolve(__dirname, '..');
const COPY_DIR = path.join(ROOT_DIR, 'copy');
const DB_PATH = path.join(ROOT_DIR, 'l2wiki.db');
const ARCHIVE_IMAGE_DIR = path.join(ROOT_DIR, 'assets', 'img', 'archive');
const LOCAL_ASSET_ROOTS = [path.join(ROOT_DIR, 'assets', 'img'), COPY_DIR];
const ALLOWED_PREFIXES = [
    'quests',
    'npc',
    'monster',
    'location',
    'guide',
    'mamon',
    'skills',
    'predmety',
    'newbie',
    'pervaya-profa',
    'vtoraya-profa',
    'tretya-profa',
    'necropolis-catacombs',
];

const DIRECT_IMPORT_REFS = [
    'https://www.l2int.ru/skills/tree-skills',
    'https://www.l2int.ru/skills/fishing-skills',
    'https://www.l2int.ru/skills/clan-skills',
    'https://www.l2int.ru/skills/enchanting-skills',
    'https://www.l2int.ru/skills/squad-skills',
    'https://www.l2int.ru/guide/item/5487-manor',
];

const SECTION_BLUEPRINTS = {
    quests: {
        title: 'Квесты',
        description: 'Профессии, сервисные квесты, поздний прогресс и детальные walkthrough-материалы из архива Lineage II.',
        groups: [
            ['profession-1', '1 профессия', 'Квесты и цепочки для первой профессии.'],
            ['profession-2', '2 профессия', 'Квесты и цепочки для второй профессии.'],
            ['profession-3', '3 профессия', 'Квесты и цепочки для третьей профессии.'],
            ['profession-4', '4 профессия', 'Квесты и цепочки для четвертой профессии.'],
            ['epic', 'Пайлака и поздний контент', 'Поздние и высокоуровневые квестовые цепочки.'],
            ['pets', 'Питомцы и маунты', 'Квесты на питомцев, дракончиков и маунтов.'],
            ['service', 'Сервисные квесты', 'Проходы, сабкласс, трансформации и утилитарные цепочки.'],
        ],
    },
    npc: {
        title: 'NPC',
        description: 'Каталоги NPC, сервисные персонажи, маршруты и специальные торговцы.',
        groups: [
            ['catalog', 'Каталог NPC', 'Справочные списки NPC и ссылки на детальные карточки.'],
            ['services', 'Сервисы и маршруты', 'Gatekeeper, Mammon и другие полезные сервисы.'],
        ],
    },
    locations: {
        title: 'Локации',
        description: 'Замки, катакомбы, некрополи и важные игровые территории.',
        groups: [
            ['castles', 'Замки', 'Castle siege, устройство замков и связанные территории.'],
            ['catacombs', 'Катакомбы', 'Катакомбы Seven Signs и связанные материалы.'],
            ['necropolis', 'Некрополи', 'Некрополи Seven Signs и маршруты.'],
            ['farming', 'Фарм-зоны', 'Полезные PvE-локации и зоны прокачки.'],
            ['temples', 'Храмы и проходы', 'Храмы, подземелья и служебные проходы.'],
        ],
    },
    guides: {
        title: 'Гайды',
        description: 'Практические руководства по прогрессу, маршрутам и игровым системам.',
        groups: [
            ['core', 'Основные гайды', 'Большие обзорные и практические руководства.'],
            ['manor', 'Сбор и сдача манора', 'Манор, урожай, семена, менеджеры и рабочие таблицы по замкам.'],
        ],
    },
    skills: {
        title: 'Скиллы | Классы | Умения',
        description: 'Классы, профессии, деревья развития и смежные системы.',
        groups: [
            ['classes', 'Дерево классов (Скиллы)', 'Классы, профессии и цепочки развития персонажа.'],
            ['fishing', 'Скиллы рыбалки', 'Рыбалка, базовые умения, цены и полезные таблицы.'],
            ['clan', 'Клановые скилы (Clan Skills)', 'Клановые умения, очки репутации и требуемые предметы.'],
            ['squad', 'Умения отрядов (Squad Skills)', 'Осадные и отрядные умения для командного контента.'],
            ['upgrade', 'Заточка скиллов (Enchanting Skills)', 'Заточки, улучшения и системы усиления.'],
        ],
    },
    items: {
        title: 'Предметы',
        description: 'Предметы, ресурсы, Manor и игровые сервисы, связанные с экипировкой и экономикой.',
        groups: [
            ['catalog', 'Каталог предметов', 'Списки предметов, ресурсов и связанных систем.'],
            ['quest-items', 'Ключевые предметы', 'Предметы, связанные с прогрессом и квестами.'],
            ['services', 'Сервисы и системы', 'Mammon, Manor и предметные сервисы.'],
        ],
    },
    monsters: {
        title: 'Монстры',
        description: 'Подборки монстров, споты и связанные игровые материалы.',
        groups: [['overview', 'Ключевые подборки', 'Сводные материалы по монстрам и фарм-точкам.']],
    },
    misc: {
        title: 'Прочее',
        description: 'Материалы, которые не попали в основные игровые категории.',
        groups: [['epic', 'Эпик-боссы', 'Отдельные справочные материалы и редкие темы.']],
    },
};

const OVERRIDE_IDS_BY_TITLE = {
    NPC: 'npc-overview',
    'Enhance Your Weapon (Усиление оружия)': 'soul-crystal',
    'Seize Your Destiny (Преодолеть Рок)': 'quest-profession-fourth',
    'Катакомбы и Некрополи': 'catacombs-necropolis',
    'Квесты на вторую профессию': 'quest-profession-second',
    'Квесты на первую профессию': 'quest-profession-first',
    'Квесты на третью профессию': 'quest-profession-third',
    'Магазин, распечатка и улучшение у Мамона': 'mammon-services',
    'Сбор и сдача манора': 'manor-guide',
};

const OVERRIDE_IDS_BY_PATH = {
    npc: 'npc-overview',
    'quests/first-profession': 'quest-profession-first',
    'quests/second-profession': 'quest-profession-second',
    'quests/third-profession': 'quest-profession-third',
    'quests/item/3130-an-obvious-lie': 'ears-quest',
    'quests/item/3118-a-special-order': 'quest-cubic',
    'skills/tree-skills': 'class-tree',
    'skills/fishing-skills': 'fishing-skills',
    'skills/clan-skills': 'clan-skills',
    'skills/enchanting-skills': 'enchanting-skills',
    'skills/squad-skills': 'squad-skills',
    'guide/item/5487-manor': 'manor-guide',
};

const normalizeWhitespace = (value) =>
    String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const escapeHtml = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const textWithBreaks = ($element) => {
    const clone = $element.clone();
    const imageLabels = clone
        .find('img')
        .toArray()
        .map((image) => normalizeWhitespace(image.attribs?.title || image.attribs?.alt || ''))
        .filter(Boolean);

    clone.find('img').remove();
    clone.find('br').replaceWith('\n');

    return normalizeWhitespace([clone.text().replace(/\n+/g, ' / '), imageLabels.join(' ')].join(' '));
};

const encodePublicPath = (relativePath) => `/${encodeURI(relativePath.split(path.sep).join('/'))}`;

const toSafeFileSlug = (value) => normalizeId(String(value || '').replace(/\//g, '-')) || 'archive-page';

const LOCAL_QUEST_ICON_MAP = [
    ['map_yellow', path.join('assets', 'img', 'icons', 'map.jpg')],
    ['ginseng_red', path.join('assets', 'img', 'icons', 'medical-harb.jpg')],
    ['stone_gray', path.join('assets', 'img', 'icons', 'Spirit Ore.jpg')],
    ['thread', path.join('assets', 'img', 'icons', 'thread.jpg')],
    ['suede', path.join('assets', 'img', 'icons', 'suede.jpg')],
    ['rabbit_ear', path.join('assets', 'img', 'icons', 'rabbit-ears.jpg')],
    ['cobol_i04', path.join('assets', 'img', 'icons', 'Golden Cobol.jpg')],
    ['cobol_i07', path.join('assets', 'img', 'icons', 'Thorn Cobol.jpg')],
    ['cobol_i09', path.join('assets', 'img', 'icons', 'Great Cobol.jpg')],
    ['oil_pot_white', path.join('assets', 'img', 'icons', 'Seed Jar.jpg')],
    ['tuna_i08', path.join('assets', 'img', 'icons', 'Orange Nimble Fish.jpg')],
    ['angler_i08', path.join('assets', 'img', 'icons', 'Orange Ugly Fish.jpg')],
    ['bream_i08', path.join('assets', 'img', 'icons', 'Orange Fat Fish.jpg')],
];

const REMOTE_QUEST_ICON_MAP = [
    ['cat_ear', 'https://linedia.ru/w/images/7/79/Accessory_cat_ear_i00_0.jpg'],
    ['racoon_ear', 'https://linedia.ru/w/images/c/ce/Accessory_racoon_ear_i00_0.jpg'],
];

const VISUAL_ARTICLE_IMAGE_MAP = {
    'class-tree': [{ fileName: 'Дерево классов (Скиллы).jpg', caption: 'Дерево классов и переходы между профессиями Lineage II.' }],
    'fishing-skills': [{ fileName: 'Скиллы рыбалки.jpg', caption: 'Рыбалка, специальные умения и полезные расходники.' }],
    'clan-skills': [{ fileName: 'Клановые скилы (Clan Skills).png', caption: 'Клановые умения, их роли и приоритеты для развития клана.' }],
    'squad-skills': [{ fileName: 'Умения отрядов (Squad Skills).jpg', caption: 'Навык отрядов и командные бонусы для осад и кланового контента.' }],
    'enchanting-skills': [{ fileName: 'Заточка скиллов (Enchanting Skills).jpg', caption: 'Заточка умений, ветки усиления и практичные приоритеты.' }],
    'manor-guide': [{ fileName: 'quest-panel-manor-2c5d754e374b.jpg', caption: 'Манор: семена, урожай, сдача, таблицы и рабочие схемы по замкам.' }],
    'archive-npc-item-5486-roxxy': [{ fileName: 'quest-roxxy-843f9506abd8.jpg', caption: 'Gatekeeper Roxxy: характеристики, связанные квесты и местонахождение.' }],
    'spoiler-guide': [
        { fileName: 'bountyhunter.gif', caption: 'Spoiler и Bounty Hunter как основа стабильной экономики.' },
        { fileName: 'warsmith.gif', caption: 'Связка спойла и крафта для долгого прогресса.' },
    ],
    'guide-economy': [{ fileName: 'codran_seed.jpg', caption: 'Манор, спойл, торговля и другие рабочие способы заработка адены.' }],
    'fishing-route': [{ fileName: 'Скиллы рыбалки.jpg', caption: 'Спокойный маршрут для рыбалки и фарма сопутствующих материалов.' }],
    'archive-guide-item-5266-craft-interlude': [{ fileName: 'warsmith.gif', caption: 'Warsmith / Maestro: крафт, торговля и ремесленный прогресс.' }],
    'catacombs-necropolis': [{ fileName: 'cat_and_necr.png', caption: 'Катакомбы и некрополи: входы, маршруты и распределение зон.' }],
    'necropolis-routes': [{ fileName: 'cat_and_necr.png', caption: 'Практичные маршруты по некрополям и навигация внутри локаций.' }],
    'pagan-temple-location': [{ fileName: 'Квесты на проход в Pagan Temple.jpg', caption: 'Pagan Temple и входная цепочка в храм.' }],
    'imperial-tomb-route': [{ fileName: 'Квесты на Фринтеззу.jpg', caption: 'Imperial Tomb и путь к Frintezza.' }],
    'items-weapons': [{ fileName: 'прокачка кристаллов.jpg', caption: 'Оружие, вставка Special Ability, апгрейд и прокачка кристаллов.' }],
    'items-armor': [{ fileName: 'armor_t02_b_i00.png', caption: 'Сеты брони и предметные ветки экипировки.' }],
    'items-accessories': [{ fileName: 'Квест на уши (Кролика, Енота, Кота).jpg', caption: 'Аксессуары, декоративные предметы и связанные игровые материалы.' }],
    'misc-epic-overview': [
        { fileName: 'Квест на Антараса.jpg', caption: 'Эпические боссы, доступы к ним и поздний PvE-контент.' },
        { fileName: 'Квесты на Фринтеззу.jpg', caption: 'Эпические рейды, требования к составу и маршруты подготовки.' },
    ],
    'quest-cubic': [{ fileName: 'квест на кубик.jpg', caption: 'A Special Order и награда кубиком.' }],
    'wash-pk': [{ fileName: 'quest-guide-hero-wash-pk.png', inlineIconFileName: 'квест на открытие РК.jpg', caption: 'Сервисная цепочка на очистку PK.' }],
    'transformation-quest': [{ fileName: 'quest-guide-hero-transformation-quest.png', inlineIconFileName: 'квест на трансформацию.jpg', caption: 'Квест на трансформацию и линия Hardin.' }],
    'subclass-quest': [{ fileName: 'quest-guide-hero-subclass-quest.png', inlineIconFileName: 'Квесты на саб-класс (Sub-class).jpg', caption: 'Sub-class, Fate’s Whisper и Mimir’s Elixir.' }],
    'noblesse-quest': [{ fileName: 'quest-guide-hero-noblesse-quest.png', inlineIconFileName: 'Квесты на дворянина (Noblesse).jpg', caption: 'Путь к статусу Noblesse.' }],
    'pagan-temple-pass': [{ fileName: 'quest-guide-hero-pagan-temple-pass.png', inlineIconFileName: 'Квесты на проход в Pagan Temple.jpg', caption: 'Проход в Pagan Temple.' }],
    'wedding-quest': [{ fileName: 'quest-guide-hero-wedding-quest.png', inlineIconFileName: 'Квесты на свадебный наряд.jpg', caption: 'Formal Wear и свадебный наряд.' }],
    'pailaka-song-fire': [{ fileName: 'quest-guide-hero-pailaka-song-fire.png', inlineIconFileName: 'Пайлака - Песня льда и огня.jpg', caption: 'Pailaka - Song of Ice and Fire.' }],
    'pailaka-devils-legacy': [{ fileName: 'quest-guide-hero-pailaka-devils-legacy.png', inlineIconFileName: 'Пайлака - Наследие Дьявола.jpg', caption: 'Pailaka - Devil’s Legacy.' }],
    'pailaka-injured-dragon': [{ fileName: 'quest-guide-hero-pailaka-injured-dragon.png', inlineIconFileName: 'Пайлака - Раненый Дракон.jpg', caption: 'Pailaka - Injured Dragon.' }],
    'freya-entry': [{ fileName: 'quest-guide-hero-freya-entry.png', inlineIconFileName: 'Квесты на Фрею.jpg', caption: 'Подготовка к Freya.' }],
    'antharas-entry': [{ fileName: 'quest-guide-hero-antharas-entry.png', inlineIconFileName: 'Квест на Антараса.jpg', caption: 'Допуск к Antharas.' }],
    'baium-entry': [{ fileName: 'quest-guide-hero-baium-entry.png', inlineIconFileName: 'Квест на Баюма.jpg', caption: 'Доступ к Baium.' }],
    'frintezza-entry': [{ fileName: 'quest-guide-hero-frintezza-entry.png', inlineIconFileName: 'Квесты на Фринтеззу.jpg', caption: 'Маршрут к Frintezza.' }],
    'quest-wolf-collar': [{ fileName: 'quest-guide-hero-quest-wolf-collar.png', inlineIconFileName: 'Квест на Волка (Wolf Collar).jpg', caption: 'Квест на Wolf Collar.' }],
    'quest-baby-kookabura': [{ fileName: 'quest-guide-hero-quest-baby-kookabura.png', inlineIconFileName: 'Квест на Птицу (Baby Kookaburra).jpg', caption: 'Квест на Baby Kookabura.' }],
    'quest-baby-cougar': [{ fileName: 'quest-guide-hero-quest-baby-cougar.png', inlineIconFileName: 'Квест на Тигра (Baby Cougar).jpg', caption: 'Квест на Baby Cougar.' }],
    'quest-dragonflute': [{ fileName: 'quest-guide-hero-quest-dragonflute.png', inlineIconFileName: 'Квест на Дракончика (Dragonflute).jpg', caption: 'Квест на Dragonflute.' }],
    'quest-dragon-bugle': [{ fileName: 'quest-guide-hero-quest-dragon-bugle.png', inlineIconFileName: 'Квест на Ездового Дракона (Dragon Bugle).jpg', caption: 'Квест на Dragon Bugle.' }],
    'quest-profession-fourth': [{ fileName: 'map.jpg', caption: 'Ключевая цепочка четвертой профессии.' }],
    'quest-baby-buffalo': [{ fileName: 'quest-guide-hero-quest-baby-buffalo.png', inlineIconFileName: 'quest-buffalo-panpipe-0e16ed14b059.jpg', caption: 'Квест на Baby Buffalo.' }],
    'valakas-entry': [{ fileName: 'quest-guide-hero-valakas-entry.png', inlineIconFileName: 'quest-necklace-of-valakas-heroicon.jpg', caption: 'Маршрут на доступ к Valakas.' }],
    'archive-quests-item-2814-path-to-becoming-a-lord-aden': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Aden.' }],
    'archive-quests-item-2816-path-to-becoming-a-lord-innadril': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Innadril.' }],
    'archive-quests-item-2817-path-to-becoming-a-lord-schuttgart': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Schuttgart.' }],
    'archive-quests-item-2819-path-to-becoming-a-lord-rune': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Rune.' }],
    'archive-quests-item-2820-path-to-becoming-a-lord-gludio': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Gludio.' }],
    'archive-quests-item-2821-path-to-becoming-a-lord-goddard': [{ fileName: 'map.jpg', caption: 'Маршрут Path to Becoming a Lord - Goddard.' }],
    'archive-quests-item-2826-a-clan-s-reputation': [{ fileName: 'Клановые скилы (Clan Skills).png', caption: 'Клановая репутация и связанные цепочки.' }],
    'archive-quests-item-2828-a-clan-s-fame': [{ fileName: 'Клановые скилы (Clan Skills).png', caption: 'Клановая слава и связанные цепочки.' }],
    'archive-quests-item-2916-pavel-the-giant': [{ fileName: 'map.jpg', caption: 'Маршрут Pavel the Giant.' }],
    'archive-quests-item-3362-how-to-oppose-evil': [{ fileName: 'map.jpg', caption: 'Маршрут How to Oppose Evil.' }],
};

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        maxPages: Number.MAX_SAFE_INTEGER,
        fetchRemote: true,
        questOnly: false,
    };

    args.forEach((arg) => {
        if (arg === '--no-fetch') {
            options.fetchRemote = false;
            return;
        }

        if (arg === '--quest-only') {
            options.questOnly = true;
            return;
        }

        if (arg.startsWith('--max-pages=')) {
            const numeric = Number(arg.split('=').pop());

            if (Number.isFinite(numeric) && numeric > 0) {
                options.maxPages = numeric;
            }
        }
    });

    return options;
};

const walkFiles = (startDir) => {
    if (!fs.existsSync(startDir)) {
        return [];
    }

    const entries = fs.readdirSync(startDir, { withFileTypes: true });
    const files = [];

    entries.forEach((entry) => {
        const fullPath = path.join(startDir, entry.name);

        if (entry.isDirectory()) {
            files.push(...walkFiles(fullPath));
            return;
        }

        files.push(fullPath);
    });

    return files;
};

const buildLocalAssetIndex = () => {
    const index = new Map();

    LOCAL_ASSET_ROOTS.forEach((rootDir) => {
        walkFiles(rootDir).forEach((fullPath) => {
            const fileName = path.basename(fullPath).toLowerCase();

            if (!index.has(fileName)) {
                index.set(fileName, []);
            }

            index.get(fileName).push(fullPath);
        });
    });

    return index;
};

const LOCAL_ASSET_INDEX = buildLocalAssetIndex();
const LOCAL_IMAGE_SIZE_CACHE = new Map();

const resolveLocalAssetPublicPath = (fileName) => {
    if (!fileName) {
        return '';
    }

    const matches = LOCAL_ASSET_INDEX.get(String(fileName).toLowerCase()) || [];
    const fullPath = matches[0];

    return fullPath ? encodePublicPath(path.relative(ROOT_DIR, fullPath)) : '';
};

const readImageSize = (fullPath) => {
    if (!fullPath || !fs.existsSync(fullPath)) {
        return null;
    }

    if (LOCAL_IMAGE_SIZE_CACHE.has(fullPath)) {
        return LOCAL_IMAGE_SIZE_CACHE.get(fullPath);
    }

    try {
        const buffer = fs.readFileSync(fullPath);

        if (buffer.length < 10) {
            LOCAL_IMAGE_SIZE_CACHE.set(fullPath, null);
            return null;
        }

        if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
            const size = {
                width: buffer.readUInt32BE(16),
                height: buffer.readUInt32BE(20),
            };
            LOCAL_IMAGE_SIZE_CACHE.set(fullPath, size);
            return size;
        }

        if (buffer.toString('ascii', 0, 3) === 'GIF') {
            const size = {
                width: buffer.readUInt16LE(6),
                height: buffer.readUInt16LE(8),
            };
            LOCAL_IMAGE_SIZE_CACHE.set(fullPath, size);
            return size;
        }

        if (buffer.toString('utf8', 0, Math.min(buffer.length, 256)).includes('<svg')) {
            const text = buffer.toString('utf8');
            const widthMatch = text.match(/\bwidth="([\d.]+)(?:px)?"/i);
            const heightMatch = text.match(/\bheight="([\d.]+)(?:px)?"/i);
            const viewBoxMatch = text.match(/\bviewBox="[\d.\s-]*\s([\d.]+)\s([\d.]+)"/i);
            const size = {
                width: Number(widthMatch?.[1] || viewBoxMatch?.[1] || 0),
                height: Number(heightMatch?.[1] || viewBoxMatch?.[2] || 0),
            };

            if (size.width > 0 && size.height > 0) {
                LOCAL_IMAGE_SIZE_CACHE.set(fullPath, size);
                return size;
            }
        }

        if (buffer[0] === 0xff && buffer[1] === 0xd8) {
            let offset = 2;

            while (offset < buffer.length) {
                if (buffer[offset] !== 0xff) {
                    offset += 1;
                    continue;
                }

                const marker = buffer[offset + 1];
                const blockLength = buffer.readUInt16BE(offset + 2);

                if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
                    const size = {
                        width: buffer.readUInt16BE(offset + 7),
                        height: buffer.readUInt16BE(offset + 5),
                    };
                    LOCAL_IMAGE_SIZE_CACHE.set(fullPath, size);
                    return size;
                }

                if (!blockLength || Number.isNaN(blockLength)) {
                    break;
                }

                offset += 2 + blockLength;
            }
        }
    } catch (error) {
        LOCAL_IMAGE_SIZE_CACHE.set(fullPath, null);
        return null;
    }

    LOCAL_IMAGE_SIZE_CACHE.set(fullPath, null);
    return null;
};

const resolvePublicPathToLocalFile = (publicSrc) => {
    const value = String(publicSrc || '').trim();

    if (!value.startsWith('/')) {
        return '';
    }

    const relativePath = decodeURI(value.replace(/^\/+/, ''));
    const fullPath = path.join(ROOT_DIR, relativePath);
    return fs.existsSync(fullPath) ? fullPath : '';
};

const isSuitableHeroMediaItem = (item) => {
    const src = String(item?.src || '').trim();

    if (!src) {
        return false;
    }

    if (/^https?:\/\//i.test(src)) {
        return false;
    }

    const localFile = resolvePublicPathToLocalFile(src);
    const size = readImageSize(localFile);

    if (!size) {
        return false;
    }

    return size.width >= 240 && size.height >= 140;
};

const QUEST_TEXT_ICON_RULES = [
    {
        pattern: /соберите.*квестовые предметы|добыть.*квестовые предметы|боев(?:ой|ую).*этап|охотнич|монстров|спот/i,
        fileName: 'quest-animals-44d00f8a382e.png',
        articleIds: ['quest-baby-cougar', 'quest-baby-buffalo', 'quest-baby-kookabura'],
    },
    { pattern: /Pet Exchange Ticket:\s*Cougar/i, fileName: 'quest-ticket-red-ddc7da4d404b.jpg', articleIds: ['quest-baby-cougar'] },
    { pattern: /\bBaby Cougar\b|Pet Manager.*Cougar|Cougar.*Pet Manager/i, fileName: 'quest-cougar-chime-e3f5cbb1d2a3.jpg', articleIds: ['quest-baby-cougar'] },
    { pattern: /Pet Exchange Ticket:\s*Buffalo/i, fileName: 'quest-ticket-blue-044e9428a3fa.jpg', articleIds: ['quest-baby-buffalo'] },
    { pattern: /\bBaby Buffalo\b|Pet Manager.*Buffalo|Buffalo.*Pet Manager/i, fileName: 'quest-buffalo-panpipe-0e16ed14b059.jpg', articleIds: ['quest-baby-buffalo'] },
    { pattern: /Pet Exchange Ticket:\s*Kookabura/i, fileName: 'quest-ticket-8c13828b60cd.jpg', articleIds: ['quest-baby-kookabura'] },
    { pattern: /Gatekeeper Bella|Bella/i, fileName: 'quest-bella-6f5a181bb24c.jpg', articleIds: ['quest-wolf-collar'] },
    { pattern: /Guard Metty|Accessory Merchant Ellie|Ellie|Metty/i, fileName: 'quest-animals-44d00f8a382e.png', articleIds: ['quest-wolf-collar'] },
    { pattern: /\bBaby Kookabura\b|\bKookabura\b|Pet Manager.*Kookabura|Kookabura.*Pet Manager/i, fileName: 'Квест на Птицу (Baby Kookaburra).jpg', articleIds: ['quest-baby-kookabura'] },
    { pattern: /Pet Manager Martin|Animal Lover.?s List|Martin/i, fileName: 'quest-wolf-spirit-totem-5caf4ed27aff.jpg', articleIds: ['quest-wolf-collar'] },
    {
        pattern: /добыть.*квестовых предметов|зверей|хищников|боевую часть|охотничьих зонах|боевом этапе/i,
        fileName: 'quests-item-2871-bring-wolf-pelts-animal-skin-5717ae26cb.jpg',
        articleIds: ['quest-wolf-collar'],
    },
    { pattern: /Wolf Collar|волка|питомца/i, fileName: 'quest-wolf-spirit-totem-5caf4ed27aff.jpg', articleIds: ['quest-wolf-collar'] },
    { pattern: /Maestro Reorin|Fate.?s Whisper/i, fileName: 'quest-maestro-mold-071057505f08.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Cabrio|Soul Orb/i, fileName: 'quest-broken-piece-of-soul-stone-c0c54950aba2.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Infernium Scepter|Hallate|Kernon|Longhorn/i, fileName: 'quest-imperial-scepter1-4969929ea6d9.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Infernium Varnish|Cliff|Ferris|Hammer/i, fileName: 'quest-varnish-d238d99d5129.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Baium.?s Blood|Blooded Fabric|Pipette Knife|Kaspar/i, fileName: 'quest-hell-knife-7a1f9b126550.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Reorin Mold|Star of Destiny|B-crystals|Top B-grade|low A-grade/i, fileName: 'quest-star-a-99b7407c9a75.gif', articleIds: ['subclass-quest'] },
    { pattern: /Mimir.?s Elixir|Magister Ladd|Pure Silver|True Gold|Supplier of Reagents/i, fileName: 'quest-reagent-silver-b45ce888612f.jpg', articleIds: ['subclass-quest'] },
    { pattern: /Wesley|Ivory Tower|alchem/i, fileName: 'quest-crystal-ball-green-0220b5ffa54c.gif', articleIds: ['subclass-quest'] },
    { pattern: /Kantabilon|Malruk|Succubus|talons/i, fileName: 'quest-badge-gold-45a51eedfcf7.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Virgil|Rahorakti|Crimson Moss|Swamp of Screams/i, fileName: 'quest-rune-castle-cc2daa59c957.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Caradine|Noel|Hellfire Oil|Lunaragent/i, fileName: 'quest-oil-pot-white-fc2aae62f726.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Part 2|Part 3|Ossian/i, fileName: 'quest-protection-of-rune-649a6124cbfb.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /внимательно читайте|пропущенным диалогом|следующая часть/i, fileName: 'quest-protection-of-rune-649a6124cbfb.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Talien|Gabrielle|Gilmore|Beehive/i, fileName: 'quest-badge-silver-c582ce5ea114.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /привилегии|эндгейм|доступны ли/i, fileName: 'quest-nobless-teleport-coupon-a0dd78932924.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Holy Grail|пропуск|разрешение|снимает ограничение|доступ действительно активен/i, fileName: 'quest-holy-grail1-65aa38b9d19e.jpg', articleIds: ['pagan-temple-pass'] },
    { pattern: /разговорные этапы подряд|нить маршрута/i, fileName: 'quest-protection-of-rune-649a6124cbfb.jpg', articleIds: ['pagan-temple-pass'] },
    { pattern: /фарма|комнаты|маршрутом|запасной зоной/i, fileName: 'quest-holy-grail3-f0dde901907c.jpg', articleIds: ['pagan-temple-pass'] },
    { pattern: /Rune|Rune Territory|high-level локациях/i, fileName: 'quest-rune-castle-cc2daa59c957.jpg', articleIds: ['pagan-temple-pass', 'freya-entry'] },
    { pattern: /предмет\/разрешение|допуск|входом во Freya/i, fileName: 'quest-protection-of-rune-649a6124cbfb.jpg', articleIds: ['freya-entry'] },
    { pattern: /разговорные шаги подряд|конфликта|лояльности/i, fileName: 'quest-crystal-cave-145ef44757aa.jpg', articleIds: ['freya-entry'] },
    { pattern: /лимит по людям|КД инстанса|командного лидера|чек-лист состава|лечение|бафы/i, fileName: 'quest-crystal-white-959167afc887.jpg', articleIds: ['freya-entry'] },
    { pattern: /Schuttgart|боевой или предметный этап|снежными зонами/i, fileName: 'quest-crystal-cave-145ef44757aa.jpg', articleIds: ['freya-entry'] },
    { pattern: /снеж|ледян|Sirra|Jinia|Freya/i, fileName: 'quest-seal-of-winter-81d7ba1a7e33.jpg', articleIds: ['freya-entry'] },
    { pattern: /Hardin|Hardin.?s Private Academy|трансформац/i, fileName: 'quest-stone-of-purity-3396d1274a88.jpg', articleIds: ['transformation-quest'] },
    { pattern: /магическому NPC|реагент|алхимическую часть|ингредиент/i, fileName: 'quest-reagent-white-56a7d2af6bb0.jpg', articleIds: ['transformation-quest'] },
    { pattern: /Formal Wear|свадебн/i, fileName: 'quest-formal-wear-7d2703e7891d.jpg', articleIds: ['wedding-quest'] },
    { pattern: /ткань|cloth/i, fileName: 'quest-piece-of-cloth-white-62b6688289eb.jpg', articleIds: ['wedding-quest'] },
    { pattern: /Sewing Kit|швейный/i, fileName: 'quest-craftsman-mold-2ef37ec9522c.jpg', articleIds: ['wedding-quest'] },
    { pattern: /украшени|декоратив/i, fileName: 'quest-jewel-gold-24700092b166.jpg', articleIds: ['wedding-quest'] },
    { pattern: /временное оружие|специальное оружие|усиления временного оружия|копье/i, fileName: 'quest-ancient-legacy-sword-64750e5475fe.jpg', articleIds: ['pailaka-devils-legacy', 'pailaka-song-fire'] },
    { pattern: /улучшите оружие|ступеней усиления|усилите оружие|свитков|зарядов/i, fileName: 'quest-baguette-s-dualsword-7276c77bef78.jpg', articleIds: ['pailaka-devils-legacy', 'pailaka-song-fire'] },
    { pattern: /бафы|банки|щитки|лечебными предметами/i, fileName: 'quest-potion-gold-e610cde97b36.jpg', articleIds: ['pailaka-devils-legacy', 'pailaka-song-fire', 'pailaka-injured-dragon'] },
    { pattern: /Lematan|босса|финальным боссом/i, fileName: 'quest-devil-s-legacy-5271ad1d7dc0.jpg', articleIds: ['pailaka-devils-legacy', 'pailaka-song-fire'] },
    { pattern: /Pailaka|корабля|инстанс/i, fileName: 'quest-devil-s-legacy-5271ad1d7dc0.jpg', articleIds: ['pailaka-devils-legacy', 'pailaka-song-fire'] },
    { pattern: /прокачанного hatchling|эволюционную цепочку|hatchling/i, fileName: 'quest-dragon-egg1-1ab6a593fac5.jpg', articleIds: ['quest-dragon-bugle'] },
    { pattern: /безопасной зоне|прокачки|питомца/i, fileName: 'quest-dragon-flute-019afeae9707.jpg', articleIds: ['quest-dragonflute'] },
    { pattern: /боевые или доставочные этапы|яйцом hatchling|передачей предметов/i, fileName: 'quest-dragon-egg1-1ab6a593fac5.jpg', articleIds: ['quest-dragonflute'] },
    { pattern: /\bDragon Flute\b|\bDragonflute\b/i, fileName: 'quest-dragon-flute-019afeae9707.jpg', articleIds: ['quest-dragonflute'] },
    { pattern: /\bDragon Bugle\b|\bStrider\b/i, fileName: 'quest-bugle-6ab8ff772a5c.jpg', articleIds: ['quest-dragon-bugle'] },
    { pattern: /\bHatchling Egg\b|\bdragon egg\b|\begg\b/i, fileName: 'quest-dragon-egg1-1ab6a593fac5.jpg', articleIds: ['quest-dragonflute', 'quest-dragon-bugle'] },
    { pattern: /\bFairy Mymyu\b|\bFairy Stone\b|\bfairy\b/i, fileName: 'quest-fairy-372e0cf0a19d.png', articleIds: ['quest-dragonflute'] },
    { pattern: /Pet Exchange Ticket/i, fileName: 'quest-ticket-35e5da3abb2a.jpg', articleIds: ['quest-baby-cougar', 'quest-baby-buffalo', 'quest-baby-kookabura'] },
    { pattern: /Poison Pouch|Sin Eater/i, fileName: 'quests-item-2829-repent-your-sins-poison-pouch-68d1236f19.jpg', articleIds: ['wash-pk'] },
    { pattern: /Black Judge/i, fileName: 'квест на открытие РК.jpg', articleIds: ['wash-pk'] },
    { pattern: /Holy Grail/i, fileName: 'quest-holy-grail1-65aa38b9d19e.jpg', articleIds: ['pagan-temple-pass'] },
    { pattern: /Noblesse Tiara|Lady of the Lake/i, fileName: 'quest-noblesse-tiara-2166a0a47d43.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Teleport Coupon/i, fileName: 'quest-nobless-teleport-coupon-a0dd78932924.jpg', articleIds: ['noblesse-quest'] },
    { pattern: /Spear of Silenos/i, fileName: 'quest-spear-of-silenos-5ee06299ff61.jpg', articleIds: ['pailaka-injured-dragon'] },
    { pattern: /Necklace of Valakas|Valakas/i, fileName: 'quest-necklace-of-valakas-heroicon.jpg', articleIds: ['valakas-entry'] },
    { pattern: /Ring of Baium|Baium/i, fileName: 'quest-ring-of-baium-heroicon.jpg', articleIds: ['baium-entry'] },
    { pattern: /Earring of Antharas|Antharas/i, fileName: 'quest-earring-of-antharas-heroicon.jpg', articleIds: ['antharas-entry'] },
    { pattern: /Frintezza/i, fileName: 'quest-frintezza-necklace-heroicon.jpg', articleIds: ['frintezza-entry'] },
    { pattern: /\bWolf Collar\b/i, fileName: 'Квест на Волка (Wolf Collar).jpg', articleIds: ['quest-wolf-collar'] },
    { pattern: /\bDragon\s*Flute\b|\bDragonflute\b|\bHatchling\b/i, fileName: 'Квест на Дракончика (Dragonflute).jpg', articleIds: ['quest-dragonflute'] },
    { pattern: /\bDragon\s*Bugle\b|\bStrider\b/i, fileName: 'Квест на Ездового Дракона (Dragon Bugle).jpg', articleIds: ['quest-dragon-bugle'] },
    { pattern: /\bBaby Kookabura\b|\bKookabura\b/i, fileName: 'Квест на Птицу (Baby Kookaburra).jpg', articleIds: ['quest-baby-kookabura'] },
    { pattern: /\bBaby Cougar\b|\bCougar\b/i, fileName: 'Квест на Тигра (Baby Cougar).jpg', articleIds: ['quest-baby-cougar'] },
    { pattern: /\bNoblesse\b|Lady of the Lake/i, fileName: 'Квесты на дворянина (Noblesse).jpg', articleIds: ['noblesse-quest'] },
    { pattern: /\bSub-?class\b|Fate.?s Whisper|Mimir.?s Elixir|Star of Destiny/i, fileName: 'Квесты на саб-класс (Sub-class).jpg', articleIds: ['subclass-quest'] },
    { pattern: /Hardin|трансформац/i, fileName: 'квест на трансформацию.jpg', articleIds: ['transformation-quest'] },
    { pattern: /Pagan Temple|Holy Grail/i, fileName: 'Квесты на проход в Pagan Temple.jpg', articleIds: ['pagan-temple-pass'] },
    { pattern: /Formal Wear|свадебн/i, fileName: 'Квесты на свадебный наряд.jpg', articleIds: ['wedding-quest'] },
    { pattern: /Pailaka|Song of Ice and Fire/i, fileName: 'Пайлака - Песня льда и огня.jpg', articleIds: ['pailaka-song-fire'] },
    { pattern: /Pailaka|Devil.?s Legacy|Lematan/i, fileName: 'Пайлака - Наследие Дьявола.jpg', articleIds: ['pailaka-devils-legacy'] },
    { pattern: /Pailaka|Injured Dragon|Latana|Spear of Silenos/i, fileName: 'Пайлака - Раненый Дракон.jpg', articleIds: ['pailaka-injured-dragon'] },
    { pattern: /Antharas|Gabrielle|Portal Stone/i, fileName: 'Квест на Антараса.jpg', articleIds: ['antharas-entry'] },
    { pattern: /Baium|Blooded Fabric|Hanellin/i, fileName: 'Квест на Баюма.jpg', articleIds: ['baium-entry'] },
    { pattern: /Freya|Sirra|Jinia/i, fileName: 'Квесты на Фрею.jpg', articleIds: ['freya-entry'] },
    { pattern: /Frintezza|Imperial Tomb|Nameless Soul/i, fileName: 'Квесты на Фринтеззу.jpg', articleIds: ['frintezza-entry'] },
    { pattern: /A Special Order|кубик|cubic/i, fileName: 'квест на кубик.jpg', articleIds: ['quest-cubic'] },
    { pattern: /PK|Black Judge|карм/i, fileName: 'квест на открытие РК.jpg', articleIds: ['wash-pk'] },
];

const QUEST_INLINE_ICON_FILES = new Set(
    [
        'map.jpg',
        'medical-harb.jpg',
        'spirit ore.jpg',
        'thread.jpg',
        'suede.jpg',
        'rabbit-ears.jpg',
        'golden cobol.jpg',
        'thorn cobol.jpg',
        'great cobol.jpg',
        'seed jar.jpg',
        'orange nimble fish.jpg',
        'orange ugly fish.jpg',
        'orange fat fish.jpg',
        'quest-ticket-35e5da3abb2a.jpg',
        'quest-ticket-8c13828b60cd.jpg',
        'quest-ticket-blue-044e9428a3fa.jpg',
        'quest-ticket-red-ddc7da4d404b.jpg',
        'quest-cougar-chime-e3f5cbb1d2a3.jpg',
        'quest-animals-44d00f8a382e.png',
        'quest-bella-6f5a181bb24c.jpg',
        'quest-broken-piece-of-soul-stone-c0c54950aba2.jpg',
        'quest-buffalo-panpipe-0e16ed14b059.jpg',
        'quest-bugle-6ab8ff772a5c.jpg',
        'quest-badge-gold-45a51eedfcf7.jpg',
        'quest-badge-silver-c582ce5ea114.jpg',
        'quest-ancient-legacy-sword-64750e5475fe.jpg',
        'quest-baguette-s-dualsword-7276c77bef78.jpg',
        'quest-craftsman-mold-2ef37ec9522c.jpg',
        'quest-crystal-ball-green-0220b5ffa54c.gif',
        'quest-crystal-cave-145ef44757aa.jpg',
        'quest-crystal-white-959167afc887.jpg',
        'quest-devil-s-legacy-5271ad1d7dc0.jpg',
        'quest-dragon-flute-019afeae9707.jpg',
        'quest-dragon-egg1-1ab6a593fac5.jpg',
        'quest-fairy-372e0cf0a19d.png',
        'quest-formal-wear-7d2703e7891d.jpg',
        'quest-hell-knife-7a1f9b126550.jpg',
        'quests-item-2829-repent-your-sins-poison-pouch-68d1236f19.jpg',
        'quest-imperial-scepter1-4969929ea6d9.jpg',
        'quest-jewel-gold-24700092b166.jpg',
        'quest-maestro-mold-071057505f08.jpg',
        'quest-holy-grail1-65aa38b9d19e.jpg',
        'quest-holy-grail3-f0dde901907c.jpg',
        'quest-noblesse-tiara-2166a0a47d43.jpg',
        'quest-nobless-teleport-coupon-a0dd78932924.jpg',
        'quest-oil-pot-white-fc2aae62f726.jpg',
        'quest-piece-of-cloth-white-62b6688289eb.jpg',
        'quest-potion-gold-e610cde97b36.jpg',
        'quest-protection-of-rune-649a6124cbfb.jpg',
        'quest-reagent-silver-b45ce888612f.jpg',
        'quest-reagent-white-56a7d2af6bb0.jpg',
        'quest-rune-castle-cc2daa59c957.jpg',
        'quest-seal-of-winter-81d7ba1a7e33.jpg',
        'quest-spear-of-silenos-5ee06299ff61.jpg',
        'quest-star-a-99b7407c9a75.gif',
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-varnish-d238d99d5129.jpg',
        'quest-wolf-spirit-totem-5caf4ed27aff.jpg',
        'quest-necklace-of-valakas-heroicon.jpg',
        'quest-ring-of-baium-heroicon.jpg',
        'quest-earring-of-antharas-heroicon.jpg',
        'quest-frintezza-necklace-heroicon.jpg',
        'quests-item-2871-bring-wolf-pelts-animal-skin-5717ae26cb.jpg',
    ].map((item) => item.toLowerCase())
);

const QUEST_GUIDE_STEP_ICON_OVERRIDES = {
    'quest-baby-cougar': [
        'quest-cougar-chime-e3f5cbb1d2a3.jpg',
        'quest-animals-44d00f8a382e.png',
        'quest-animals-44d00f8a382e.png',
        'quest-ticket-red-ddc7da4d404b.jpg',
        'quest-cougar-chime-e3f5cbb1d2a3.jpg',
        'quest-cougar-chime-e3f5cbb1d2a3.jpg',
    ],
    'quest-baby-buffalo': [
        'quest-buffalo-panpipe-0e16ed14b059.jpg',
        'quest-animals-44d00f8a382e.png',
        'quest-animals-44d00f8a382e.png',
        'quest-buffalo-panpipe-0e16ed14b059.jpg',
        'quest-ticket-blue-044e9428a3fa.jpg',
        'quest-buffalo-panpipe-0e16ed14b059.jpg',
    ],
    'quest-baby-kookabura': [
        'Квест на Птицу (Baby Kookaburra).jpg',
        'quest-animals-44d00f8a382e.png',
        'quest-animals-44d00f8a382e.png',
        'quest-ticket-35e5da3abb2a.jpg',
        'quest-ticket-8c13828b60cd.jpg',
        'Квест на Птицу (Baby Kookaburra).jpg',
    ],
    'quest-dragonflute': [
        'quest-fairy-372e0cf0a19d.png',
        'quest-fairy-372e0cf0a19d.png',
        'quest-fairy-372e0cf0a19d.png',
        'quest-dragon-egg1-1ab6a593fac5.jpg',
        'quest-dragon-flute-019afeae9707.jpg',
        'quest-dragon-egg1-1ab6a593fac5.jpg',
        'quest-dragon-flute-019afeae9707.jpg',
    ],
    'quest-dragon-bugle': [
        'quest-dragon-egg1-1ab6a593fac5.jpg',
        'quest-bugle-6ab8ff772a5c.jpg',
        'quest-bugle-6ab8ff772a5c.jpg',
        'quest-dragon-egg1-1ab6a593fac5.jpg',
        'quest-bugle-6ab8ff772a5c.jpg',
        'quest-bugle-6ab8ff772a5c.jpg',
    ],
    'noblesse-quest': [
        'quest-badge-silver-c582ce5ea114.jpg',
        'quest-badge-gold-45a51eedfcf7.jpg',
        'quest-rune-castle-cc2daa59c957.jpg',
        'quest-oil-pot-white-fc2aae62f726.jpg',
        'quest-protection-of-rune-649a6124cbfb.jpg',
        'quest-protection-of-rune-649a6124cbfb.jpg',
        'quest-noblesse-tiara-2166a0a47d43.jpg',
        'quest-nobless-teleport-coupon-a0dd78932924.jpg',
    ],
    'quest-wolf-collar': [
        'quest-wolf-spirit-totem-5caf4ed27aff.jpg',
        'quest-bella-6f5a181bb24c.jpg',
        'quests-item-2871-bring-wolf-pelts-animal-skin-5717ae26cb.jpg',
        'quests-item-2871-bring-wolf-pelts-animal-skin-5717ae26cb.jpg',
        'quests-item-2871-bring-wolf-pelts-leather-shirt-d1bb630806.jpg',
        'quest-wolf-spirit-totem-5caf4ed27aff.jpg',
        'quest-wolf-spirit-totem-5caf4ed27aff.jpg',
    ],
    'pagan-temple-pass': [
        'quest-rune-castle-cc2daa59c957.jpg',
        'quest-protection-of-rune-649a6124cbfb.jpg',
        'quest-rune-castle-cc2daa59c957.jpg',
        'quest-holy-grail1-65aa38b9d19e.jpg',
        'quest-holy-grail1-65aa38b9d19e.jpg',
        'quest-holy-grail3-f0dde901907c.jpg',
        'quest-holy-grail3-f0dde901907c.jpg',
    ],
    'freya-entry': [
        'quest-seal-of-winter-81d7ba1a7e33.jpg',
        'quest-crystal-cave-145ef44757aa.jpg',
        'quest-crystal-cave-145ef44757aa.jpg',
        'quest-protection-of-rune-649a6124cbfb.jpg',
        'quest-crystal-white-959167afc887.jpg',
        'quest-crystal-white-959167afc887.jpg',
    ],
    'pailaka-devils-legacy': [
        'quest-ancient-legacy-sword-64750e5475fe.jpg',
        'quest-ancient-legacy-sword-64750e5475fe.jpg',
        'quest-baguette-s-dualsword-7276c77bef78.jpg',
        'quest-devil-s-legacy-5271ad1d7dc0.jpg',
        'quest-potion-gold-e610cde97b36.jpg',
        'quest-devil-s-legacy-5271ad1d7dc0.jpg',
        'quest-ancient-legacy-sword-64750e5475fe.jpg',
        'quest-devil-s-legacy-5271ad1d7dc0.jpg',
    ],
    'pailaka-song-fire': [
        'quest-fire-and-water-64d2a497499f.gif',
        'quest-ancient-legacy-sword-64750e5475fe.jpg',
        'quest-fire-and-water-64d2a497499f.gif',
        'quest-baguette-s-dualsword-7276c77bef78.jpg',
        'quest-fire-and-water-64d2a497499f.gif',
        'quest-potion-gold-e610cde97b36.jpg',
        'quest-fire-and-water-64d2a497499f.gif',
        'quest-devil-s-legacy-5271ad1d7dc0.jpg',
    ],
    'transformation-quest': [
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-reagent-white-56a7d2af6bb0.jpg',
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-reagent-white-56a7d2af6bb0.jpg',
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-stone-of-purity-3396d1274a88.jpg',
        'quest-stone-of-purity-3396d1274a88.jpg',
    ],
    'wedding-quest': [
        'quest-formal-wear-7d2703e7891d.jpg',
        'quest-piece-of-cloth-white-62b6688289eb.jpg',
        'quest-craftsman-mold-2ef37ec9522c.jpg',
        'quest-jewel-gold-24700092b166.jpg',
        'quest-formal-wear-7d2703e7891d.jpg',
        'quest-formal-wear-7d2703e7891d.jpg',
        'quest-jewel-gold-24700092b166.jpg',
    ],
};

const resolveQuestArticleInlineIcon = (articleId = '') => {
    const candidate = VISUAL_ARTICLE_IMAGE_MAP[articleId]?.[0]?.inlineIconFileName || VISUAL_ARTICLE_IMAGE_MAP[articleId]?.[0]?.fileName || '';
    return candidate ? resolveLocalAssetPublicPath(candidate) : '';
};

const buildQuestInlineIconHtml = (src, alt) =>
    src ? `<img src="${src}" alt="${escapeHtml(alt || '')}" loading="lazy" class="quest-inline-icon">` : '';

const prependQuestInlineIcon = (text, articleId = '') => {
    const safeText = escapeHtml(text);
    const rule = QUEST_TEXT_ICON_RULES.find(
        (entry) =>
            QUEST_INLINE_ICON_FILES.has(String(entry.fileName || '').toLowerCase()) &&
            (!entry.articleIds || entry.articleIds.includes(articleId)) &&
            entry.pattern.test(text)
    );

    const src = rule ? resolveLocalAssetPublicPath(rule.fileName) : resolveQuestArticleInlineIcon(articleId);

    if (!src) {
        return safeText;
    }

    return `${buildQuestInlineIconHtml(src, text)}${safeText}`;
};

const inferQuestIconDataFromText = (text, articleId = '') => {
    const rule = QUEST_TEXT_ICON_RULES.find(
        (entry) =>
            QUEST_INLINE_ICON_FILES.has(String(entry.fileName || '').toLowerCase()) &&
            (!entry.articleIds || entry.articleIds.includes(articleId)) &&
            entry.pattern.test(String(text || ''))
    );

    const src = rule ? resolveLocalAssetPublicPath(rule.fileName) : resolveQuestArticleInlineIcon(articleId);

    return {
        src,
        alt: src ? normalizeWhitespace(text) : '',
    };
};

const extractQuestEntryMetadata = (text = '') => {
    const normalized = normalizeWhitespace(text);
    const meta = {
        npc: '',
        location: '',
        quantity: '',
        rewardPreview: '',
    };

    const npcMatch =
        normalized.match(/(?:Поговорите|Поговори|Вернитесь|Вернись|Обратитесь|Начните|Возьмите квест)\s+(?:с|к|у)\s+(.+?)(?=\s+(?:в|во|на|около)\b|,|\.|$)/i) ||
        normalized.match(/(?:Принесите|Отнесите|Сдайте)\s+.+?\s+(?:к|NPC)\s+(.+?)(?=,|\.|$)/i) ||
        normalized.match(/(?:Talk to|Speak to|Return to|Meet)\s+(.+?)(?=\s+(?:in|at|near)\b|,|\.|$)/i) ||
        normalized.match(/(?:Bring|Take|Deliver)\s+.+?\s+to\s+(.+?)(?=,|\.|$)/i);

    if (npcMatch?.[1]) {
        meta.npc = normalizeWhitespace(npcMatch[1]);
    }

    const locationMatch =
        normalized.match(/(?:в|во|на|около)\s+(.+?)(?=\s+(?:и|пока|чтобы|получите|убивайте|вернитесь|принесите|соберите)\b|,|\.|$)/i) ||
        normalized.match(/(?:локация|в зоне)\s+(.+?)(?=,|\.|$)/i) ||
        normalized.match(/(?:in|at|near)\s+(.+?)(?=\s+(?:and|until|to|get|kill|return|bring|collect)\b|,|\.|$)/i);

    if (locationMatch?.[1]) {
        meta.location = normalizeWhitespace(locationMatch[1]);
    }

    if (meta.npc && /\s+(?:в|во|на|около|in|at|near)\s+/i.test(meta.npc)) {
        meta.npc = normalizeWhitespace(meta.npc.split(/\s+(?:в|во|на|около|in|at|near)\s+/i)[0]);
    }

    const quantityMatch = normalized.match(/(\d+\s*(?:шт\.?|items?|pieces?|аден[аы]?|adena))/i);

    if (quantityMatch?.[1]) {
        meta.quantity = normalizeWhitespace(quantityMatch[1]);
    }

    const rewardMatch = normalized.match(/получите(?:\s+награду(?:\s+на\s+выбор)?\s*:?\s*|\s+)(.+?)(?=\.|$)/i);

    if (rewardMatch?.[1]) {
        meta.rewardPreview = normalizeWhitespace(rewardMatch[1]);
    }

    return meta;
};

const unwrapSlashWrappedText = (value) => {
    let normalized = normalizeWhitespace(value);

    if (!normalized) {
        return '';
    }

    normalized = normalized.replace(/^\/+\s*/, '').replace(/\s*\/+$/, '');
    return normalizeWhitespace(normalized);
};

const splitSlashSegments = (value) =>
    unwrapSlashWrappedText(value)
        .split(/\s+\/+\s+/)
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean);

const mergeFormulaSegments = (segments = []) =>
    segments.reduce((accumulator, segment) => {
        const normalized = normalizeWhitespace(segment);

        if (!normalized) {
            return accumulator;
        }

        if (accumulator.length && (/^[0-9][0-9.,\s=()+-]*$/.test(normalized) || /^[-+]/.test(normalized))) {
            accumulator[accumulator.length - 1] = `${accumulator[accumulator.length - 1]} / ${normalized}`;
            return accumulator;
        }

        accumulator.push(normalized);
        return accumulator;
    }, []);

const isAllowedPath = (sourcePath) => {
    if (!sourcePath) {
        return false;
    }

    if (
        sourcePath.includes('/component/') ||
        sourcePath.includes('/modules/') ||
        sourcePath.includes('/templates/') ||
        sourcePath.includes('/plugins/') ||
        sourcePath.includes('/media/') ||
        sourcePath.includes('/administrator/') ||
        sourcePath.includes('finder') ||
        sourcePath.includes('search')
    ) {
        return false;
    }

    return ALLOWED_PREFIXES.some((prefix) => sourcePath === prefix || sourcePath.startsWith(`${prefix}/`));
};

const parseArchiveReference = (input) => {
    if (!input) {
        return null;
    }

    const value = String(input).trim().replace(/&amp;/g, '&');

    if (!value) {
        return null;
    }

    const normalizedUrl = value.startsWith('//') ? `https:${value}` : value.startsWith('/web/') ? `https://web.archive.org${value}` : value;
    let archiveUrl = '';
    let originalUrl = '';
    let archivedAt = '';

    const archiveMatch = normalizedUrl.match(/https?:\/\/web\.archive\.org\/web\/(\d+)[^/]*\/(https?:\/\/[^"'#\s]+)/i);

    if (archiveMatch) {
        archivedAt = archiveMatch[1];
        originalUrl = archiveMatch[2];
        archiveUrl = normalizedUrl;
    } else if (/^https?:\/\/(?:www\.)?l2int\.ru\//i.test(normalizedUrl)) {
        originalUrl = normalizedUrl;
        archiveUrl = '';
    } else {
        return null;
    }

    try {
        const parsed = new URL(originalUrl);
        const sourcePath = parsed.pathname.replace(/^\/+|\/+$/g, '');

        if (!isAllowedPath(sourcePath)) {
            return null;
        }

        return {
            archiveUrl,
            originalUrl: `https://www.l2int.ru/${sourcePath}`,
            archivedAt,
            path: sourcePath,
        };
    } catch (error) {
        return null;
    }
};

const extractArchiveReferenceFromHtml = (html) => {
    if (!html) {
        return null;
    }

    const sourceMatch =
        html.match(/__wm\.wombat\("([^"]+)",\s*"(\d+)"/) ||
        html.match(/saved from url=\(\d+\)(https?:\/\/web\.archive\.org\/web\/\d+\/https?:\/\/[^ ]+)/i);

    if (sourceMatch) {
        return parseArchiveReference(sourceMatch[0].includes('__wm.wombat') ? `https://web.archive.org/web/${sourceMatch[2]}/${sourceMatch[1]}` : sourceMatch[1]);
    }

    const baseMatch = html.match(/<base href="https?:\/\/web\.archive\.org\/web\/(\d+)[^"]*\/(https?:\/\/[^"]+)"/i);

    if (baseMatch) {
        return parseArchiveReference(`https://web.archive.org/web/${baseMatch[1]}/${baseMatch[2]}`);
    }

    return null;
};

const readLocalHtmlPages = () =>
    fs
        .readdirSync(COPY_DIR)
        .filter((fileName) => fileName.endsWith('.html'))
        .sort()
        .map((fileName) => {
            const fullPath = path.join(COPY_DIR, fileName);
            const html = fs.readFileSync(fullPath, 'utf8');
            const ref = extractArchiveReferenceFromHtml(html);

            return {
                fileName,
                fullPath,
                html,
                ref,
            };
        })
        .filter((page) => page.ref);

const readCachedArchivePages = () => {
    ensureStorageDirs();

    return fs
        .readdirSync(RAW_DIR)
        .filter((fileName) => fileName.endsWith('.html'))
        .sort()
        .map((fileName) => {
            const fullPath = path.join(RAW_DIR, fileName);
            const html = fs.readFileSync(fullPath, 'utf8');
            const separatorIndex = fileName.lastIndexOf('--');
            const slug = separatorIndex >= 0 ? fileName.slice(0, separatorIndex) : fileName.replace(/\.html$/i, '');
            const ref = extractArchiveReferenceFromHtml(html);
            return {
                slug,
                ref,
                fileName,
                fullPath,
                html,
                relativePath: path.relative(ROOT_DIR, fullPath).split(path.sep).join('/'),
            };
        });
};

const buildArchiveUrl = (ref) => {
    if (!ref) {
        return '';
    }

    if (ref.archiveUrl) {
        return ref.archiveUrl;
    }

    if (ref.originalUrl && ref.archivedAt) {
        return `https://web.archive.org/web/${ref.archivedAt}/${ref.originalUrl}`;
    }

    if (ref.originalUrl) {
        return `https://web.archive.org/web/20220628000000/${ref.originalUrl}`;
    }

    return '';
};

const saveRawSnapshot = (sourcePath, archivedAt, html) => {
    ensureStorageDirs();
    const fileName = `${toSafeFileSlug(sourcePath)}--${archivedAt || 'local'}.html`;
    const fullPath = path.join(RAW_DIR, fileName);
    fs.writeFileSync(fullPath, html, 'utf8');
    return path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');
};

const isQuestSourcePath = (sourcePath = '') => sourcePath === 'quests' || sourcePath.startsWith('quests/');
const shouldPreferLiveFetch = (sourcePath = '') => isAllowedPath(sourcePath) && sourcePath.includes('/');
const shouldUseRichDetailHtml = (sourcePath = '', pageType = '') => pageType === 'detail' && !isQuestSourcePath(sourcePath);

const absolutizeOriginalAssetUrl = (src, archiveRef) => {
    const value = String(src || '').trim();

    if (!value || value.startsWith('data:')) {
        return '';
    }

    if (/^https?:\/\/(?!web\.archive\.org\/web\/)/i.test(value)) {
        return value;
    }

    if (value.startsWith('//')) {
        return `https:${value}`;
    }

    if (/^https?:\/\/web\.archive\.org\/web\/\d+[^/]*\/(https?:\/\/[^"'#\s]+)/i.test(value)) {
        return value.replace(/^https?:\/\/web\.archive\.org\/web\/\d+[^/]*\/(https?:\/\/[^"'#\s]+)$/i, '$1');
    }

    if (value.startsWith('/web/')) {
        const parsed = parseArchiveReference(`https://web.archive.org${value}`);
        return parsed?.originalUrl || '';
    }

    return new URL(value, archiveRef?.originalUrl || 'https://www.l2int.ru/').toString();
};

const absolutizeArchiveAssetUrl = (src, archiveRef) => {
    const value = String(src || '').trim();

    if (!value || value.startsWith('data:')) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('//')) {
        return `https:${value}`;
    }

    if (value.startsWith('/web/')) {
        return `https://web.archive.org${value}`;
    }

    if (value.startsWith('/')) {
        if (archiveRef?.archivedAt) {
            const origin = new URL(archiveRef.originalUrl || 'https://www.l2int.ru/').origin;
            return `https://web.archive.org/web/${archiveRef.archivedAt}im_/${origin}${value}`;
        }

        return new URL(value, archiveRef?.originalUrl || 'https://www.l2int.ru/').toString();
    }

    return new URL(value, archiveRef?.originalUrl || 'https://www.l2int.ru/').toString();
};

const absolutizeArchivePageUrl = (href, archiveRef) => {
    const value = String(href || '').trim();

    if (!value || value.startsWith('#') || /^javascript:/i.test(value) || /^mailto:/i.test(value)) {
        return '';
    }

    if (/^https?:\/\/web\.archive\.org\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/web/')) {
        return `https://web.archive.org${value}`;
    }

    const originalUrl = /^https?:\/\//i.test(value)
        ? value
        : new URL(value, archiveRef?.originalUrl || 'https://www.l2int.ru/').toString();

    return archiveRef?.archivedAt ? `https://web.archive.org/web/${archiveRef.archivedAt}/${originalUrl}` : originalUrl;
};

const mapQuestImageToLocal = (src, archiveRef) => {
    const absoluteUrl = absolutizeArchiveAssetUrl(src, archiveRef);
    const lowerSrc = absoluteUrl.toLowerCase();
    const localMatch = LOCAL_QUEST_ICON_MAP.find(([needle]) => lowerSrc.includes(needle));

    if (localMatch) {
        return encodePublicPath(localMatch[1]);
    }

    return '';
};

const mapQuestImageToRemote = (src, archiveRef) => {
    const absoluteUrl = absolutizeArchiveAssetUrl(src, archiveRef);
    const lowerSrc = absoluteUrl.toLowerCase();
    const remoteMatch = REMOTE_QUEST_ICON_MAP.find(([needle]) => lowerSrc.includes(needle));

    return remoteMatch ? remoteMatch[1] : '';
};

const findExistingMirroredQuestImage = (src, archiveRef) => {
    const absoluteUrl = absolutizeArchiveAssetUrl(src, archiveRef);

    if (!absoluteUrl) {
        return '';
    }

    try {
        const parsedUrl = new URL(absoluteUrl);
        const extension = (path.extname(parsedUrl.pathname).toLowerCase() || '.jpg').replace(/[^a-z0-9.]/gi, '') || '.jpg';
        const safeExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(extension) ? extension : '.jpg';
        const baseName = toSafeFileSlug(path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname))) || 'quest-image';
        const contentHash = crypto.createHash('sha1').update(absoluteUrl).digest('hex').slice(0, 12);
        const fileName = `quest-${baseName}-${contentHash}${safeExtension}`;
        const fullPath = path.join(ARCHIVE_IMAGE_DIR, fileName);

        if (fs.existsSync(fullPath)) {
            return encodePublicPath(path.relative(ROOT_DIR, fullPath));
        }
    } catch (error) {
        return '';
    }

    return '';
};

const buildQuestImageCacheTarget = (absoluteUrl) => {
    if (!absoluteUrl) {
        return null;
    }

    try {
        const parsedUrl = new URL(absoluteUrl);
        const extension = (path.extname(parsedUrl.pathname).toLowerCase() || '.jpg').replace(/[^a-z0-9.]/gi, '') || '.jpg';
        const safeExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(extension) ? extension : '.jpg';
        const baseName = toSafeFileSlug(path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname))) || 'quest-image';
        const contentHash = crypto.createHash('sha1').update(absoluteUrl).digest('hex').slice(0, 12);
        const fileName = `quest-${baseName}-${contentHash}${safeExtension}`;
        const fullPath = path.join(ARCHIVE_IMAGE_DIR, fileName);
        return {
            fullPath,
            publicPath: encodePublicPath(path.relative(ROOT_DIR, fullPath)),
        };
    } catch (error) {
        return null;
    }
};

const downloadQuestImageIfNeeded = async (src, archiveRef) => {
    const primaryUrl = absolutizeOriginalAssetUrl(src, archiveRef);
    const fallbackUrl = absolutizeArchiveAssetUrl(src, archiveRef);
    const candidateUrls = Array.from(new Set([primaryUrl, fallbackUrl].filter(Boolean)));

    for (const absoluteUrl of candidateUrls) {
        const target = buildQuestImageCacheTarget(absoluteUrl);

        if (!target) {
            continue;
        }

        if (fs.existsSync(target.fullPath)) {
            return target.publicPath;
        }

        try {
            const response = await fetch(absoluteUrl, {
                headers: {
                    'User-Agent': 'L2Wiki Quest Importer/1.0',
                    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                },
            });

            if (!response.ok) {
                continue;
            }

            const contentType = String(response.headers.get('content-type') || '').toLowerCase();

            if (!contentType.startsWith('image/')) {
                continue;
            }

            const buffer = Buffer.from(await response.arrayBuffer());

            if (!buffer.length) {
                continue;
            }

            fs.writeFileSync(target.fullPath, buffer);
            return target.publicPath;
        } catch (error) {
            continue;
        }
    }

    return '';
};

const cacheArchiveImagesFromHtml = async (html, archiveRef, sourcePath) => {
    if (!shouldPreferLiveFetch(sourcePath) || !html) {
        return;
    }

    const $ = cheerio.load(html);
    const sources = new Set();

    $('.itemFullText img, .itemintro img, .tb img').each((index, image) => {
        const src = normalizeWhitespace($(image).attr('src') || '');

        if (src) {
            sources.add(src);
        }
    });

    for (const src of sources) {
        await downloadQuestImageIfNeeded(src, archiveRef);
    }
};

const mirrorQuestImageLocally = (src, archiveRef, sourcePath) => {
    const mappedIcon = mapQuestImageToLocal(src, archiveRef);

    if (mappedIcon) {
        return mappedIcon;
    }

    const mappedRemoteIcon = mapQuestImageToRemote(src, archiveRef);

    if (mappedRemoteIcon) {
        return mappedRemoteIcon;
    }

    const mirroredImage = findExistingMirroredQuestImage(src, archiveRef);

    if (mirroredImage) {
        return mirroredImage;
    }

    const originalImage = absolutizeOriginalAssetUrl(src, archiveRef);

    if (originalImage) {
        return originalImage;
    }

    return absolutizeArchiveAssetUrl(src, archiveRef);
};

const normalizeQuestArticles = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article || article.section !== 'quests' || article.layout === 'catalog') {
            return;
        }

        article.layout = 'quest-detail';

        if ((!article.sidebarFacts || !article.sidebarFacts.length) && Array.isArray(article.meta) && article.meta.length) {
            article.sidebarFacts = article.meta.map((fact) => ({ ...fact }));
        }
    });
};

const QUEST_BACKFILL_SKIP_IDS = new Set(['quest-profession-first', 'quest-profession-second', 'quest-profession-third']);

const buildGenericQuestLeadBlocks = (article) => {
    const facts = [...(article.sidebarFacts || []), ...(article.meta || [])];
    const level = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'уровень')?.value || '';
    const startNpc = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'стартовый npc')?.value || '';
    const startLocation = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'стартовая локация')?.value || '';
    const requirements = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'требования')?.value || '';
    const prep = [];

    if (level) {
        prep.push(`Убедитесь, что персонаж соответствует рекомендованному уровню: ${level}.`);
    }

    if (requirements && !/нет требований/i.test(requirements)) {
        prep.push(`Подготовьте все обязательные условия заранее: ${requirements}.`);
    }

    if (startNpc) {
        prep.push(`Стартуйте у NPC ${startNpc} и дочитайте первый диалог до конца, чтобы не пропустить направление маршрута.`);
    }

    if (startLocation) {
        prep.push(`Сразу планируйте телепорт и возврат через ${startLocation}, чтобы не терять темп на лишней беготне.`);
    }

    if (article.id.includes('saga-of-')) {
        prep.push('Для саг заранее держите под рукой Ice Crystal, удобные телепорты в Goddard и готовность к длинному маршруту по Tablet of Vision.');
    }

    if (article.id.includes('law-enforcement')) {
        prep.push('Квест короткий, но лучше проходить его без пауз, пока линия с Kamael-профессией полностью держится в памяти.');
    }

    const leadBlocks = [];

    if (article.summary) {
        leadBlocks.push({
            type: 'prose',
            title: 'О квесте',
            paragraphs: [
                article.summary,
                'Ниже собран локальный подробный маршрут по шагам, чтобы квест читался как цельное прохождение, а не как короткая памятка.',
            ],
        });
    }

    if (prep.length) {
        leadBlocks.push({
            type: 'list',
            title: 'Что подготовить',
            style: 'check',
            items: prep,
        });
    }

    return leadBlocks;
};

const renderQuestHtmlTable = (block) => {
    const columns =
        block.columns?.length
            ? block.columns
            : (block.rows || [])[0]?.cells?.map((cell, index) => ({
                  key: `column-${index + 1}`,
                  label: cell.value || `Колонка ${index + 1}`,
              })) || [];

    if (!columns.length || !(block.rows || []).length) {
        return '';
    }

    const headHtml = columns.map((column) => `<th>${escapeHtml(column.label || '')}</th>`).join('');
    const rowsHtml = (block.rows || [])
        .map((row) => {
            const cellsHtml = (row.cells || [])
                .map((cell) => {
                    const value = escapeHtml(cell.value || '');

                    if (cell.href && /^\/pages\//.test(cell.href)) {
                        return `<td><a href="${cell.href}">${value}</a></td>`;
                    }

                    return `<td>${value}</td>`;
                })
                .join('');

            return `<tr>${cellsHtml}</tr>`;
        })
        .join('');

    return `<div class="wiki-rich-table quest-inline-table"><table><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
};

const renderQuestHtmlFromBlocks = (blocks = [], articleId = '') =>
    blocks
        .map((block, index) => {
            if (!block || block.type === 'media') {
                return '';
            }

            if (block.type === 'prose') {
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    ${(block.paragraphs || []).map((paragraph) => `<p class="quest-paragraph">${prependQuestInlineIcon(paragraph, articleId)}</p>`).join('')}
                `;
            }

            if (block.type === 'steps') {
                return `
                    <h2 class="${index === 0 ? 'quest-section-title' : 'quest-subtitle'}">${escapeHtml(block.title || 'Прохождение квеста')}</h2>
                    <ol class="quest-steps">
                        ${(block.items || []).map((item) => `<li>${prependQuestInlineIcon(item, articleId)}</li>`).join('')}
                    </ol>
                `;
            }

            if (block.type === 'list') {
                const listClass = block.style === 'check' ? 'quest-bullets quest-bullets--check' : 'quest-bullets';
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    <ul class="${listClass}">
                        ${(block.items || []).map((item) => `<li>${prependQuestInlineIcon(item, articleId)}</li>`).join('')}
                    </ul>
                `;
            }

            if (block.type === 'callout') {
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    <blockquote class="quest-note">
                        ${block.text ? `<p class="quest-paragraph">${prependQuestInlineIcon(block.text, articleId)}</p>` : ''}
                        ${
                            block.items?.length
                                ? `<ul class="quest-bullets">${block.items
                                      .map((item) => `<li>${prependQuestInlineIcon(item, articleId)}</li>`)
                                      .join('')}</ul>`
                                : ''
                        }
                    </blockquote>
                `;
            }

            if (block.type === 'table') {
                const tableHtml = renderQuestHtmlTable(block);
                return `${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}${tableHtml}`;
            }

            return '';
        })
        .filter(Boolean)
        .join('');

const createQuestHtmlBlock = (articleId, blocks = []) => {
    const html = renderQuestHtmlFromBlocks(blocks, articleId);

    if (!html) {
        return null;
    }

    return {
        id: `${articleId}-html-backfill`,
        type: 'html',
        title: '',
        html: `<div class="quest-archive quest-archive--compat">${html}</div>`,
    };
};

const applyQuestDetailBackfill = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article || article.section !== 'quests' || article.layout === 'catalog' || QUEST_BACKFILL_SKIP_IDS.has(article.id)) {
            return;
        }

        const manual = manualQuestBackfill[article.id];

        if (!manual && (article.blocks || []).some((block) => block.type === 'html')) {
            return;
        }

        const mediaBlocks = (article.blocks || []).filter((block) => block.type === 'media');
        const sourceBlocks = manual
            ? manual.blocks.map((block, index) => ({
                  id: `${article.id}-manual-${index + 1}`,
                  ...block,
              }))
            : [...buildGenericQuestLeadBlocks(article), ...(article.blocks || []).filter((block) => block.type !== 'media')].map((block, index) => ({
                  id: block.id || `${article.id}-quest-${index + 1}`,
                  ...block,
              }));

        const htmlBlock = createQuestHtmlBlock(article.id, sourceBlocks);

        if (!htmlBlock) {
            return;
        }

        if (manual?.summary) {
            article.summary = manual.summary;
        }

        if (manual?.meta?.length) {
            article.meta = manual.meta.map((fact) => ({ ...fact }));
        }

        if (manual?.sidebarFacts?.length) {
            article.sidebarFacts = manual.sidebarFacts.map((fact) => ({ ...fact }));
        }

        article.blocks = [...mediaBlocks, htmlBlock];
    });
};

const buildQuestGuideEntryFromText = (text, articleId = '') => {
    const normalizedText = normalizeWhitespace(text);

    if (!normalizedText) {
        return null;
    }

    const icon = inferQuestIconDataFromText(normalizedText, articleId);
    const meta = extractQuestEntryMetadata(normalizedText);

    return {
        text: normalizedText,
        html: '',
        iconSrc: icon.src,
        iconAlt: icon.alt,
        quantity: meta.quantity,
        location: meta.location,
        npc: meta.npc,
        rewardPreview: meta.rewardPreview,
        substeps: [],
    };
};

const applyQuestGuideStepIconOverrides = (articleId, questGuide) => {
    const overrides = QUEST_GUIDE_STEP_ICON_OVERRIDES[articleId];

    if (!overrides?.length || !questGuide || !Array.isArray(questGuide.steps)) {
        return questGuide;
    }

    questGuide.steps = questGuide.steps.map((step, index) => {
        const fileName = overrides[index];
        const src = fileName ? resolveLocalAssetPublicPath(fileName) : '';

        if (!src) {
            return step;
        }

        return {
            ...step,
            iconSrc: src,
            iconAlt: normalizeWhitespace(step?.text || questGuide.title || articleId),
        };
    });

    return questGuide;
};

const detectQuestGuideSection = (title = '') => {
    const normalized = normalizeWhitespace(title).toLowerCase();

    if (!normalized) {
        return '';
    }

    if (/что подготов|подготовить|prepare/.test(normalized)) {
        return 'prep';
    }

    if (/прохожд|пошагов|walkthrough|guide/.test(normalized)) {
        return 'steps';
    }

    if (/наград|результат|reward/.test(normalized)) {
        return 'rewards';
    }

    if (/полезн|заметк|tips|notes/.test(normalized)) {
        return 'notes';
    }

    if (/о квесте|кратко|about/.test(normalized)) {
        return 'overview';
    }

    return '';
};

const buildQuestGuideEntryFromNode = ($, $node, articleId = '') => {
    const $item = $node.clone();
    const nestedLists = $item.children('ol, ul').toArray();
    const substeps = nestedLists.flatMap((list) => parseQuestGuideEntriesFromList($, $(list), articleId));

    nestedLists.forEach((list) => {
        $(list).remove();
    });

    const firstImage = $item.find('img').first();
    const text = normalizeWhitespace($item.text());
    const html = String($item.html() || '').trim();
    const inferredIcon = inferQuestIconDataFromText(text, articleId);
    const meta = extractQuestEntryMetadata(text);
    const iconSrc = String(firstImage.attr('src') || inferredIcon.src || '').trim();
    const iconAlt = normalizeWhitespace(firstImage.attr('alt') || firstImage.attr('title') || inferredIcon.alt || text);

    if (!text && !html && !substeps.length) {
        return null;
    }

    return {
        text,
        html,
        iconSrc,
        iconAlt,
        quantity: meta.quantity,
        location: meta.location,
        npc: meta.npc,
        rewardPreview: meta.rewardPreview,
        substeps,
    };
};

const parseQuestGuideEntriesFromList = ($, $list, articleId = '') =>
    $list
        .children('li')
        .toArray()
        .map((item) => buildQuestGuideEntryFromNode($, $(item), articleId))
        .filter(Boolean);

const convertQuestBlocksToQuestGuide = (article, heroMedia = []) => {
    const overviewParagraphs = [];
    const prepItems = [];
    const steps = [];
    const rewards = [];
    const notes = [];

    (article.blocks || []).forEach((block) => {
        if (!block || block.type === 'media' || block.type === 'html' || block.type === 'questGuide') {
            return;
        }

        const sectionKey = detectQuestGuideSection(block.title || '');

        if (block.type === 'prose') {
            const target = sectionKey === 'notes' ? notes : overviewParagraphs;
            (block.paragraphs || []).map((item) => normalizeWhitespace(item)).filter(Boolean).forEach((item) => target.push(item));
            return;
        }

        if (block.type === 'steps') {
            (block.items || []).map((item) => buildQuestGuideEntryFromText(item, article.id)).filter(Boolean).forEach((item) => steps.push(item));
            return;
        }

        if (block.type === 'list') {
            const entries = (block.items || []).map((item) => buildQuestGuideEntryFromText(item, article.id)).filter(Boolean);

            if (sectionKey === 'rewards') {
                rewards.push(...entries);
                return;
            }

            if (sectionKey === 'notes') {
                entries.forEach((entry) => {
                    if (entry.text) {
                        notes.push(entry.text);
                    }
                });
                return;
            }

            if (sectionKey === 'steps') {
                steps.push(...entries);
                return;
            }

            prepItems.push(...entries);
            return;
        }

        if (block.type === 'callout') {
            const calloutItems = [block.text || '', ...(block.items || [])].map((item) => normalizeWhitespace(item)).filter(Boolean);

            if (sectionKey === 'rewards') {
                calloutItems.map((item) => buildQuestGuideEntryFromText(item, article.id)).filter(Boolean).forEach((item) => rewards.push(item));
                return;
            }

            if (sectionKey === 'notes' || !sectionKey) {
                calloutItems.forEach((item) => notes.push(item));
                return;
            }

            calloutItems.forEach((item) => overviewParagraphs.push(item));
        }
    });

    if (!overviewParagraphs.length && article.summary) {
        overviewParagraphs.push(normalizeWhitespace(article.summary));
    }

    return {
        id: 'quest-guide',
        type: 'questGuide',
        title: '',
        heroMedia,
        overviewParagraphs,
        prepItems,
        steps,
        rewards,
        notes,
        relatedQuestIds: [...(article.related || [])],
    };
};

const convertQuestHtmlToQuestGuide = (article, htmlBlock, heroMedia = []) => {
    const $ = cheerio.load(`<div class="quest-guide-root">${htmlBlock.html || ''}</div>`);
    const $root = $('.quest-archive').first().length ? $('.quest-archive').first() : $('.quest-guide-root').first();
    const overviewParagraphs = article.summary ? [normalizeWhitespace(article.summary)] : [];
    const prepItems = [];
    const steps = [];
    const rewards = [];
    const notes = [];
    const $stepsHeading = $root.find('h2, h3, h4').filter((index, node) => /прохожд/i.test(normalizeWhitespace($(node).text()))).first();
    const $mainSteps = $stepsHeading.length ? $stepsHeading.nextAll('ol').first() : $root.children('ol').first();

    if ($stepsHeading.length) {
        $stepsHeading.prevAll('p').toArray().reverse().forEach((paragraph) => {
            const text = normalizeWhitespace($(paragraph).text());

            if (text && !overviewParagraphs.includes(text)) {
                overviewParagraphs.push(text);
            }
        });
    }

    if ($mainSteps.length) {
        parseQuestGuideEntriesFromList($, $mainSteps, article.id).forEach((entry) => steps.push(entry));
    }

    const collectRewardsFromEntries = (entries = []) => {
        entries.forEach((entry) => {
            if (entry.substeps?.length && /получите наград|награду на выбор|получите в награду/i.test(`${entry.text || ''} ${entry.html || ''}`)) {
                entry.substeps.forEach((substep) => {
                    rewards.push({
                        ...substep,
                        substeps: [],
                    });
                });
            }

            if (entry.substeps?.length) {
                collectRewardsFromEntries(entry.substeps);
            }
        });
    };

    collectRewardsFromEntries(steps);

    if ($mainSteps.length) {
        let $cursor = $mainSteps.next();
        let currentSection = '';

        while ($cursor.length) {
            const tagName = $cursor.get(0)?.name?.toLowerCase?.() || '';

            if (/^h[1-6]$/.test(tagName)) {
                currentSection = detectQuestGuideSection($cursor.text());
                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'blockquote') {
                const quoteText = normalizeWhitespace($cursor.text());

                if (quoteText) {
                    notes.push(quoteText);
                }

                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'p' && currentSection !== 'rewards') {
                const noteText = normalizeWhitespace($cursor.text());

                if (noteText) {
                    notes.push(noteText);
                }

                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'ul' && currentSection === 'rewards') {
                parseQuestGuideEntriesFromList($, $cursor, article.id).forEach((entry) => rewards.push(entry));
                $cursor = $cursor.next();
                continue;
            }

            $cursor = $cursor.next();
        }
    }

    return {
        id: 'quest-guide',
        type: 'questGuide',
        title: '',
        heroMedia,
        overviewParagraphs,
        prepItems,
        steps,
        rewards,
        notes,
        relatedQuestIds: [...(article.related || [])],
    };
};

const convertQuestHtmlToQuestGuideV2 = (article, htmlBlock, heroMedia = []) => {
    const $ = cheerio.load(`<div class="quest-guide-root">${htmlBlock.html || ''}</div>`);
    const $root = $('.quest-archive').first().length ? $('.quest-archive').first() : $('.quest-guide-root').first();
    const overviewParagraphs = article.summary ? [normalizeWhitespace(article.summary)] : [];
    const prepItems = [];
    const steps = [];
    const rewards = [];
    const notes = [];

    const appendEntriesToSection = (entries = [], sectionKey = '') => {
        if (!entries.length) {
            return;
        }

        if (sectionKey === 'rewards') {
            rewards.push(...entries);
            return;
        }

        if (sectionKey === 'prep') {
            prepItems.push(...entries);
            return;
        }

        if (sectionKey === 'notes') {
            entries.forEach((entry) => {
                if (entry.text) {
                    notes.push(entry.text);
                }
            });
            return;
        }

        if (sectionKey === 'overview') {
            entries.forEach((entry) => {
                if (entry.text && !overviewParagraphs.includes(entry.text)) {
                    overviewParagraphs.push(entry.text);
                }
            });
            return;
        }

        steps.push(...entries);
    };

    const consumeSectionNodes = (nodes = [], sectionKey = '') => {
        nodes.forEach((node) => {
            const $node = $(node);
            const tagName = String(node?.name || '').toLowerCase();

            if (!tagName) {
                return;
            }

            if (tagName === 'blockquote') {
                const quoteText = normalizeWhitespace($node.text());

                if (quoteText) {
                    notes.push(quoteText);
                }

                return;
            }

            if (tagName === 'ol' || tagName === 'ul') {
                appendEntriesToSection(parseQuestGuideEntriesFromList($, $node, article.id), sectionKey);
                return;
            }

            if (tagName === 'p' || tagName === 'div') {
                const entry = buildQuestGuideEntryFromNode($, $node, article.id);

                if (!entry) {
                    return;
                }

                appendEntriesToSection([entry], sectionKey);
            }
        });
    };

    const $headings = $root.find('h2, h3, h4');
    const $stepsHeading = $headings.filter((index, node) => detectQuestGuideSection($(node).text()) === 'steps').first();
    const $mainSteps = $stepsHeading.length ? $stepsHeading.nextAll('ol').first() : $root.children('ol').first();

    if ($headings.length) {
        $headings.each((index, heading) => {
            const $heading = $(heading);
            const sectionKey = detectQuestGuideSection($heading.text()) || (index === 0 && !$stepsHeading.length ? 'steps' : '');
            const sectionNodes = $heading.nextUntil('h2, h3, h4').toArray();

            if (!sectionKey || !sectionNodes.length) {
                return;
            }

            consumeSectionNodes(sectionNodes, sectionKey);
        });
    }

    if (!steps.length && $stepsHeading.length) {
        $stepsHeading.prevAll('p').toArray().reverse().forEach((paragraph) => {
            const text = normalizeWhitespace($(paragraph).text());

            if (text && !overviewParagraphs.includes(text)) {
                overviewParagraphs.push(text);
            }
        });
    }

    if (!steps.length && $mainSteps.length) {
        parseQuestGuideEntriesFromList($, $mainSteps, article.id).forEach((entry) => steps.push(entry));
    }

    const collectRewardsFromEntries = (entries = []) => {
        entries.forEach((entry) => {
            if (entry.substeps?.length && /получите наград|награду на выбор|получите в награду/i.test(`${entry.text || ''} ${entry.html || ''}`)) {
                entry.substeps.forEach((substep) => {
                    rewards.push({
                        ...substep,
                        substeps: [],
                    });
                });
            }

            if (entry.substeps?.length) {
                collectRewardsFromEntries(entry.substeps);
            }
        });
    };

    collectRewardsFromEntries(steps);

    if ($mainSteps.length && !notes.length) {
        let $cursor = $mainSteps.next();
        let currentSection = '';

        while ($cursor.length) {
            const tagName = $cursor.get(0)?.name?.toLowerCase?.() || '';

            if (/^h[1-6]$/.test(tagName)) {
                currentSection = detectQuestGuideSection($cursor.text());
                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'blockquote') {
                const quoteText = normalizeWhitespace($cursor.text());

                if (quoteText) {
                    notes.push(quoteText);
                }

                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'p' && currentSection !== 'rewards') {
                const noteText = normalizeWhitespace($cursor.text());

                if (noteText) {
                    notes.push(noteText);
                }

                $cursor = $cursor.next();
                continue;
            }

            if (tagName === 'ul' && currentSection === 'rewards') {
                parseQuestGuideEntriesFromList($, $cursor, article.id).forEach((entry) => rewards.push(entry));
                $cursor = $cursor.next();
                continue;
            }

            $cursor = $cursor.next();
        }
    }

    return {
        id: 'quest-guide',
        type: 'questGuide',
        title: '',
        heroMedia,
        overviewParagraphs,
        prepItems,
        steps,
        rewards,
        notes,
        relatedQuestIds: [...(article.related || [])],
    };
};

const normalizeQuestGuideArticles = (database) => {
    const mergeQuestGuideEntries = (existing = [], additions = []) => {
        const merged = [];
        const seen = new Set();

        [...existing, ...additions].forEach((entry) => {
            if (!entry) {
                return;
            }

            const key = normalizeWhitespace(entry.text || entry.html || '');

            if (!key || seen.has(key)) {
                return;
            }

            seen.add(key);
            merged.push(entry);
        });

        return merged;
    };

    const mergeQuestNotes = (existing = [], additions = []) => {
        const merged = [];
        const seen = new Set();

        [...existing, ...additions].forEach((note) => {
            const normalized = normalizeWhitespace(note);

            if (!normalized || seen.has(normalized)) {
                return;
            }

            seen.add(normalized);
            merged.push(normalized);
        });

        return merged;
    };

    const buildPrepFallback = (article) => {
        const facts = [...(article.sidebarFacts || []), ...(article.meta || [])];
        const entries = [];
        const level = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'уровень')?.value || '';
        const requirements = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'требования')?.value || '';
        const startNpc = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'стартовый npc')?.value || '';
        const startLocation = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'стартовая локация')?.value || '';

        if (level) {
            entries.push(buildQuestGuideEntryFromText(`Проверьте рекомендуемый уровень персонажа перед стартом: ${level}.`, article.id));
        }

        if (requirements && !/нет требований/i.test(requirements)) {
            entries.push(buildQuestGuideEntryFromText(`Подготовьте все обязательные условия заранее: ${requirements}.`, article.id));
        }

        if (startNpc) {
            entries.push(buildQuestGuideEntryFromText(`Начните маршрут у NPC ${startNpc} и не пропускайте стартовый диалог.`, article.id));
        }

        if (startLocation) {
            entries.push(buildQuestGuideEntryFromText(`Сразу подготовьте удобный телепорт и возврат через ${startLocation}.`, article.id));
        }

        return entries.filter(Boolean);
    };

    const buildNotesFallback = (article) => {
        const facts = [...(article.sidebarFacts || []), ...(article.meta || [])];
        const notes = [];
        const startNpc = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'ÑÑ‚Ð°Ñ€Ñ‚Ð¾Ð²Ñ‹Ð¹ npc')?.value || '';
        const startLocation = facts.find((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'ÑÑ‚Ð°Ñ€Ñ‚Ð¾Ð²Ð°Ñ Ð»Ð¾ÐºÐ°Ñ†Ð¸Ñ')?.value || '';

        if (startNpc) {
            notes.push(`Если шаги сбились, ориентируйтесь на стартового NPC: ${startNpc}. Обычно он же подсказывает следующую ветку маршрута в диалоге.`);
        }

        if (startLocation) {
            notes.push(`Держите под рукой быстрый возврат в ${startLocation}, чтобы быстрее закрывать промежуточные этапы и сдачу задания.`);
        }

        if (article.related?.length) {
            notes.push('Если это часть длинной цепочки, проверьте связанные материалы внизу страницы и убедитесь, что предыдущий этап уже завершен.');
        }

        return notes;
    };

    const buildRewardsFallback = (questGuide) => {
        const rewards = [];

        (questGuide.steps || []).forEach((step) => {
            if (!/получите наград|награду на выбор|получите в награду|на выбор/i.test(`${step.text || ''} ${step.html || ''}`)) {
                return;
            }

            (step.substeps || []).forEach((substep) => {
                rewards.push({
                    ...substep,
                    substeps: [],
                });
            });
        });

        return rewards;
    };

    Object.values(database.articles).forEach((article) => {
        if (!article || article.section !== 'quests' || article.layout === 'catalog') {
            return;
        }

        const hasSourceQuestHtml =
            String(article.source?.path || '').startsWith('quests/') &&
            (article.blocks || []).some((block) => block.type === 'html' && block.html);

        if (hasSourceQuestHtml) {
            return;
        }

        const heroMedia = (article.blocks || [])
            .filter((block) => block.type === 'media')
            .flatMap((block) => block.items || [])
            .map((item) => ({
                src: item.src || '',
                alt: item.alt || item.caption || article.title,
                caption: item.caption || '',
            }))
            .filter((item) => isSuitableHeroMediaItem(item))
            .filter((item) => item.src);

        const existingQuestGuide = (article.blocks || []).find((block) => block.type === 'questGuide');

        if (existingQuestGuide) {
            existingQuestGuide.heroMedia = (existingQuestGuide.heroMedia || []).filter((item) => isSuitableHeroMediaItem(item));
            existingQuestGuide.heroMedia = existingQuestGuide.heroMedia.length ? existingQuestGuide.heroMedia : heroMedia;
            existingQuestGuide.overviewParagraphs = mergeQuestNotes(existingQuestGuide.overviewParagraphs || [], [article.summary || '']);
            existingQuestGuide.prepItems = mergeQuestGuideEntries(existingQuestGuide.prepItems || [], buildPrepFallback(article));
            existingQuestGuide.notes = mergeQuestNotes(existingQuestGuide.notes || [], buildNotesFallback(article));

            if (!(existingQuestGuide.rewards || []).length) {
                existingQuestGuide.rewards = buildRewardsFallback(existingQuestGuide);
            }

            existingQuestGuide.relatedQuestIds = existingQuestGuide.relatedQuestIds?.length ? existingQuestGuide.relatedQuestIds : [...(article.related || [])];
            article.blocks = [applyQuestGuideStepIconOverrides(article.id, existingQuestGuide)];
            return;
        }

        const htmlBlock = (article.blocks || []).find((block) => block.type === 'html' && block.html);
        const questGuide = htmlBlock ? convertQuestHtmlToQuestGuideV2(article, htmlBlock, heroMedia) : convertQuestBlocksToQuestGuide(article, heroMedia);

        if (!questGuide || !(questGuide.steps || []).length) {
            return;
        }

        if (!(questGuide.overviewParagraphs || []).length && article.summary) {
            questGuide.overviewParagraphs = [normalizeWhitespace(article.summary)].filter(Boolean);
        }

        questGuide.prepItems = mergeQuestGuideEntries(questGuide.prepItems || [], buildPrepFallback(article));

        if (!(questGuide.rewards || []).length) {
            questGuide.rewards = buildRewardsFallback(questGuide);
        }

        if (!(questGuide.rewards || []).length) {
            questGuide.rewards = [
                buildQuestGuideEntryFromText(
                    'Вернитесь к стартовому NPC и завершите цепочку, чтобы получить финальную награду этого квеста на вашем сервере.',
                    article.id
                ),
            ].filter(Boolean);
        }

        questGuide.notes = mergeQuestNotes(
            questGuide.notes || [],
            buildNotesFallback(article).concat(
                !(questGuide.notes || []).length
                    ? ['Проверяйте журнал задания после каждого разговора с NPC и держите под рукой быстрый возврат к стартовой локации.']
                    : []
            )
        );

        article.blocks = [applyQuestGuideStepIconOverrides(article.id, questGuide)];
    });
};

const createVisualMediaBlock = (articleId, mediaConfig = []) => {
    const items = mediaConfig
        .map((item, index) => {
            const src = item.src || resolveLocalAssetPublicPath(item.fileName);

            if (!src) {
                return null;
            }

            return {
                id: `${articleId}-visual-${index + 1}`,
                src,
                alt: item.alt || item.caption || 'Lineage II',
                caption: item.caption || '',
            };
        })
        .filter((item) => isSuitableHeroMediaItem(item))
        .filter(Boolean);

    if (!items.length) {
        return null;
    }

    return {
        id: `${articleId}-visual-media`,
        type: 'media',
        title: '',
        items,
    };
};

const resolveVisualMediaConfig = (article) => {
    if (!article) {
        return [];
    }

    const specific = VISUAL_ARTICLE_IMAGE_MAP[article.id];

    if (specific?.length) {
        return specific;
    }

    const sourcePath = String(article.source?.path || '');
    const inspect = `${article.title || ''} ${sourcePath}`.toLowerCase();

    if (sourcePath.startsWith('monster/item/') && /zaken/i.test(inspect)) {
        return [
            {
                fileName: 'quest-zaken-9950972b4d07.jpg',
                caption: `${article.title}: эпик-босс, связанный контент и полезные материалы.`,
            },
        ];
    }

    return [];
};

const addVisualMediaBlocks = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article || (article.blocks || []).some((block) => block.type === 'media')) {
            return;
        }

        const visualBlock = createVisualMediaBlock(article.id, resolveVisualMediaConfig(article));

        if (!visualBlock) {
            return;
        }

        article.blocks = [visualBlock, ...(article.blocks || [])];
    });
};

const isGenericVisualMediaBlock = (block) =>
    block?.type === 'media' &&
    (block.items || []).some((item) => {
        const src = String(item.src || '');
        return src.includes('/assets/img/home/card-');
    });

const looksLikeFormulaBlob = (value = '') => {
    const normalized = normalizeWhitespace(value);
    const segments = splitSlashSegments(normalized);

    if (segments.length < 3) {
        return false;
    }

    return /Crystal|Soulshot|Spiritshot|Adena|Recipe|Купите|магазине|формул|крафт|стоим/i.test(normalized);
};

const sanitizeTableRows = (rows = []) =>
    rows
        .map((row) => ({
            ...row,
            title: unwrapSlashWrappedText(row.title || ''),
            cells: (row.cells || []).map((cell) => ({
                ...cell,
                value: unwrapSlashWrappedText(cell.value || ''),
            })),
        }))
        .filter((row) => row.cells.some((cell) => normalizeWhitespace(cell.value)));

const sanitizeCraftFormulaBlock = (block) => {
    const rawParts = [block.title || '', block.text || '', ...(block.paragraphs || []), ...(block.items || [])];
    const segments = mergeFormulaSegments(rawParts.flatMap((part) => splitSlashSegments(part)));

    if (!segments.length) {
        return null;
    }

    const [lead, ...rest] = segments;
    return {
        ...block,
        type: 'callout',
        title: 'Торговля и расчет',
        tone: 'info',
        text: lead || '',
        items: rest,
    };
};

const sanitizeTerritorySkillBlock = (block) => {
    const paragraph = normalizeWhitespace(block.paragraphs?.[0] || '');
    const match = paragraph.match(/^Скилл территории:\s*(.+)$/i);

    if (!match) {
        return null;
    }

    const stats = splitSlashSegments(match[1]);

    if (!stats.length) {
        return null;
    }

    return {
        ...block,
        type: 'callout',
        title: 'Скилл территории',
        tone: 'info',
        text: '',
        items: stats,
    };
};

const sanitizeArticleBlock = (article, block) => {
    if (!block || block.type === 'html' || block.type === 'media') {
        return block;
    }

    const sanitized = {
        ...block,
        title: unwrapSlashWrappedText(block.title || ''),
    };

    if (sanitized.type === 'prose') {
        sanitized.paragraphs = (block.paragraphs || []).map((paragraph) => unwrapSlashWrappedText(paragraph)).filter(Boolean);
        const territorySkillBlock = sanitizeTerritorySkillBlock(sanitized);
        if (territorySkillBlock) {
            return territorySkillBlock;
        }
    }

    if (sanitized.type === 'list' || sanitized.type === 'steps') {
        sanitized.items = (block.items || []).map((item) => unwrapSlashWrappedText(item)).filter(Boolean);
    }

    if (sanitized.type === 'callout') {
        sanitized.text = unwrapSlashWrappedText(block.text || '');
        sanitized.items = (block.items || []).map((item) => unwrapSlashWrappedText(item)).filter(Boolean);

        if (looksLikeFormulaBlob([block.title, block.text, ...(block.items || [])].join(' '))) {
            return sanitizeCraftFormulaBlock({
                ...sanitized,
                paragraphs: block.paragraphs || [],
            });
        }

        if (!sanitized.title && sanitized.text) {
            const infoSegments = splitSlashSegments(sanitized.text);

            if (infoSegments.length > 1) {
                sanitized.text = infoSegments[0];
                sanitized.items = [...infoSegments.slice(1), ...sanitized.items];
            }
        }
    }

    if (sanitized.type === 'table') {
        sanitized.rows = sanitizeTableRows(block.rows || []);
        sanitized.columns = block.columns || [];
    }

    return sanitized;
};

const sanitizeImportedContent = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article) {
            return;
        }

        article.summary = unwrapSlashWrappedText(article.summary || '');
        article.blocks = (article.blocks || [])
            .map((block) => sanitizeArticleBlock(article, block))
            .filter((block) => {
                if (!block) {
                    return false;
                }

                if (block.type === 'prose') {
                    return (block.paragraphs || []).length > 0;
                }

                if (block.type === 'list' || block.type === 'steps') {
                    return (block.items || []).length > 0;
                }

                if (block.type === 'callout') {
                    return Boolean(block.text || (block.items || []).length);
                }

                if (block.type === 'table') {
                    return (block.rows || []).length > 0;
                }

                return true;
            });
    });
};

const pruneIrrelevantMediaBlocks = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article) {
            return;
        }

        const isSourceBackedQuest = article.section === 'quests' && String(article.source?.path || '').startsWith('quests/');

        article.blocks = (article.blocks || []).filter((block) => {
            if (isSourceBackedQuest && block?.type === 'media') {
                return false;
            }

            return !isGenericVisualMediaBlock(block);
        });
    });
};

const sanitizeMediaBlocks = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article) {
            return;
        }

        article.blocks = (article.blocks || [])
            .map((block) => {
                if (block?.type !== 'media') {
                    return block;
                }

                const items = (block.items || []).filter((item) => isSuitableHeroMediaItem(item));

                if (!items.length) {
                    return null;
                }

                return {
                    ...block,
                    items,
                };
            })
            .filter(Boolean);
    });

    Object.values(database.sections).forEach((section) => {
        if (!section) {
            return;
        }

        section.landingBlocks = (section.landingBlocks || [])
            .map((block) => {
                if (block?.type !== 'media') {
                    return block;
                }

                const items = (block.items || []).filter((item) => isSuitableHeroMediaItem(item));

                if (!items.length) {
                    return null;
                }

                return {
                    ...block,
                    items,
                };
            })
            .filter(Boolean);
    });
};

const findContentRoot = ($, pageType) => {
    if (pageType === 'detail') {
        return $('.itemFullText').first();
    }

    return $('#k2Container').first();
};

const cleanupContainer = ($root) => {
    $root.find('script, style, noscript, iframe, .itemToolbar, .itemNavigation, .itemBackToTop, .clr').remove();
    $root.find('[id*="yandex"], [class*="yandex"], [class*="advert"], [class*="ads"], [class*="banner"]').remove();
};

const DETAIL_FACT_LABEL_PATTERN = /уровень|раса|агрессивный|количество|hp|mp|exp|sp|тип|уров\./i;

const extractFactsFromTable = ($, $table) => {
    const facts = [];

    $table.find('tr').each((index, row) => {
        const $cells = $(row).children('th, td');

        if ($cells.length < 2) {
            return;
        }

        const label = normalizeWhitespace($cells.eq(0).text()).replace(/^[^\p{L}\p{N}]+/u, '');
        const value = textWithBreaks($cells.eq(1));

        if (label && value) {
            facts.push({ label, value });
        }
    });

    return facts;
};

const scoreFactTable = (facts = []) =>
    facts.reduce((score, fact) => score + (DETAIL_FACT_LABEL_PATTERN.test(fact.label) ? 3 : 0) + (fact.value && fact.value !== '-' ? 1 : 0), 0);

const unwrapFactTableTarget = ($, $container, $table, preferOuterTable = false) => {
    let $target = $table;

    if (preferOuterTable) {
        $table.parents('table').each((index, parent) => {
            if ($container.find(parent).length) {
                $target = $(parent);
            }
        });
    }

    const wrapper = $target.closest('.tb');
    return wrapper.length ? wrapper : $target;
};

const findDetailFactTable = ($, $container, context = {}) => {
    const primaryTable = $container.find('.tb table').first().length
        ? $container.find('.tb table').first()
        : $container.find('table[align="right"]').first();

    if (primaryTable.length) {
        const facts = extractFactsFromTable($, primaryTable);

        if (facts.length) {
            return {
                facts,
                $removeTarget: unwrapFactTableTarget($, $container, primaryTable),
            };
        }
    }

    const sourcePath = String(context.sourcePath || '');
    const shouldUseFallback = sourcePath.startsWith('npc/') || sourcePath.startsWith('monster/');

    if (!shouldUseFallback) {
        return null;
    }

    let bestMatch = null;

    $container.find('table').each((index, table) => {
        const $table = $(table);
        const facts = extractFactsFromTable($, $table);

        if (!facts.length) {
            return;
        }

        const score = scoreFactTable(facts);

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                score,
                facts,
                $removeTarget: unwrapFactTableTarget($, $container, $table, true),
            };
        }
    });

    return bestMatch && bestMatch.score >= 6 ? bestMatch : null;
};

const parseInfoboxFacts = ($, $container, context = {}) => {
    const match = findDetailFactTable($, $container, context);

    if (!match || !match.facts.length) {
        return [];
    }

    match.$removeTarget.remove();
    return match.facts;
};

const extractMediaItems = ($, $scope, context) =>
    $scope
        .find('img')
        .toArray()
        .map((image) => {
            const $image = $(image);
            const rawSrc = $image.attr('src');

            if (!rawSrc) {
                return null;
            }

            let src = String(rawSrc).trim();

            if (/^(?:\/)?assets\//i.test(src)) {
                return {
                    src: src.startsWith('/') ? src : `/${src}`,
                    alt: normalizeWhitespace($image.attr('alt') || ''),
                    caption: normalizeWhitespace($image.attr('title') || ''),
                };
            }

            if (/^https?:\/\//i.test(src)) {
                return {
                    src,
                    alt: normalizeWhitespace($image.attr('alt') || ''),
                    caption: normalizeWhitespace($image.attr('title') || ''),
                };
            }

            if (context.origin !== 'local-copy') {
                return null;
            }

            const relativeDir = `${path.basename(context.localFileName, '.html')}_files`;
            const cleanedSrc = src.replace(/^\.\//, '');
            const resolved = cleanedSrc.startsWith(`${relativeDir}/`) ? path.join('copy', cleanedSrc) : path.join('copy', relativeDir, cleanedSrc);

            return {
                src: encodePublicPath(resolved),
                alt: normalizeWhitespace($image.attr('alt') || ''),
                caption: normalizeWhitespace($image.attr('title') || ''),
            };
        })
        .filter(Boolean);

const parseTableCell = ($, cell) => {
    const $cell = $(cell);
    const linkRef = parseArchiveReference($cell.find('a').first().attr('href'));
    const value = textWithBreaks($cell);

    return {
        value,
        href: linkRef?.archiveUrl || linkRef?.originalUrl || '',
    };
};

const parseTableBlock = ($, table, explicitTitle = '') => {
    const rows = $(table)
        .find('tr')
        .toArray()
        .map((row) => {
            const $row = $(row);
            const cells = $row.children('th, td').toArray().map((cell) => parseTableCell($, cell));
            const headerLike = $row.children('th').length > 0 || $row.children('td').toArray().every((cell) => $(cell).find('strong').length);

            return {
                headerLike,
                cells,
            };
        })
        .filter((row) => row.cells.length);

    if (!rows.length) {
        return null;
    }

    let title = explicitTitle;
    let workingRows = [...rows];

    if (workingRows[0].cells.length === 1 && workingRows.length > 1) {
        title = title || workingRows[0].cells[0].value;
        workingRows = workingRows.slice(1);
    }

    if (workingRows.length === 1 && workingRows[0].cells.length === 1) {
        return {
            type: 'callout',
            title,
            tone: 'info',
            text: workingRows[0].cells[0].value,
            items: [],
        };
    }

    const longestRowLength = Math.max(...workingRows.map((row) => row.cells.length));
    const headerRow = workingRows[0]?.headerLike ? workingRows[0] : null;
    const columns = (headerRow ? headerRow.cells : Array.from({ length: longestRowLength }, (_, index) => ({ value: `Колонка ${index + 1}` }))).map(
        (cell, index) => ({
            key: `column-${index + 1}`,
            label: cell.value || `Колонка ${index + 1}`,
        })
    );
    const dataRows = (headerRow ? workingRows.slice(1) : workingRows).map((row, rowIndex) => ({
        id: `row-${rowIndex + 1}`,
        cells: Array.from({ length: columns.length }, (_, index) => row.cells[index] || { value: '' }),
    }));

    if (!dataRows.length) {
        return null;
    }

    return {
        type: 'table',
        title,
        compact: true,
        columns,
        rows: dataRows,
    };
};

const prepareQuestHtmlBlock = ($, $container, context) => {
    const $quest = $container.clone();

    // The quest body itself is often wrapped in `.tb`; the infobox is already
    // removed earlier from `$container`, so deleting every `.tb` here strips the
    // walkthrough from a chunk of archive pages (notably saga quests).
    $quest.find('.itemBackToTop').remove();
    $quest.find('a').each((index, anchor) => {
        const $anchor = $(anchor);
        const href = String($anchor.attr('href') || '').trim();

        if (!href) {
            $anchor.replaceWith($anchor.html() || $anchor.text());
            return;
        }

        if (href.startsWith('#')) {
            $anchor
                .attr('href', href)
                .removeAttr('target')
                .removeAttr('rel')
                .removeAttr('onclick')
                .removeAttr('style');
            return;
        }

        const absoluteHref = absolutizeArchivePageUrl(href, context.archiveRef);
        const parsedHref = parseArchiveReference(absoluteHref);

        if (!parsedHref) {
            $anchor.replaceWith($anchor.html() || $anchor.text());
            return;
        }

        $anchor
            .attr('href', absoluteHref)
            .removeAttr('target')
            .removeAttr('rel')
            .removeAttr('onclick')
            .removeAttr('style');
    });

    $quest.find('img').each((index, image) => {
        const $image = $(image);
        const src = mirrorQuestImageLocally($image.attr('src'), context.archiveRef, context.sourcePath);

        if (!src) {
            $image.remove();
            return;
        }

        $image.attr('src', src);
        $image.attr('loading', 'lazy');
        $image.attr('alt', normalizeWhitespace($image.attr('alt') || $image.attr('title') || ''));
        $image.removeAttr('style width height border hspace vspace align class id');
        $image.addClass('quest-inline-icon');
    });

    $quest.find('span').each((index, span) => {
        const $span = $(span);
        const style = String($span.attr('style') || '').toLowerCase();

        if (style.includes('#808080') || style.includes('128, 128, 128')) {
            $span.addClass('quest-muted');
        }

        $span.removeAttr('style');
    });

    $quest.find('h2').each((index, heading) => {
        $(heading).addClass('quest-section-title');
    });

    $quest.find('h4').each((index, heading) => {
        $(heading).addClass('quest-subtitle');
    });

    $quest.find('blockquote').each((index, quote) => {
        $(quote).addClass('quest-note');
    });

    $quest.find('p').each((index, paragraph) => {
        $(paragraph).addClass('quest-paragraph');
    });

    $quest.find('table').each((index, table) => {
        const $table = $(table);
        $table.addClass('quest-inline-table');
        $table.removeAttr('style width height border cellpadding cellspacing align bgcolor');
    });

    $quest.find('ol').each((index, list) => {
        $(list).addClass(index === 0 ? 'quest-steps' : 'quest-substeps');
    });

    $quest.find('ul').each((index, list) => {
        $(list).addClass('quest-bullets');
    });

    $quest.find('*').each((index, node) => {
        const $node = $(node);
        Object.keys(node.attribs || {}).forEach((attribute) => {
            if (!['href', 'src', 'alt', 'title', 'loading', 'class', 'colspan', 'rowspan'].includes(attribute)) {
                $node.removeAttr(attribute);
            }
        });
    });

    $quest.find('p, div, span, strong, em').each((index, node) => {
        const $node = $(node);

        if (!$node.children().length && !normalizeWhitespace($node.text())) {
            $node.remove();
        }
    });

    const html = $quest.html();

    if (!normalizeWhitespace(html)) {
        return null;
    }

    return {
        type: 'html',
        title: '',
        html: `<div class="quest-archive">${html}</div>`,
    };
};

const isExternalNonContentUrl = (href = '') => {
    const value = String(href || '').trim();

    if (!/^https?:\/\//i.test(value)) {
        return false;
    }

    return !/^https?:\/\/(?:web\.archive\.org\/web\/\d+[^/]*\/)?(?:www\.)?l2int\.ru\//i.test(value);
};

const removeRichDetailNoise = ($, $detail) => {
    $detail.find('img').each((index, image) => {
        const $image = $(image);
        const src = String($image.attr('src') || '').toLowerCase();
        const alt = normalizeWhitespace($image.attr('alt') || $image.attr('title') || '').toLowerCase();

        if (src.includes('noscreen') || /скриншот не загружен|реклама/.test(alt)) {
            $image.remove();
        }
    });

    $detail.find('a[href]').each((index, anchor) => {
        const $anchor = $(anchor);
        const href = String($anchor.attr('href') || '').trim();

        if (!isExternalNonContentUrl(href)) {
            return;
        }

        const $block = $anchor.closest('table, div, p, li');

        if ($block.length && ($block.find('img').length || normalizeWhitespace($block.text()).length < 220)) {
            $block.remove();
            return;
        }

        $anchor.replaceWith($anchor.text());
    });

    $detail.find('p, div, li').each((index, node) => {
        const $node = $(node);
        const text = normalizeWhitespace($node.text());

        if (($node.find('img').length || $node.find('a').length) && /реклама|advert/i.test(text)) {
            $node.remove();
        }
    });
};

const prepareRichDetailHtmlBlock = ($, $container, context) => {
    const $detail = $container.clone();

    $detail.find('script, style, iframe, form, .itemBackToTop').remove();
    $detail.find('hr').removeAttr('style');
    removeRichDetailNoise($, $detail);

    $detail.find('a').each((index, anchor) => {
        const $anchor = $(anchor);
        const href = String($anchor.attr('href') || '').trim();

        if (!href) {
            $anchor.replaceWith($anchor.html() || $anchor.text());
            return;
        }

        if (href.startsWith('#')) {
            $anchor
                .attr('href', href)
                .removeAttr('target')
                .removeAttr('rel')
                .removeAttr('onclick')
                .removeAttr('style')
                .addClass('archive-detail__anchor-link');
            return;
        }

        const absoluteHref = absolutizeArchivePageUrl(href, context.archiveRef);
        const parsedHref = parseArchiveReference(absoluteHref);

        if (!parsedHref) {
            $anchor.replaceWith($anchor.html() || $anchor.text());
            return;
        }

        $anchor
            .attr('href', absoluteHref)
            .removeAttr('target')
            .removeAttr('rel')
            .removeAttr('onclick')
            .removeAttr('style');
    });

    $detail.find('img').each((index, image) => {
        const $image = $(image);
        const originalSrc = String($image.attr('src') || '').trim();

        if (/noscreen/i.test(originalSrc)) {
            $image.remove();
            return;
        }

        const src = mirrorQuestImageLocally($image.attr('src'), context.archiveRef, context.sourcePath);

        if (!src) {
            $image.remove();
            return;
        }

        $image.attr('src', src);
        $image.attr('loading', 'lazy');
        $image.attr('alt', normalizeWhitespace($image.attr('alt') || $image.attr('title') || 'Lineage II'));
        $image.removeAttr('style width height border hspace vspace align');
        $image.removeAttr('class');
        $image.addClass('archive-detail__image');
    });

    $detail.find('h1, h2, h3, h4').each((index, heading) => {
        const $heading = $(heading);
        const anchorName = normalizeWhitespace($heading.find('a[name]').first().attr('name') || '');

        if (anchorName && !$heading.attr('id')) {
            $heading.attr('id', anchorName);
        }

        $heading.find('a.anchor').remove();
        $heading.addClass('archive-detail__heading');
    });

    $detail.find('table').each((index, table) => {
        $(table)
            .addClass('archive-detail__table')
            .removeAttr('style width height border cellpadding cellspacing align bgcolor');
    });

    $detail.find('ul.nav-tabs, ol.nav-tabs').each((index, list) => {
        const $list = $(list);
        $list.removeAttr('id').addClass('archive-detail__tabs');
        $list.children('li').addClass('archive-detail__tab-item');
        $list.find('a[href^="#"]').addClass('archive-detail__tab-link').removeAttr('data-toggle');
    });

    $detail.find('.tab-content').each((index, content) => {
        $(content).addClass('archive-detail__tab-content');
    });

    $detail.find('.tab-pane').each((index, pane) => {
        const $pane = $(pane);
        $pane.addClass('archive-detail__tab-pane');

        if (index === 0 && !$detail.find('.tab-pane.active').length) {
            $pane.addClass('active');
        }
    });

    $detail.find('.archive-detail__tab-pane').each((index, pane) => {
        const $pane = $(pane);
        const paneId = normalizeWhitespace($pane.attr('id') || '').toLowerCase();
        const headingText = normalizeWhitespace($pane.find('.archive-detail__heading').first().text()).toLowerCase();
        const isLocationPane = paneId.includes('местонахождение') || headingText.includes('местонахождение');

        if (isLocationPane) {
            $pane.find('img').attr('loading', 'eager').attr('fetchpriority', 'high');
        }
    });

    $detail.find('p').each((index, paragraph) => {
        $(paragraph).addClass('archive-detail__paragraph');
    });

    $detail.find('ul:not(.archive-detail__tabs), ol').each((index, list) => {
        $(list).addClass('archive-detail__list');
    });

    $detail.find('*').each((index, node) => {
        const $node = $(node);
        Object.keys(node.attribs || {}).forEach((attribute) => {
            if (
                ![
                    'href',
                    'src',
                    'alt',
                    'title',
                    'loading',
                    'class',
                    'colspan',
                    'rowspan',
                    'id',
                    'name',
                ].includes(attribute)
            ) {
                $node.removeAttr(attribute);
            }
        });
    });

    const html = $detail.html();

    if (!normalizeWhitespace(html)) {
        return null;
    }

    return {
        type: 'html',
        title: '',
        html: `<div class="archive-detail">${html}</div>`,
    };
};

const extractBlocks = ($, $container, context) => {
    const blocks = [];
    let pendingTitle = '';
    let paragraphs = [];

    const flushProse = () => {
        const cleaned = paragraphs.map((item) => normalizeWhitespace(item)).filter(Boolean);

        if (!cleaned.length) {
            paragraphs = [];
            return;
        }

        blocks.push({
            type: 'prose',
            title: pendingTitle,
            paragraphs: cleaned,
        });

        pendingTitle = '';
        paragraphs = [];
    };

    const consumeNodes = (nodes) => {
        nodes.forEach((node) => {
            if (!node) {
                return;
            }

            if (node.type === 'text') {
                const text = normalizeWhitespace(node.data || '');

                if (text) {
                    paragraphs.push(text);
                }

                return;
            }

            const $node = $(node);
            const tagName = String(node.name || '').toLowerCase();

            if (!tagName || ['script', 'style', 'noscript', 'iframe', 'hr'].includes(tagName)) {
                return;
            }

            if (/^h[2-6]$/.test(tagName)) {
                flushProse();
                const titleText = normalizeWhitespace($node.text());

                if (titleText && titleText !== context.title) {
                    pendingTitle = titleText;
                }

                return;
            }

            if (tagName === 'blockquote') {
                const quoteText = normalizeWhitespace($node.text());

                if (quoteText && quoteText.length < 120) {
                    flushProse();
                    pendingTitle = quoteText;
                    return;
                }
            }

            if (tagName === 'table') {
                flushProse();
                const block = parseTableBlock($, $node, pendingTitle);

                if (block) {
                    blocks.push(block);
                    pendingTitle = '';
                }

                return;
            }

            if (tagName === 'ol' || tagName === 'ul') {
                flushProse();
                const items = $node
                    .children('li')
                    .toArray()
                    .map((item) => normalizeWhitespace($(item).text()))
                    .filter(Boolean);

                if (items.length) {
                    blocks.push({
                        type: tagName === 'ol' ? 'steps' : 'list',
                        title: pendingTitle,
                        style: tagName === 'ol' ? 'ordered' : 'unordered',
                        items,
                    });
                    pendingTitle = '';
                }

                return;
            }

            if (tagName === 'img') {
                flushProse();
                const items = extractMediaItems($, $node, context);

                if (items.length) {
                    blocks.push({
                        type: 'media',
                        title: pendingTitle,
                        items,
                    });
                    pendingTitle = '';
                }

                return;
            }

            if (['div', 'section', 'article'].includes(tagName) && $node.children().length) {
                consumeNodes($node.contents().toArray());
                return;
            }

            const mediaItems = extractMediaItems($, $node, context);
            const text = normalizeWhitespace($node.text());

            if (mediaItems.length && !text) {
                flushProse();
                blocks.push({
                    type: 'media',
                    title: pendingTitle,
                    items: mediaItems,
                });
                pendingTitle = '';
                return;
            }

            if (text) {
                paragraphs.push(text);
            }
        });
    };

    consumeNodes($container.contents().toArray());
    flushProse();

    return blocks.map((block, index) => ({
        id: `${context.idSeed}-block-${index + 1}`,
        ...block,
    }));
};

const extractSummary = (description, blocks) => {
    if (normalizeWhitespace(description)) {
        return normalizeWhitespace(description);
    }

    for (const block of blocks) {
        if (block.type === 'prose' && block.paragraphs?.length) {
            return block.paragraphs[0];
        }

        if ((block.type === 'list' || block.type === 'steps') && block.items?.length) {
            return block.items[0];
        }

        if (block.type === 'callout' && block.text) {
            return block.text;
        }

        if (block.type === 'html' && block.html) {
            return normalizeWhitespace(block.html.replace(/<[^>]+>/g, ' ')).slice(0, 260);
        }
    }

    return '';
};

const extractIntro = (blocks) => {
    const proseBlock = blocks.find((block) => block.type === 'prose' && block.paragraphs?.length);

    if (proseBlock) {
        return proseBlock.paragraphs.slice(0, 3);
    }

    const htmlBlock = blocks.find((block) => block.type === 'html' && block.html);

    if (!htmlBlock) {
        return [];
    }

    const stripped = normalizeWhitespace(htmlBlock.html.replace(/<[^>]+>/g, ' '));
    return stripped ? [stripped.slice(0, 220)] : [];
};

const extractAliases = (title) => {
    const aliases = new Set();
    const cleanedTitle = normalizeWhitespace(title);

    if (cleanedTitle) {
        aliases.add(cleanedTitle.toLowerCase());
    }

    const match = cleanedTitle.match(/^(.*?)\s*\(([^)]+)\)\s*$/);

    if (match) {
        aliases.add(normalizeWhitespace(match[1]).toLowerCase());
        aliases.add(normalizeWhitespace(match[2]).toLowerCase());
    }

    return Array.from(aliases).filter(Boolean);
};

const detectPageType = ($) => ($('.itemView').length ? 'detail' : 'category');

const extractLinks = ($, $root) =>
    $root
        .find('a[href]')
        .toArray()
        .map((anchor) => parseArchiveReference($(anchor).attr('href')))
        .filter(Boolean);

const parsePage = (html, context) => {
    const $ = cheerio.load(html);
    const pageType = detectPageType($);
    const $root = findContentRoot($, pageType);

    if (!$root.length) {
        return null;
    }

    const $container = $root.clone();
    cleanupContainer($container);

    const title = normalizeWhitespace(
        pageType === 'detail' ? $('.itemTitle').first().text() : $('.itemListCategory h2').first().text() || $('h1').first().text()
    );
    const description = normalizeWhitespace($('meta[name="description"]').attr('content') || '');
    const sidebarFacts = pageType === 'detail' ? parseInfoboxFacts($, $container, context) : [];
    const isQuestDetail = pageType === 'detail' && isQuestSourcePath(context.sourcePath);
    const isRichDetail = shouldUseRichDetailHtml(context.sourcePath, pageType);
    const baseContext = {
        ...context,
        title,
        idSeed: toSafeFileSlug(context.sourcePath),
    };
    const blocks = isQuestDetail
        ? [prepareQuestHtmlBlock($, $container, baseContext)].filter(Boolean)
        : isRichDetail
          ? [prepareRichDetailHtmlBlock($, $container, baseContext)].filter(Boolean)
          : extractBlocks($, $container, baseContext);
    const outboundLinks = extractLinks($, $root);

    return {
        pageType,
        title,
        description,
        sidebarFacts,
        blocks,
        outboundLinks,
        layout: isQuestDetail ? 'quest-detail' : pageType === 'detail' ? 'detail' : 'catalog',
    };
};

const parseCdxPayload = (payload) => {
    const text = String(payload || '')
        .replace(/^\uFEFF/, '')
        .trim();

    if (!text) {
        return { rows: [], resumeKey: '' };
    }

    let data = [];

    try {
        data = JSON.parse(text);
    } catch (error) {
        console.warn('[import-archive] failed to parse CDX payload');
        return { rows: [], resumeKey: '' };
    }

    const rows = [];
    let resumeKey = '';

    data.slice(1).forEach((entry) => {
        if (!Array.isArray(entry) || !entry.length) {
            return;
        }

        if (entry.length === 1 && typeof entry[0] === 'string') {
            resumeKey = entry[0];
            return;
        }

        if (entry.length >= 2 && /^\d+$/.test(String(entry[0] || ''))) {
            rows.push(entry);
        }
    });

    return { rows, resumeKey };
};

const fetchCdxArchiveReferences = (urlPattern, maxBatches = 20) => {
    const collected = new Map();
    let resumeKey = '';

    for (let batch = 0; batch < maxBatches; batch += 1) {
        const requestUrl = new URL('https://web.archive.org/cdx/search/cdx');
        requestUrl.searchParams.set('url', urlPattern);
        requestUrl.searchParams.set('output', 'json');
        requestUrl.searchParams.set('fl', 'timestamp,original,statuscode,mimetype');
        requestUrl.searchParams.append('filter', 'statuscode:200');
        requestUrl.searchParams.append('filter', 'mimetype:text/html');
        requestUrl.searchParams.set('limit', '1000');
        requestUrl.searchParams.set('showResumeKey', 'true');

        if (resumeKey) {
            requestUrl.searchParams.set('resumeKey', resumeKey);
        }

        let payload = '';

        try {
            payload = execFileSync('curl.exe', ['-L', '--max-time', '40', requestUrl.toString()], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
                maxBuffer: 64 * 1024 * 1024,
            });
        } catch (error) {
            console.warn('[import-archive] failed to query CDX:', error.message);
            break;
        }

        const parsed = parseCdxPayload(payload);

        parsed.rows.forEach(([timestamp, original]) => {
            const ref = parseArchiveReference(`https://web.archive.org/web/${timestamp}/${original}`);

            if (!ref) {
                return;
            }

            const existing = collected.get(ref.path);

            if (!existing || String(timestamp) > String(existing.archivedAt || '')) {
                collected.set(ref.path, ref);
            }
        });

        if (!parsed.resumeKey) {
            break;
        }

        resumeKey = parsed.resumeKey;
    }

    return Array.from(collected.values());
};

const ensureBlueprints = (database) => {
    Object.entries(SECTION_BLUEPRINTS).forEach(([sectionId, blueprint]) => {
        const existing = database.sections[sectionId] || {
            id: sectionId,
            title: blueprint.title,
            description: blueprint.description,
            stats: [],
            groups: [],
            order: Object.keys(database.sections).length,
            landingLayout: 'catalog',
            landingBlocks: [],
            landingSidebarFacts: [],
            catalogColumns: [],
            catalogRows: [],
        };

        existing.title = existing.title || blueprint.title;
        existing.description = existing.description || blueprint.description;
        existing.landingLayout = existing.landingLayout || 'catalog';
        const existingGroupsById = new Map((existing.groups || []).map((group) => [group.id, group]));
        existing.groups = blueprint.groups.map(([groupId, label, description], index) => ({
            id: groupId,
            label,
            description,
            entries: [],
            order: index,
        }));

        database.sections[sectionId] = existing;
    });
};

const inferSectionGroup = (sourcePath, parents, title) => {
    const parentList = Array.from(parents || []);
    const inspect = `${sourcePath} ${title} ${parentList.join(' ')}`.toLowerCase();

    if (
        sourcePath.startsWith('newbie') ||
        sourcePath.startsWith('pervaya-profa') ||
        sourcePath.startsWith('vtoraya-profa') ||
        sourcePath.startsWith('tretya-profa')
    ) {
        return { section: 'skills', group: 'classes' };
    }

    if (sourcePath.startsWith('skills/tree-skills')) {
        return { section: 'skills', group: 'classes' };
    }

    if (sourcePath.startsWith('skills/fishing-skills')) {
        return { section: 'skills', group: 'fishing' };
    }

    if (sourcePath.startsWith('skills/clan-skills')) {
        return { section: 'skills', group: 'clan' };
    }

    if (sourcePath.startsWith('skills/squad-skills')) {
        return { section: 'skills', group: 'squad' };
    }

    if (sourcePath.startsWith('skills/enchanting-skills')) {
        return { section: 'skills', group: 'upgrade' };
    }

    if (sourcePath.startsWith('guide/item/5487-manor')) {
        return { section: 'guides', group: 'manor' };
    }

    if (sourcePath.startsWith('skills')) {
        return { section: 'skills', group: 'classes' };
    }

    const inferQuestProfessionTier = () => {
        const joinedParents = parentList.join(' ').toLowerCase();

        if (
            sourcePath.includes('fourth-profession') ||
            inspect.includes('fourth-profession') ||
            joinedParents.includes('quests/fourth-profession') ||
            normalizeWhitespace(title) === 'Seize Your Destiny (Преодолеть Рок)'
        ) {
            return 'profession-4';
        }

        if (
            sourcePath.includes('third-profession') ||
            inspect.includes('third-profession') ||
            joinedParents.includes('quests/third-profession')
        ) {
            return 'profession-3';
        }

        if (
            sourcePath.includes('second-profession') ||
            sourcePath.includes('kvesty-na-vtoruyu-professiyu') ||
            inspect.includes('second-profession') ||
            inspect.includes('квесты на вторую профессию') ||
            joinedParents.includes('quests/second-profession')
        ) {
            return 'profession-2';
        }

        if (
            sourcePath.includes('first-profession') ||
            sourcePath.includes('kvesty-na-pervuyu-professiyu') ||
            inspect.includes('first-profession') ||
            inspect.includes('квесты на первую профессию') ||
            joinedParents.includes('quests/first-profession')
        ) {
            return 'profession-1';
        }

        return '';
    };
    const questProfessionTier = inferQuestProfessionTier();

    if (questProfessionTier) {
        return { section: 'quests', group: questProfessionTier };
    }

    if (
        inspect.includes('first-profession') ||
        inspect.includes('second-profession') ||
        inspect.includes('third-profession') ||
        inspect.includes('fourth-profession') ||
        inspect.includes('profession')
    ) {
        return { section: 'quests', group: 'service' };
    }

    if (sourcePath.startsWith('npc')) {
        return { section: 'npc', group: sourcePath === 'npc' ? 'catalog' : 'catalog' };
    }

    if (sourcePath.startsWith('mamon')) {
        return { section: 'npc', group: 'services' };
    }

    if (sourcePath.startsWith('guide')) {
        return { section: 'guides', group: 'core' };
    }

    if (sourcePath.startsWith('predmety')) {
        return { section: 'items', group: 'catalog' };
    }

    if (sourcePath.startsWith('monster')) {
        return { section: 'monsters', group: 'overview' };
    }

    if (sourcePath.startsWith('necropolis-catacombs') || inspect.includes('necropolis')) {
        return {
            section: 'locations',
            group: inspect.includes('catacomb') && !inspect.includes('necropolis') ? 'catacombs' : inspect.includes('necropolis') ? 'necropolis' : 'catacombs',
        };
    }

    if (sourcePath.startsWith('location')) {
        if (inspect.includes('castle')) {
            return { section: 'locations', group: 'castles' };
        }

        if (inspect.includes('catacomb')) {
            return { section: 'locations', group: 'catacombs' };
        }

        if (inspect.includes('necropolis')) {
            return { section: 'locations', group: 'necropolis' };
        }

        return { section: 'locations', group: 'farming' };
    }

    if (sourcePath.startsWith('quests')) {
        return { section: 'quests', group: 'service' };
    }

    return { section: 'misc', group: 'epic' };
};

const findExistingArticleId = (database, pageData, sourcePath) => {
    if (OVERRIDE_IDS_BY_PATH[sourcePath]) {
        return OVERRIDE_IDS_BY_PATH[sourcePath];
    }

    if (OVERRIDE_IDS_BY_TITLE[pageData.title]) {
        return OVERRIDE_IDS_BY_TITLE[pageData.title];
    }

    const existingBySource = Object.values(database.articles).find((article) => article.source?.path === sourcePath);

    if (existingBySource) {
        return existingBySource.id;
    }

    const existingByTitle = Object.values(database.articles).find(
        (article) => normalizeWhitespace(article.title).toLowerCase() === normalizeWhitespace(pageData.title).toLowerCase()
    );

    if (existingByTitle) {
        return existingByTitle.id;
    }

    return normalizeId(`archive-${sourcePath}`);
};

const buildLocalHref = (ref, articlePathMap) => {
    const archiveRef = parseArchiveReference(ref);

    if (!archiveRef) {
        return ref || '';
    }

    const articleId = articlePathMap.get(archiveRef.path);

    if (articleId) {
        return `/pages/article.html?article=${encodeURIComponent(articleId)}`;
    }

    const mapping = inferSectionGroup(archiveRef.path, new Set(), archiveRef.path);

    if (mapping.section) {
        return `/pages/section.html?section=${encodeURIComponent(mapping.section)}`;
    }

    return archiveRef.archiveUrl || archiveRef.originalUrl || ref || '';
};

const rewriteInternalLinks = (database) => {
    const articlePathMap = new Map(
        Object.values(database.articles)
            .filter((article) => article.source?.path)
            .map((article) => [article.source.path, article.id])
    );

    const rewriteRows = (rows = []) =>
        rows.map((row) => ({
            ...row,
            cells: (row.cells || []).map((cell) => ({
                ...cell,
                href: cell.href ? buildLocalHref(cell.href, articlePathMap) : '',
            })),
        }));

    const rewriteHtmlBlock = (block) => {
        if (block.type !== 'html' || !block.html) {
            return block;
        }

        const $ = cheerio.load(`<div class="root">${block.html}</div>`);
        $('.root a[href]').each((index, anchor) => {
            const $anchor = $(anchor);
            const href = $anchor.attr('href');
            const localHref = buildLocalHref(href, articlePathMap);

            if (localHref) {
                $anchor.attr('href', localHref);
            }
        });

        return {
            ...block,
            html: $('.root').html() || block.html,
        };
    };

    Object.values(database.sections).forEach((section) => {
        section.catalogRows = rewriteRows(section.catalogRows || []);
        section.landingBlocks = (section.landingBlocks || []).map((block) =>
            block.type === 'table' ? { ...block, rows: rewriteRows(block.rows || []) } : rewriteHtmlBlock(block)
        );
    });

    Object.values(database.articles).forEach((article) => {
        article.blocks = (article.blocks || []).map((block) =>
            block.type === 'table' ? { ...block, rows: rewriteRows(block.rows || []) } : rewriteHtmlBlock(block)
        );
        article.related = (article.related || []).filter((articleId) => database.articles[articleId] && articleId !== article.id).slice(0, 8);
    });
};

const buildSectionCatalogs = (database, landingBlocksBySection) => {
    Object.values(database.sections).forEach((section) => {
        const sectionArticles = Object.values(database.articles)
            .filter((article) => article.section === section.id)
            .sort((left, right) => {
                const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 9999;
                const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 9999;
                return leftOrder - rightOrder || left.title.localeCompare(right.title, 'ru');
            });

        section.catalogColumns = [
            { key: 'material', label: 'Материал' },
            { key: 'group', label: 'Группа' },
            { key: 'summary', label: 'Краткое описание' },
        ];

        section.catalogRows = sectionArticles.map((article, index) => ({
            id: `catalog-${index + 1}`,
            cells: [
                {
                    value: article.title,
                    href: `/pages/article.html?article=${encodeURIComponent(article.id)}`,
                },
                {
                    value: section.groups?.find((group) => group.id === article.group)?.label || article.group,
                },
                {
                    value: article.summary || 'Подробная статья и сводные таблицы.',
                },
            ],
        }));

        section.landingLayout = 'catalog';
        section.landingSidebarFacts = [
            { label: 'Материалов', value: String(sectionArticles.length) },
            { label: 'Групп', value: String(section.groups?.length || 0) },
            { label: 'Детальных страниц', value: String(sectionArticles.filter((article) => article.layout !== 'catalog').length) },
        ];
        section.stats = section.landingSidebarFacts;
        section.landingBlocks = (landingBlocksBySection[section.id]?.length ? landingBlocksBySection[section.id] : section.landingBlocks || []).map(
            (block, index) => ({
                id: `${section.id}-landing-${index + 1}`,
                ...block,
            })
        );
    });
};

const getArticleFactValue = (article, label) =>
    [...(article?.sidebarFacts || []), ...(article?.meta || [])].find(
        (item) => normalizeWhitespace(item.label).toLowerCase() === normalizeWhitespace(label).toLowerCase()
    )?.value || '';

const buildArticleCatalogRow = (database, articleId, fallbackSummary = '') => {
    const article = database.articles[articleId];

    if (!article) {
        return null;
    }

    const detail = [
        getArticleFactValue(article, 'Уровень') ? `Уровень ${getArticleFactValue(article, 'Уровень')}` : '',
        getArticleFactValue(article, 'Стартовый NPC'),
        getArticleFactValue(article, 'Стартовая локация'),
    ]
        .filter(Boolean)
        .join(' • ');

    return {
        id: `${article.id}-hub-row`,
        cells: [
            {
                value: article.title,
                href: `/pages/article.html?article=${encodeURIComponent(article.id)}`,
            },
            {
                value: detail || article.eyebrow || '',
            },
            {
                value: article.summary || fallbackSummary || 'Открыть подробную локальную страницу.',
            },
        ],
    };
};

const createTableBlock = (id, title, rows) =>
    rows.length
        ? {
              id,
              type: 'table',
              title,
              compact: true,
              columns: [
                  { key: 'material', label: 'Материал' },
                  { key: 'details', label: 'Краткие данные' },
                  { key: 'summary', label: 'Описание' },
              ],
              rows,
          }
        : null;

const upsertHubArticle = (database, article) => {
    const existing = database.articles[article.id] || {};

    database.articles[article.id] = {
        ...existing,
        ...article,
        id: article.id,
        intro: article.intro || [],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        aliases: article.aliases || existing.aliases || [],
        source: {
            path: `local-hub/${article.id}`,
            sourceType: 'local-hub',
        },
    };
};

const buildLegacyHubArticles = (database) => {
    const findArticleIdByPath = (sourcePath) =>
        Object.values(database.articles).find((article) => article.source?.path === sourcePath)?.id || '';

    const earsQuestId = findArticleIdByPath('quests/item/3130-an-obvious-lie');
    const specialOrderId = findArticleIdByPath('quests/item/3118-a-special-order');
    const earRows = [earsQuestId, specialOrderId].map((articleId) => buildArticleCatalogRow(database, articleId)).filter(Boolean);
    const primaryEarArticle = earsQuestId ? database.articles[earsQuestId] : null;
    const primaryEarHtmlBlock = primaryEarArticle?.blocks?.find((block) => block.type === 'html');
    const primaryEarStepsBlock = primaryEarArticle?.blocks?.find((block) => block.type === 'steps');
    const shouldReplaceEarsQuest =
        !(database.articles['ears-quest']?.layout === 'quest-detail' && database.articles['ears-quest']?.source?.path === 'quests/item/3130-an-obvious-lie');

    const earBlocks = [
        {
            id: 'ears-quest-overview',
            type: 'prose',
            title: 'Аксессуарные квесты',
            paragraphs: [
                'Здесь собраны локальные материалы по декоративным квестам и аксессуарам Lineage II без внешних переходов и ссылок на архив.',
                'Основной квест на уши вынесен в отдельную подробную страницу, а ниже остается быстрый каталог с наградами, стартом и связанными материалами.',
            ],
        },
        createTableBlock('ears-quest-catalog', 'Доступные материалы', earRows),
        primaryEarHtmlBlock
            ? {
                  id: 'ears-quest-primary-detail',
                  type: 'html',
                  title: primaryEarArticle?.title || 'Подробное прохождение',
                  html: primaryEarHtmlBlock.html,
              }
            : primaryEarStepsBlock
              ? {
                    id: 'ears-quest-primary-steps',
                    type: 'steps',
                    title: primaryEarArticle?.title || 'Подробное прохождение',
                    style: 'ordered',
                    items: primaryEarStepsBlock.items || [],
                }
              : null,
    ].filter(Boolean);

    if (shouldReplaceEarsQuest) {
        upsertHubArticle(database, {
        id: 'ears-quest',
        section: 'quests',
        group: 'service',
        title: 'Квест на уши (Кролика, Енота, Кота)',
        summary: primaryEarArticle?.summary || 'Полный локальный разбор аксессуарных квестов с отдельной детальной страницей и игровыми изображениями.',
        eyebrow: 'Сервисные квесты',
        meta: [
            { label: 'Тип', value: 'Аксессуарные квесты' },
            { label: 'Основной квест', value: primaryEarArticle?.title || 'An Obvious Lie' },
            { label: 'Формат', value: 'Каталог + подробное прохождение' },
        ],
        layout: 'catalog',
        sidebarFacts: primaryEarArticle?.sidebarFacts || [],
        blocks: earBlocks,
        related: [earsQuestId, specialOrderId, 'items-accessories'].filter(Boolean),
        aliases: ['квест на уши', 'rabbit ears', 'cat ears', 'raccoon ears'],
        });
    }

    const weaponRows = [
        {
            id: 'items-weapons-grade',
            cells: [
                { value: 'Грейды оружия' },
                { value: 'D, C, B, A, S, S80/S84' },
                { value: 'Подбирайте оружие по грейду, классу, типу атаки и доступности заточки/вставки SA.' },
            ],
        },
        buildArticleCatalogRow(database, 'soul-crystal', 'Усиление оружия, вставка Special Ability и маршруты прокачки кристаллов.'),
        buildArticleCatalogRow(database, 'mammon-services', 'Обмен, распечатка и улучшение экипировки через сервисы Маммона.'),
    ].filter(Boolean);

    upsertHubArticle(database, {
        id: 'items-weapons',
        section: 'items',
        group: 'catalog',
        title: 'Оружие Lineage 2 - Полный гайд',
        summary: 'Большой локальный хаб по типам оружия, грейдам, усилению и связанным игровым сервисам.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Оружие' },
            { label: 'Категории', value: 'Физическое, магическое, двуручное, дальнее' },
            { label: 'Формат', value: 'Обзорный хаб' },
        ],
        layout: 'catalog',
        blocks: [
            {
                id: 'items-weapons-overview',
                type: 'prose',
                title: 'Что есть в разделе',
                paragraphs: [
                    'Эта страница собирает основные локальные материалы по оружию: грейды, сервисы улучшения, вставку Special Ability и маршруты усиления.',
                    'Ниже оставлены только внутренние переходы по сайту и краткие таблицы для быстрого выбора направления.',
                ],
            },
            createTableBlock('items-weapons-table', 'Оружие и связанные материалы', weaponRows),
        ].filter(Boolean),
        related: ['soul-crystal', 'mammon-services', 'items-armor', 'items-accessories'].filter((articleId) => database.articles[articleId]),
        aliases: ['оружие lineage 2', 'weapons', 'оружие'],
    });

    const armorRows = [
        {
            id: 'items-armor-types',
            cells: [
                { value: 'Типы брони' },
                { value: 'Heavy, Light, Robe, Shield, Sigil' },
                { value: 'Выбор брони зависит от роли персонажа, бонусов сета, скорости и устойчивости в PvE/PvP.' },
            ],
        },
        buildArticleCatalogRow(database, 'mammon-services', 'Сервисы распечатки и обмена брони через Blacksmith of Mammon.'),
        buildArticleCatalogRow(database, 'items-accessories', 'Аксессуары и дополнительные слоты экипировки для полного комплекта.'),
    ].filter(Boolean);

    upsertHubArticle(database, {
        id: 'items-armor',
        section: 'items',
        group: 'catalog',
        title: 'Броня Lineage 2 - Полный гайд',
        summary: 'Локальный хаб по типам брони, сетам, сервисам распечатки и общим правилам подбора экипировки.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Броня' },
            { label: 'Категории', value: 'Heavy / Light / Robe' },
            { label: 'Формат', value: 'Обзорный хаб' },
        ],
        layout: 'catalog',
        blocks: [
            {
                id: 'items-armor-overview',
                type: 'prose',
                title: 'Подбор брони',
                paragraphs: [
                    'Раздел собирает основные локальные материалы по сетам, типам брони и связанным сервисам распечатки и улучшения.',
                    'Используйте таблицу ниже как стартовую карту по броне, а затем переходите в нужные связанные материалы.',
                ],
            },
            createTableBlock('items-armor-table', 'Броня и связанные материалы', armorRows),
        ].filter(Boolean),
        related: ['mammon-services', 'items-weapons', 'items-accessories'].filter((articleId) => database.articles[articleId]),
        aliases: ['броня lineage 2', 'armor', 'броня'],
    });

    const accessoriesRows = [
        {
            id: 'items-accessories-types',
            cells: [
                { value: 'Категории аксессуаров' },
                { value: 'Серьги, кольца, ожерелья, декоративные аксессуары' },
                { value: 'Часть аксессуаров дает боевые бонусы, часть относится к коллекционным и декоративным наградам.' },
            ],
        },
        buildArticleCatalogRow(database, 'ears-quest', 'Декоративные уши и связанные аксессуарные квесты на локальном сайте.'),
        buildArticleCatalogRow(database, 'wedding-quest', 'Свадебный наряд и тематические декоративные предметы.'),
    ].filter(Boolean);

    upsertHubArticle(database, {
        id: 'items-accessories',
        section: 'items',
        group: 'catalog',
        title: 'Аксессуары Lineage 2 - Кольца, серьги, ожерелья',
        summary: 'Обзорный локальный хаб по боевым и декоративным аксессуарам с переходами на связанные квесты и материалы.',
        eyebrow: 'Предметы',
        meta: [
            { label: 'Тип', value: 'Аксессуары' },
            { label: 'Категории', value: 'Боевые и декоративные' },
            { label: 'Формат', value: 'Обзорный хаб' },
        ],
        layout: 'catalog',
        blocks: [
            {
                id: 'items-accessories-overview',
                type: 'prose',
                title: 'Что входит в аксессуары',
                paragraphs: [
                    'Здесь собраны локальные материалы по эпическим и обычным аксессуарам, а также по декоративным наградам, которые часто ищут отдельно.',
                    'Ниже оставлены только внутренние переходы по сайту, чтобы раздел работал как самостоятельный игровой справочник.',
                ],
            },
            createTableBlock('items-accessories-table', 'Аксессуары и связанные материалы', accessoriesRows),
        ].filter(Boolean),
        related: ['ears-quest', 'wedding-quest', 'items-weapons', 'items-armor'].filter((articleId) => database.articles[articleId]),
        aliases: ['аксессуары lineage 2', 'accessories', 'кольца серьги ожерелья'],
    });
};

const getArticleNeedles = (article) => {
    const title = normalizeWhitespace(article?.title || '');
    const needles = new Set(
        [title, ...(article?.aliases || [])]
            .flatMap((value) => {
                const normalized = normalizeWhitespace(value);

                if (!normalized) {
                    return [];
                }

                const variants = [normalized];
                const outside = normalizeWhitespace(normalized.replace(/\([^)]*\)/g, ' '));
                const inside = Array.from(normalized.matchAll(/\(([^)]+)\)/g)).map((match) => normalizeWhitespace(match[1] || ''));

                if (outside) {
                    variants.push(outside);
                }

                inside.forEach((value) => variants.push(value));
                return variants;
            })
            .map((value) => value.toLowerCase())
            .filter((value) => value.length >= 3)
    );

    return Array.from(needles);
};

const getFirstHtmlBlock = (article) => (article?.blocks || []).find((block) => block.type === 'html' && normalizeWhitespace(block.html));

const LEGACY_STRUCTURED_ARTICLE_IDS = new Set([
    'fishing-skills',
    'clan-skills',
    'enchanting-skills',
    'squad-skills',
    'manor-guide',
    'mammon-services',
    'archive-guide-item-3139-spoil',
    'archive-guide-item-5266-craft-interlude',
]);

const buildBlockSignature = (block) => {
    if (!block) {
        return '';
    }

    if (block.type === 'media') {
        return `media:${normalizeWhitespace(block.title)}:${(block.items || [])
            .map((item) => `${item.src || ''}|${item.caption || ''}`)
            .join(';')}`;
    }

    if (block.type === 'table') {
        return `table:${normalizeWhitespace(block.title)}:${(block.columns || []).map((column) => column.label || '').join('|')}:${
            (block.rows || []).length
        }`;
    }

    if (block.type === 'prose') {
        return `prose:${normalizeWhitespace(block.title)}:${normalizeWhitespace((block.paragraphs || []).join(' ')).slice(0, 280)}`;
    }

    if (block.type === 'list' || block.type === 'steps' || block.type === 'callout') {
        return `${block.type}:${normalizeWhitespace(block.title)}:${normalizeWhitespace(
            `${block.text || ''} ${(block.items || []).join(' ')}`
        ).slice(0, 280)}`;
    }

    return `${block.type}:${normalizeWhitespace(block.title)}:${normalizeWhitespace(block.id || '')}`;
};

const dedupeBlocks = (blocks = []) => {
    const seen = new Set();
    const unique = [];

    (blocks || []).forEach((block) => {
        const signature = buildBlockSignature(block);

        if (!signature || seen.has(signature)) {
            return;
        }

        seen.add(signature);
        unique.push(block);
    });

    return unique;
};

const isLegacyHtmlNoiseOnly = (html = '') => {
    const text = normalizeWhitespace(String(html || '').replace(/<[^>]+>/g, ' '));

    if (!text) {
        return true;
    }

    const chunks = text
        .split(/\s{2,}/)
        .map((value) => normalizeLegacyPaneTitle(value))
        .filter(Boolean);

    if (!chunks.length) {
        return true;
    }

    return chunks.every((chunk) => {
        if (isLegacyNoiseText(chunk)) {
            return true;
        }

        const tokens = chunk.split(/\s+/).filter(Boolean);
        return tokens.length > 0 && tokens.every((token) => isLegacyNoiseText(token));
    });
};

const normalizeLegacyPaneTitle = (value = '') => normalizeWhitespace(value).replace(/[:\s]+$/g, '');

const isLegacyNoiseText = (value = '') =>
    /^(lineage ii|interlude|gracia(?: final| epilogue)?(?: - high five)?|high five|goddess of destruction|квесты|местонахождение|дроп|спойл)$/i.test(
        normalizeLegacyPaneTitle(value)
    );

const isChroniclePaneTitle = (value = '') => /^(interlude|gracia(?: final| epilogue)?(?: - high five)?|high five|goddess of destruction)$/i.test(normalizeLegacyPaneTitle(value));

const isSpecificArchivePaneTitle = (value = '') =>
    /(квест|спойл|дроп|местонахожд|location|quests|spoil|drop|human|elf|dark elf|dwarf|orc|kamael|male soldier|female soldier)/i.test(
        normalizeLegacyPaneTitle(value)
    );

const getArchivePaneLabelMap = ($, $scope) => {
    const labelMap = new Map();

    $scope
        .children('.archive-detail__tabs')
        .first()
        .find('.archive-detail__tab-link[href^="#"]')
        .each((index, link) => {
            const $link = $(link);
            const href = normalizeWhitespace($link.attr('href') || '').replace(/^#/, '');
            const label = normalizeLegacyPaneTitle($link.text());

            if (href && label) {
                labelMap.set(href.toLowerCase(), label);
            }
        });

    return labelMap;
};

const getImmediateArchiveTabPanes = ($scope) => $scope.children('.archive-detail__tab-content').first().children('.archive-detail__tab-pane');

const promoteShortLeadBlocks = (blocks = [], fallbackTitle = '') => {
    const normalizedBlocks = [];

    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const nextBlock = blocks[index + 1];

        if (
            block?.type === 'prose' &&
            (block.paragraphs || []).length === 1 &&
            nextBlock &&
            !normalizeWhitespace(nextBlock.title) &&
            ['table', 'list', 'steps', 'callout', 'media'].includes(nextBlock.type)
        ) {
            const text = normalizeWhitespace(block.paragraphs[0]).replace(/[:\s]+$/g, '');

            if (text && text.length <= 72) {
                normalizedBlocks.push({
                    ...nextBlock,
                    title: text,
                });
                index += 1;
                continue;
            }
        }

        normalizedBlocks.push(block);
    }

    if (fallbackTitle && normalizedBlocks.length && !normalizedBlocks.some((block) => normalizeWhitespace(block?.title))) {
        normalizedBlocks[0] = {
            ...normalizedBlocks[0],
            title: fallbackTitle,
        };
    }

    return normalizedBlocks.filter((block) => {
        if (!block) {
            return false;
        }

        if ((block.type === 'list' || block.type === 'steps') && (block.items || []).length) {
            return !(block.items || []).every((item) => isLegacyNoiseText(item));
        }

        if (block.type === 'callout') {
            return !isLegacyNoiseText(block.text || '') || (block.items || []).length > 0;
        }

        if (block.type === 'prose') {
            return !((block.paragraphs || []).length && (block.paragraphs || []).every((paragraph) => isLegacyNoiseText(paragraph)));
        }

        return true;
    });
};

const extractLegacyBlocksFromScope = ($, $scope, context, fallbackTitle = '') => {
    const $clone = $scope.clone();
    $clone.children('.archive-detail__tabs, .archive-detail__tab-content').remove();

    const firstHeading = $clone.children('.archive-detail__heading').first();

    if (firstHeading.length && normalizeLegacyPaneTitle(firstHeading.text()) === normalizeLegacyPaneTitle(fallbackTitle)) {
        firstHeading.remove();
    }

    const blocks = extractBlocks($, $clone, {
        ...context,
        title: fallbackTitle || context.title || '',
        allowLocalMedia: true,
        idSeed: `${context.idSeed}-${toSafeFileSlug(fallbackTitle || 'detail')}`,
    });

    return promoteShortLeadBlocks(blocks, fallbackTitle);
};

const flattenArchiveDetailScope = ($, $scope, context, fallbackTitle = '') => {
    const panes = getImmediateArchiveTabPanes($scope);

    if (!panes.length) {
        return extractLegacyBlocksFromScope($, $scope, context, fallbackTitle);
    }

    const labelMap = getArchivePaneLabelMap($, $scope);
    const blocks = [];

    panes.each((index, pane) => {
        const $pane = $(pane);
        const paneId = normalizeWhitespace($pane.attr('id') || '').toLowerCase();
        const paneTitle = normalizeLegacyPaneTitle(
            labelMap.get(paneId) || $pane.children('.archive-detail__heading').first().text() || fallbackTitle || `Раздел ${index + 1}`
        );
        const nestedPanes = getImmediateArchiveTabPanes($pane);
        const nestedPaneTitles = nestedPanes
            .toArray()
            .map((nestedPane) => {
                const $nestedPane = $(nestedPane);
                const nestedId = normalizeWhitespace($nestedPane.attr('id') || '').toLowerCase();
                const nestedMap = getArchivePaneLabelMap($, $pane);
                return normalizeLegacyPaneTitle(nestedMap.get(nestedId) || $nestedPane.children('.archive-detail__heading').first().text() || nestedId);
            })
            .filter(Boolean);

        if (nestedPanes.length && (isChroniclePaneTitle(paneTitle) || nestedPaneTitles.some((title) => isSpecificArchivePaneTitle(title)))) {
            blocks.push(
                ...flattenArchiveDetailScope($, $pane, { ...context, idSeed: `${context.idSeed}-${toSafeFileSlug(paneTitle || `pane-${index + 1}`)}` }, paneTitle)
            );
            return;
        }

        blocks.push(
            ...extractLegacyBlocksFromScope(
                $,
                $pane,
                { ...context, idSeed: `${context.idSeed}-${toSafeFileSlug(paneTitle || `pane-${index + 1}`)}` },
                paneTitle
            )
        );
    });

    return blocks;
};

const rebuildLegacyHtmlArticle = (article) => {
    const htmlBlock = getFirstHtmlBlock(article);

    if (!htmlBlock || !/archive-detail/i.test(htmlBlock.html || '')) {
        return [];
    }

    const $ = cheerio.load(`<div class="legacy-root">${htmlBlock.html}</div>`);
    const $detail = $('.legacy-root .archive-detail').first().length ? $('.legacy-root .archive-detail').first() : $('.legacy-root');
    const blocks = flattenArchiveDetailScope($, $detail, {
        idSeed: article.id,
        title: article.title,
        allowLocalMedia: true,
    });

    return dedupeBlocks(blocks).map((block, index) => ({
        ...block,
        id: block.id || `${article.id}-rebuilt-${index + 1}`,
    }));
};

const rebuildLegacyHtmlArticles = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article) {
            return;
        }

        const shouldRebuild =
            article.section === 'npc' || article.section === 'monsters' || article.section === 'locations' || LEGACY_STRUCTURED_ARTICLE_IDS.has(article.id);

        if (!shouldRebuild) {
            return;
        }

        const htmlBlock = getFirstHtmlBlock(article);
        const rebuiltBlocks = rebuildLegacyHtmlArticle(article);

        const preservedBlocks = (article.blocks || []).filter((block) => block.type !== 'html');

        if (!rebuiltBlocks.length) {
            if (htmlBlock && preservedBlocks.length && isLegacyHtmlNoiseOnly(htmlBlock.html || '')) {
                article.blocks = dedupeBlocks(preservedBlocks);
            }
            return;
        }

        article.blocks = dedupeBlocks([...preservedBlocks, ...rebuiltBlocks]);
    });
};

const sanitizeDetailSidebarFacts = (facts = []) => {
    const knownLabels = [
        'Уровень',
        'Раса',
        'Агрессивный',
        'Количество HP',
        'Количество MP',
        'Количество EXP',
        'Количество SP',
        'P.Atk',
        'P.Def',
        'M.Atk',
        'M.Def',
        'Местонахождение',
    ];

    return (facts || []).filter((fact) => {
        const label = normalizeWhitespace(fact?.label);
        const value = normalizeWhitespace(fact?.value);
        const labelHits = knownLabels.filter((item) => label.includes(item)).length;
        const slashCount = (value.match(/\//g) || []).length;

        if (!label || !value) {
            return false;
        }

        if (labelHits >= 3) {
            return false;
        }

        if (/^\/\s*/.test(value) && slashCount >= 5) {
            return false;
        }

        return true;
    });
};

const extractNpcLocationText = (article) => {
    const htmlBlock = getFirstHtmlBlock(article);

    if (!htmlBlock) {
        return '';
    }

    const $ = cheerio.load(`<div class="root">${htmlBlock.html}</div>`);
    const needles = getArticleNeedles(article);
    let locationText = '';

    $('.root h2, .root h3, .root h4').each((index, heading) => {
        if (locationText) {
            return;
        }

        const $heading = $(heading);

        if (!/местонахождение/i.test(normalizeWhitespace($heading.text()))) {
            return;
        }

        const $scope = $heading.closest('.tab-pane').length ? $heading.closest('.tab-pane') : $heading.parent();
        const values = $scope
            .find('td, p, li')
            .toArray()
            .map((node) => normalizeWhitespace($(node).text()))
            .filter((value) => value && !/местонахождение/i.test(value));

        locationText =
            values.find((value) => /territory|town|village|forest|island|temple|tower|aden|gludio|dion|giran|oren|rune|goddard|schuttgart/i.test(value)) ||
            values[0] ||
            '';
    });

    if (locationText) {
        return locationText;
    }

    $('.root table tr').each((index, row) => {
        if (locationText) {
            return;
        }

        const $cells = $(row).children('th, td');

        if ($cells.length < 6) {
            return;
        }

        const npcCell = normalizeWhitespace($cells.eq(4).text()).toLowerCase();
        const locationCell = normalizeWhitespace($cells.eq(5).text());

        if (locationCell && needles.some((needle) => npcCell.includes(needle))) {
            locationText = locationCell;
        }
    });

    return locationText;
};

const extractDetailPaneImageSrc = (article, paneLabel = 'Местонахождение') => {
    const htmlBlock = getFirstHtmlBlock(article);

    if (!htmlBlock) {
        return '';
    }

    const needle = normalizeWhitespace(paneLabel).toLowerCase();
    const $ = cheerio.load(`<div class="root">${htmlBlock.html}</div>`);
    let imageSrc = '';

    $('.root .tab-pane').each((index, pane) => {
        if (imageSrc) {
            return;
        }

        const $pane = $(pane);
        const paneId = normalizeWhitespace($pane.attr('id') || '').toLowerCase();
        const headingText = normalizeWhitespace($pane.find('h2, h3, h4').first().text()).toLowerCase();

        if (!paneId.includes(needle) && !headingText.includes(needle)) {
            return;
        }

        imageSrc = normalizeWhitespace($pane.find('img').first().attr('src') || '');
    });

    return imageSrc;
};

const ensureDetailLocationMediaBlock = (article) => {
    const imageSrc = extractDetailPaneImageSrc(article, 'Местонахождение');

    if (!imageSrc) {
        return '';
    }

    const locationBlockId = `${article.id}-location-media`;

    if ((article.blocks || []).some((block) => block.id === locationBlockId)) {
        return imageSrc;
    }

    insertBlockAfterHero(article, {
        id: locationBlockId,
        type: 'media',
        title: 'Местонахождение',
        items: [
            {
                src: imageSrc,
                alt: `${normalizeWhitespace(article.title)} — местонахождение`,
                caption: `Карта местонахождения для ${normalizeWhitespace(article.title)}.`,
            },
        ],
    });

    return imageSrc;
};

const insertBlockAfterHero = (article, block) => {
    const blocks = article.blocks || [];

    if (blocks[0]?.type === 'media') {
        article.blocks = [blocks[0], block, ...blocks.slice(1)];
        return;
    }

    article.blocks = [block, ...blocks];
};

const enhanceNpcArticles = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article || article.section !== 'npc' || article.layout === 'catalog') {
            return;
        }

        article.layout = 'detail';

        const sidebarFacts = sanitizeDetailSidebarFacts(Array.isArray(article.sidebarFacts) ? [...article.sidebarFacts] : []);
        const locationText = extractNpcLocationText(article);
        const locationImageSrc = ensureDetailLocationMediaBlock(article);
        const hasLocationFact = sidebarFacts.some((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'местонахождение');

        if (locationText && !hasLocationFact) {
            sidebarFacts.push({ label: 'Местонахождение', value: locationText });
        } else if (!locationText && locationImageSrc && !hasLocationFact && String(article.source?.path || '').startsWith('npc/item/')) {
            sidebarFacts.push({ label: 'Местонахождение', value: 'Карта местонахождения доступна на странице' });
        }

        article.sidebarFacts = sidebarFacts;

        const title = normalizeWhitespace(article.title);
        const inspect = `${title} ${article.source?.path || ''}`.toLowerCase();
        const roleLabel = /gatekeeper|хранитель портала/i.test(inspect)
            ? 'Gatekeeper'
            : /pet manager|fishing guide|warehouse keeper|manor manager/i.test(inspect)
              ? 'Service NPC'
              : 'NPC';
        const summaryLocation = locationText
            ? ` Основное местонахождение: ${locationText}.`
            : locationImageSrc
              ? ' На странице доступна карта местонахождения.'
              : '';

        article.summary = `${title} — ${roleLabel} Lineage II.${summaryLocation} На странице собраны характеристики, связанные квесты и полезные таблицы.`.trim();

        if (!(article.blocks || []).some((block) => block.type === 'prose')) {
            insertBlockAfterHero(article, {
                id: `${article.id}-overview`,
                type: 'prose',
                title: 'О персонаже',
                paragraphs: [
                    `${title} — служебный NPC Lineage II с отдельной карточкой характеристик, квестов и маршрута доступа.`,
                    locationText
                        ? `Основная привязка по территории: ${locationText}. Ниже оставлены таблицы связанных заданий и данные для быстрого ориентирования.`
                        : locationImageSrc
                          ? 'Ниже сохранена карта местонахождения и архивные таблицы, чтобы NPC можно было найти без внешних ссылок.'
                          : 'Ниже собраны связанные квесты, основные параметры и данные, которые помогают быстро понять роль NPC в игровом маршруте.',
                ],
            });
        }
    });
};

const enhanceMonsterArticles = (database) => {
    Object.values(database.articles).forEach((article) => {
        if (!article || article.section !== 'monsters' || article.layout === 'catalog') {
            return;
        }

        article.layout = 'detail';

        const sidebarFacts = sanitizeDetailSidebarFacts(Array.isArray(article.sidebarFacts) ? [...article.sidebarFacts] : []);
        const locationText = extractNpcLocationText(article);
        const locationImageSrc = ensureDetailLocationMediaBlock(article);
        const hasLocationFact = sidebarFacts.some((fact) => normalizeWhitespace(fact.label).toLowerCase() === 'местонахождение');

        if (locationText && !hasLocationFact) {
            sidebarFacts.push({ label: 'Местонахождение', value: locationText });
        } else if (!locationText && locationImageSrc && !hasLocationFact && String(article.source?.path || '').startsWith('monster/item/')) {
            sidebarFacts.push({ label: 'Местонахождение', value: 'Карта местонахождения доступна на странице' });
        } else if (!locationText && !locationImageSrc && !hasLocationFact && String(article.source?.path || '').startsWith('monster/item/')) {
            sidebarFacts.push({ label: 'Местонахождение', value: 'Архивная карточка не содержит карту местонахождения' });
        }

        article.sidebarFacts = sidebarFacts;

        const title = normalizeWhitespace(article.title);
        const locationSuffix = locationText
            ? ` Основная зона: ${locationText}.`
            : locationImageSrc
              ? ' На странице доступна карта местонахождения.'
              : '';

        article.summary = `${title} — карточка монстра Lineage II со статами, дропом, спойлом, связанными квестами и местонахождением.${locationSuffix}`.trim();

        if (!(article.blocks || []).some((block) => block.type === 'prose')) {
            insertBlockAfterHero(article, {
                id: `${article.id}-overview`,
                type: 'prose',
                title: 'О монстре',
                paragraphs: [
                    `${title} — локальная карточка монстра с подробными таблицами дропа, спойла, квестовых связок и игровых параметров.`,
                    locationText
                        ? `В карточке дополнительно сохранено местонахождение: ${locationText}. Ниже доступны архивные таблицы и связанные игровые материалы.`
                        : locationImageSrc
                          ? 'Ниже доступны карта местонахождения, таблицы дропа, спойла и связанные игровые материалы.'
                          : 'Ниже доступны архивные таблицы по дропу, спойлу, связанным квестам и другим полезным данным.',
                ],
            });
        }
    });
};

const buildEpicBossOverview = (database) => {
    const epicRows = [
        buildArticleCatalogRow(database, 'antharas-entry', 'Доступ к Antharas, требования группы и короткая схема подготовки.'),
        buildArticleCatalogRow(database, 'baium-entry', 'Маршрут к Baium и ключевые этапы входа.'),
        buildArticleCatalogRow(database, 'valakas-entry', 'Подготовка к Valakas и связанные материалы.'),
        buildArticleCatalogRow(database, 'frintezza-entry', 'Маршрут к Frintezza и этапы захода.'),
        buildArticleCatalogRow(database, 'freya-entry', 'Подготовка к Freya, состав и полезные заметки.'),
        buildArticleCatalogRow(database, 'archive-monster-item-5292-zaken', 'Карточка Zaken и связанные материалы по эпик-контенту.'),
    ].filter(Boolean);

    upsertHubArticle(database, {
        id: 'misc-epic-overview',
        section: 'misc',
        group: 'epic',
        title: 'Эпик-боссы Lineage II',
        summary: 'Сводная локальная страница по эпик-боссам, доступам, связанным квестам и важным материалам позднего PvE.',
        eyebrow: 'Эпик-боссы',
        meta: [
            { label: 'Формат', value: 'Обзорный хаб' },
            { label: 'Контент', value: 'Боссы, входные квесты, полезные маршруты' },
        ],
        layout: 'catalog',
        blocks: [
            {
                id: 'misc-epic-overview-prose',
                type: 'prose',
                title: 'Поздний PvE-контент',
                paragraphs: [
                    'Раздел собирает локальные материалы по эпик-боссам, входным цепочкам и связанным походам без внешних переходов.',
                    'Используйте таблицу ниже как стартовую карту по Antharas, Baium, Valakas, Frintezza, Freya и другим связанным материалам позднего контента.',
                ],
            },
            createTableBlock('misc-epic-overview-table', 'Эпик-боссы и связанные материалы', epicRows),
        ].filter(Boolean),
        related: ['antharas-entry', 'baium-entry', 'valakas-entry', 'frintezza-entry', 'freya-entry', 'archive-monster-item-5292-zaken'].filter(
            (articleId) => database.articles[articleId]
        ),
        aliases: ['эпик боссы', 'epic bosses', 'antharas baium valakas frintezza'],
    });
};

const fetchRemotePage = async (ref) => {
    const candidates = Array.from(new Set([ref?.originalUrl, buildArchiveUrl(ref)].filter(Boolean)));
    let lastError = null;

    for (const candidateUrl of candidates) {
        try {
            const response = await fetch(candidateUrl, {
                headers: {
                    'User-Agent': 'L2Wiki Archive Importer/1.0',
                    Accept: 'text/html,application/xhtml+xml',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${candidateUrl} (${response.status})`);
            }

            const contentType = response.headers.get('content-type') || '';

            if (!contentType.includes('text/html')) {
                continue;
            }

            const html = await response.text();
            return {
                html,
                sourceUrl: candidateUrl,
                finalUrl: response.url || candidateUrl,
            };
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }

    return null;
};

const main = async () => {
    const options = parseArgs();
    ensureStorageDirs();

    const database = deepClone(readCanonical());
    const db = new sqlite3.Database(DB_PATH);
    ensureBlueprints(database);

    const registry = new Map();
    const localPagesByPath = new Map();
    const cachedPages = readCachedArchivePages();
    const cachedPagesByPath = new Map(cachedPages.filter((page) => page.ref?.path).map((page) => [page.ref.path, page]));
    const cachedPagesBySlug = new Map(cachedPages.map((page) => [page.slug, page]));
    const processedPages = [];
    const landingBlocksBySection = {};

    const shouldImportPath = (sourcePath = '') => (!options.questOnly ? true : sourcePath === 'quests' || sourcePath.startsWith('quests/'));

    const registerReference = (ref, parentPath = '') => {
        if (!ref || !ref.path) {
            return;
        }

        if (!shouldImportPath(ref.path)) {
            return;
        }

        const existing = registry.get(ref.path) || {
            ref,
            parents: new Set(),
            processed: false,
        };

        if (!existing.ref.archiveUrl && ref.archiveUrl) {
            existing.ref = ref;
        }

        if (parentPath) {
            existing.parents.add(parentPath);
        }

        registry.set(ref.path, existing);
    };

    readLocalHtmlPages().forEach((page) => {
        registerReference(page.ref);
        localPagesByPath.set(page.ref.path, page);
    });

    cachedPages.forEach((page) => {
        if (page.ref?.path) {
            registerReference(page.ref);
        }
    });

    DIRECT_IMPORT_REFS.map((value) => parseArchiveReference(value)).filter(Boolean).forEach((ref) => registerReference(ref));

    if (options.fetchRemote) {
        const questArchiveRefs = fetchCdxArchiveReferences('https://l2int.ru/quests/item/*');
        questArchiveRefs.forEach((ref) => registerReference(ref));
        console.log(`[import-archive] discovered ${questArchiveRefs.length} quest detail pages via CDX`);
    }

    while (processedPages.length < options.maxPages) {
        const nextEntry = Array.from(registry.entries()).find(([, entry]) => !entry.processed);

        if (!nextEntry) {
            break;
        }

        const [sourcePath, entry] = nextEntry;
        let html = '';
        let archiveRef = entry.ref;
        let origin = 'remote-wayback';
        let localFileName = '';
        let snapshotRelativePath = '';
        const preferRemoteSource = options.fetchRemote && shouldPreferLiveFetch(sourcePath);

        if (preferRemoteSource) {
            try {
                const remote = await fetchRemotePage(entry.ref);

                if (remote) {
                    html = remote.html;
                    archiveRef = parseArchiveReference(remote.finalUrl || remote.sourceUrl) || parseArchiveReference(remote.sourceUrl) || entry.ref;
                    origin = /^https?:\/\/(?:www\.)?l2int\.ru\//i.test(remote.finalUrl || remote.sourceUrl || '') ? 'remote-live' : 'remote-wayback';
                    await cacheArchiveImagesFromHtml(html, archiveRef, sourcePath);
                }
            } catch (error) {
                console.warn('[import-archive] Quest refresh fallback:', sourcePath, error.message);
            }
        }

        if (html) {
            // `html` was already refreshed from the live source above.
        } else if (localPagesByPath.has(sourcePath)) {
            const localPage = localPagesByPath.get(sourcePath);
            html = localPage.html;
            archiveRef = localPage.ref;
            origin = 'local-copy';
            localFileName = localPage.fileName;
        } else if (cachedPagesByPath.has(sourcePath)) {
            const cachedPage = cachedPagesByPath.get(sourcePath);
            html = cachedPage.html;
            archiveRef = cachedPage.ref || archiveRef;
            origin = 'local-archive';
            snapshotRelativePath = cachedPage.relativePath;
        } else if (cachedPagesBySlug.has(toSafeFileSlug(sourcePath))) {
            const cachedPage = cachedPagesBySlug.get(toSafeFileSlug(sourcePath));
            html = cachedPage.html;
            archiveRef = cachedPage.ref || archiveRef;
            origin = 'local-archive';
            snapshotRelativePath = cachedPage.relativePath;
        } else if (options.fetchRemote) {
            try {
                const remote = await fetchRemotePage(entry.ref);

                if (!remote) {
                    entry.processed = true;
                    continue;
                }

                html = remote.html;
                archiveRef = parseArchiveReference(remote.finalUrl || remote.sourceUrl) || parseArchiveReference(remote.sourceUrl) || entry.ref;
                origin = /^https?:\/\/(?:www\.)?l2int\.ru\//i.test(remote.finalUrl || remote.sourceUrl || '') ? 'remote-live' : 'remote-wayback';
                await cacheArchiveImagesFromHtml(html, archiveRef, sourcePath);
            } catch (error) {
                console.warn('[import-archive] Skip fetch:', sourcePath, error.message);
                entry.processed = true;
                continue;
            }
        } else {
            entry.processed = true;
            continue;
        }

        if (!snapshotRelativePath) {
            snapshotRelativePath = saveRawSnapshot(sourcePath, archiveRef.archivedAt, html);
        }

        const parsed = parsePage(html, {
            sourcePath,
            origin,
            localFileName,
            archiveRef,
        });

        entry.processed = true;

        if (!parsed || !parsed.title || !parsed.blocks.length) {
            continue;
        }

        processedPages.push({
            sourcePath,
            parents: entry.parents,
            archiveRef,
            snapshotRelativePath,
            origin,
            ...parsed,
        });

        parsed.outboundLinks.forEach((ref) => {
            registerReference(ref, sourcePath);
        });

        if (processedPages.length % 20 === 0) {
            console.log(`[import-archive] processed ${processedPages.length} pages...`);
        }
    }

    const outboundByPath = new Map();

    processedPages.forEach((pageData, index) => {
        const mapping = inferSectionGroup(pageData.sourcePath, pageData.parents, pageData.title);
        const articleId = findExistingArticleId(database, pageData, pageData.sourcePath);
        const aliases = extractAliases(pageData.title);
        const summary = extractSummary(pageData.description, pageData.blocks);

        database.articles[articleId] = {
            ...(database.articles[articleId] || {}),
            id: articleId,
            section: mapping.section,
            group: mapping.group,
            title: pageData.title,
            summary,
            eyebrow: SECTION_BLUEPRINTS[mapping.section]?.title || mapping.section,
            meta: [],
            intro: extractIntro(pageData.blocks),
            checklist: [],
            steps: [],
            rewards: [],
            tips: [],
            related: [],
            order: index,
            layout: pageData.layout || (pageData.pageType === 'detail' ? 'detail' : 'catalog'),
            sidebarFacts: pageData.sidebarFacts,
            source: {
                url: buildArchiveUrl(pageData.archiveRef),
                archivedAt: pageData.archiveRef.archivedAt || '',
                path: pageData.sourcePath,
                snapshot: pageData.snapshotRelativePath,
                sourceType:
                    pageData.origin === 'local-copy'
                        ? 'copy+wayback'
                        : pageData.origin === 'local-archive'
                          ? 'local-archive'
                          : pageData.origin === 'remote-live'
                            ? 'live+l2int'
                            : 'wayback',
            },
            aliases,
            blocks: pageData.blocks,
        };

        outboundByPath.set(
            pageData.sourcePath,
            pageData.outboundLinks.map((ref) => ref.path).filter(Boolean)
        );

        if (pageData.origin === 'local-copy' && pageData.pageType === 'category') {
            landingBlocksBySection[mapping.section] = landingBlocksBySection[mapping.section] || [];
            const sectionBlocks = pageData.blocks.map((block, blockIndex) => ({
                ...block,
                title: blockIndex === 0 ? block.title || pageData.title : block.title,
            }));
            landingBlocksBySection[mapping.section].push(...sectionBlocks);
        }
    });

    const pathToArticleId = new Map(
        Object.values(database.articles)
            .filter((article) => article.source?.path)
            .map((article) => [article.source.path, article.id])
    );

    Object.values(database.articles).forEach((article) => {
        const outboundPaths = outboundByPath.get(article.source?.path) || [];
        article.related = Array.from(new Set(outboundPaths.map((sourcePath) => pathToArticleId.get(sourcePath)).filter(Boolean))).slice(0, 8);
    });

    normalizeQuestArticles(database);
    buildLegacyHubArticles(database);
    buildEpicBossOverview(database);
    sanitizeImportedContent(database);
    applyQuestDetailBackfill(database);
    enhanceNpcArticles(database);
    enhanceMonsterArticles(database);
    rebuildLegacyHtmlArticles(database);
    pruneIrrelevantMediaBlocks(database);
    sanitizeMediaBlocks(database);
    addVisualMediaBlocks(database);
    sanitizeMediaBlocks(database);
    normalizeQuestGuideArticles(database);
    buildSectionCatalogs(database, landingBlocksBySection);
    rewriteInternalLinks(database);

    try {
        const normalized = normalizeDatabase(database);
        const result = await publishCanonical(db, normalized, 'archive-import');

        console.log(
            `[import-archive] published ${Object.keys(result.database.sections).length} sections and ${Object.keys(result.database.articles).length} articles`
        );
        console.log(`[import-archive] canonical: ${result.canonicalPath}`);
        console.log(`[import-archive] backup: ${result.backupPath}`);
    } finally {
        await new Promise((resolve) => db.close(resolve));
    }
};

main().catch((error) => {
    console.error('[import-archive] failed:', error);
    process.exitCode = 1;
});
