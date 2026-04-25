#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (db) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const clone = (value) => JSON.parse(JSON.stringify(value));

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ');
const collapse = (value = '') => stripHtml(value).replace(/\s+/g, ' ').trim();
const normalize = (value = '') =>
    collapse(value)
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/[“”"']/g, '')
        .replace(/\s*\/\s*\([^)]*\)\s*$/g, '')
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();

const hrefForArticle = (id) => `/pages/article.html?article=${id}`;

const collectVariants = (title = '') => {
    const variants = new Set();
    const raw = collapse(title);

    if (!raw) {
        return variants;
    }

    variants.add(normalize(raw));

    const slashPart = raw.split('/')[0].trim();
    if (slashPart) {
        variants.add(normalize(slashPart));
    }

    const parenIndex = raw.indexOf('(');
    if (parenIndex > 0) {
        variants.add(normalize(raw.slice(0, parenIndex)));
    }

    return variants;
};

const buildQuestLookup = (articles) => {
    const lookup = new Map();

    for (const [id, article] of Object.entries(articles)) {
        if (article.section !== 'quests') {
            continue;
        }

        if (!id.startsWith('archive-quests-item-')) {
            continue;
        }

        for (const key of collectVariants(article.title)) {
            if (key && !lookup.has(key)) {
                lookup.set(key, id);
            }
        }
    }

    return lookup;
};

const buildLocationLookup = (articles) => {
    const lookup = new Map();

    for (const [id, article] of Object.entries(articles)) {
        if (article.section !== 'locations') {
            continue;
        }

        if (id === 'world-map-locations' || id === 'locations-overview') {
            continue;
        }

        for (const key of collectVariants(article.title)) {
            if (key && !lookup.has(key)) {
                lookup.set(key, id);
            }
        }
    }

    return lookup;
};

const removeMapBlocks = (article) => {
    article.blocks = (article.blocks || []).filter((block) => !['imageMap', 'location'].includes(block.type));
};

const ensureContentBlocks = (article) => {
    if ((article.blocks || []).length) {
        return;
    }

    const blocks = [];

    if (Array.isArray(article.intro) && article.intro.length) {
        blocks.push({
            id: `${article.id}-intro`,
            type: 'prose',
            title: '',
            paragraphs: article.intro.map((paragraph) => collapse(paragraph)).filter(Boolean),
        });
    }

    if (Array.isArray(article.sidebarFacts) && article.sidebarFacts.length) {
        blocks.push({
            id: `${article.id}-facts`,
            type: 'table',
            title: 'Краткая информация',
            columns: [
                { key: 'fact', label: 'Параметр', align: '', width: '' },
                { key: 'value', label: 'Значение', align: '', width: '' },
            ],
            rows: article.sidebarFacts.map((fact, index) => ({
                id: `${article.id}-fact-row-${index + 1}`,
                title: '',
                href: '',
                cells: [
                    { value: collapse(fact.label), href: '', html: '' },
                    { value: collapse(fact.value), href: '', html: '' },
                ],
                meta: [],
            })),
        });
    }

    article.blocks = blocks;
};

const cleanRelatedWorldMap = (article) => {
    article.related = (article.related || []).filter((id) => id !== 'world-map-locations');

    if (typeof article.eyebrow === 'string' && article.eyebrow.includes('Карта мира')) {
        if (article.section === 'locations') {
            article.eyebrow = 'Локации';
        } else if (article.section === 'npc') {
            article.eyebrow = 'NPC';
        }
    }
};

const fixProfessionGroupLabels = (db) => {
    const labels = {
        'profession-1': '1 профессия',
        'profession-2': '2 профессия',
        'profession-3': '3 профессия',
        'profession-4': '4 профессия',
    };

    for (const group of db.sections?.quests?.groups || []) {
        if (labels[group.id]) {
            group.label = labels[group.id];
        }
    }
};

