#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const META_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-meta.json');
const LINEDIA_BASE_URL = 'https://linedia.ru';
const SNAPSHOT = 'linedia-import-2026-04-25';

const articleHref = (id) => `/pages/article.html?article=${id}`;

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (db) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const normalizeText = (value = '') =>
    String(value)
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const toAbsoluteUrl = (value = '') => {
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    return `${LINEDIA_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const slugify = (value = '') =>
    normalizeText(value)
        .toLowerCase()
        .replace(/['"()]+/g, '')
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '');

const splitBilingualName = (value = '') => {
    const text = normalizeText(value);
    const parenthesized = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);

    if (parenthesized) {
        return {
            english: normalizeText(parenthesized[1]),
            russian: normalizeText(parenthesized[2]),
            combined: `${normalizeText(parenthesized[1])} (${normalizeText(parenthesized[2])})`,
        };
    }

    const latinFirst = text.match(/^([A-Za-z0-9][A-Za-z0-9'’\-\s:+./]+?)\s+([А-Яа-яЁё].+)$/);
    if (latinFirst) {
        return {
            english: normalizeText(latinFirst[1]),
            russian: normalizeText(latinFirst[2]),
            combined: `${normalizeText(latinFirst[1])} (${normalizeText(latinFirst[2])})`,
        };
    }

    const cyrillicFirst = text.match(/^([А-Яа-яЁё][А-Яа-яЁё0-9'’\-\s:+./]+?)\s+([A-Za-z].+)$/);
    if (cyrillicFirst) {
        return {
            english: normalizeText(cyrillicFirst[2]),
            russian: normalizeText(cyrillicFirst[1]),
            combined: `${normalizeText(cyrillicFirst[2])} (${normalizeText(cyrillicFirst[1])})`,
        };
    }

    return {
        english: text,
        russian: '',
        combined: text,
    };
};

const request = async (url) => {
    const retryableStatuses = new Set([429, 500, 502, 503, 504]);
    const delay = (ms) => new Promise((next) => setTimeout(next, ms));

    const singleRequest = (targetUrl, redirectCount = 0) =>
        new Promise((resolve, reject) => {
            https
                .get(
                    targetUrl,
                    {
                        headers: {
                            'user-agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
                        },
                    },
                    (response) => {
                        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                            if (redirectCount >= 5) {
                                reject(new Error(`Too many redirects for ${url}`));
                                return;
                            }

                            singleRequest(toAbsoluteUrl(response.headers.location), redirectCount + 1).then(resolve).catch(reject);
                            return;
                        }

                        if (response.statusCode >= 400) {
                            response.resume();
                            const error = new Error(`HTTP ${response.statusCode} for ${targetUrl}`);
                            error.statusCode = response.statusCode;
                            reject(error);
                            return;
                        }

                        let body = '';
                        response.on('data', (chunk) => (body += chunk));
                        response.on('end', () => resolve(body));
                    }
                )
                .on('error', reject);
        });

    let lastError = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            return await singleRequest(url);
        } catch (error) {
            lastError = error;
            if (!retryableStatuses.has(error.statusCode) && attempt >= 1) {
                break;
            }
            if (!retryableStatuses.has(error.statusCode) && error.statusCode) {
                break;
            }
            if (attempt === 7) {
                break;
            }
            await delay(700 * (attempt + 1));
        }
    }

    throw lastError || new Error(`Request failed for ${url}`);
};

const runInChunks = async (items, worker, concurrency = 6) => {
    const queue = [...items];
    const results = [];

    const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
        while (queue.length) {
            const item = queue.shift();
            const result = await worker(item);
            results.push(result);
        }
    });

    await Promise.all(runners);
    return results;
};

const itemThumbHtml = (src, label = '') =>
    src
        ? `<img class="wiki-item-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(label || 'Lineage II')}" loading="lazy" />`
        : '';

const bilingualLinkHtml = (href, english, russian) => `
    <a class="wiki-item-link" href="${escapeHtml(href)}">
        <span class="wiki-item-link__en">${escapeHtml(english || russian || 'Предмет')}</span>
        ${russian ? `<span class="wiki-item-link__ru">${escapeHtml(russian)}</span>` : ''}
    </a>
`;

const weaponLinkHtml = (href, imageSrc, english, russian) => `
    <span class="weapon-table__item">
        ${itemThumbHtml(imageSrc, `${english || ''} ${russian || ''}`.trim())}
        <a class="wiki-item-link" href="${escapeHtml(href)}">
            <span class="wiki-item-link__en">${escapeHtml(english || russian || 'Предмет')}</span>
            ${russian ? `<span class="wiki-item-link__ru">${escapeHtml(russian)}</span>` : ''}
        </a>
    </span>
`;

const gradeLinkCell = (articleId, blockId, label, hasBlock) => {
    if (!hasBlock) {
        return { value: '-' };
    }

    return {
        value: label,
        href: `${articleHref(articleId)}#${blockId}`,
    };
};

const ITEM_GRADE_ORDER = ['NG', 'D Grade', 'C Grade', 'B Grade', 'A Grade', 'S Grade', 'S80 Grade', 'S84 Grade'];
const WEAPON_GRADE_ORDER = ['No Grade', 'D Grade', 'C Grade', 'B Grade', 'A Grade', 'S Grade', 'S80 Grade', 'S84 Grade'];

const GRADE_META_LABELS = ['NG', 'D', 'C', 'B', 'A', 'S', 'S80', 'S84'];

