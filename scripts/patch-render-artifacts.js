#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Patch runtime artifacts (data/page-data) for Render-friendly navigation/perf:
 * - Make weapons groups open category articles directly (landingArticleId)
 * - Remove the redundant "overview" weapons group from navigation
 * - Replace #blockId grade links in hub tables with ?grade=... (no scroll jumps)
 * - Add Dynasty weapons/armor/jewelry as real article artifacts and inject them into S-grade tables
 * - Update shared artifacts (article-summaries, search-index, admin-bootstrap) to include new Dynasty pages
 *
 * This script is intentionally idempotent.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGE_DATA_DIR = path.join(ROOT_DIR, 'data', 'page-data');
const ARTICLES_DIR = path.join(PAGE_DATA_DIR, 'articles');
const SECTIONS_DIR = path.join(PAGE_DATA_DIR, 'sections');

const PUBLIC_BASE_PATH = path.join(PAGE_DATA_DIR, 'public-base.json');
const ARTICLE_SUMMARIES_PATH = path.join(PAGE_DATA_DIR, 'article-summaries.json');
const SEARCH_INDEX_PATH = path.join(PAGE_DATA_DIR, 'search-index.json');
const ADMIN_BOOTSTRAP_PATH = path.join(ROOT_DIR, 'data', 'admin-bootstrap.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, payload) => fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
const readJsonIfExists = (filePath) => (fs.existsSync(filePath) ? readJson(filePath) : null);

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const buildArticleHref = (articleId) => `/pages/article.html?article=${encodeURIComponent(articleId)}`;

const GRADE_LABELS = new Set(['S84', 'S80', 'S', 'A', 'B', 'C', 'D', 'NG', 'No Grade', 'S Grade', 'S80 Grade', 'S84 Grade']);

const rewriteGradeLinksInArticle = (article) => {
    let changed = false;

    (article.blocks || []).forEach((block) => {
        if (block?.type !== 'table' || !Array.isArray(block.rows)) {
            return;
        }

        block.rows.forEach((row) => {
            (row?.cells || []).forEach((cell) => {
                const href = cell?.href;
                if (typeof href !== 'string' || !href.includes('#')) {
                    return;
                }

                const value = String(cell?.value || '').trim();
                if (!GRADE_LABELS.has(value)) {
                    return;
                }

                const base = href.split('#')[0];
                if (!/\/pages\/article\.html\?article=/i.test(base)) {
                    return;
                }

                const sep = base.includes('?') ? '&' : '?';
                cell.href = `${base}${sep}grade=${encodeURIComponent(value)}`;
                changed = true;
            });
        });
    });

    return changed;
};

const gradeBadgeHtml = (gradeLabel) => {
    const normalized = String(gradeLabel || '').trim();
    const iconMap = {
        'No Grade': 'https://l2int.ru/images/all/Rang_NG.gif',
        'NG': 'https://l2int.ru/images/all/Rang_NG.gif',
        'D Grade': 'https://l2int.ru/images/all/Rang_D.gif',
        'C Grade': 'https://l2int.ru/images/all/Rang_C.gif',
        'B Grade': 'https://l2int.ru/images/all/Rang_B.gif',
        'A Grade': 'https://l2int.ru/images/all/Rang_A.gif',
        'S Grade': 'https://l2int.ru/images/all/Grade_S.gif',
        'S80 Grade': 'https://l2int.ru/images/all/Grade_S.gif',
        'S84 Grade': 'https://l2int.ru/images/all/Grade_S.gif',
    };

    const icon = iconMap[normalized] || iconMap['S Grade'];

    return (
        `<span class="weapon-grade">\n` +
        `            <img class="weapon-grade__icon" src="${escapeHtml(icon)}" alt="${escapeHtml(normalized)}" loading="lazy" />\n` +
        `            <span>${escapeHtml(normalized)}</span>\n` +
        `        </span>`
    );
};

const buildWeaponTableCellHtml = ({ name, ru, icon }) =>
    `
        <span class="weapon-table__item">
            <img class="wiki-item-thumb" src="${escapeHtml(icon)}" alt="${escapeHtml(name)} ${escapeHtml(ru)}" loading="lazy" />
            <span class="wiki-item-link">
                <span class="wiki-item-link__en">${escapeHtml(name)}</span>
                <span class="wiki-item-link__ru">${escapeHtml(ru)}</span>
            </span>
        </span>
    `.trim();

const buildLinkedNameHtml = ({ name, ru, href }) =>
    `
        <a class="wiki-item-link" href="${escapeHtml(href)}">
            <span class="wiki-item-link__en">${escapeHtml(name)}</span>
            <span class="wiki-item-link__ru">${escapeHtml(ru)}</span>
        </a>
    `.trim();

const DYNASTY_WEAPONS = [
    {
        id: 'weapon-dynasty-sword',
        name: 'Dynasty Sword',
        ru: 'Меч Династии',
        group: 'swords',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png',
    },
    {
        id: 'weapon-dynasty-blade',
        name: 'Dynasty Blade',
        ru: 'Клинок Династии',
        group: 'swords',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png',
    },
    {
        id: 'weapon-dynasty-knife',
        name: 'Dynasty Knife',
        ru: 'Нож Династии',
        group: 'daggers',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png',
    },
    {
        id: 'weapon-dynasty-dual-daggers',
        name: 'Dynasty Dual Daggers',
        ru: 'Парные Кинжалы Династии',
        group: 'daggers',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png',
    },
    {
        id: 'weapon-dynasty-bow',
        name: 'Dynasty Bow',
        ru: 'Лук Династии',
        group: 'bows',
        patk: 723,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png',
    },
    {
        id: 'weapon-dynasty-crossbow',
        name: 'Dynasty Crossbow',
        ru: 'Арбалет Династии',
        group: 'bows',
        patk: 723,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png',
    },
    {
        id: 'weapon-dynasty-great-sword',
        name: 'Dynasty Great Sword',
        ru: 'Двуручный Меч Династии',
        group: 'two-handed',
        patk: 485,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png',
    },
    {
        id: 'weapon-dynasty-staff',
        name: 'Dynasty Staff',
        ru: 'Посох Династии',
        group: 'blunt',
        patk: 323,
        matk: 244,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png',
    },
    {
        id: 'weapon-dynasty-mace',
        name: 'Dynasty Mace',
        ru: 'Булава Династии',
        group: 'blunt',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png',
    },
    {
        id: 'weapon-dynasty-dual-swords',
        name: 'Dynasty Dual Swords',
        ru: 'Парные Мечи Династии',
        group: 'duals',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png',
    },
    {
        id: 'weapon-dynasty-two-handed-staff',
        name: 'Dynasty Two-Handed Staff',
        ru: 'Двуручный Посох Династии',
        group: 'two-handed-blunts',
        patk: 388,
        matk: 292,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png',
    },
    {
        id: 'weapon-dynasty-fist',
        name: 'Dynasty Fist',
        ru: 'Кастет Династии',
        group: 'fists',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png',
    },
    {
        id: 'weapon-dynasty-pike',
        name: 'Dynasty Pike',
        ru: 'Пика Династии',
        group: 'pole',
        patk: 389,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png',
    },
    {
        id: 'weapon-dynasty-rapier',
        name: 'Dynasty Rapier',
        ru: 'Рапира Династии',
        group: 'rapier',
        patk: 405,
        matk: 161,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png',
    },
    {
        id: 'weapon-dynasty-magic-book',
        name: 'Dynasty Magic Book',
        ru: 'Магическая Книга Династии',
        group: 'magic-books',
        patk: 242,
        matk: 244,
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png',
    },
];

const DYNASTY_ARMOR = {
    heavy: [
        {
            name: 'Dynasty Breastplate',
            ru: 'Кираса Династии',
            pdef: 293,
            grade: 'S',
            slot: 'Chest',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_breastplate_i00.png',
        },
        {
            name: 'Dynasty Gaiters',
            ru: 'Набедренники Династии',
            pdef: 183,
            grade: 'S',
            slot: 'Legs',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gaiters_i00.png',
        },
        {
            name: 'Dynasty Gauntlets',
            ru: 'Рукавицы Династии',
            pdef: 117,
            grade: 'S',
            slot: 'Gloves',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gauntlets_i00.png',
        },
        {
            name: 'Dynasty Boots',
            ru: 'Сапоги Династии',
            pdef: 117,
            grade: 'S',
            slot: 'Feet',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_boots_i00.png',
        },
        {
            name: 'Dynasty Helmet',
            ru: 'Шлем Династии',
            pdef: 146,
            grade: 'S',
            slot: 'Head',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_helmet_i00.png',
        },
    ],
    light: [
        {
            name: 'Dynasty Leather Armor',
            ru: 'Кожаный Доспех Династии',
            pdef: 220,
            grade: 'S',
            slot: 'Chest',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_vest_i00.png',
        },
        {
            name: 'Dynasty Leather Leggings',
            ru: 'Кожаные Поножи Династии',
            pdef: 137,
            grade: 'S',
            slot: 'Legs',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_leggings_i00.png',
        },
        {
            name: 'Dynasty Leather Gloves',
            ru: 'Кожаные Перчатки Династии',
            pdef: 88,
            grade: 'S',
            slot: 'Gloves',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_gloves_i00.png',
        },
        {
            name: 'Dynasty Leather Boots',
            ru: 'Кожаные Сапоги Династии',
            pdef: 88,
            grade: 'S',
            slot: 'Feet',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_boots_i00.png',
        },
    ],
    robe: [
        {
            name: 'Dynasty Tunic',
            ru: 'Туника Династии',
            pdef: 147,
            mdef: 20,
            grade: 'S',
            slot: 'Chest',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_tunic_i00.png',
        },
        {
            name: 'Dynasty Hose',
            ru: 'Штаны Династии',
            pdef: 92,
            mdef: 12,
            grade: 'S',
            slot: 'Legs',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_hose_i00.png',
        },
        {
            name: 'Dynasty Gloves',
            ru: 'Перчатки Династии',
            pdef: 59,
            mdef: 8,
            grade: 'S',
            slot: 'Gloves',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gloves_i00.png',
        },
        {
            name: 'Dynasty Shoes',
            ru: 'Башмаки Династии',
            pdef: 59,
            mdef: 8,
            grade: 'S',
            slot: 'Feet',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_shoes_i00.png',
        },
    ],
    shield: [
        {
            name: 'Dynasty Shield',
            ru: 'Щит Династии',
            pdef: 329,
            grade: 'S',
            slot: 'Shield',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_shield_i00.png',
        },
    ],
    sigil: [
        {
            name: 'Dynasty Sigil',
            ru: 'Символ Династии',
            pdef: 146,
            grade: 'S',
            slot: 'Sigil',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_sigil_i00.png',
        },
    ],
};

const DYNASTY_JEWELRY = [
    {
        name: 'Dynasty Necklace',
        ru: 'Ожерелье Династии',
        mdef: 66,
        grade: 'S',
        slot: 'Necklace',
        icon: 'https://l2central.info/classic/img/items/accessary_dynasty_necklace_i00.png',
    },
    {
        name: 'Dynasty Earring',
        ru: 'Серьга Династии',
        mdef: 50,
        grade: 'S',
        slot: 'Earring',
        icon: 'https://l2central.info/classic/img/items/accessary_dynasty_earring_i00.png',
    },
    {
        name: 'Dynasty Ring',
        ru: 'Кольцо Династии',
        mdef: 37,
        grade: 'S',
        slot: 'Ring',
        icon: 'https://l2central.info/classic/img/items/accessary_dynasty_ring_i00.png',
    },
];

const weaponGroupLabels = {
    swords: 'Мечи',
    daggers: 'Кинжалы',
    bows: 'Луки',
    'two-handed': 'Двуручные мечи',
    blunt: 'Дубинки',
    duals: 'Дуалы',
    'two-handed-blunts': 'Двуручные дубинки',
    fists: 'Кастеты',
    pole: 'Алебарды',
    rapier: 'Рапиры',
    'magic-books': 'Магические книги',
};

const armorEyebrows = {
    heavy: 'Предметы | Тяжелая броня',
    light: 'Предметы | Легкая броня',
    robe: 'Предметы | Магическая броня',
    shield: 'Предметы | Щиты',
    sigil: 'Предметы | Щиты',
};

const buildDynastyWeaponArticle = (item) => {
    const categoryId = `weapons-${item.group === 'two-handed-blunts' ? 'two-handed-blunt' : item.group}`;
    const title = `${item.name} (${item.ru})`;
    const href = buildArticleHref(item.id);

    return {
        id: item.id,
        section: 'weapons',
        group: item.group,
        title,
        summary: `${title} — S Grade, P. Atk ${item.patk}, M. Atk ${item.matk}.`,
        eyebrow: `Оружие | ${weaponGroupLabels[item.group] || item.group}`,
        meta: [
            { label: 'Физ. Атк. \\ P. Atk.', value: String(item.patk) },
            { label: 'Маг. Атк. \\ M. Atk.', value: String(item.matk) },
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [
            `${item.name} (${item.ru}) — оружие S Grade серии Dynasty. Добавлено в локальную базу, чтобы все ссылки работали внутри сайта.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [categoryId],
        order: 9999,
        layout: '',
        sidebarFacts: [],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'base-stats',
                type: 'table',
                title: 'Базовые характеристики',
                columns: [
                    { key: 'fact', label: 'Параметр', align: '', width: '' },
                    { key: 'value', label: 'Значение', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        cells: [
                            { value: 'Физ. Атк. \\ P. Atk.', html: '' },
                            { value: String(item.patk), html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Маг. Атк. \\ M. Atk.', html: '' },
                            { value: String(item.matk), html: '' },
                        ],
                    },
                    {
                        id: 'row-3',
                        cells: [
                            { value: 'Ранг \\ Grade', html: '' },
                            { value: 'S Grade', html: '' },
                        ],
                    },
                    {
                        id: 'row-4',
                        cells: [
                            { value: 'Открыть страницу', html: '' },
                            { value: 'Перейти', href, html: `<a href="${escapeHtml(href)}">Перейти</a>` },
                        ],
                    },
                ],
                compact: false,
            },
        ],
    };
};

const toSlugIdPart = (name) => String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const buildDynastyArmorArticleId = (item) => `armor-dynasty-${toSlugIdPart(item.name)}`;
const buildDynastyJewelryArticleId = (item) => `jewelry-dynasty-${toSlugIdPart(item.name)}`;

const buildDynastyArmorArticle = (groupId, item) => {
    const articleId = buildDynastyArmorArticleId(item);
    const title = `${item.name} (${item.ru})`;
    const href = buildArticleHref(articleId);

    const relatedMap = {
        heavy: 'items-armor-heavy-armor',
        light: 'items-armor-light-armor',
        robe: 'items-armor-magic-armor',
        shield: 'items-armor-shields',
        sigil: 'items-armor-shields',
    };

    return {
        id: articleId,
        section: 'items',
        group: 'armor',
        title,
        summary: `Физ. Защ. \\ P. Def: ${item.pdef} • Ранг \\ Grade: S Grade`,
        eyebrow: armorEyebrows[groupId] || 'Предметы | Броня',
        meta: [
            { label: 'Физ. Защ. \\ P. Def', value: String(item.pdef) },
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [`${item.name} (${item.ru}) — S Grade броня серии Dynasty. Добавлено в локальную базу.`],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [relatedMap[groupId]].filter(Boolean),
        order: 9999,
        layout: '',
        sidebarFacts: [],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'base-stats',
                type: 'table',
                title: 'Базовые характеристики',
                columns: [
                    { key: 'fact', label: 'Параметр', align: '', width: '' },
                    { key: 'value', label: 'Значение', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        cells: [
                            { value: 'Физ. Защ. \\ P. Def', html: '' },
                            { value: String(item.pdef), html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Ранг \\ Grade', html: '' },
                            { value: 'S Grade', html: '' },
                        ],
                    },
                    {
                        id: 'row-3',
                        cells: [
                            { value: 'Открыть страницу', html: '' },
                            { value: 'Перейти', href, html: `<a href="${escapeHtml(href)}">Перейти</a>` },
                        ],
                    },
                ],
                compact: false,
            },
        ],
    };
};

const buildDynastyJewelryArticle = (item) => {
    const articleId = buildDynastyJewelryArticleId(item);
    const title = `${item.name} (${item.ru})`;
    const href = buildArticleHref(articleId);

    const relatedMap = {
        Ring: 'items-jewelry-rings',
        Earring: 'items-jewelry-earrings',
        Necklace: 'items-jewelry-necklaces',
    };

    return {
        id: articleId,
        section: 'items',
        group: 'accessories',
        title,
        summary: `Маг. Защ. \\ M. Def: ${item.mdef} • Ранг \\ Grade: S Grade`,
        eyebrow:
            item.slot === 'Ring'
                ? 'Предметы | Кольца'
                : item.slot === 'Earring'
                  ? 'Предметы | Серьги'
                  : 'Предметы | Ожерелья',
        meta: [
            { label: 'Маг. Защ. \\ M. Def', value: String(item.mdef) },
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [`${item.name} (${item.ru}) — S Grade бижутерия серии Dynasty. Добавлено в локальную базу.`],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [relatedMap[item.slot] || 'items-accessories'],
        order: 9999,
        layout: '',
        sidebarFacts: [],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'base-stats',
                type: 'table',
                title: 'Базовые характеристики',
                columns: [
                    { key: 'fact', label: 'Параметр', align: '', width: '' },
                    { key: 'value', label: 'Значение', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        cells: [
                            { value: 'Маг. Защ. \\ M. Def', html: '' },
                            { value: String(item.mdef), html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Ранг \\ Grade', html: '' },
                            { value: 'S Grade', html: '' },
                        ],
                    },
                    {
                        id: 'row-3',
                        cells: [
                            { value: 'Открыть страницу', html: '' },
                            { value: 'Перейти', href, html: `<a href="${escapeHtml(href)}">Перейти</a>` },
                        ],
                    },
                ],
                compact: false,
            },
        ],
    };
};

const ensureDir = (targetPath) => {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
};

const upsertArticleArtifact = (article) => {
    ensureDir(ARTICLES_DIR);
    const targetPath = path.join(ARTICLES_DIR, `${article.id}.json`);
    const existing = readJsonIfExists(targetPath);

    if (existing) {
        // Keep blocks if user already edited them manually in the repo.
        // Our goal is to ensure the page exists + has basic stats.
        const merged = {
            ...existing,
            ...article,
            blocks: Array.isArray(existing.blocks) && existing.blocks.length ? existing.blocks : article.blocks,
        };
        writeJson(targetPath, merged);
        return { changed: true, path: targetPath };
    }

    writeJson(targetPath, article);
    return { changed: true, path: targetPath };
};

const addDynastyWeaponsToCategoryTables = () => {
    let updated = 0;

    const byGroup = new Map();
    DYNASTY_WEAPONS.forEach((item) => {
        if (!byGroup.has(item.group)) {
            byGroup.set(item.group, []);
        }
        byGroup.get(item.group).push(item);
    });

    for (const [groupId, items] of byGroup.entries()) {
        const categoryArticleId =
            groupId === 'two-handed-blunts'
                ? 'weapons-two-handed-blunt'
                : groupId === 'two-handed'
                  ? 'weapons-two-handed'
                  : `weapons-${groupId}`;

        const articlePath = path.join(ARTICLES_DIR, `${categoryArticleId}.json`);
        const category = readJsonIfExists(articlePath);

        if (!category) {
            console.warn(`[dynasty] Missing category article: ${categoryArticleId}`);
            continue;
        }

        const gradeTables = (category.blocks || []).filter((block) => block?.type === 'table');
        let sTable = gradeTables.find((block) => block.id === 's-grade-table' || String(block.title || '').trim() === 'S Grade');

        const ensureSGradeTable = () => {
            if (sTable) {
                return;
            }

            // Some categories (e.g. rapiers) might not have an S-grade table in the current import.
            const sampleTable =
                gradeTables.find((block) => String(block.title || '').includes('S80')) ||
                gradeTables.find((block) => String(block.title || '').includes('S84')) ||
                gradeTables[0];

            if (!sampleTable) {
                return;
            }

            sTable = {
                id: 's-grade-table',
                type: 'table',
                title: 'S Grade',
                columns: sampleTable.columns || [],
                rows: [],
                compact: Boolean(sampleTable.compact),
            };

            const ngIndex = (category.blocks || []).findIndex((block) => block?.type === 'table' && String(block.title || '').trim() === 'No Grade');
            const insertAt = ngIndex >= 0 ? ngIndex + 1 : (category.blocks || []).length;
            category.blocks = (category.blocks || []).slice(0, insertAt).concat([sTable]).concat((category.blocks || []).slice(insertAt));
        };

        ensureSGradeTable();
        if (!sTable) {
            console.warn(`[dynasty] Could not create S-grade table for: ${categoryArticleId}`);
            continue;
        }

        const defaultTypeValue =
            sTable.rows?.[0]?.cells?.[4]?.value ||
            gradeTables.find((block) => String(block.title || '').includes('S80'))?.rows?.[0]?.cells?.[4]?.value ||
            '';

        const existingHrefs = new Set(
            (sTable.rows || [])
                .flatMap((row) => (row?.cells || []).map((cell) => cell?.href).filter(Boolean))
                .map((href) => String(href))
        );

        let didChange = false;
        items.forEach((item) => {
            const href = buildArticleHref(item.id);
            if (existingHrefs.has(href)) {
                return;
            }

            (sTable.rows || (sTable.rows = [])).push({
                id: `dynasty-${item.id}`,
                cells: [
                    {
                        value: `${item.name} / ${item.ru}`,
                        href,
                        html: buildWeaponTableCellHtml(item),
                    },
                    { value: String(item.patk) },
                    { value: String(item.matk) },
                    { value: '—' },
                    { value: defaultTypeValue },
                    { value: 'S Grade', html: gradeBadgeHtml('S Grade') },
                ],
            });
            didChange = true;
        });

        if (didChange) {
            writeJson(articlePath, category);
            updated += 1;
        }
    }

    return updated;
};

const addDynastyArmorToTables = () => {
    const slotToTarget = (armorGroup, slot) => {
        if (slot === 'Gloves') return 'items-armor-gloves';
        if (slot === 'Feet') return 'items-armor-boots';
        if (slot === 'Head') return 'items-armor-helmet';
        if (slot === 'Shield' || slot === 'Sigil') return 'items-armor-shields';

        if (armorGroup === 'heavy') return 'items-armor-heavy-armor';
        if (armorGroup === 'light') return 'items-armor-light-armor';
        return 'items-armor-magic-armor';
    };

    const addRow = (targetArticleId, articleId, item, statValue) => {
        const targetPath = path.join(ARTICLES_DIR, `${targetArticleId}.json`);
        const target = readJsonIfExists(targetPath);
        if (!target) {
            console.warn(`[dynasty] Missing armor category article: ${targetArticleId}`);
            return false;
        }

        const sTable = (target.blocks || []).find((block) => block?.type === 'table' && String(block.title || '').trim() === 'S Grade');
        if (!sTable) {
            console.warn(`[dynasty] Missing S-grade table in: ${targetArticleId}`);
            return false;
        }

        const href = buildArticleHref(articleId);
        const existing = new Set(
            (sTable.rows || [])
                .flatMap((row) => [row?.href, ...(row?.cells || []).map((cell) => cell?.href)])
                .filter(Boolean)
                .map(String)
        );
        if (existing.has(href)) {
            return false;
        }

        const display = `${item.name} (${item.ru})`;
        (sTable.rows || (sTable.rows = [])).push({
            id: `dynasty-${articleId}`,
            href,
            cells: [
                {
                    value: display,
                    html: `<img class="wiki-item-thumb" src="${escapeHtml(item.icon)}" alt="${escapeHtml(display)}" loading="lazy" />`,
                },
                {
                    value: display,
                    href,
                    html: buildLinkedNameHtml({ name: item.name, ru: item.ru, href }),
                },
                { value: String(statValue) },
                { value: '—' },
                { value: 'S Grade' },
            ],
        });

        writeJson(targetPath, target);
        return true;
    };

    let touched = 0;

    for (const [armorGroup, items] of Object.entries(DYNASTY_ARMOR)) {
        items.forEach((item) => {
            const articleId = buildDynastyArmorArticleId(item);
            const targetArticleId = slotToTarget(armorGroup, item.slot);
            const did = addRow(targetArticleId, articleId, item, item.pdef);
            if (did) touched += 1;
        });
    }

    return touched;
};

const addDynastyJewelryToTables = () => {
    const slotToTarget = (slot) => {
        if (slot === 'Ring') return 'items-jewelry-rings';
        if (slot === 'Earring') return 'items-jewelry-earrings';
        return 'items-jewelry-necklaces';
    };

    let touched = 0;

    DYNASTY_JEWELRY.forEach((item) => {
        const articleId = buildDynastyJewelryArticleId(item);
        const targetArticleId = slotToTarget(item.slot);
        const targetPath = path.join(ARTICLES_DIR, `${targetArticleId}.json`);
        const target = readJsonIfExists(targetPath);

        if (!target) {
            console.warn(`[dynasty] Missing jewelry category article: ${targetArticleId}`);
            return;
        }

        const sTable = (target.blocks || []).find((block) => block?.type === 'table' && String(block.title || '').trim() === 'S Grade');
        if (!sTable) {
            console.warn(`[dynasty] Missing S-grade table in: ${targetArticleId}`);
            return;
        }

        const href = buildArticleHref(articleId);
        const existing = new Set(
            (sTable.rows || [])
                .flatMap((row) => [row?.href, ...(row?.cells || []).map((cell) => cell?.href)])
                .filter(Boolean)
                .map(String)
        );
        if (existing.has(href)) {
            return;
        }

        const display = `${item.name} (${item.ru})`;
        (sTable.rows || (sTable.rows = [])).push({
            id: `dynasty-${articleId}`,
            href,
            cells: [
                {
                    value: display,
                    html: `<img class="wiki-item-thumb" src="${escapeHtml(item.icon)}" alt="${escapeHtml(display)}" loading="lazy" />`,
                },
                {
                    value: display,
                    href,
                    html: buildLinkedNameHtml({ name: item.name, ru: item.ru, href }),
                },
                { value: String(item.mdef) },
                { value: '—' },
                { value: 'S Grade' },
            ],
        });

        writeJson(targetPath, target);
        touched += 1;
    });

    return touched;
};

const patchWeaponsNavigationArtifacts = () => {
    const publicBase = readJson(PUBLIC_BASE_PATH);
    const weaponsSectionPath = path.join(SECTIONS_DIR, 'weapons.json');
    const weaponsSection = readJsonIfExists(weaponsSectionPath);

    if (!weaponsSection) {
        throw new Error('Missing weapons section artifact: data/page-data/sections/weapons.json');
    }

    const landingByGroupId = new Map();

    weaponsSection.groups = (weaponsSection.groups || [])
        .filter((group) => group?.id !== 'overview')
        .map((group) => {
            const landing = (group.entries || [])[0] || '';
            if (landing) {
                group.landingArticleId = landing;
                landingByGroupId.set(group.id, landing);
            }
            return group;
        });

    writeJson(weaponsSectionPath, weaponsSection);

    const publicWeapons = publicBase.sections?.weapons;
    if (publicWeapons?.groups?.length) {
        publicWeapons.groups = publicWeapons.groups
            .filter((group) => group?.id !== 'overview')
            .map((group) => {
                const fallback = (group.entries || [])[0] || '';
                const landing = landingByGroupId.get(group.id) || fallback;
                if (landing) {
                    group.landingArticleId = landing;
                }
                return group;
            });
    }

    publicBase.updatedAt = new Date().toISOString();
    writeJson(PUBLIC_BASE_PATH, publicBase);

    return { landingByGroupId };
};

const upsertSharedArtifactsForArticles = (articles) => {
    const publicBase = readJson(PUBLIC_BASE_PATH);
    const articleSummaries = readJson(ARTICLE_SUMMARIES_PATH);
    const searchIndex = readJson(SEARCH_INDEX_PATH);
    const adminBootstrap = readJson(ADMIN_BOOTSTRAP_PATH);

    const sectionTitles = Object.fromEntries(
        Object.values(publicBase.sections || {}).map((section) => [section.id, section.title || section.id])
    );

    const groupTitles = {};
    Object.values(publicBase.sections || {}).forEach((section) => {
        groupTitles[section.id] = Object.fromEntries((section.groups || []).map((group) => [group.id, group.label || group.id]));
    });

    const ensureArticleSummary = (article) => {
        articleSummaries[article.id] = {
            id: article.id,
            section: article.section || '',
            group: article.group || '',
            title: article.title || '',
            summary: article.summary || '',
            eyebrow: article.eyebrow || '',
            order: Number.isFinite(Number(article.order)) ? Number(article.order) : 9999,
            layout: article.layout || '',
            heroImage: article.heroImage || '',
            meta: article.meta || [],
            sidebarFacts: article.sidebarFacts || [],
            aliases: article.aliases || [],
            related: article.related || [],
            source: article.source || {},
        };
    };

    const ensureSearchRecord = (article) => {
        const sectionId = article.section || '';
        const groupId = article.group || '';
        const sectionTitle = sectionTitles[sectionId] || sectionId;
        const groupTitle = groupTitles?.[sectionId]?.[groupId] || groupId;

        const searchableText = [
            article.title,
            article.summary,
            article.eyebrow,
            ...(article.aliases || []),
            ...(article.intro || []),
            ...(article.meta || []).flatMap((item) => [item?.label, item?.value]),
            ...(article.blocks || []).flatMap((block) => [block?.title, ...(block?.items || []), ...(block?.paragraphs || [])]),
        ]
            .filter(Boolean)
            .join(' ');

        const next = {
            id: article.id,
            type: 'article',
            title: article.title || '',
            summary: article.summary || '',
            section: sectionId,
            sectionTitle,
            group: groupId,
            groupTitle,
            previewImage: article.heroImage || '',
            searchableText,
        };

        const index = searchIndex.findIndex((record) => record?.type === 'article' && record?.id === article.id);
        if (index >= 0) {
            searchIndex[index] = next;
        } else {
            searchIndex.push(next);
        }
    };

    const ensureAdminBootstrap = (article) => {
        if (!adminBootstrap?.database?.articles) {
            return;
        }

        if (!Array.isArray(adminBootstrap.articleSummaryIds)) {
            adminBootstrap.articleSummaryIds = [];
        }

        if (!adminBootstrap.articleSummaryIds.includes(article.id)) {
            adminBootstrap.articleSummaryIds.push(article.id);
        }

        adminBootstrap.database.articles[article.id] = {
            id: article.id,
            section: article.section || '',
            group: article.group || '',
            title: article.title || '',
            summary: article.summary || '',
            eyebrow: article.eyebrow || '',
            order: Number.isFinite(Number(article.order)) ? Number(article.order) : 9999,
            layout: article.layout || '',
            heroImage: article.heroImage || '',
            meta: article.meta || [],
            sidebarFacts: article.sidebarFacts || [],
            aliases: article.aliases || [],
            related: article.related || [],
            source: article.source || {},
        };
    };

    articles.forEach((article) => {
        ensureArticleSummary(article);
        ensureSearchRecord(article);
        ensureAdminBootstrap(article);
    });

    adminBootstrap.updatedAt = new Date().toISOString();

    writeJson(ARTICLE_SUMMARIES_PATH, articleSummaries);
    writeJson(SEARCH_INDEX_PATH, searchIndex);
    writeJson(ADMIN_BOOTSTRAP_PATH, adminBootstrap);
};

const patchHubArticles = () => {
    const hubIds = ['items-weapons', 'weapons-overview', 'items-armor', 'items-accessories'];
    let updated = 0;

    hubIds.forEach((articleId) => {
        const filePath = path.join(ARTICLES_DIR, `${articleId}.json`);
        const article = readJsonIfExists(filePath);
        if (!article) return;

        const changed = rewriteGradeLinksInArticle(article);
        if (changed) {
            writeJson(filePath, article);
            updated += 1;
        }
    });

    return updated;
};

const main = () => {
    if (!fs.existsSync(PAGE_DATA_DIR)) {
        throw new Error('Missing data/page-data. Run scripts/build-runtime-artifacts.js first.');
    }

    console.log('[patch] Updating weapons navigation artifacts...');
    patchWeaponsNavigationArtifacts();

    console.log('[patch] Rewriting hub grade links (remove #anchors)...');
    const hubTouched = patchHubArticles();
    console.log(`[patch] Hub articles updated: ${hubTouched}`);

    console.log('[patch] Creating Dynasty article artifacts...');
    const createdArticles = [];

    DYNASTY_WEAPONS.forEach((item) => {
        const article = buildDynastyWeaponArticle(item);
        upsertArticleArtifact(article);
        createdArticles.push(article);
    });

    Object.entries(DYNASTY_ARMOR).forEach(([groupId, items]) => {
        items.forEach((item) => {
            const article = buildDynastyArmorArticle(groupId, item);
            upsertArticleArtifact(article);
            createdArticles.push(article);
        });
    });

    DYNASTY_JEWELRY.forEach((item) => {
        // Normalize slot naming to match our relatedMap keys
        const normalizedItem = {
            ...item,
            slot: item.slot === 'Neck' ? 'Necklace' : item.slot,
        };
        const article = buildDynastyJewelryArticle(normalizedItem);
        upsertArticleArtifact(article);
        createdArticles.push(article);
    });

    console.log('[patch] Injecting Dynasty items into category tables...');
    const weaponTables = addDynastyWeaponsToCategoryTables();
    const armorTables = addDynastyArmorToTables();
    const jewelryTables = addDynastyJewelryToTables();
    console.log(`[patch] Weapon categories touched: ${weaponTables}`);
    console.log(`[patch] Armor rows added: ${armorTables}`);
    console.log(`[patch] Jewelry rows added: ${jewelryTables}`);

    console.log('[patch] Updating shared artifacts (summaries/search/admin bootstrap)...');
    upsertSharedArtifactsForArticles(createdArticles);

    console.log(`[patch] Done. Dynasty articles ensured: ${createdArticles.length}`);
};

main();
