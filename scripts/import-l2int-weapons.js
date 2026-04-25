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

const weaponTypes = [
    { slug: 'swords', articleId: 'weapons-swords', groupId: 'swords', label: 'Мечи', menuLabel: 'Мечи', order: 0 },
    { slug: 'daggers', articleId: 'weapons-daggers', groupId: 'daggers', label: 'Кинжалы', menuLabel: 'Кинжалы', order: 1 },
    { slug: 'bows', articleId: 'weapons-bows', groupId: 'bows', label: 'Луки', menuLabel: 'Луки', order: 2 },
    { slug: 'two-handed-swords', articleId: 'weapons-two-handed', groupId: 'two-handed', label: 'Двуручные мечи', menuLabel: 'Двуручные мечи', order: 3 },
    { slug: 'blunts', articleId: 'weapons-blunt', groupId: 'blunt', label: 'Дубинки', menuLabel: 'Дубинки', order: 4 },
    { slug: 'duals', articleId: 'weapons-duals', groupId: 'duals', label: 'Дуалы', menuLabel: 'Дуалы', order: 5 },
    { slug: 'two-handed-blunts', articleId: 'weapons-two-handed-blunt', groupId: 'two-handed-blunts', label: 'Двуручные дубинки', menuLabel: 'Двуручные дубинки', order: 6 },
    { slug: 'fists', articleId: 'weapons-fists', groupId: 'fists', label: 'Кастеты', menuLabel: 'Кастеты', order: 7 },
    { slug: 'pole', articleId: 'weapons-pole', groupId: 'pole', label: 'Алебарды', menuLabel: 'Алебарды', order: 8 },
    { slug: 'rapier', articleId: 'weapons-rapier', groupId: 'rapier', label: 'Рапиры', menuLabel: 'Рапиры', order: 9 },
    { slug: 'magic-book', articleId: 'weapons-magic-books', groupId: 'magic-books', label: 'Магические книги', menuLabel: 'Магические книги', order: 10 },
];

const grades = [
    { slug: 'ng', label: 'No Grade' },
    { slug: 'd', label: 'D Grade' },
    { slug: 'c', label: 'C Grade' },
    { slug: 'b', label: 'B Grade' },
    { slug: 'a', label: 'A Grade' },
    { slug: 's', label: 'S Grade' },
];

const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const normalizeId = (value = '') =>
    String(value)
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '');

const fetchHtml = (url) =>
    new Promise((resolve, reject) => {
        https
            .get(url, (response) => {
                if (response.statusCode >= 400) {
                    reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                    return;
                }

                let html = '';
                response.on('data', (chunk) => (html += chunk));
                response.on('end', () => resolve(html));
            })
            .on('error', reject);
    });

const parseHtmlTable = ($, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const headerCells = rows.first().children('th,td');
    const columns = headerCells
        .map((index, cell) => ({
            key: `column-${index + 1}`,
            label: normalizeText($(cell).text()),
        }))
        .get()
        .filter((column) => column.label);

    const dataRows = rows
        .slice(1)
        .map((rowIndex, row) => {
            const cells = $(row)
                .children('th,td')
                .map((_, cell) => ({
                    value: normalizeText($(cell).text()),
                    href: '',
                }))
                .get();

            if (!cells.some((cell) => cell.value)) {
                return null;
            }

            return {
                id: `row-${rowIndex + 1}`,
                cells,
            };
        })
        .get()
        .filter(Boolean);

    return { columns, rows: dataRows };
};

const parseStatsTable = ($) => {
    const rows = $('table').first().find('tr');
    const stats = {};
    let heroTitle = '';

    rows.each((index, row) => {
        const cells = $(row)
            .children('th,td')
            .map((_, cell) => normalizeText($(cell).text()))
            .get()
            .filter(Boolean);

        if (!cells.length) {
            return;
        }

        if (index === 0 && cells[0]) {
            heroTitle = cells[cells.length - 1];
            return;
        }

        if (cells.length >= 2) {
            stats[cells[0]] = cells.slice(1).join(' ');
        }
    });

    return { heroTitle, stats };
};

const parseCraftPane = ($) => {
    const craftPane = $('.tab-pane').filter((_, pane) => normalizeText($(pane).find('h2,h3').first().text()) === 'Крафт').first();

    if (!craftPane.length) {
        return { details: [], ingredients: [] };
    }

    const items = craftPane
        .find('ul li')
        .map((_, item) => normalizeText($(item).text()))
        .get()
        .filter(Boolean);

    const details = [];
    const ingredients = [];
    let inComposition = false;

    items.forEach((item) => {
        if (/^состав:?$/i.test(item)) {
            inComposition = true;
            return;
        }

        if (inComposition || / - \d+/.test(item)) {
            const match = item.match(/^(.*?)\s*-\s*(.+)$/);

            if (match) {
                ingredients.push({
                    name: normalizeText(match[1]),
                    quantity: normalizeText(match[2]),
                });
            }
            return;
        }

        const pairMatch = item.match(/^([^:]+):\s*(.+)$/);

        if (pairMatch) {
            details.push({
                key: normalizeText(pairMatch[1]),
                value: normalizeText(pairMatch[2]),
            });
        } else {
            details.push({
                key: 'Деталь',
                value: item,
            });
        }
    });

    return { details, ingredients };
};