const GRADE_ID_MAP = {
    NG: 'ng',
    'No Grade': 'ng',
    'D Grade': 'd',
    'C Grade': 'c',
    'B Grade': 'b',
    'A Grade': 'a',
    'S Grade': 's',
    'S80 Grade': 's80',
    'S84 Grade': 's84',
};

const JEWELRY_CONFIG = [
    {
        articleId: 'items-jewelry-rings',
        groupId: 'accessories',
        overviewId: 'items-accessories',
        title: 'Кольца',
        sourcePath: 'Бижутерия/Кольца',
        prefix: 'jewelry-item-linedia',
        statLabel: 'М. Защ',
        eyebrow: 'Предметы | Кольца',
    },
    {
        articleId: 'items-jewelry-earrings',
        groupId: 'accessories',
        overviewId: 'items-accessories',
        title: 'Серьги',
        sourcePath: 'Бижутерия/Серьги',
        prefix: 'jewelry-item-linedia',
        statLabel: 'М. Защ',
        eyebrow: 'Предметы | Серьги',
    },
    {
        articleId: 'items-jewelry-necklaces',
        groupId: 'accessories',
        overviewId: 'items-accessories',
        title: 'Ожерелья',
        sourcePath: 'Бижутерия/Ожерелья',
        prefix: 'jewelry-item-linedia',
        statLabel: 'М. Защ',
        eyebrow: 'Предметы | Ожерелья',
    },
];

const ARMOR_CONFIG = [
    {
        articleId: 'items-armor-heavy-armor',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Тяжелая броня',
        sourcePath: 'Броня/Тяжелая',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Тяжелая броня',
    },
    {
        articleId: 'items-armor-light-armor',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Легкая броня',
        sourcePath: 'Броня/Легкая',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Легкая броня',
    },
    {
        articleId: 'items-armor-magic-armor',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Магическая броня',
        sourcePath: 'Броня/Робы',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Магическая броня',
    },
    {
        articleId: 'items-armor-gloves',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Перчатки',
        sourcePath: 'Броня/Перчатки',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Перчатки',
    },
    {
        articleId: 'items-armor-boots',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Ботинки',
        sourcePath: 'Броня/Ботинки',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Ботинки',
    },
    {
        articleId: 'items-armor-helmet',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Шлемы',
        sourcePath: 'Броня/Шлемы',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Шлемы',
    },
    {
        articleId: 'items-armor-shields',
        groupId: 'armor',
        overviewId: 'items-armor',
        title: 'Щиты',
        sourcePath: 'Броня/Щиты',
        prefix: 'armor-item-linedia',
        statLabel: 'Физ. Защ',
        eyebrow: 'Предметы | Щиты',
    },
];

const WEAPON_SOURCE_CONFIG = [
    { sourcePath: 'Оружие/Мечи', sourceKey: 'swords' },
    { sourcePath: 'Оружие/Кинжалы', sourceKey: 'daggers' },
    { sourcePath: 'Оружие/Луки', sourceKey: 'bows' },
    { sourcePath: 'Оружие/Дуалы', sourceKey: 'duals' },
    { sourcePath: 'Оружие/Дубинки', sourceKey: 'blunts' },
    { sourcePath: 'Оружие/Кастеты', sourceKey: 'fists' },
    { sourcePath: 'Оружие/Алебарды', sourceKey: 'pole' },
    { sourcePath: 'Оружие/Рапиры', sourceKey: 'rapier' },
];

const WEAPON_LOCAL_CONFIG = {
    swords: { articleId: 'weapons-swords', groupId: 'swords', label: 'Мечи', eyebrow: 'Оружие | Мечи' },
    daggers: { articleId: 'weapons-daggers', groupId: 'daggers', label: 'Кинжалы', eyebrow: 'Оружие | Кинжалы' },
    bows: { articleId: 'weapons-bows', groupId: 'bows', label: 'Луки', eyebrow: 'Оружие | Луки' },
    'two-handed': { articleId: 'weapons-two-handed', groupId: 'two-handed', label: 'Двуручные мечи', eyebrow: 'Оружие | Двуручные мечи' },
    blunt: { articleId: 'weapons-blunt', groupId: 'blunt', label: 'Дубинки', eyebrow: 'Оружие | Дубинки' },
    duals: { articleId: 'weapons-duals', groupId: 'duals', label: 'Дуалы', eyebrow: 'Оружие | Дуалы' },
    'two-handed-blunts': {
        articleId: 'weapons-two-handed-blunt',
        groupId: 'two-handed-blunts',
        label: 'Двуручные дубинки',
        eyebrow: 'Оружие | Двуручные дубинки',
    },
    fists: { articleId: 'weapons-fists', groupId: 'fists', label: 'Кастеты', eyebrow: 'Оружие | Кастеты' },
    pole: { articleId: 'weapons-pole', groupId: 'pole', label: 'Алебарды', eyebrow: 'Оружие | Алебарды' },
    rapier: { articleId: 'weapons-rapier', groupId: 'rapier', label: 'Рапиры', eyebrow: 'Оружие | Рапиры' },
    'magic-books': {
        articleId: 'weapons-magic-books',
        groupId: 'magic-books',
        label: 'Магические книги',
        eyebrow: 'Оружие | Магические книги',
    },
};

const WEAPON_OVERVIEW_ORDER = [
    'swords',
    'two-handed',
    'bows',
    'daggers',
    'duals',
    'blunt',
    'two-handed-blunts',
    'fists',
    'pole',
    'rapier',
    'magic-books',
];

