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
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGE_DATA_DIR = path.join(ROOT_DIR, 'data', 'page-data');
const ARTICLES_DIR = path.join(PAGE_DATA_DIR, 'articles');
const SECTIONS_DIR = path.join(PAGE_DATA_DIR, 'sections');

const PUBLIC_BASE_PATH = path.join(PAGE_DATA_DIR, 'public-base.json');
const ARTICLE_SUMMARIES_PATH = path.join(PAGE_DATA_DIR, 'article-summaries.json');
const SEARCH_INDEX_PATH = path.join(PAGE_DATA_DIR, 'search-index.json');
const ADMIN_BOOTSTRAP_PATH = path.join(ROOT_DIR, 'data', 'admin-bootstrap.json');
const DYNASTY_ASSET_DIR = path.join(ROOT_DIR, 'assets', 'img', 'dynasty');
const DYNASTY_ASSET_WEB_DIR = '/assets/img/dynasty';

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
const FETCH_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
    accept: 'application/json,text/html,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

const fetchJson = async (url) => {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
};

const fetchBinary = async (url) => {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
};

const normalizeDynastyAssetBase = (value = '') =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const buildDynastyLocalAssetPath = (slug, ext = '.jpg') => `${DYNASTY_ASSET_WEB_DIR}/${normalizeDynastyAssetBase(slug)}${ext}`;

const listAllPageImages = async (pageTitle) => {
    const found = [];
    let continuation = '';

    while (true) {
        const query = new URLSearchParams({
            action: 'query',
            titles: pageTitle,
            prop: 'images',
            imlimit: 'max',
            format: 'json',
        });

        if (continuation) {
            query.set('imcontinue', continuation);
        }

        const payload = await fetchJson(`https://linedia.ru/api.php?${query.toString()}`);
        const pages = payload?.query?.pages || {};
        const page = Object.values(pages)[0] || {};
        const images = Array.isArray(page?.images) ? page.images.map((image) => image?.title).filter(Boolean) : [];
        found.push(...images);

        continuation = String(payload?.['query-continue']?.images?.imcontinue || '').trim();
        if (!continuation) {
            break;
        }
    }

    return Array.from(new Set(found));
};

const getImageInfoUrl = async (fileTitle) => {
    const query = new URLSearchParams({
        action: 'query',
        titles: fileTitle,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
    });
    const payload = await fetchJson(`https://linedia.ru/api.php?${query.toString()}`);
    const pages = payload?.query?.pages || {};
    const page = Object.values(pages)[0] || {};
    return String(page?.imageinfo?.[0]?.url || '').trim();
};

const materializeDynastyRemoteImage = async (item, remoteUrl) => {
    if (!remoteUrl) {
        return '';
    }

    const slug = item?.id || item?.name || crypto.randomUUID();
    const extensionFromUrl = path.extname(new URL(remoteUrl).pathname || '').toLowerCase();
    const extension = extensionFromUrl || '.jpg';
    const assetFileName = `${normalizeDynastyAssetBase(slug)}${extension}`;
    const assetPath = path.join(DYNASTY_ASSET_DIR, assetFileName);
    ensureDir(DYNASTY_ASSET_DIR);

    if (!fs.existsSync(assetPath)) {
        const payload = await fetchBinary(remoteUrl);
        fs.writeFileSync(assetPath, payload);
    }

    const webPath = `${DYNASTY_ASSET_WEB_DIR}/${assetFileName}`;
    item.icon = webPath;
    item.remoteIcon = remoteUrl;
    return webPath;
};