const fixQuestLinks = (db, questLookup) => {
    const overviewIds = ['quest-profession-first', 'quest-profession-second', 'quest-profession-third'];

    for (const articleId of overviewIds) {
        const article = db.articles[articleId];

        if (!article) {
            continue;
        }

        const selfHref = hrefForArticle(articleId);

        for (const block of article.blocks || []) {
            if (block.type !== 'table') {
                continue;
            }

            for (const row of block.rows || []) {
                let matchedHref = '';

                for (const cell of row.cells || []) {
                    const key = normalize(cell.value);
                    const targetId = questLookup.get(key);

                    if (!targetId) {
                        continue;
                    }

                    matchedHref = hrefForArticle(targetId);

                    if (!cell.href || cell.href === selfHref) {
                        cell.href = matchedHref;
                    }
                }

                if (matchedHref && (!row.href || row.href === selfHref)) {
                    row.href = matchedHref;
                }
            }
        }
    }
};

const fixCatacombLinks = (db, locationLookup) => {
    const articleIds = ['catacombs-detailed-guide', 'catacombs-necropolis'];

    for (const articleId of articleIds) {
        const article = db.articles[articleId];

        if (!article) {
            continue;
        }

        const selfHref = hrefForArticle(articleId);

        for (const block of article.blocks || []) {
            if (block.type !== 'table') {
                continue;
            }

            for (const row of block.rows || []) {
                let matchedHref = '';

                for (const cell of row.cells || []) {
                    const targetId = locationLookup.get(normalize(cell.value));

                    if (!targetId) {
                        continue;
                    }

                    matchedHref = hrefForArticle(targetId);

                    if (!cell.href || cell.href === selfHref || /section\.html\?section=locations/.test(cell.href)) {
                        cell.href = matchedHref;
                    }
                }

                if (matchedHref && (!row.href || row.href === selfHref || /section\.html\?section=locations/.test(row.href))) {
                    row.href = matchedHref;
                }
            }
        }
    }
};

const syncCatacombHubLinks = (db) => {
    const guide = db.articles['catacombs-detailed-guide'];
    const hub = db.articles['catacombs-necropolis'];

    if (!guide || !hub) {
        return;
    }

    const guideTable = (guide.blocks || []).find((block) => block.type === 'table' && /Катакомбы/.test(block.title || ''));
    const hubTable = (hub.blocks || []).find((block) => block.type === 'table' && /Catacombs/.test(block.title || ''));

    if (!guideTable || !hubTable) {
        return;
    }

    for (let index = 0; index < Math.min(guideTable.rows.length, hubTable.rows.length); index += 1) {
        const sourceHref = guideTable.rows[index]?.cells?.[0]?.href;

        if (!sourceHref) {
            continue;
        }

        hubTable.rows[index].href = sourceHref;

        if (hubTable.rows[index].cells?.[0]) {
            hubTable.rows[index].cells[0].href = sourceHref;
        }
    }
};