const fetchCache = new Map();
const itemPageCache = new Map();
let gitBaselineDatabase = undefined;

const readGitBaselineDatabase = () => {
    if (gitBaselineDatabase !== undefined) {
        return gitBaselineDatabase;
    }

    try {
        const raw = execSync('git show HEAD:data/canonical/l2wiki-canonical.json', {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 300 * 1024 * 1024,
        });
        gitBaselineDatabase = JSON.parse(raw);
    } catch {
        gitBaselineDatabase = null;
    }

    return gitBaselineDatabase;
};

const loadHtml = async (url) => {
    if (!fetchCache.has(url)) {
        fetchCache.set(url, request(url));
    }

    return fetchCache.get(url);
};

const parseCategoryRows = ($) => {
    const table = $('table.common.sortable').last().length ? $('table.common.sortable').last() : $('table.common').last();
    const rows = table.find('tr');

    return rows
        .slice(1)
        .map((index, row) => {
            const $row = $(row);
            const cells = $row
                .children('th,td')
                .map((_, cell) => normalizeText($(cell).text()))
                .get();
            const links = $row.find('a[href]');
            const itemHref = links.last().attr('href') || links.first().attr('href') || '';
            const imageSrc = toAbsoluteUrl($row.find('img').first().attr('src') || '');

            if (!itemHref || cells.length < 3) {
                return null;
            }

            return {
                rowId: `row-${index + 1}`,
                itemUrl: toAbsoluteUrl(itemHref),
                imageSrc,
                categoryStat: cells[2] || '',
                description: cells[cells.length - 1] || '',
            };
        })
        .get()
        .filter(Boolean);
};

const getNoteText = ($) => {
    const text = normalizeText($('body').text());
    const match = text.match(/С хроник Goddess of Destruction[^.]+/i);
    return match ? normalizeText(match[0]) : '';
};

const parsePrimaryFacts = ($) => {
    const table = $('table.common')
        .filter((_, item) => $(item).find('tr').length >= 5)
        .first();
    const rows = table.find('tr');
    const facts = [];
    let imageSrc = '';

    rows.each((index, row) => {
        const $row = $(row);

        if (index === 0) {
            imageSrc = toAbsoluteUrl($row.find('img').first().attr('src') || '');
            return;
        }

        const cells = $row
            .children('th,td')
            .map((_, cell) => normalizeText($(cell).text()))
            .get()
            .filter(Boolean);

        if (cells.length >= 2) {
            facts.push({
                key: cells[0].replace(/:\s*$/, ''),
                value: cells.slice(1).join(' '),
            });
        }
    });

    return { facts, imageSrc };
};