const selectDynastyMediaTitle = (titles, kind, item) => {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    const nameTokens = String(item?.name || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean)
        .filter((token) => token !== 'dynasty');
    const baseCandidates = (Array.isArray(titles) ? titles : []).filter(Boolean);
    const prefix =
        normalizedKind === 'armor'
            ? 'файл:armor '
            : normalizedKind === 'jewelry'
              ? 'файл:accessary '
              : 'файл:weapon ';

    const candidates = baseCandidates.filter((title) => {
        const lower = String(title).toLowerCase();
        if (!lower.startsWith(prefix)) {
            return false;
        }

        if (!lower.includes('dynasty')) {
            return false;
        }

        if (/(recipe|piece|grade|adena|etc |etc_|pannel|unconfirmed|bound|returning hero|foundation|fortune)/i.test(lower)) {
            return false;
        }

        return true;
    });

    const scored = candidates
        .map((title) => {
            const lower = String(title).toLowerCase();
            let score = 0;

            if (/\bi00\b/.test(lower) || /_i00_/.test(lower)) {
                score += 30;
            }
            if (/\bi01\b/.test(lower) || /_i01_/.test(lower)) {
                score += 10;
            }
            nameTokens.forEach((token) => {
                if (lower.includes(token)) {
                    score += 4;
                }
            });

            return { title, score };
        })
        .sort((left, right) => right.score - left.score);

    return scored[0]?.title || '';
};

const ensureLocalDynastyImage = async (item, kind) => {
    const existingLocal = String(item?.icon || '').trim();
    if (existingLocal.startsWith(DYNASTY_ASSET_WEB_DIR)) {
        return existingLocal;
    }

    try {
        const directFileTitle = String(item?.wikiFileTitle || '').trim();
        if (directFileTitle) {
            const directUrl = await getImageInfoUrl(directFileTitle);
            if (directUrl) {
                return materializeDynastyRemoteImage(item, directUrl);
            }
        }

        const pageTitle = String(item?.wikiTitle || item?.name || '').trim();
        if (!pageTitle) {
            return existingLocal;
        }

        const imageTitles = await listAllPageImages(pageTitle);
        const fileTitle = selectDynastyMediaTitle(imageTitles, kind, item);
        if (!fileTitle) {
            return existingLocal;
        }

        const remoteUrl = await getImageInfoUrl(fileTitle);
        if (!remoteUrl) {
            return existingLocal;
        }

        return materializeDynastyRemoteImage(item, remoteUrl);
    } catch (error) {
        console.warn(`[dynasty] Failed to resolve image for ${item?.name || 'item'}: ${error.message}`);
        return existingLocal;
    }
};