const upsertItemsResourcesArticle = (db) => {
    const article = {
        id: 'items-resources',
        section: 'items',
        group: 'catalog',
        title: 'Ресурсы Lineage 2 - Полный гайд',
        summary: 'Локальный хаб по ресурсам, рецептам, спойлу, манору и крафту для экономики персонажа.',
        eyebrow: 'Предметы | Ресурсы',
        meta: [{ label: 'Источник структуры', value: 'L2INT предметы / ресурсы и рецепты' }],
        intro: [
            'Раздел объединяет материалы, которые чаще всего нужны для крафта, спойла, манора и экономического фарма.',
            'Структура подобрана по логике раздела предметов на l2int.ru: ресурсы, рецепты и связанные игровые системы.'
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: ['spoiler-guide', 'manor-guide', 'archive-guide-item-5266-craft-interlude', 'items-armor', 'items-weapons'],
        order: 0,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Раздел', value: 'Предметы' },
            { label: 'Подкатегории', value: 'Ресурсы, рецепты, спойл, манор, крафт' },
        ],
        source: {
            url: 'https://l2int.ru/predmety',
            path: 'predmety',
            snapshot: 'manual-2026-04-12',
            sourceType: 'reference',
        },
        aliases: ['resources', 'items-materials'],
        blocks: [
            {
                id: 'items-resources-overview',
                type: 'prose',
                title: 'Что входит в раздел',
                paragraphs: [
                    'На l2int раздел предметов вынесен отдельно от оружия и брони и включает ресурсы и рецепты как основу крафта. Здесь собраны локальные материалы по той же логике, но без внешних переходов.',
                    'Используйте раздел для быстрого входа в спойл-маршруты, манор, крафт и связанные экономические гайды.'
                ],
            },
            {
                id: 'items-resources-table',
                type: 'table',
                title: 'Ресурсы и связанные материалы',
                columns: [
                    { key: 'material', label: 'Материал', align: '', width: '' },
                    { key: 'details', label: 'Краткие данные', align: '', width: '' },
                    { key: 'summary', label: 'Описание', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'items-resources-spoil',
                        title: '',
                        href: hrefForArticle('items-resources'),
                        cells: [
                            { value: 'Гайд спойлеру', href: hrefForArticle('spoiler-guide'), html: '' },
                            { value: 'Спойл, точки фарма, ресурсы', href: hrefForArticle('items-resources'), html: '' },
                            { value: 'Практичный маршрут по добыче базовых и редких материалов через spoil.', href: hrefForArticle('items-resources'), html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'items-resources-manor',
                        title: '',
                        href: hrefForArticle('items-resources'),
                        cells: [
                            { value: 'Сбор и сдача манора', href: hrefForArticle('manor-guide'), html: '' },
                            { value: 'Seeds, crops, адена', href: hrefForArticle('items-resources'), html: '' },
                            { value: 'Манор помогает закрывать часть потребностей в ресурсах и ускоряет экономический прогресс.', href: hrefForArticle('items-resources'), html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'items-resources-craft',
                        title: '',
                        href: hrefForArticle('items-resources'),
                        cells: [
                            { value: 'Гайд крафтеру', href: hrefForArticle('archive-guide-item-5266-craft-interlude'), html: '' },
                            { value: 'Рецепты, крафт, производство', href: hrefForArticle('items-resources'), html: '' },
                            { value: 'Связка по рецептам и производству вещей для Warsmith/Maestro.', href: hrefForArticle('items-resources'), html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'items-resources-armor',
                        title: '',
                        href: hrefForArticle('items-resources'),
                        cells: [
                            { value: 'Броня Lineage 2 - Полный гайд', href: hrefForArticle('items-armor'), html: '' },
                            { value: 'Heavy, Light, Robe, Shield', href: hrefForArticle('items-resources'), html: '' },
                            { value: 'Связанные сеты и материалы, которые чаще всего требуют заготовок и рецептов.', href: hrefForArticle('items-resources'), html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'items-resources-jewelry',
                        title: '',
                        href: hrefForArticle('items-resources'),
                        cells: [
                            { value: 'Бижутерия Lineage 2 - Полный гайд', href: hrefForArticle('items-accessories'), html: '' },
                            { value: 'Кольца, серьги, ожерелья', href: hrefForArticle('items-resources'), html: '' },
                            { value: 'Обзор категорий бижутерии и связанных декоративных и боевых предметов.', href: hrefForArticle('items-resources'), html: '' },
                        ],
                        meta: [],
                    },
                ],
                compact: true,
            },
        ],
    };

    db.articles[article.id] = article;

    const catalogGroup = (db.sections?.items?.groups || []).find((group) => group.id === 'catalog');

    if (catalogGroup) {
        catalogGroup.entries = ['items-weapons', 'items-resources', 'items-armor', 'items-accessories'];
    }
};

const renameAccessoriesToJewelry = (db) => {
    const article = db.articles['items-accessories'];

    if (!article) {
        return;
    }

    article.title = 'Бижутерия Lineage 2 - Полный гайд';
    article.summary = 'Локальный хаб по кольцам, серьгам, ожерельям и связанным предметам.';
    article.eyebrow = 'Предметы | Бижутерия';

    if (Array.isArray(article.intro)) {
        article.intro = [
            'Раздел собирает кольца, серьги, ожерелья и связанные декоративные предметы Lineage 2.',
            'Структура повторяет идею бижутерии на l2int.ru, но все переходы остаются внутри сайта.',
        ];
    }

    for (const block of article.blocks || []) {
        if (block.type === 'prose' && block.title === 'Что входит в аксессуары') {
            block.title = 'Что входит в бижутерию';
            block.paragraphs = [
                'Здесь собраны локальные материалы по эпической и обычной бижутерии, а также по декоративным наградам, которые часто ищут отдельно.',
                'Ниже оставлены только внутренние переходы по сайту, чтобы раздел работал как самостоятельный игровой справочник.',
            ];
        }

        if (block.type === 'table' && block.title === 'Аксессуары и связанные материалы') {
            block.title = 'Бижутерия и связанные материалы';

            for (const row of block.rows || []) {
                if (row.id === 'items-accessories-types') {
                    row.cells[0].value = 'Категории бижутерии';
                    row.cells[1].value = 'Кольца, серьги, ожерелья, декоративная бижутерия';
                    row.cells[2].value = 'Часть бижутерии даёт боевые бонусы, часть относится к коллекционным и декоративным наградам.';
                }
            }
        }
    }
};

const rewriteLocationsSection = (db) => {
    const locations = db.sections?.locations;

    if (!locations) {
        return;
    }

    locations.groups = (locations.groups || []).filter((group) => group.id !== 'world');
    locations.landingBlocks = (locations.landingBlocks || []).filter((block) => block.type !== 'imageMap');
};

const cleanAllArticles = (db) => {
    for (const article of Object.values(db.articles || {})) {
        removeMapBlocks(article);
        cleanRelatedWorldMap(article);
        ensureContentBlocks(article);
    }
};

const generateMissingCatacombArticles = (db) => {
    const guide = db.articles['catacombs-detailed-guide'];
    const hub = db.articles['catacombs-necropolis'];
    const catacombGroup = (db.sections?.locations?.groups || []).find((group) => group.id === 'catacombs');

    if (!guide || !hub || !catacombGroup) {
        return;
    }

    const detailedTable = (guide.blocks || []).find((block) => block.type === 'table' && /Катакомбы/.test(block.title || ''));
    const hubTable = (hub.blocks || []).find((block) => block.type === 'table' && /Catacombs/.test(block.title || ''));

    if (!detailedTable || !hubTable) {
        return;
    }

    for (let index = 0; index < detailedTable.rows.length; index += 1) {
        const row = detailedTable.rows[index];
        const hubRow = hubTable.rows[index];
        const articleHref = row.cells?.[0]?.href || '';
        const articleId = (articleHref.match(/article=([^&]+)/) || [])[1];

        if (!articleId || db.articles[articleId]) {
            continue;
        }

        const title = collapse(hubRow?.cells?.[0]?.value || row.cells?.[0]?.value || '');
        const level = collapse(hubRow?.cells?.[1]?.value || row.cells?.[1]?.value || '');
        const location = collapse(hubRow?.cells?.[2]?.value || row.cells?.[2]?.value || '');
        const details = collapse(row.cells?.[3]?.value || '');

        db.articles[articleId] = {
            id: articleId,
            section: 'locations',
            group: 'catacombs',
            title,
            summary: `${title} — обзор входа, уровней и полезного фарма.`,
            eyebrow: 'Локации | Катакомбы',
            meta: [
                { label: 'Уровень', value: level },
                { label: 'Район', value: location },
                { label: 'Фарм', value: details },
            ],
            intro: [
                `${title} подходит для игроков диапазона ${level}.`,
                `Ближайшая точка входа: ${location}.`,
                `Основная ценность локации: ${details}.`,
            ],
            checklist: [],
            steps: [],
            rewards: [],
            tips: [],
            related: ['catacombs-necropolis', 'catacombs-detailed-guide'],
            order: 0,
            layout: 'detail',
            sidebarFacts: [
                { label: 'Уровень', value: level },
                { label: 'Локация', value: location },
                { label: 'Полезно знать', value: details },
            ],
            source: {
                url: 'https://l2int.ru/location/necropolis-catacombs',
                path: 'location/necropolis-catacombs',
                snapshot: 'manual-2026-04-12',
                sourceType: 'reference',
            },
            aliases: [title.toLowerCase()],
            blocks: [
                {
                    id: `${articleId}-overview`,
                    type: 'prose',
                    title: '',
                    paragraphs: [
                        `${title} — одна из основных локаций системы Seven Signs.`,
                        `Ориентируйтесь на диапазон ${level} и заходите через ближайший маршрут: ${location}.`,
                        `В этом месте обычно фармят ${details}.`,
                    ],
                },
                {
                    id: `${articleId}-facts`,
                    type: 'table',
                    title: 'Краткая информация',
                    columns: [
                        { key: 'fact', label: 'Параметр', align: '', width: '' },
                        { key: 'value', label: 'Значение', align: '', width: '' },
                    ],
                    rows: [
                        {
                            id: `${articleId}-row-1`,
                            title: '',
                            href: '',
                            cells: [
                                { value: 'Уровень', href: '', html: '' },
                                { value: level, href: '', html: '' },
                            ],
                            meta: [],
                        },
                        {
                            id: `${articleId}-row-2`,
                            title: '',
                            href: '',
                            cells: [
                                { value: 'Ближайший район', href: '', html: '' },
                                { value: location, href: '', html: '' },
                            ],
                            meta: [],
                        },
                        {
                            id: `${articleId}-row-3`,
                            title: '',
                            href: '',
                            cells: [
                                { value: 'Что фармят', href: '', html: '' },
                                { value: details, href: '', html: '' },
                            ],
                            meta: [],
                        },
                    ],
                },
            ],
        };
    }

    const catacombEntries = [
        'catacombs-detailed-guide',
        'catacombs-necropolis',
        'archive-location-necropolis-catacombs-item-3141-catacomb-of-the-heretic',
        'archive-location-necropolis-catacombs-item-3142-catacomb-of-the-branded',
        'archive-location-necropolis-catacombs-item-3143-catacomb-of-the-apostate',
        'archive-location-necropolis-catacombs-item-3144-catacomb-of-the-witch',
        'archive-location-necropolis-catacombs-item-3145-catacomb-of-dark-omens',
        'archive-location-necropolis-catacombs-item-3146-catacomb-of-the-forbidden-path',
    ].filter((id) => Boolean(db.articles[id]));

    catacombGroup.entries = catacombEntries;
};

const fixCrossLinks = (db) => {
    const questLookup = buildQuestLookup(db.articles);
    const locationLookup = buildLocationLookup(db.articles);
    fixQuestLinks(db, questLookup);
    fixCatacombLinks(db, locationLookup);
};

const main = () => {
    const db = readDatabase();

    fixProfessionGroupLabels(db);
    rewriteLocationsSection(db);
    cleanAllArticles(db);
    renameAccessoriesToJewelry(db);
    upsertItemsResourcesArticle(db);
    generateMissingCatacombArticles(db);
    fixCrossLinks(db);
    syncCatacombHubLinks(db);

    if (db.articles['world-map-locations']) {
        const article = db.articles['world-map-locations'];
        article.title = 'Основные локации мира Lineage 2';
        article.summary = 'Обзор ключевых городов, фарм-зон, катакомб и полезных направлений без карты.';
        article.eyebrow = 'Локации';
        article.group = 'farming';
        article.meta = [
            { label: 'Тип', value: 'Обзор локаций' },
            { label: 'Регионы', value: 'Ключевые города и зоны' },
            { label: 'Маршруты', value: 'PvE, фарм, катакомбы' },
        ];
        article.intro = [
            'Подборка основных городов, фарм-зон, катакомб и полезных направлений для быстрого выбора маршрута.',
            'Используйте таблицы ниже как обзорную навигацию по миру Lineage 2 без отдельной карты.',
        ];
    }

    writeDatabase(db);

    console.log('Canonical data updated: maps removed, profession links fixed, item hubs expanded.');
};

main();
