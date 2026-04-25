#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const BASE_URL = 'https://l2int.ru';

const articleHref = (id) => `/pages/article.html?article=${id}`;
const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (db) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const absoluteUrl = (value = '') => {
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const splitBilingualName = (value = '') => {
    const text = normalizeText(value);
    const russianStart = text.search(/[А-ЯЁа-яё]/);

    if (russianStart <= 0) {
        return {
            english: text.replace(/[()]+/g, '').trim(),
            russian: '',
            combined: text.replace(/[()]+/g, '').trim(),
        };
    }

    const english = text
        .slice(0, russianStart)
        .replace(/\(+$/g, '')
        .trim();
    const russian = text
        .slice(russianStart)
        .replace(/^\)+/g, '')
        .replace(/^\(+/g, '')
        .replace(/\)+$/g, '')
        .trim();

    return {
        english,
        russian,
        combined: russian ? `${english} (${russian})` : english,
    };
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

const request = (url) =>
    new Promise((resolve, reject) => {
        const fetch = (targetUrl, redirectCount = 0) => {
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

                            fetch(absoluteUrl(response.headers.location), redirectCount + 1);
                            return;
                        }

                        if (response.statusCode >= 400) {
                            reject(new Error(`HTTP ${response.statusCode} for ${targetUrl}`));
                            return;
                        }

                        let body = '';
                        response.on('data', (chunk) => (body += chunk));
                        response.on('end', () => resolve(body));
                    }
                )
                .on('error', reject);
        };

        fetch(url);
    });

const runInChunks = async (items, worker, concurrency = 6) => {
    const queue = [...items];
    const results = [];

    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (queue.length) {
            const item = queue.shift();
            const result = await worker(item);
            results.push(result);
        }
    });

    await Promise.all(runners);
    return results;
};

const grades = [
    { slug: 'ng', label: 'NG' },
    { slug: 'd', label: 'D Grade' },
    { slug: 'c', label: 'C Grade' },
    { slug: 'b', label: 'B Grade' },
    { slug: 'a', label: 'A Grade' },
    { slug: 's', label: 'S Grade' },
];

const armorCategories = [
    { slug: 'heavy-armor', articleId: 'items-armor-heavy-armor', label: 'Тяжелая броня', description: 'Сеты и отдельные части для танков и мили-классов.' },
    { slug: 'light-armor', articleId: 'items-armor-light-armor', label: 'Легкая броня', description: 'Броня для даггеров, луков и мобильных классов.' },
    { slug: 'magic-armor', articleId: 'items-armor-magic-armor', label: 'Магическая броня', description: 'Робы и магические комплекты для кастеров и саппорта.' },
    { slug: 'gloves', articleId: 'items-armor-gloves', label: 'Перчатки', description: 'Отдельный слот брони с собственными грейдами.' },
    { slug: 'boots', articleId: 'items-armor-boots', label: 'Ботинки', description: 'Ботинки и сапоги по всем грейдам.' },
    { slug: 'helmet', articleId: 'items-armor-helmet', label: 'Шлемы', description: 'Шлемы и головные элементы защиты.' },
    { slug: 'shields', articleId: 'items-armor-shields', label: 'Щиты', description: 'Щиты и офф-хенд защита для танков и саппорта.' },
];

const jewelryCategories = [
    { slug: 'rings', articleId: 'items-jewelry-rings', label: 'Кольца', description: 'Кольца по всем грейдам, включая боевые и базовые варианты.' },
    { slug: 'earring', articleId: 'items-jewelry-earrings', label: 'Серьги', description: 'Серьги по всем грейдам с магической защитой.' },
    { slug: 'necklace', articleId: 'items-jewelry-necklaces', label: 'Ожерелья', description: 'Ожерелья по всем грейдам, от NG до S.' },
];