const prepareDynastyImages = async () => {
    for (const item of DYNASTY_WEAPONS) {
        await ensureLocalDynastyImage(item, 'weapon');
    }

    for (const items of Object.values(DYNASTY_ARMOR)) {
        for (const item of items) {
            await ensureLocalDynastyImage(item, 'armor');
        }
    }

    for (const item of DYNASTY_JEWELRY) {
        await ensureLocalDynastyImage(item, 'jewelry');
    }
};

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
        wikiFileTitle: 'Файл:Dual dagger i00 0.jpg',
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
        wikiTitle: 'Dynasty Ancient Sword',
        wikiFileTitle: 'Файл:Weapon dynasty ancient sword i00 0.jpg',
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
        wikiTitle: 'Dynasty Dual Sword',
        wikiFileTitle: 'Файл:Weapon dual sword i00 0.jpg',
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png',
    },
    {
        id: 'weapon-dynasty-two-handed-staff',
        name: 'Dynasty Two-Handed Staff',
        ru: 'Двуручный Посох Династии',
        group: 'two-handed-blunts',
        patk: 388,
        matk: 292,
        wikiTitle: 'Dynasty Crusher',
        wikiFileTitle: 'Файл:Weapon dynasty crusher i00 0.jpg',
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png',
    },
    {
        id: 'weapon-dynasty-fist',
        name: 'Dynasty Fist',
        ru: 'Кастет Династии',
        group: 'fists',
        patk: 405,
        matk: 161,
        wikiTitle: 'Dynasty Bagh-Nakh',
        wikiFileTitle: 'Файл:Weapon dynasty jamadhr i00 0.jpg',
        icon: 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png',
    },
    {
        id: 'weapon-dynasty-pike',
        name: 'Dynasty Pike',
        ru: 'Пика Династии',
        group: 'pole',
        patk: 389,
        matk: 161,
        wikiTitle: 'Dynasty Halberd',
        wikiFileTitle: 'Файл:Weapon dynasty spear i00 0.jpg',
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
        wikiTitle: 'Mysterious Book',
        wikiFileTitle: 'Файл:Etc spellbook blue i00 0.jpg',
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
            wikiFileTitle: 'Файл:Armor t91 u i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_breastplate_i00.png',
        },
        {
            name: 'Dynasty Gaiters',
            ru: 'Набедренники Династии',
            pdef: 183,
            grade: 'S',
            slot: 'Legs',
            wikiFileTitle: 'Файл:Armor t91 l i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gaiters_i00.png',
        },
        {
            name: 'Dynasty Gauntlets',
            ru: 'Рукавицы Династии',
            pdef: 117,
            grade: 'S',
            slot: 'Gloves',
            wikiFileTitle: 'Файл:Armor t91 g i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gauntlets_i00.png',
        },
        {
            name: 'Dynasty Boots',
            ru: 'Сапоги Династии',
            pdef: 117,
            grade: 'S',
            slot: 'Feet',
            wikiFileTitle: 'Файл:Armor t91 b i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_boots_i00.png',
        },
        {
            name: 'Dynasty Helmet',
            ru: 'Шлем Династии',
            pdef: 146,
            grade: 'S',
            slot: 'Head',
            wikiFileTitle: 'Файл:Armor helmet i00 0.jpg',
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
            wikiFileTitle: 'Файл:Armor t92 u i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_vest_i00.png',
        },
        {
            name: 'Dynasty Leather Leggings',
            ru: 'Кожаные Поножи Династии',
            pdef: 137,
            grade: 'S',
            slot: 'Legs',
            wikiFileTitle: 'Файл:Armor t92 l i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_leggings_i00.png',
        },
        {
            name: 'Dynasty Leather Gloves',
            ru: 'Кожаные Перчатки Династии',
            pdef: 88,
            grade: 'S',
            slot: 'Gloves',
            wikiFileTitle: 'Файл:Armor t92 g i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_leather_gloves_i00.png',
        },
        {
            name: 'Dynasty Leather Boots',
            ru: 'Кожаные Сапоги Династии',
            pdef: 88,
            grade: 'S',
            slot: 'Feet',
            wikiFileTitle: 'Файл:Armor t92 b i00 0.jpg',
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
            wikiFileTitle: 'Файл:Armor t93 u i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_tunic_i00.png',
        },
        {
            name: 'Dynasty Hose',
            ru: 'Штаны Династии',
            pdef: 92,
            mdef: 12,
            grade: 'S',
            slot: 'Legs',
            wikiFileTitle: 'Файл:Armor t93 l i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_hose_i00.png',
        },
        {
            name: 'Dynasty Gloves',
            ru: 'Перчатки Династии',
            pdef: 59,
            mdef: 8,
            grade: 'S',
            slot: 'Gloves',
            wikiFileTitle: 'Файл:Armor t93 g i00 0.jpg',
            icon: 'https://l2central.info/classic/img/items/armor_dynasty_gloves_i00.png',
        },
        {
            name: 'Dynasty Shoes',
            ru: 'Башмаки Династии',
            pdef: 59,
            mdef: 8,
            grade: 'S',
            slot: 'Feet',
            wikiFileTitle: 'Файл:Armor t93 b i00 0.jpg',
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
            wikiFileTitle: 'Файл:Shield dynasty shield i00 0.jpg',
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
            wikiFileTitle: 'Файл:GF-sigil.jpg',
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
        wikiFileTitle: 'Файл:Accessary dynasty necklace i00 0.jpg',
        icon: 'https://l2central.info/classic/img/items/accessary_dynasty_necklace_i00.png',
    },
    {
        name: 'Dynasty Earring',
        ru: 'Серьга Династии',
        mdef: 50,
        grade: 'S',
        slot: 'Earring',
        wikiFileTitle: 'Файл:Accessary dynasty earring i00 0.jpg',
        icon: 'https://l2central.info/classic/img/items/accessary_dynasty_earring_i00.png',
    },
    {
        name: 'Dynasty Ring',
        ru: 'Кольцо Династии',
        mdef: 37,
        grade: 'S',
        slot: 'Ring',
        wikiFileTitle: 'Файл:Accessary dynasty ring i00 0.jpg',
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

const weaponTypeLabels = {
    swords: 'Меч (Sword)/Одноручный',
    daggers: 'Кинжал (Dagger)/Одноручный',
    bows: 'Лук или арбалет/Двуручный',
    'two-handed': 'Меч (Sword)/Двуручный',
    blunt: 'Дубина (Blunt)/Одноручный',
    duals: 'Парные мечи (Dual Sword)',
    'two-handed-blunts': 'Дубина (Blunt)/Двуручный',
    fists: 'Кастет (Fist Weapon)',
    pole: 'Алебарда (Polearm)/Двуручный',
    rapier: 'Рапира (Rapier)/Одноручный',
    'magic-books': 'Магическая книга/Одноручный',
};

const weaponRoleHints = {
    swords: 'Универсальная линия для мили-классов с упором на стабильный урон и одноручный формат.',
    daggers: 'Лёгкая ветка оружия для даггерщиков и классов с критическим уроном в спину.',
    bows: 'Дальнобойная линия для лучников и арбалетчиков, где важен burst и позиционка.',
    'two-handed': 'Тяжёлая двуручная ветка для сильного фронтального урона и медленного, но мощного размена.',
    blunt: 'Линия дубин и магических blunt-оружий для саппортов, гибридов и части мили-классов.',
    duals: 'Парное оружие для классов, которым нужен ровный темп автоатаки и PvE-комфорт.',
    'two-handed-blunts': 'Двуручные blunt-версии с упором на высокий удар и более редкие, но тяжёлые атаки.',
    fists: 'Ветка кастетов для Tyrant-подобных классов и быстрого melee-стиля.',
    pole: 'Polearm-линия для массового фарма, париков и ситуаций с несколькими целями.',
    rapier: 'Эксклюзивная линия Камаэль с упором на скорость и профиль rapier-классов.',
    'magic-books': 'Магическая книга для Enchanter/маго-ориентированных ролей, где важен M. Atk.',
};

const armorRoleHints = {
    heavy: 'Тяжёлые части Dynasty рассчитаны на фронтлайн, высокий P. Def и сборку тяжёлых сетов.',
    light: 'Лёгкая ветка Dynasty удобна для даггеров, лучников и мобильных физ. классов.',
    robe: 'Робные части Dynasty поддерживают магов и саппортов, которым важны каст и магическая выживаемость.',
    shield: 'Щит Dynasty дополняет tank/support-сборки и закрывает слот защитного офф-хэнда.',
    sigil: 'Sigil Dynasty используется в магических и саппорт-сборках вместо щита, когда нужен другой баланс статов.',
};

const jewelryRoleHints = {
    Ring: 'Кольцо Dynasty усиливает магическую защиту и закрывает базовый слот кольца в S Grade.',
    Earring: 'Серьга Dynasty даёт апгрейд по M. Def для high-level персонажей и сетов бижутерии.',
    Necklace: 'Ожерелье Dynasty — центральная часть S Grade бижутерии с самым заметным вкладом в M. Def.',
};

const buildNavigationTable = (rows) => ({
    id: 'dynasty-navigation',
    type: 'table',
    title: 'Связанные страницы',
    columns: [
        { key: 'page', label: 'Страница', align: '', width: '' },
        { key: 'action', label: 'Переход', align: '', width: '' },
    ],
    rows,
    compact: true,
});

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
    const categoryHref = buildArticleHref(categoryId);
    const typeLabel = weaponTypeLabels[item.group] || 'Оружие';
    const roleHint = weaponRoleHints[item.group] || 'Часть high-level ветки Dynasty.';

    return {
        id: item.id,
        section: 'weapons',
        group: item.group,
        title,
        summary: `${title} — S Grade, ${typeLabel}, P. Atk ${item.patk}, M. Atk ${item.matk}.`,
        eyebrow: `Оружие | ${weaponGroupLabels[item.group] || item.group}`,
        meta: [
            { label: 'Тип', value: typeLabel },
            { label: 'Физ. Атк. \\ P. Atk.', value: String(item.patk) },
            { label: 'Маг. Атк. \\ M. Atk.', value: String(item.matk) },
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [
            `${item.name} (${item.ru}) — базовая версия оружия серии Dynasty в S Grade.`,
            `${roleHint} На живых серверах рядом с этой версией обычно встречаются SA-, attribute-, masterwork- и PvP-варианты той же линии.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [categoryId],
        order: 9999,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Категория', value: weaponGroupLabels[item.group] || item.group },
            { label: 'Тип', value: typeLabel },
            { label: 'P. Atk.', value: String(item.patk) },
            { label: 'M. Atk.', value: String(item.matk) },
            { label: 'Ранг', value: 'S Grade' },
        ],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'dynasty-weapon-overview',
                type: 'prose',
                title: 'Обзор',
                paragraphs: [
                    `${item.name} относится к high-level линейке Dynasty и закрывает S Grade сегмент для своей категории.`,
                    `На этой странице собрана базовая локальная карточка без раздувания на десятки SA-вариантов: удобно быстро открыть предмет, посмотреть ключевые цифры и вернуться в общий каталог ${weaponGroupLabels[item.group] || item.group}.`,
                ],
            },
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
                            { value: 'Тип', html: '' },
                            { value: typeLabel, html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Физ. Атк. \\ P. Atk.', html: '' },
                            { value: String(item.patk), html: '' },
                        ],
                    },
                    {
                        id: 'row-3',
                        cells: [
                            { value: 'Маг. Атк. \\ M. Atk.', html: '' },
                            { value: String(item.matk), html: '' },
                        ],
                    },
                    {
                        id: 'row-4',
                        cells: [
                            { value: 'Ранг \\ Grade', html: '' },
                            { value: 'S Grade', html: '' },
                        ],
                    },
                    {
                        id: 'row-5',
                        cells: [
                            { value: 'Линейка', html: '' },
                            { value: 'Dynasty', html: '' },
                        ],
                    },
                ],
                compact: false,
            },
            {
                id: 'dynasty-weapon-features',
                type: 'list',
                title: 'Что полезно знать',
                items: [
                    'Это базовая обычная версия предмета: для неё обычно существуют SA-, attribute- и PvP-модификации.',
                    'Предмет уже привязан к локальной категории, поэтому из таблиц оружия и бокового меню переход работает напрямую.',
                    `Если нужен быстрый сравнительный просмотр, лучше открывать соседние позиции в разделе «${weaponGroupLabels[item.group] || item.group}».`,
                ],
            },
            {
                id: 'dynasty-weapon-practice',
                type: 'list',
                title: 'Практика и получение',
                items: [
                    'Обычно такие предметы ищут через крафт, рынок, клановый склад или high-level PvE-фарм, где собираются рецепты и материалы линии Dynasty.',
                    'Перед покупкой или крафтом полезно сравнивать не только P. Atk. и M. Atk., но и тип оружия, удобство класса, скорость атаки и наличие нужного SA.',
                    'Для текущего сайта эта карточка служит ещё и полноценной целевой страницей: ссылки из каталога, меню и админки должны вести именно сюда без возврата на главную.',
                ],
            },
            buildNavigationTable([
                {
                    id: 'row-1',
                    cells: [
                        { value: `Категория: ${weaponGroupLabels[item.group] || item.group}` },
                        {
                            value: 'Открыть',
                            href: categoryHref,
                            html: `<a href="${escapeHtml(categoryHref)}">Перейти к категории</a>`,
                        },
                    ],
                },
                {
                    id: 'row-2',
                    cells: [
                        { value: 'Текущая карточка предмета' },
                        { value: 'Открыта сейчас', href, html: `<a href="${escapeHtml(href)}">Открыта сейчас</a>` },
                    ],
                },
            ]),
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
    const slotLabel = item.slot || 'Armor';

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
        summary: `Физ. Защ. \\ P. Def: ${item.pdef} • Слот: ${slotLabel} • Ранг \\ Grade: S Grade`,
        eyebrow: armorEyebrows[groupId] || 'Предметы | Броня',
        meta: [
            { label: 'Слот', value: slotLabel },
            { label: 'Физ. Защ. \\ P. Def', value: String(item.pdef) },
            ...(item.mdef ? [{ label: 'Маг. Защ. \\ M. Def', value: String(item.mdef) }] : []),
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [
            `${item.name} (${item.ru}) — S Grade часть серии Dynasty.`,
            `${armorRoleHints[groupId] || 'Часть high-level серии Dynasty.'} На практике игроки обычно смотрят такие предметы вместе с остальными элементами того же типа или полного сета.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [relatedMap[groupId]].filter(Boolean),
        order: 9999,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Тип', value: armorEyebrows[groupId] || 'Броня' },
            { label: 'Слот', value: slotLabel },
            { label: 'P. Def', value: String(item.pdef) },
            ...(item.mdef ? [{ label: 'M. Def', value: String(item.mdef) }] : []),
            { label: 'Ранг', value: 'S Grade' },
        ],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'dynasty-armor-overview',
                type: 'prose',
                title: 'Обзор',
                paragraphs: [
                    `${item.name} входит в линейку Dynasty и закрывает high-level сегмент своей категории брони.`,
                    `Эта локальная карточка нужна для быстрых переходов из таблиц, бокового меню и админки: здесь собраны главные параметры без лишнего разветвления на десятки соседних предметов.`,
                ],
            },
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
                            { value: 'Слот', html: '' },
                            { value: slotLabel, html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Физ. Защ. \\ P. Def', html: '' },
                            { value: String(item.pdef), html: '' },
                        ],
                    },
                    {
                        id: 'row-3',
                        cells: [
                            { value: 'Маг. Защ. \\ M. Def', html: '' },
                            { value: item.mdef ? String(item.mdef) : '—', html: '' },
                        ],
                    },
                    {
                        id: 'row-4',
                        cells: [
                            { value: 'Ранг \\ Grade', html: '' },
                            { value: 'S Grade', html: '' },
                        ],
                    },
                    {
                        id: 'row-5',
                        cells: [
                            { value: 'Серия', html: '' },
                            { value: 'Dynasty', html: '' },
                        ],
                    },
                ],
                compact: false,
            },
            {
                id: 'dynasty-armor-features',
                type: 'list',
                title: 'Что полезно знать',
                items: [
                    'Страница описывает базовую часть Dynasty без разделения на запечатанные, мастерворк- и редкие варианты.',
                    `Предмет удобнее оценивать в связке с разделом «${armorEyebrows[groupId] || 'Броня'}» и соседними частями той же линейки.`,
                    'Через локальную карточку проще проверить, что сохранение и переходы в админке работают на реальных item-страницах, а не только на общих разделах.',
                ],
            },
            {
                id: 'dynasty-armor-practice',
                type: 'list',
                title: 'Комплект и применение',
                items: [
                    'Ценность части брони зависит не только от её защиты, но и от того, в какой сет она собирается и какую ветку класса поддерживает: heavy, light, robe, shield или sigil.',
                    'На практике игроки обычно сравнивают базовую версию, запечатанные варианты, мастерворк-версии и дальнейшие апгрейды в S80/S84-линейках.',
                    'Для сайта такая карточка важна как отдельная живая запись: изменения из админки должны сохраняться здесь, в родительской категории и в поисковом индексе одновременно.',
                ],
            },
            buildNavigationTable([
                {
                    id: 'row-1',
                    cells: [
                        { value: 'Родительская категория' },
                        {
                            value: 'Открыть',
                            href: buildArticleHref(relatedMap[groupId] || 'items-armor'),
                            html: `<a href="${escapeHtml(buildArticleHref(relatedMap[groupId] || 'items-armor'))}">Перейти к категории</a>`,
                        },
                    ],
                },
                {
                    id: 'row-2',
                    cells: [
                        { value: 'Текущая карточка предмета' },
                        { value: 'Открыта сейчас', href, html: `<a href="${escapeHtml(href)}">Открыта сейчас</a>` },
                    ],
                },
            ]),
        ],
    };
};