const parseItemPage = async (url) => {
    if (!itemPageCache.has(url)) {
        itemPageCache.set(
            url,
            (async () => {
                const html = await loadHtml(url);
                const $ = cheerio.load(html);
                const title = normalizeText($('h1').first().text()) || normalizeText($('title').first().text());
                const { facts, imageSrc } = parsePrimaryFacts($);
                const factsMap = new Map(facts.map((fact) => [normalizeText(fact.key), normalizeText(fact.value)]));
                const idValue = factsMap.get('ID') || factsMap.get('ID:') || '';
                const name = splitBilingualName(title);

                return {
                    url,
                    path: url.replace(/^https?:\/\/[^/]+\/wiki\//i, 'wiki/'),
                    title,
                    name,
                    imageSrc,
                    facts,
                    factsMap,
                    itemId: slugify(idValue) || slugify(title),
                };
            })()
        );
    }

    return itemPageCache.get(url);
};

const getFactValue = (factsMap, labels) => {
    for (const label of labels) {
        const direct = factsMap.get(label);
        if (direct) {
            return direct;
        }

        const normalized = label.replace(/:\s*$/, '');
        if (factsMap.has(normalized)) {
            return factsMap.get(normalized);
        }
    }

    return '';
};

const buildBaseStatsBlock = (id, facts) => ({
    id: `${id}-base-stats`,
    type: 'table',
    title: 'Основные параметры',
    columns: [
        { key: 'fact', label: 'Параметр' },
        { key: 'value', label: 'Значение' },
    ],
    rows: facts.map((fact, index) => ({
        id: `row-${index + 1}`,
        cells: [{ value: fact.key }, { value: fact.value }],
    })),
    compact: false,
});

const buildDescriptionBlock = (id, text) => ({
    id: `${id}-description`,
    type: 'prose',
    title: 'Описание',
    paragraphs: [text],
});

const createSidebarFacts = (facts, preferredLabels, gradeValue) => {
    const picked = [];

    for (const label of preferredLabels) {
        const fact = facts.find((item) => item.key === label);
        if (fact && fact.value) {
            picked.push({ label: fact.key, value: fact.value });
        }
    }

    if (gradeValue) {
        picked.push({ label: 'Ранг', value: gradeValue });
    }

    return picked.slice(0, 5);
};

const upsertGroupEntries = (group, articleIds) => {
    const seen = new Set();
    group.entries = [...group.entries.filter(Boolean), ...articleIds].filter((id) => {
        if (seen.has(id)) {
            return false;
        }

        seen.add(id);
        return true;
    });
};

const createItemArticle = ({ kind, config, gradeLabel, articleId, item, description }) => {
    const baseFacts = [...item.facts];
    const gradeFactExists = baseFacts.some((fact) => /^Ранг$/i.test(fact.key));

    if (!gradeFactExists) {
        baseFacts.push({ key: 'Ранг', value: gradeLabel });
    }

    const weightValue = getFactValue(item.factsMap, ['Вес', 'Weight']);
    const typeValue = getFactValue(item.factsMap, ['Тип', 'Type']);
    const pAtk = getFactValue(item.factsMap, ['P. Atk.', 'Ф. Атк.', 'Физ. Атк.', 'P.Atk']);
    const mAtk = getFactValue(item.factsMap, ['M. Atk.', 'М. Атк.', 'M.Atk']);
    const pDef = getFactValue(item.factsMap, ['Ф. Защ.', 'P. Def', 'P.Def']);
    const mDef = getFactValue(item.factsMap, ['М. Защ.', 'M. Def', 'M.Def']);

    const summaryParts = [];
    if (kind === 'weapon') {
        if (typeValue) {
            summaryParts.push(typeValue);
        }
        if (pAtk) {
            summaryParts.push(`P. Atk. ${pAtk}`);
        }
        if (mAtk) {
            summaryParts.push(`M. Atk. ${mAtk}`);
        }
        summaryParts.push(gradeLabel);
    } else if (kind === 'armor') {
        if (pDef) {
            summaryParts.push(`Физ. Защ.: ${pDef}`);
        }
        if (weightValue) {
            summaryParts.push(`Вес: ${weightValue}`);
        }
        summaryParts.push(gradeLabel);
    } else {
        if (mDef) {
            summaryParts.push(`М. Защ.: ${mDef}`);
        }
        if (weightValue) {
            summaryParts.push(`Вес: ${weightValue}`);
        }
        summaryParts.push(gradeLabel);
    }

    const sidebarFacts =
        kind === 'weapon'
            ? createSidebarFacts(baseFacts, ['Тип', 'P. Atk.', 'M. Atk.', 'Вес'], gradeLabel)
            : createSidebarFacts(baseFacts, ['Ф. Защ.', 'М. Защ.', 'Вес', 'Цена'], gradeLabel);

    const blocks = [];
    if (item.imageSrc) {
        blocks.push({
            id: `${articleId}-hero`,
            type: 'media',
            items: [
                {
                    src: item.imageSrc,
                    alt: item.name.combined,
                    caption: item.name.combined,
                },
            ],
        });
    }

    blocks.push(buildBaseStatsBlock(articleId, baseFacts));

    if (description) {
        blocks.push(buildDescriptionBlock(articleId, description));
    }

    return {
        id: articleId,
        section: kind === 'weapon' ? 'weapons' : 'items',
        group: config.groupId,
        title: item.name.combined,
        summary: summaryParts.join(' • '),
        eyebrow: config.eyebrow,
        meta: sidebarFacts,
        intro: [
            `${item.name.combined} — локальная карточка предмета, добавленная по данным Linedia для грейда ${gradeLabel}.`,
        ],
        related:
            kind === 'weapon'
                ? [config.articleId, 'weapons-overview']
                : [config.articleId, config.overviewId],
        order: 9999,
        layout: 'detail',
        sidebarFacts,
        source: {
            url: item.url,
            path: item.path,
            snapshot: SNAPSHOT,
            sourceType: 'reference',
        },
        aliases: [item.name.english, item.name.russian].filter(Boolean),
        blocks,
    };
};

const buildItemCategoryRow = ({ kind, articleId, item, gradeLabel, statLabel }) => {
    const itemUrl = articleHref(articleId);
    const weightValue = getFactValue(item.factsMap, ['Вес', 'Weight']);
    const pAtk = getFactValue(item.factsMap, ['P. Atk.', 'Ф. Атк.', 'Физ. Атк.', 'P.Atk']);
    const mAtk = getFactValue(item.factsMap, ['M. Atk.', 'М. Атк.', 'M.Atk']);
    const typeValue = getFactValue(item.factsMap, ['Тип', 'Type']);
    const pDef = getFactValue(item.factsMap, ['Ф. Защ.', 'P. Def', 'P.Def']);
    const mDef = getFactValue(item.factsMap, ['М. Защ.', 'M. Def', 'M.Def']);

    if (kind === 'weapon') {
        return {
            href: itemUrl,
            cells: [
                {
                    value: item.name.combined,
                    href: itemUrl,
                    html: weaponLinkHtml(itemUrl, item.imageSrc, item.name.english, item.name.russian),
                },
                { value: pAtk || '-' },
                { value: mAtk || '-' },
                { value: weightValue || '-' },
                { value: typeValue || '-' },
                { value: gradeLabel },
            ],
        };
    }

    return {
        href: itemUrl,
        cells: [
            {
                value: item.name.combined,
                html: itemThumbHtml(item.imageSrc, item.name.combined),
            },
            {
                value: item.name.combined,
                href: itemUrl,
                html: bilingualLinkHtml(itemUrl, item.name.english, item.name.russian),
            },
            {
                value: statLabel === 'Физ. Защ' ? pDef || '-' : mDef || '-',
            },
            {
                value: weightValue || '-',
            },
            {
                value: gradeLabel,
            },
        ],
    };
};

const buildItemsGradeBlock = (articleId, gradeSlug, gradeLabel, statLabel, rows) => ({
    id: `${articleId}-${gradeSlug}`,
    type: 'table',
    title: gradeLabel,
    columns: [
        { key: 'preview', label: 'preview' },
        { key: 'name', label: 'Название' },
        { key: 'stat', label: statLabel },
        { key: 'weight', label: 'Вес' },
        { key: 'grade', label: 'Ранг' },
    ],
    rows: rows.map((row, index) => ({
        id: `${gradeSlug}-row-${index + 1}`,
        href: row.href,
        cells: row.cells,
    })),
    compact: false,
});

const buildWeaponGradeBlock = (gradeSlug, gradeLabel, rows) => ({
    id: `${gradeSlug}-grade-table`,
    type: 'table',
    title: gradeLabel,
    columns: [
        { key: 'column-2', label: 'Название' },
        { key: 'column-3', label: 'Ф. Атк.' },
        { key: 'column-4', label: 'М. Атк.' },
        { key: 'column-5', label: 'Вес' },
        { key: 'column-6', label: 'Тип' },
        { key: 'column-7', label: 'Ранг' },
    ],
    rows: rows.map((row, index) => ({
        id: `${gradeSlug}-row-${index + 1}`,
        cells: row.cells,
    })),
    compact: false,
});

const reorderGradeBlocks = (article, isGradeBlock, orderedBlocks) => {
    const before = [];
    const after = [];
    let seenGrade = false;

    article.blocks.forEach((block) => {
        if (isGradeBlock(block)) {
            seenGrade = true;
            return;
        }

        if (!seenGrade) {
            before.push(block);
        } else {
            after.push(block);
        }
    });

    article.blocks = [...before, ...orderedBlocks.filter(Boolean), ...after];
};

const updateItemsCategoryArticle = (article, newBlocks) => {
    const oldGradeBlocks = article.blocks.filter((block) => block.type === 'table' && block.id.startsWith(`${article.id}-`));
    const blockByTitle = new Map(oldGradeBlocks.map((block) => [normalizeText(block.title), block]));

    newBlocks.forEach((block) => blockByTitle.set(normalizeText(block.title), block));

    const orderedBlocks = ITEM_GRADE_ORDER.map((title) => blockByTitle.get(title)).filter(Boolean);
    reorderGradeBlocks(article, (block) => block.type === 'table' && block.id.startsWith(`${article.id}-`), orderedBlocks);
};

const updateWeaponCategoryArticle = (article, newBlocks) => {
    const oldGradeBlocks = article.blocks.filter((block) => block.type === 'table' && /-grade-table$/.test(block.id));
    const blockByTitle = new Map(oldGradeBlocks.map((block) => [normalizeText(block.title), block]));
    const baselineDb = readGitBaselineDatabase();
    const baselineBlocks =
        baselineDb?.articles?.[article.id]?.blocks?.filter((block) => block.type === 'table' && /-grade-table$/.test(block.id)) || [];

    baselineBlocks.forEach((block) => {
        const title = normalizeText(block.title);
        if (!blockByTitle.has(title)) {
            blockByTitle.set(title, block);
        }
    });

    newBlocks.forEach((block) => blockByTitle.set(normalizeText(block.title), block));

    const orderedBlocks = WEAPON_GRADE_ORDER.map((title) => blockByTitle.get(title)).filter(Boolean);
    reorderGradeBlocks(article, (block) => block.type === 'table' && /-grade-table$/.test(block.id), orderedBlocks);
};

const countGradeTableRows = (article) =>
    (article.blocks || [])
        .filter((block) => block.type === 'table')
        .reduce((total, block) => total + (Array.isArray(block.rows) ? block.rows.length : 0), 0);

const updateOverviewRowDetails = (row, description, count, grades) => {
    row.cells[1].value = grades;
    row.cells[2].value = `${description} Найдено позиций: ${count}.`;
};

const articleHasBlock = (article, blockId) => Array.isArray(article.blocks) && article.blocks.some((block) => block.id === blockId);

const updateWeaponsOverviewArticle = (article, db) => {
    const tableBlock = (article.blocks || []).find((block) => block.id === 'weapons-overview-table' || block.title === 'Оружие');
    if (!tableBlock) {
        return;
    }

    const oldRows = new Map(
        (tableBlock.rows || []).map((row) => [
            normalizeText(row.cells?.[0]?.value || '').toLowerCase(),
            row,
        ])
    );

    tableBlock.columns = [
        { key: 'category', label: 'Оружие' },
        { key: 's84', label: 'S84', align: 'center' },
        { key: 's80', label: 'S80', align: 'center' },
        { key: 's', label: 'S', align: 'center' },
        { key: 'a', label: 'A', align: 'center' },
        { key: 'b', label: 'B', align: 'center' },
        { key: 'c', label: 'C', align: 'center' },
        { key: 'd', label: 'D', align: 'center' },
        { key: 'ng', label: 'NG', align: 'center' },
    ];

    tableBlock.rows = WEAPON_OVERVIEW_ORDER.map((key) => {
        const config = WEAPON_LOCAL_CONFIG[key];
        const weaponArticle = db.articles[config.articleId];
        const oldRow = oldRows.get(config.label.toLowerCase());
        const categoryCell =
            oldRow?.cells?.[0] ||
            {
                value: config.label,
                href: articleHref(config.articleId),
            };

        return {
            id: oldRow?.id || `weapons-overview-${slugify(config.label)}`,
            cells: [
                categoryCell,
                gradeLinkCell(config.articleId, 's84-grade-table', 'S84', articleHasBlock(weaponArticle, 's84-grade-table')),
                gradeLinkCell(config.articleId, 's80-grade-table', 'S80', articleHasBlock(weaponArticle, 's80-grade-table')),
                gradeLinkCell(config.articleId, 's-grade-table', 'S', articleHasBlock(weaponArticle, 's-grade-table')),
                gradeLinkCell(config.articleId, 'a-grade-table', 'A', articleHasBlock(weaponArticle, 'a-grade-table')),
                gradeLinkCell(config.articleId, 'b-grade-table', 'B', articleHasBlock(weaponArticle, 'b-grade-table')),
                gradeLinkCell(config.articleId, 'c-grade-table', 'C', articleHasBlock(weaponArticle, 'c-grade-table')),
                gradeLinkCell(config.articleId, 'd-grade-table', 'D', articleHasBlock(weaponArticle, 'd-grade-table')),
                gradeLinkCell(config.articleId, 'ng-grade-table', 'NG', articleHasBlock(weaponArticle, 'ng-grade-table')),
            ],
        };
    });
};

const classifyWeaponGroup = (sourceKey, typeValue) => {
    const normalized = normalizeText(typeValue).toLowerCase();

    if (sourceKey === 'swords') {
        return /двуруч/.test(normalized) ? 'two-handed' : 'swords';
    }

    if (sourceKey === 'blunts') {
        return /двуруч/.test(normalized) ? 'two-handed-blunts' : 'blunt';
    }

    const map = {
        daggers: 'daggers',
        bows: 'bows',
        duals: 'duals',
        fists: 'fists',
        pole: 'pole',
        rapier: 'rapier',
    };

    return map[sourceKey] || null;
};

const importItemCategories = async (db, configs, kind) => {
    for (const config of configs) {
        const categoryRowsByGrade = {};
        const newArticleIds = [];

        for (const grade of [
            { slug: 's80', label: 'S80 Grade' },
            { slug: 's84', label: 'S84 Grade' },
        ]) {
            const pageUrl = `${LINEDIA_BASE_URL}/wiki/${config.sourcePath
                .split('/')
                .map((part) => encodeURIComponent(part))
                .join('/')}/${grade.slug.toUpperCase()}`;
            const html = await loadHtml(pageUrl);
            const $ = cheerio.load(html);
            const parsedRows = parseCategoryRows($);
            const noteText = kind === 'armor' ? getNoteText($) : '';

            const fallbackArmorNote =
                kind === 'armor' && grade.label === 'S84 Grade'
                    ? noteText || 'С хроник Goddess of Destruction отдельные S84 комплекты были переведены в S80 грейд.'
                    : noteText;

            if (!parsedRows.length && fallbackArmorNote) {
                categoryRowsByGrade[grade.label] = {
                    note: fallbackArmorNote,
                    rows: [],
                };
                continue;
            }

            const itemRows = await runInChunks(
                parsedRows,
                async (row) => {
                    const item = await parseItemPage(row.itemUrl);
                    const articleId = `${config.prefix}-${item.itemId}-${slugify(item.name.english || item.name.combined)}`;
                    db.articles[articleId] = createItemArticle({
                        kind,
                        config,
                        gradeLabel: grade.label,
                        articleId,
                        item,
                        description: row.description,
                    });
                    newArticleIds.push(articleId);

                    return buildItemCategoryRow({
                        kind,
                        articleId,
                        item,
                        gradeLabel: grade.label,
                        statLabel: config.statLabel,
                    });
                },
                4
            );

            categoryRowsByGrade[grade.label] = {
                    rows: itemRows,
                    note: fallbackArmorNote,
                };
        }

        const article = db.articles[config.articleId];
        const newBlocks = [];

        ['S80 Grade', 'S84 Grade'].forEach((gradeLabel) => {
            const payload = categoryRowsByGrade[gradeLabel];
            if (!payload) {
                return;
            }

            if (payload.rows.length) {
                newBlocks.push(buildItemsGradeBlock(article.id, GRADE_ID_MAP[gradeLabel], gradeLabel, config.statLabel, payload.rows));
            } else if (payload.note) {
                newBlocks.push({
                    id: `${article.id}-${GRADE_ID_MAP[gradeLabel]}-note`,
                    type: 'prose',
                    title: gradeLabel,
                    paragraphs: [payload.note],
                });
            }
        });

        updateItemsCategoryArticle(article, newBlocks.filter((block) => block.type === 'table'));

        const noteBlocks = newBlocks.filter((block) => block.type === 'prose');
        article.blocks = article.blocks.filter((block) => !/-note$/.test(block.id));
        article.blocks.push(...noteBlocks);

        upsertGroupEntries(db.sections.items.groups.find((group) => group.id === config.groupId), newArticleIds);

        article.summary = `${config.title} с локальными карточками предметов и полными грейдами вплоть до S84.`;
    }
};

const importWeaponCategories = async (db) => {
    const groupedRows = {};
    const newArticleIdsByGroup = {};

    Object.keys(WEAPON_LOCAL_CONFIG).forEach((groupId) => {
        groupedRows[groupId] = {};
        newArticleIdsByGroup[groupId] = [];
    });

    for (const sourceConfig of WEAPON_SOURCE_CONFIG) {
        for (const grade of [
            { slug: 's80', label: 'S80 Grade' },
            { slug: 's84', label: 'S84 Grade' },
        ]) {
            const pageUrl = `${LINEDIA_BASE_URL}/wiki/${sourceConfig.sourcePath
                .split('/')
                .map((part) => encodeURIComponent(part))
                .join('/')}/${grade.slug.toUpperCase()}`;
            const html = await loadHtml(pageUrl);
            const $ = cheerio.load(html);
            const parsedRows = parseCategoryRows($);

            await runInChunks(
                parsedRows,
                async (row) => {
                    const item = await parseItemPage(row.itemUrl);
                    const typeValue = getFactValue(item.factsMap, ['Тип', 'Type']);
                    const targetGroup = classifyWeaponGroup(sourceConfig.sourceKey, typeValue);

                    if (!targetGroup) {
                        return;
                    }

                    const targetConfig = WEAPON_LOCAL_CONFIG[targetGroup];
                    const articleId = `weapon-item-linedia-${item.itemId}-${slugify(item.name.english || item.name.combined)}`;
                    db.articles[articleId] = createItemArticle({
                        kind: 'weapon',
                        config: targetConfig,
                        gradeLabel: grade.label,
                        articleId,
                        item,
                        description: row.description,
                    });
                    newArticleIdsByGroup[targetGroup].push(articleId);

                    if (!groupedRows[targetGroup][grade.label]) {
                        groupedRows[targetGroup][grade.label] = [];
                    }

                    groupedRows[targetGroup][grade.label].push(
                        buildItemCategoryRow({
                            kind: 'weapon',
                            articleId,
                            item,
                            gradeLabel: grade.label,
                        })
                    );
                },
                4
            );
        }
    }

    Object.entries(WEAPON_LOCAL_CONFIG).forEach(([groupId, config]) => {
        const article = db.articles[config.articleId];
        const newBlocks = [];

        ['S80 Grade', 'S84 Grade'].forEach((gradeLabel) => {
            const rows = groupedRows[groupId][gradeLabel] || [];
            if (rows.length) {
                newBlocks.push(buildWeaponGradeBlock(GRADE_ID_MAP[gradeLabel], gradeLabel, rows));
            }
        });

        updateWeaponCategoryArticle(article, newBlocks);

        const count = countGradeTableRows(article);
        article.summary = `Полная локальная таблица оружия категории «${config.label}» по всем доступным грейдам, включая S80 и S84.`;
        article.meta = [
            { label: 'Градации', value: GRADE_META_LABELS.join(', ') },
            { label: 'Предметов', value: String(count) },
        ];

        upsertGroupEntries(db.sections.weapons.groups.find((group) => group.id === config.groupId), newArticleIdsByGroup[groupId]);
    });

    updateWeaponsOverviewArticle(db.articles['weapons-overview'], db);
    updateWeaponsOverviewArticle(db.articles['items-weapons'], db);
};

const updateItemOverviewArticles = (db) => {
    const accessoriesOverview = db.articles['items-accessories'];
    const armorOverview = db.articles['items-armor'];
    const gradesValue = 'NG, D, C, B, A, S, S80, S84';

    const jewelryDescriptions = {
        'items-jewelry-rings': 'Кольца по всем грейдам, включая боевые и базовые варианты.',
        'items-jewelry-earrings': 'Серьги по всем грейдам с магической защитой.',
        'items-jewelry-necklaces': 'Ожерелья по всем грейдам, от NG до S84.',
    };

    const armorDescriptions = {
        'items-armor-heavy-armor': 'Сеты и отдельные части для танков и мили-классов.',
        'items-armor-light-armor': 'Броня для даггеров, луков и мобильных классов.',
        'items-armor-magic-armor': 'Робы и магические комплекты для кастеров и саппорта.',
        'items-armor-gloves': 'Отдельный слот брони с собственными грейдами.',
        'items-armor-boots': 'Ботинки и сапоги по всем грейдам.',
        'items-armor-helmet': 'Шлемы и головные элементы защиты.',
        'items-armor-shields': 'Щиты и офф-хенд защита для танков и саппорта.',
    };

    const accessoriesTable = accessoriesOverview.blocks.find((block) => block.id === 'items-accessories-categories');
    accessoriesTable.rows.forEach((row) => {
        const linkedArticle = db.articles[row.href.split('=').pop()];
        const description = jewelryDescriptions[row.href.split('=').pop()] || row.cells[2].value.replace(/Найдено позиций:.*$/, '').trim();
        updateOverviewRowDetails(row, description, countGradeTableRows(linkedArticle), gradesValue);
    });

    const armorTable = armorOverview.blocks.find((block) => block.id === 'items-armor-categories');
    armorTable.rows.forEach((row) => {
        const linkedArticle = db.articles[row.href.split('=').pop()];
        const description = armorDescriptions[row.href.split('=').pop()] || row.cells[2].value.replace(/Найдено позиций:.*$/, '').trim();
        updateOverviewRowDetails(row, description, countGradeTableRows(linkedArticle), gradesValue);
    });
};

const updateAlternativeProfession = (db) => {
    const questsSection = db.sections.quests;
    const groupIndex = questsSection.groups.findIndex((group) => group.id === 'profession-4');

    if (groupIndex !== -1) {
        questsSection.groups[groupIndex] = {
            id: 'alternative-profession',
            label: 'Альтернативная профессия',
            description: 'Альтернативные и ускоренные цепочки второй профессии по образцу Linedia.',
            entries: [
                'quest-profession-fourth',
                'archive-quests-item-3074-good-work-s-reward',
                'archive-quests-item-3073-certified-arbalester',
                'archive-quests-item-3081-certified-berserker',
                'archive-quests-item-3085-certified-soul-breaker',
            ],
            order: 3,
        };
    }

    const landingArticle = db.articles['quest-profession-fourth'];
    landingArticle.section = 'quests';
    landingArticle.group = 'alternative-profession';
    landingArticle.title = 'Альтернативная профессия';
    landingArticle.summary = 'Короткий вход в альтернативные цепочки второй профессии с Good Work\'s Reward и ветками Kamael.';
    landingArticle.eyebrow = 'Квесты';
    landingArticle.layout = 'detail';
    landingArticle.meta = [
        { label: 'Уровень', value: '39+' },
        { label: 'Формат', value: 'Альтернативные квесты на 2 профессию' },
        { label: 'Основа', value: 'Good Work\'s Reward и Certified-ветки' },
    ];
    landingArticle.sidebarFacts = [...landingArticle.meta];
    landingArticle.aliases = ['альтернативная профессия', 'good work\'s reward', 'вторая профессия без марок'];
    landingArticle.related = [
        'archive-quests-item-3074-good-work-s-reward',
        'archive-quests-item-3073-certified-arbalester',
        'archive-quests-item-3081-certified-berserker',
        'archive-quests-item-3085-certified-soul-breaker',
        'quest-profession-second',
    ];
    landingArticle.source = {
        url: 'https://linedia.ru/wiki/Good_Work%27s_Reward',
        path: 'wiki/Good_Work%27s_Reward',
        snapshot: SNAPSHOT,
        sourceType: 'reference',
    };
    landingArticle.intro = [
        'В этой хронике вместо бесполезной IV-профессии вынесена отдельная ветка альтернативной второй профессии по логике Linedia.',
    ];
    landingArticle.blocks = [
        {
            id: 'alternative-profession-intro',
            type: 'prose',
            title: 'Что это за раздел',
            paragraphs: [
                'Альтернативная профессия собирает быстрые и альтернативные квесты на вторую смену профессии, которые заменяют долгий фарм стандартных марок.',
                'Для обычных рас ключевой маршрут начинается с Good Work\'s Reward, а для Kamael используются отдельные сертификационные квесты под конкретный путь класса.',
            ],
        },
        {
            id: 'alternative-profession-routes',
            type: 'table',
            title: 'Основные маршруты',
            columns: [
                { key: 'quest', label: 'Квест' },
                { key: 'level', label: 'Уровень' },
                { key: 'who', label: 'Для кого' },
                { key: 'details', label: 'Что дает' },
            ],
            rows: [
                {
                    id: 'alt-prof-row-1',
                    href: articleHref('archive-quests-item-3074-good-work-s-reward'),
                    cells: [
                        {
                            value: 'Good Work\'s Reward',
                            href: articleHref('archive-quests-item-3074-good-work-s-reward'),
                        },
                        { value: '39+' },
                        { value: 'Люди, эльфы, темные эльфы, орки, гномы' },
                        { value: 'Позволяет взять альтернативные марки для второй профессии через Black Marketeer of Mammon.' },
                    ],
                },
                {
                    id: 'alt-prof-row-2',
                    href: articleHref('archive-quests-item-3073-certified-arbalester'),
                    cells: [
                        {
                            value: 'Certified Arbalester',
                            href: articleHref('archive-quests-item-3073-certified-arbalester'),
                        },
                        { value: '39+' },
                        { value: 'Надзиратель' },
                        { value: 'Альтернативный квест на путь Арбалетчика для Kamael.' },
                    ],
                },
                {
                    id: 'alt-prof-row-3',
                    href: articleHref('archive-quests-item-3081-certified-berserker'),
                    cells: [
                        {
                            value: 'Certified Berserker',
                            href: articleHref('archive-quests-item-3081-certified-berserker'),
                        },
                        { value: '39+' },
                        { value: 'Солдат' },
                        { value: 'Альтернативный квест на путь Берсерка для Kamael.' },
                    ],
                },
                {
                    id: 'alt-prof-row-4',
                    href: articleHref('archive-quests-item-3085-certified-soul-breaker'),
                    cells: [
                        {
                            value: 'Certified Soul Breaker',
                            href: articleHref('archive-quests-item-3085-certified-soul-breaker'),
                        },
                        { value: '39+' },
                        { value: 'Солдат / Надзиратель' },
                        { value: 'Альтернативный квест на путь Палача для Kamael.' },
                    ],
                },
            ],
            compact: false,
        },
        {
            id: 'alternative-profession-notes',
            type: 'prose',
            title: 'Как пользоваться',
            paragraphs: [
                'Если играете за обычную расу, начинайте с Good Work\'s Reward и уже после него закрывайте нужную ветку второй профессии через альтернативные марки.',
                'Если играете за Kamael, сразу переходите в нужный Certified-квест под свой класс. Так раздел работает как нормальная замена старой IV-профессии и больше не ломает навигацию по квестам.',
            ],
        },
    ];
};

const updateMeta = (db) => {
    fs.writeFileSync(
        META_PATH,
        `${JSON.stringify(
            {
                version: db.version || 2,
                updatedAt: new Date().toISOString(),
                site: {
                    name: db.site?.name || 'L2Wiki.Su',
                    subtitle: db.site?.subtitle || '',
                },
                counts: {
                    sections: Object.keys(db.sections || {}).length,
                    articles: Object.keys(db.articles || {}).length,
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );
};

const main = async () => {
    const db = readDatabase();

    await importItemCategories(db, JEWELRY_CONFIG, 'jewelry');
    await importItemCategories(db, ARMOR_CONFIG, 'armor');
    await importWeaponCategories(db);
    updateItemOverviewArticles(db);
    updateAlternativeProfession(db);
    updateMeta(db);
    writeDatabase(db);

    console.log(`Updated canonical database with ${Object.keys(db.articles || {}).length} articles.`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