const extractItemMeta = (href, prefix) => {
    const match = String(href || '').match(/\/item\/(\d+)-([^/?#]+)/i);

    if (!match) {
        return null;
    }

    return {
        numericId: match[1],
        slug: match[2],
        articleId: `${prefix}-${match[1]}-${match[2]}`,
    };
};

const parseHtmlTable = ($, table, localizeLinks = null) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const columns = rows
        .first()
        .children('th,td')
        .map((index, cell) => ({
            key: `column-${index + 1}`,
            label: normalizeText($(cell).text()) || `Колонка ${index + 1}`,
        }))
        .get();

    const dataRows = rows
        .slice(1)
        .map((rowIndex, row) => {
            const cells = $(row)
                .children('th,td')
                .map((_, cell) => {
                    const $cell = $(cell);
                    const link = $cell.find('a[href]').first();
                    const href = localizeLinks ? localizeLinks(link.attr('href') || '') : '';
                    return {
                        value: normalizeText($cell.text()),
                        href,
                        html: '',
                    };
                })
                .get();

            if (!cells.some((cell) => cell.value || cell.html)) {
                return null;
            }

            return {
                id: `row-${rowIndex + 1}`,
                title: '',
                href: '',
                cells,
                meta: [],
            };
        })
        .get()
        .filter(Boolean);

    return { columns, rows: dataRows };
};

const parseCraftPane = ($) => {
    const pane = $('.tab-pane')
        .filter((_, item) => /к[рp]афт/i.test(normalizeText($(item).find('h2,h3').first().text())))
        .first();

    if (!pane.length) {
        return { details: [], ingredients: [] };
    }

    const entries = pane
        .find('li')
        .map((_, item) => normalizeText($(item).text()))
        .get()
        .filter(Boolean);

    const details = [];
    const ingredients = [];
    let inIngredients = false;

    entries.forEach((entry) => {
        if (/^состав:?$/i.test(entry)) {
            inIngredients = true;
            return;
        }

        const pair = entry.match(/^(.*?)\s*-\s*(.+)$/);

        if ((inIngredients || pair) && pair) {
            ingredients.push({
                name: normalizeText(pair[1]),
                quantity: normalizeText(pair[2]),
            });
            return;
        }

        const detailPair = entry.match(/^([^:]+):\s*(.+)$/);

        if (detailPair) {
            details.push({
                key: normalizeText(detailPair[1]),
                value: normalizeText(detailPair[2]),
            });
        } else {
            details.push({
                key: 'Деталь',
                value: entry,
            });
        }
    });

    return { details, ingredients };
};

const parseStatsTable = ($) => {
    const $table = $('table').first();
    const imageSrc = absoluteUrl($table.find('img').first().attr('src') || '');
    const stats = [];
    let title = '';

    $table.find('tr').each((index, row) => {
        const cells = $(row)
            .children('th,td')
            .map((_, cell) => normalizeText($(cell).text()))
            .get()
            .filter(Boolean);

        if (!cells.length) {
            return;
        }

        if (index === 0) {
            title = cells[cells.length - 1];
            return;
        }

        if (cells.length >= 2) {
            stats.push({
                key: cells[0],
                value: cells.slice(1).join(' '),
            });
        }
    });

    return { title, imageSrc, stats };
};

const formatStatsSummary = (pairs = []) => {
    const interesting = pairs
        .filter((pair) => /Grade|Ранг|Защ|Weight|Вес|Price|Цена|Create Item|Крафта/i.test(pair.key))
        .slice(0, 3)
        .map((pair) => `${pair.key}: ${pair.value}`);

    return interesting.join(' • ');
};

const parseDetailTables = ($, itemPrefix) => {
    const localizeItemLink = (href) => {
        const meta = extractItemMeta(href, itemPrefix);
        return meta ? articleHref(meta.articleId) : '';
    };

    return $('.tab-pane')
        .map((_, pane) => {
            const title = normalizeText($(pane).find('h2,h3').first().text());
            const $table = $(pane).find('table').first();

            if (!$table.length || !title) {
                return null;
            }

            return {
                title,
                ...parseHtmlTable($, $table, localizeItemLink),
            };
        })
        .get()
        .filter(Boolean);
};

const createItemArticle = ({ articleId, title, imageSrc, stats, craft, detailTables, sectionLabel, sourceUrl, related = [] }) => {
    const name = splitBilingualName(title);
    const summary = formatStatsSummary(stats) || `${name.combined} — предмет из базы l2int.ru`;
    const meta = stats.slice(0, 4).map((pair) => ({ label: pair.key, value: pair.value }));
    const blocks = [];

    if (imageSrc) {
        blocks.push({
            id: `${articleId}-hero`,
            type: 'media',
            title: '',
            items: [{ src: imageSrc, alt: name.combined, caption: name.combined }],
        });
    }

    blocks.push({
        id: `${articleId}-stats`,
        type: 'table',
        title: 'Основные параметры',
        columns: [
            { key: 'fact', label: 'Параметр' },
            { key: 'value', label: 'Значение' },
        ],
        rows: stats.map((pair, index) => ({
            id: `row-${index + 1}`,
            title: '',
            href: '',
            cells: [
                { value: pair.key, href: '', html: '' },
                { value: pair.value, href: '', html: '' },
            ],
            meta: [],
        })),
        compact: true,
    });

    if (craft.details.length) {
        blocks.push({
            id: `${articleId}-craft-details`,
            type: 'table',
            title: 'Крафт',
            columns: [
                { key: 'fact', label: 'Параметр' },
                { key: 'value', label: 'Значение' },
            ],
            rows: craft.details.map((pair, index) => ({
                id: `row-${index + 1}`,
                title: '',
                href: '',
                cells: [
                    { value: pair.key, href: '', html: '' },
                    { value: pair.value, href: '', html: '' },
                ],
                meta: [],
            })),
            compact: true,
        });
    }

    if (craft.ingredients.length) {
        blocks.push({
            id: `${articleId}-craft-ingredients`,
            type: 'table',
            title: 'Состав',
            columns: [
                { key: 'ingredient', label: 'Материал' },
                { key: 'quantity', label: 'Количество' },
            ],
            rows: craft.ingredients.map((item, index) => ({
                id: `row-${index + 1}`,
                title: '',
                href: '',
                cells: [
                    { value: item.name, href: '', html: '' },
                    { value: item.quantity, href: '', html: '' },
                ],
                meta: [],
            })),
            compact: true,
        });
    }

    detailTables.forEach((table, index) => {
        if (table.rows.length) {
            blocks.push({
                id: `${articleId}-table-${index + 1}`,
                type: 'table',
                title: table.title,
                columns: table.columns,
                rows: table.rows,
            });
        }
    });

    return {
        id: articleId,
        section: 'items',
        group: 'catalog',
        title: name.combined,
        summary,
        eyebrow: `Предметы | ${sectionLabel}`,
        meta,
        intro: [`${name.combined} — локальная копия предмета с данными и таблицами, собранными по структуре l2int.ru.`],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related,
        order: 0,
        layout: 'detail',
        sidebarFacts: meta.slice(0, 4),
        source: {
            url: sourceUrl,
            path: sourceUrl.replace(BASE_URL, '').replace(/^\//, ''),
            snapshot: 'live-import-2026-04-12',
            sourceType: 'reference',
        },
        aliases: [name.english, name.russian].filter(Boolean).map((value) => value.toLowerCase()),
        blocks,
    };
};

const parseCategoryPage = async (url, itemPrefix) => {
    const html = await request(url);
    const $ = cheerio.load(html);
    const table = $('table.table-category').first();

    if (!table.length) {
        return null;
    }

    const columns = [
        { key: 'preview', label: '' },
        { key: 'name', label: 'Название' },
        { key: 'stat', label: normalizeText(table.find('tr').first().children('th,td').eq(2).text()) || 'Параметр' },
        { key: 'weight', label: normalizeText(table.find('tr').first().children('th,td').eq(3).text()) || 'Вес' },
        { key: 'grade', label: normalizeText(table.find('tr').first().children('th,td').eq(4).text()) || 'Ранг' },
    ];

    const items = table
        .find('tr')
        .slice(1)
        .map((index, row) => {
            const cells = $(row).children('th,td');
            const imageSrc = absoluteUrl(cells.eq(0).find('img').attr('src') || '');
            const link = cells.eq(1).find('a[href*="/item/"]').first();
            const sourceHref = absoluteUrl(link.attr('href') || '');
            const itemMeta = extractItemMeta(sourceHref, itemPrefix);

            if (!itemMeta) {
                return null;
            }

            const name = splitBilingualName(normalizeText(cells.eq(1).text()));
            const localHref = articleHref(itemMeta.articleId);

            return {
                articleId: itemMeta.articleId,
                sourceHref,
                imageSrc,
                title: name.combined,
                name,
                row: {
                    id: `row-${index + 1}`,
                    title: '',
                    href: localHref,
                    cells: [
                        { value: name.combined, href: '', html: itemThumbHtml(imageSrc, name.combined) },
                        { value: name.combined, href: localHref, html: bilingualLinkHtml(localHref, name.english, name.russian) },
                        { value: normalizeText(cells.eq(2).text()), href: '', html: '' },
                        { value: normalizeText(cells.eq(3).text()), href: '', html: '' },
                        { value: normalizeText(cells.eq(4).text()), href: '', html: '' },
                    ],
                    meta: [],
                },
            };
        })
        .get()
        .filter(Boolean);

    return { columns, items };
};

const parseResourceIndex = async () => {
    const html = await request(`${BASE_URL}/predmety/resursy`);
    const $ = cheerio.load(html);
    const items = [];
    let currentGroup = 'Ресурсы';

    $('.itemListCategory .glavtab')
        .find('strong, a[href*="/predmety/resursy/item/"]')
        .each((_, node) => {
            const $node = $(node);

            if (node.tagName === 'strong') {
                const nextGroup = normalizeText($node.text());

                if (nextGroup) {
                    currentGroup = nextGroup;
                }

                return;
            }

            const sourceHref = absoluteUrl($node.attr('href') || '');
            const itemMeta = extractItemMeta(sourceHref, 'resource-item');

            if (!itemMeta) {
                return;
            }

            const imageSrc = absoluteUrl($node.closest('tr').find('img').first().attr('src') || '');
            const name = splitBilingualName(normalizeText($node.text()));
            const localHref = articleHref(itemMeta.articleId);

            items.push({
                articleId: itemMeta.articleId,
                sourceHref,
                imageSrc,
                group: currentGroup,
                title: name.combined,
                name,
                row: {
                    id: `row-${items.length + 1}`,
                    title: '',
                    href: localHref,
                    cells: [
                        { value: name.combined, href: '', html: itemThumbHtml(imageSrc, name.combined) },
                        { value: name.combined, href: localHref, html: bilingualLinkHtml(localHref, name.english, name.russian) },
                        { value: currentGroup, href: '', html: '' },
                    ],
                    meta: [],
                },
            });
        });

    const unique = [];
    const seen = new Set();

    items.forEach((item) => {
        if (seen.has(item.articleId)) {
            return;
        }

        seen.add(item.articleId);
        unique.push(item);
    });

    return {
        columns: [
            { key: 'preview', label: '' },
            { key: 'name', label: 'Название' },
            { key: 'group', label: 'Группа' },
        ],
        items: unique,
    };
};

const buildCategoryArticle = (articleId, title, summary, sourceUrl, blocks, related = []) => ({
    id: articleId,
    section: 'items',
    group: 'catalog',
    title,
    summary,
    eyebrow: 'Предметы',
    meta: [],
    intro: [summary],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    related,
    order: 0,
    layout: 'detail',
    sidebarFacts: [],
    source: {
        url: sourceUrl,
        path: sourceUrl.replace(BASE_URL, '').replace(/^\//, ''),
        snapshot: 'live-import-2026-04-12',
        sourceType: 'reference',
    },
    aliases: [],
    blocks,
});

const importCategorySpec = async (db, spec) => {
    const blocks = [
        {
            id: `${spec.hubId}-overview`,
            type: 'prose',
            title: spec.proseTitle,
            paragraphs: spec.proseParagraphs,
        },
    ];

    const hubRows = [];
    const itemJobs = [];

    for (const category of spec.categories) {
        const categoryBlocks = [];
        let totalItems = 0;

        for (const grade of grades) {
            const url = `${BASE_URL}${spec.basePath}/${category.slug}/${grade.slug}`;
            let parsed = null;

            try {
                parsed = await parseCategoryPage(url, spec.itemPrefix);
            } catch (error) {
                if (/HTTP 404/.test(String(error.message || ''))) {
                    continue;
                }

                throw error;
            }

            if (!parsed || !parsed.items.length) {
                continue;
            }

            totalItems += parsed.items.length;
            parsed.items.forEach((item) => itemJobs.push({ ...item, sectionLabel: category.label, related: [category.articleId, spec.hubId] }));

            categoryBlocks.push({
                id: `${category.articleId}-${grade.slug}`,
                type: 'table',
                title: grade.label,
                columns: parsed.columns,
                rows: parsed.items.map((item) => item.row),
            });
        }

        db.articles[category.articleId] = buildCategoryArticle(
            category.articleId,
            `${category.label} Lineage 2`,
            `${category.description} Локальная категория с грейдами и переходами на предметы.`,
            `${BASE_URL}${spec.basePath}/${category.slug}`,
            categoryBlocks.length
                ? [
                      {
                          id: `${category.articleId}-intro`,
                          type: 'prose',
                          title: '',
                          paragraphs: [category.description, 'Ниже собраны все доступные грейды этой категории с локальными переходами на предметы.'],
                      },
                      ...categoryBlocks,
                  ]
                : [
                      {
                          id: `${category.articleId}-empty`,
                          type: 'prose',
                          title: '',
                          paragraphs: [category.description],
                      },
                  ],
            [spec.hubId]
        );

        hubRows.push({
            id: `${spec.hubId}-${category.slug}`,
            title: '',
            href: articleHref(category.articleId),
            cells: [
                { value: category.label, href: articleHref(category.articleId), html: '' },
                { value: 'NG, D, C, B, A, S', href: '', html: '' },
                { value: `${category.description} Найдено позиций: ${totalItems}.`, href: '', html: '' },
            ],
            meta: [],
        });
    }

    blocks.push({
        id: `${spec.hubId}-categories`,
        type: 'table',
        title: spec.tableTitle,
        columns: [
            { key: 'category', label: 'Категория' },
            { key: 'grades', label: 'Грейды' },
            { key: 'details', label: 'Описание' },
        ],
        rows: hubRows,
        compact: true,
    });

    spec.extraBlocks.forEach((block) => blocks.push(block));

    db.articles[spec.hubId].blocks = blocks;
    db.articles[spec.hubId].related = Array.from(new Set([...(db.articles[spec.hubId].related || []), ...spec.categories.map((category) => category.articleId)]));

    const itemArticles = await runInChunks(
        itemJobs,
        async (job) => {
            const html = await request(job.sourceHref);
            const $ = cheerio.load(html);
            const statsData = parseStatsTable($);
            const craft = parseCraftPane($);
            const detailTables = parseDetailTables($, spec.itemPrefix);

            return createItemArticle({
                articleId: job.articleId,
                title: statsData.title || job.title,
                imageSrc: statsData.imageSrc || job.imageSrc,
                stats: statsData.stats,
                craft,
                detailTables,
                sectionLabel: job.sectionLabel,
                sourceUrl: job.sourceHref,
                related: job.related,
            });
        },
        6
    );

    itemArticles.forEach((article) => {
        db.articles[article.id] = article;
    });
};

const importResources = async (db) => {
    const parsed = await parseResourceIndex();
    const itemArticles = await runInChunks(
        parsed.items,
        async (job) => {
            const html = await request(job.sourceHref);
            const $ = cheerio.load(html);
            const statsData = parseStatsTable($);
            const craft = parseCraftPane($);
            const detailTables = parseDetailTables($, 'resource-item');

            return createItemArticle({
                articleId: job.articleId,
                title: statsData.title || job.title,
                imageSrc: statsData.imageSrc || job.imageSrc,
                stats: statsData.stats,
                craft,
                detailTables,
                sectionLabel: 'Ресурсы',
                sourceUrl: job.sourceHref,
                related: ['items-resources', 'spoiler-guide', 'manor-guide'],
            });
        },
        6
    );

    itemArticles.forEach((article) => {
        db.articles[article.id] = article;
    });

    db.articles['items-resources'].blocks = [
        {
            id: 'items-resources-overview',
            type: 'prose',
            title: 'Ресурсы и материалы',
            paragraphs: [
                'Раздел собран по структуре l2int.ru: базовые ресурсы, крафтовые материалы и связанные предметы экономики.',
                'Все переходы ниже ведут на локальные страницы с параметрами, крафтом, дропом и другими таблицами.',
            ],
        },
        {
            id: 'items-resources-catalog',
            type: 'table',
            title: 'Каталог ресурсов',
            columns: parsed.columns,
            rows: parsed.items.map((item) => item.row),
        },
        {
            id: 'items-resources-related',
            type: 'table',
            title: 'Связанные системы',
            columns: [
                { key: 'name', label: 'Раздел' },
                { key: 'details', label: 'Краткие данные' },
                { key: 'summary', label: 'Описание' },
            ],
            rows: [
                {
                    id: 'row-1',
                    title: '',
                    href: articleHref('spoiler-guide'),
                    cells: [
                        { value: 'Гайд спойлеру', href: articleHref('spoiler-guide'), html: '' },
                        { value: 'Спойл, фарм, маршруты', href: '', html: '' },
                        { value: 'Практичные споты и добыча материалов, которые напрямую связаны с ресурсами.', href: '', html: '' },
                    ],
                    meta: [],
                },
                {
                    id: 'row-2',
                    title: '',
                    href: articleHref('manor-guide'),
                    cells: [
                        { value: 'Сбор и сдача манора', href: articleHref('manor-guide'), html: '' },
                        { value: 'Seeds / crops', href: '', html: '' },
                        { value: 'Манор помогает закрывать часть потребностей в ресурсах и рецептах.', href: '', html: '' },
                    ],
                    meta: [],
                },
                {
                    id: 'row-3',
                    title: '',
                    href: articleHref('archive-guide-item-5266-craft-interlude'),
                    cells: [
                        { value: 'Гайд крафтеру', href: articleHref('archive-guide-item-5266-craft-interlude'), html: '' },
                        { value: 'Крафт и производство', href: '', html: '' },
                        { value: 'Связка по рецептам, созданию вещей и игровым материалам.', href: '', html: '' },
                    ],
                    meta: [],
                },
            ],
            compact: true,
        },
    ];
};

const main = async () => {
    const db = readDatabase();

    await importCategorySpec(db, {
        hubId: 'items-armor',
        basePath: '/predmety/bronya',
        itemPrefix: 'armor-item',
        categories: armorCategories,
        proseTitle: 'Броня и категории',
        proseParagraphs: [
            'Раздел брони повторяет структуру оригинального l2int: тяжелая, легкая, магическая броня, а также перчатки, ботинки, шлемы и щиты.',
            'Категории ниже ведут на локальные страницы с грейдами и локальными карточками предметов.',
        ],
        tableTitle: 'Категории брони',
        extraBlocks: [
            {
                id: 'items-armor-links',
                type: 'table',
                title: 'Связанные разделы',
                columns: [
                    { key: 'name', label: 'Материал' },
                    { key: 'details', label: 'Краткие данные' },
                    { key: 'summary', label: 'Описание' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        title: '',
                        href: articleHref('mammon-services'),
                        cells: [
                            { value: 'Магазин, распечатка и улучшение у Мамона', href: articleHref('mammon-services'), html: '' },
                            { value: 'NPC / сервис', href: '', html: '' },
                            { value: 'Распечатка, улучшение и обмен сетов и частей экипировки.', href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-2',
                        title: '',
                        href: articleHref('items-resources'),
                        cells: [
                            { value: 'Ресурсы', href: articleHref('items-resources'), html: '' },
                            { value: 'Крафт и материалы', href: '', html: '' },
                            { value: 'Материалы и заготовки, которые чаще всего нужны для создания брони.', href: '', html: '' },
                        ],
                        meta: [],
                    },
                ],
                compact: true,
            },
        ],
    });

    await importCategorySpec(db, {
        hubId: 'items-accessories',
        basePath: '/predmety/bizhuteriya',
        itemPrefix: 'jewelry-item',
        categories: jewelryCategories,
        proseTitle: 'Бижутерия и категории',
        proseParagraphs: [
            'Раздел бижутерии собран по категориям оригинального l2int: кольца, серьги и ожерелья по всем грейдам.',
            'Ниже оставлены локальные категории и переходы на локальные карточки предметов.',
        ],
        tableTitle: 'Категории бижутерии',
        extraBlocks: [
            {
                id: 'items-accessories-links',
                type: 'table',
                title: 'Связанные материалы',
                columns: [
                    { key: 'name', label: 'Материал' },
                    { key: 'details', label: 'Краткие данные' },
                    { key: 'summary', label: 'Описание' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        title: '',
                        href: articleHref('ears-quest'),
                        cells: [
                            { value: 'An Obvious Lie (Очевидная ложь)', href: articleHref('ears-quest'), html: '' },
                            { value: 'Декоративная награда', href: '', html: '' },
                            { value: 'Популярный аксессуарный квест с локальным прохождением.', href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-2',
                        title: '',
                        href: articleHref('wedding-quest'),
                        cells: [
                            { value: 'Квесты на свадебный наряд', href: articleHref('wedding-quest'), html: '' },
                            { value: 'Formal Wear', href: '', html: '' },
                            { value: 'Связанные декоративные предметы и цепочка на свадебный комплект.', href: '', html: '' },
                        ],
                        meta: [],
                    },
                ],
                compact: true,
            },
        ],
    });

    await importResources(db);

    writeDatabase(db);
    console.log('l2int items imported: armor, jewelry and resources hubs expanded.');
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