const buildDynastyJewelryArticle = (item) => {
    const articleId = buildDynastyJewelryArticleId(item);
    const title = `${item.name} (${item.ru})`;
    const href = buildArticleHref(articleId);
    const slotLabel = item.slot || 'Accessory';

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
        summary: `Маг. Защ. \\ M. Def: ${item.mdef} • Слот: ${slotLabel} • Ранг \\ Grade: S Grade`,
        eyebrow:
            item.slot === 'Ring'
                ? 'Предметы | Кольца'
                : item.slot === 'Earring'
                  ? 'Предметы | Серьги'
                  : 'Предметы | Ожерелья',
        meta: [
            { label: 'Слот', value: slotLabel },
            { label: 'Маг. Защ. \\ M. Def', value: String(item.mdef) },
            { label: 'Ранг \\ Grade', value: 'S Grade' },
        ],
        intro: [
            `${item.name} (${item.ru}) — S Grade предмет бижутерии серии Dynasty.`,
            `${jewelryRoleHints[item.slot] || 'Часть high-level бижутерии Dynasty.'} Такие страницы полезны и как справка, и как реальная цель для проверки переходов и сохранений из админки.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [relatedMap[item.slot] || 'items-accessories'],
        order: 9999,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Слот', value: slotLabel },
            { label: 'M. Def', value: String(item.mdef) },
            { label: 'Серия', value: 'Dynasty' },
            { label: 'Ранг', value: 'S Grade' },
        ],
        source: { sourceType: 'manual-dynasty' },
        aliases: [item.name.toLowerCase(), item.ru.toLowerCase()],
        heroImage: item.icon,
        blocks: [
            {
                id: 'dynasty-jewelry-overview',
                type: 'prose',
                title: 'Обзор',
                paragraphs: [
                    `${item.name} — часть S Grade линейки Dynasty и логичное усиление для high-level персонажей по слоту ${slotLabel}.`,
                    'На странице собрана базовая карточка без разбиения на редкие и временные версии, чтобы переходы по бижутерии были быстрыми и понятными.',
                ],
            },
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
                            { value: 'Слот', html: '' },
                            { value: slotLabel, html: '' },
                        ],
                    },
                    {
                        id: 'row-2',
                        cells: [
                            { value: 'Маг. Защ. \\ M. Def', html: '' },
                            { value: String(item.mdef), html: '' },
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
                            { value: 'Серия', html: '' },
                            { value: 'Dynasty', html: '' },
                        ],
                    },
                ],
                compact: false,
            },
            {
                id: 'dynasty-jewelry-features',
                type: 'list',
                title: 'Что полезно знать',
                items: [
                    'Эта карточка описывает обычную версию предмета и служит локальной точкой входа для всей Dynasty-бижутерии по слоту.',
                    'Если нужен быстрый обзор соседних вариантов, удобнее перейти обратно в категорию колец, серёг или ожерелий.',
                    'На сайте такие страницы важны ещё и тем, что через них проще отлавливать битые ссылки и проблемы сохранения в админке.',
                ],
            },
            {
                id: 'dynasty-jewelry-practice',
                type: 'list',
                title: 'Как использовать',
                items: [
                    'Бижутерия Dynasty обычно рассматривается как часть полного high-level набора, где важны не только цифры M. Def, но и баланс слотов кольца, серёг и ожерелья.',
                    'При сравнении имеет смысл смотреть на доступность на рынке, стоимость заточки и то, насколько быстро слот потом меняется на более поздние S80/S84-вещи.',
                    'Эта локальная страница нужна не только как справка, но и как нормальная конечная точка маршрута: пользователь должен попадать сразу на предмет, а не теряться между каталогом и главной.',
                ],
            },
            buildNavigationTable([
                {
                    id: 'row-1',
                    cells: [
                        { value: 'Родительская категория' },
                        {
                            value: 'Открыть',
                            href: buildArticleHref(relatedMap[item.slot] || 'items-accessories'),
                            html: `<a href="${escapeHtml(buildArticleHref(relatedMap[item.slot] || 'items-accessories'))}">Перейти к категории</a>`,
                        },
                    ],
                },
                {
                    id: 'row-2',
                    cells: [
                        { value: 'Текущая карточка предмета' },
                        { value: 'Открыта сейчас', href, html: `<a href="${escapeHtml(href)}">Открыта сейчас</a>` },
                    ],
                },
            ]),
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
        if (existing?.source?.sourceType === 'manual-dynasty') {
            writeJson(targetPath, article);
            return { changed: true, path: targetPath };
        }

        // Keep blocks if a non-generated article already contains richer custom content.
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
            const existingRow = (sTable.rows || []).find(
                (row) =>
                    String(row?.href || '') === href ||
                    (row?.cells || []).some((cell) => String(cell?.href || '') === href)
            );

            if (existingRow) {
                existingRow.cells = [
                    {
                        value: `${item.name} / ${item.ru}`,
                        href,
                        html: buildWeaponTableCellHtml(item),
                    },
                    { value: String(item.patk) },
                    { value: String(item.matk) },
                    { value: existingRow?.cells?.[3]?.value || '—' },
                    { value: existingRow?.cells?.[4]?.value || defaultTypeValue },
                    { value: 'S Grade', html: gradeBadgeHtml('S Grade') },
                ];
                didChange = true;
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
        const display = `${item.name} (${item.ru})`;
        const existing = new Set(
            (sTable.rows || [])
                .flatMap((row) => [row?.href, ...(row?.cells || []).map((cell) => cell?.href)])
                .filter(Boolean)
                .map(String)
        );
        const existingRow = (sTable.rows || []).find(
            (row) =>
                String(row?.href || '') === href ||
                (row?.cells || []).some((cell) => String(cell?.href || '') === href)
        );

        if (existingRow) {
            existingRow.href = href;
            existingRow.cells = [
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
                { value: existingRow?.cells?.[3]?.value || '—' },
                { value: 'S Grade' },
            ];
            writeJson(targetPath, target);
            return true;
        }

        if (existing.has(href)) {
            return false;
        }
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
        const display = `${item.name} (${item.ru})`;
        const existing = new Set(
            (sTable.rows || [])
                .flatMap((row) => [row?.href, ...(row?.cells || []).map((cell) => cell?.href)])
                .filter(Boolean)
                .map(String)
        );
        const existingRow = (sTable.rows || []).find(
            (row) =>
                String(row?.href || '') === href ||
                (row?.cells || []).some((cell) => String(cell?.href || '') === href)
        );

        if (existingRow) {
            existingRow.href = href;
            existingRow.cells = [
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
                { value: existingRow?.cells?.[3]?.value || '—' },
                { value: 'S Grade' },
            ];
            writeJson(targetPath, target);
            touched += 1;
            return;
        }

        if (existing.has(href)) {
            return;
        }
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

const main = async () => {
    if (!fs.existsSync(PAGE_DATA_DIR)) {
        throw new Error('Missing data/page-data. Run scripts/build-runtime-artifacts.js first.');
    }

    console.log('[patch] Updating weapons navigation artifacts...');
    patchWeaponsNavigationArtifacts();

    console.log('[patch] Rewriting hub grade links (remove #anchors)...');
    const hubTouched = patchHubArticles();
    console.log(`[patch] Hub articles updated: ${hubTouched}`);

    console.log('[patch] Resolving Dynasty images and caching local assets...');
    await prepareDynastyImages();

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

main().catch((error) => {
    console.error('[patch] Failed:', error);
    process.exit(1);
});