const parseNamedPaneTable = ($, title) => {
    const pane = $('.tab-pane').filter((_, item) => normalizeText($(item).find('h2,h3').first().text()) === title).first();

    if (!pane.length) {
        return null;
    }

    const table = pane.find('table').first();
    return table.length ? parseHtmlTable($, table) : null;
};

const parseSaVariants = ($) => {
    const pane = $('.tab-pane').filter((_, item) => normalizeText($(item).find('h2,h3').first().text()) === 'Вставка SA').first();

    if (!pane.length) {
        return [];
    }

    return pane
        .find('a[href*="/item/"]')
        .map((_, link) => ({
            label: normalizeText($(link).text()),
            href: $(link).attr('href') || '',
        }))
        .get()
        .filter((item) => item.label);
};

const extractItemMeta = (href) => {
    const match = String(href || '').match(/\/item\/(\d+)-([^/?#]+)/i);

    if (!match) {
        return null;
    }

    return {
        numericId: match[1],
        slug: match[2],
        articleId: `weapon-item-${match[1]}-${match[2]}`,
    };
};

const toRowsFromPairs = (pairs) =>
    pairs.map((pair, index) => ({
        id: `row-${index + 1}`,
        cells: [{ value: pair.key }, { value: pair.value }],
    }));

const parseCategoryPage = async (type, grade) => {
    const url = `${BASE_URL}/predmety/oruzhie/${type.slug}/${grade.slug}`;
    let html = '';

    try {
        html = await fetchHtml(url);
    } catch (error) {
        if (/HTTP 404/.test(String(error.message || ''))) {
            return null;
        }

        throw error;
    }

    const $ = cheerio.load(html);
    const table = $('table.table-category').first();

    if (!table.length) {
        return null;
    }

    const columns = table
        .find('tr')
        .first()
        .children('th,td')
        .map((index, cell) => {
            const label = normalizeText($(cell).text());
            return label ? { key: `column-${index + 1}`, label } : null;
        })
        .get()
        .filter(Boolean);

    const rows = table
        .find('tr')
        .slice(1)
        .map((rowIndex, row) => {
            const $row = $(row);
            const cells = $row
                .children('th,td')
                .map((_, cell) => {
                    const value = normalizeText($(cell).text());
                    const href = $(cell).find('a[href*="/item/"]').first().attr('href') || '';
                    return { value, href };
                })
                .get();

            if (!cells.some((cell) => cell.value)) {
                return null;
            }

            return {
                id: `row-${rowIndex + 1}`,
                cells,
            };
        })
        .get()
        .filter(Boolean);

    return {
        url,
        pageTitle: normalizeText($('h1').first().text()),
        columns,
        rows,
    };
};

const buildLocalCategoryBlock = (grade, categoryData) => ({
    id: `${normalizeId(grade.slug)}-grade-table`,
    type: 'table',
    title: grade.label,
    columns: categoryData.columns[0]?.label ? categoryData.columns : categoryData.columns.slice(1),
    rows: categoryData.rows.map((row, rowIndex) => {
        const itemMeta = extractItemMeta(row.cells[1]?.href || row.cells[0]?.href || '');
        const cells = row.cells.map((cell, cellIndex) => ({
            value: cell.value,
            href: cellIndex === 1 && itemMeta ? articleHref(itemMeta.articleId) : '',
        }));

        const normalizedCells = cells[0]?.value === '' ? cells.slice(1) : cells;

        return {
            id: `${normalizeId(grade.slug)}-row-${rowIndex + 1}`,
            cells: normalizedCells,
        };
    }),
});

const buildAliases = (heroTitle) => {
    const aliases = new Set();
    const title = normalizeText(heroTitle);

    if (!title) {
        return [];
    }

    aliases.add(title.toLowerCase());
    const match = title.match(/^(.+?)\((.+)\)$/);

    if (match) {
        aliases.add(normalizeText(match[1]).toLowerCase());
        aliases.add(normalizeText(match[2]).toLowerCase());
    }

    return Array.from(aliases);
};

const buildWeaponItemArticle = async (type, itemPath) => {
    const itemMeta = extractItemMeta(itemPath);

    if (!itemMeta) {
        return null;
    }

    const url = `${BASE_URL}${itemPath}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const { heroTitle, stats } = parseStatsTable($);
    const craft = parseCraftPane($);
    const dropTable = parseNamedPaneTable($, 'Дроп');
    const enchantTable = parseNamedPaneTable($, 'Таблица заточки');
    const saVariants = parseSaVariants($);
    const statPairs = Object.entries(stats).map(([key, value]) => ({ key, value }));
    const typeValue = stats['Тип'] || stats['Тип Type'] || '';
    const gradeValue = stats['Ранг \\ Grade'] || stats['Ранг Grade'] || stats['Ранг'] || '';
    const pAtkValue = stats['Физ. Атк. \\ P. Atk.'] || stats['Физ. Атк. P. Atk.'] || '';

    const blocks = [];

    if (statPairs.length) {
        blocks.push({
            id: 'base-stats',
            type: 'table',
            title: 'Базовые характеристики',
            columns: [
                { key: 'fact', label: 'Параметр' },
                { key: 'value', label: 'Значение' },
            ],
            rows: toRowsFromPairs(statPairs),
        });
    }

    if (craft.details.length) {
        blocks.push({
            id: 'craft-details',
            type: 'table',
            title: 'Крафт',
            columns: [
                { key: 'fact', label: 'Параметр' },
                { key: 'value', label: 'Значение' },
            ],
            rows: toRowsFromPairs(craft.details),
        });
    }

    if (craft.ingredients.length) {
        blocks.push({
            id: 'craft-materials',
            type: 'table',
            title: 'Материалы для крафта',
            columns: [
                { key: 'item', label: 'Материал' },
                { key: 'qty', label: 'Количество' },
            ],
            rows: craft.ingredients.map((item, index) => ({
                id: `material-${index + 1}`,
                cells: [{ value: item.name }, { value: item.quantity }],
            })),
        });
    }

    if (dropTable?.columns?.length && dropTable?.rows?.length) {
        blocks.push({
            id: 'drop-table',
            type: 'table',
            title: 'Дроп',
            columns: dropTable.columns,
            rows: dropTable.rows,
        });
    }

    if (saVariants.length) {
        blocks.push({
            id: 'sa-variants',
            type: 'table',
            title: 'Вставка SA',
            columns: [{ key: 'variant', label: 'Вариант' }],
            rows: saVariants.map((item, index) => {
                const meta = extractItemMeta(item.href);
                return {
                    id: `sa-${index + 1}`,
                    cells: [{ value: item.label, href: meta ? articleHref(meta.articleId) : '' }],
                };
            }),
        });
    }

    if (enchantTable?.columns?.length && enchantTable?.rows?.length) {
        blocks.push({
            id: 'enchant-table',
            type: 'table',
            title: 'Таблица заточки',
            columns: enchantTable.columns,
            rows: enchantTable.rows,
        });
    }

    return {
        id: itemMeta.articleId,
        section: 'weapons',
        group: type.groupId,
        title: heroTitle || itemMeta.slug,
        summary: normalizeText(
            `${heroTitle || itemMeta.slug} — ${gradeValue || 'оружие'} ${typeValue ? `, ${typeValue}` : ''}${pAtkValue ? `, P.Atk ${pAtkValue}` : ''}.`
        ),
        eyebrow: `Оружие | ${type.label}`,
        meta: [
            typeValue ? { label: 'Тип', value: typeValue } : null,
            gradeValue ? { label: 'Ранг', value: gradeValue } : null,
            pAtkValue ? { label: 'Физ. Атк.', value: pAtkValue } : null,
        ].filter(Boolean),
        intro: [
            'Характеристики и вспомогательные таблицы перенесены в локальную базу знаний, чтобы все переходы по оружию оставались внутри сайта.',
        ],
        related: [type.articleId],
        order: 4000 + Number(itemMeta.numericId),
        aliases: buildAliases(heroTitle),
        source: {
            url,
            path: itemPath.replace(/^\//, ''),
            sourceType: 'live-scrape',
        },
        blocks,
    };
};

const buildWeaponsOverview = (db, categories) => {
    const totalCategories = categories.length;
    const totalItems = Object.values(db.articles).filter((article) => article.id.startsWith('weapon-item-')).length;

    db.articles['weapons-overview'] = {
        id: 'weapons-overview',
        section: 'weapons',
        group: 'overview',
        title: 'Оружие Lineage 2 — Полный гайд',
        summary: 'Локальный каталог оружия Lineage II по типам, грейдам и предметам без внешних переходов.',
        eyebrow: 'Оружие | Обзор',
        meta: [
            { label: 'Типов оружия', value: String(totalCategories) },
            { label: 'Градации', value: 'NG-S' },
            { label: 'Локальных предметов', value: String(totalItems) },
        ],
        intro: [
            'Все категории и item-страницы оружия перенесены в локальную базу знаний с таблицами, характеристиками и блоками по крафту, дропу и SA.',
        ],
        related: categories.map((category) => category.articleId),
        order: 0,
        layout: 'catalog',
        blocks: [
            {
                id: 'weapons-overview-categories',
                type: 'table',
                title: 'Категории оружия',
                columns: [
                    { key: 'category', label: 'Категория' },
                    { key: 'details', label: 'Что внутри' },
                ],
                rows: categories.map((category, index) => ({
                    id: `overview-category-${index + 1}`,
                    cells: [
                        { value: category.label, href: articleHref(category.articleId) },
                        { value: 'Все доступные грейды и локальные item-страницы.' },
                    ],
                })),
            },
        ],
    };
};

const runPool = async (items, limit, worker) => {
    const results = [];
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const currentIndex = cursor++;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(runners);
    return results;
};

const main = async () => {
    const db = readDatabase();
    const weaponSection = db.sections.weapons;

    if (!weaponSection) {
        throw new Error('Weapons section is missing in canonical database.');
    }

    Object.keys(db.articles)
        .filter((articleId) => articleId.startsWith('weapon-item-'))
        .forEach((articleId) => {
            delete db.articles[articleId];
        });

    const categorySummaries = [];

    for (const type of weaponTypes) {
        console.log(`Importing category: ${type.slug}`);
        const categoryPages = [];

        for (const grade of grades) {
            const categoryData = await parseCategoryPage(type, grade);

            if (categoryData?.rows?.length) {
                categoryPages.push({
                    grade,
                    data: categoryData,
                });
            }
        }

        if (!categoryPages.length) {
            continue;
        }

        const itemPaths = Array.from(
            new Set(
                categoryPages.flatMap((page) =>
                    page.data.rows
                        .map((row) => row.cells.find((cell) => /\/item\//.test(cell.href || ''))?.href || '')
                        .filter(Boolean)
                )
            )
        );

        const importedItems = await runPool(itemPaths, 6, async (itemPath) => buildWeaponItemArticle(type, itemPath));

        importedItems.filter(Boolean).forEach((article) => {
            db.articles[article.id] = article;
        });

        db.articles[type.articleId] = {
            id: type.articleId,
            section: 'weapons',
            group: type.groupId,
            title: `${type.label} — Оружие Lineage 2`,
            summary: `Полная локальная таблица оружия категории «${type.label}» по всем доступным грейдам.`,
            eyebrow: `Оружие | ${type.label}`,
            meta: [
                { label: 'Градации', value: categoryPages.map((page) => page.grade.label.replace(' Grade', '')).join(', ') },
                { label: 'Предметов', value: String(itemPaths.length) },
            ],
            intro: ['Таблицы и item-страницы этой категории открываются локально и сохраняют структуру данных с l2int.ru в дизайне сайта.'],
            related: ['weapons-overview'],
            order: type.order + 1,
            layout: 'catalog',
            source: {
                url: `${BASE_URL}/predmety/oruzhie/${type.slug}`,
                path: `predmety/oruzhie/${type.slug}`,
                sourceType: 'live-scrape',
            },
            blocks: categoryPages.map((page) => buildLocalCategoryBlock(page.grade, page.data)),
        };

        categorySummaries.push({
            articleId: type.articleId,
            label: type.menuLabel,
            groupId: type.groupId,
            order: type.order,
        });
    }

    weaponSection.description = 'Полный локальный каталог оружия Lineage 2 с item-страницами, крафтом, дропом, SA и таблицами заточки.';
    weaponSection.stats = [
        { label: 'Типов оружия', value: String(categorySummaries.length) },
        { label: 'Градации', value: 'NG-S' },
        { label: 'Предметов', value: String(Object.values(db.articles).filter((article) => article.id.startsWith('weapon-item-')).length) },
    ];
    weaponSection.groups = [
        ...categorySummaries.map((category) => ({
            id: category.groupId,
            label: category.label,
            entries: [category.articleId],
            order: category.order,
        })),
        {
            id: 'overview',
            label: 'Обзор оружия',
            entries: ['weapons-overview'],
            order: 999,
        },
    ];
    weaponSection.catalogColumns = [
        { key: 'category', label: 'Категория' },
        { key: 'details', label: 'Что внутри' },
    ];
    weaponSection.catalogRows = categorySummaries.map((category, index) => ({
        id: `weapon-category-${index + 1}`,
        cells: [
            { value: category.label, href: articleHref(category.articleId) },
            { value: 'Таблицы всех грейдов и локальные страницы каждого оружия.' },
        ],
    }));

    buildWeaponsOverview(db, categorySummaries);
    db.updatedAt = new Date().toISOString();
    writeDatabase(db);
    console.log(`Imported ${Object.values(db.articles).filter((article) => article.id.startsWith('weapon-item-')).length} local weapon items.`);
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
