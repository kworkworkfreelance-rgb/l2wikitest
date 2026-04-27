#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const canonicalPath = path.join(__dirname, '..', 'data', 'canonical', 'l2wiki-canonical.json');
const metaPath = path.join(__dirname, '..', 'data', 'canonical', 'l2wiki-meta.json');
const localStorageCanonicalPath = path.join(__dirname, '..', '.l2wiki-storage', 'data', 'canonical', 'l2wiki-canonical.json');
const localStorageMetaPath = path.join(__dirname, '..', '.l2wiki-storage', 'data', 'canonical', 'l2wiki-meta.json');

const database = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

const GRADE_COLUMNS = [
    { key: 's84', label: 'S84' },
    { key: 's80', label: 'S80' },
    { key: 's', label: 'S' },
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
    { key: 'd', label: 'D' },
    { key: 'ng', label: 'NG' },
];

const WEAPON_HUB_CATEGORIES = [
    { articleId: 'weapons-swords', label: 'Мечи' },
    { articleId: 'weapons-two-handed', label: 'Двуручные мечи' },
    { articleId: 'weapons-bows', label: 'Луки' },
    { articleId: 'weapons-daggers', label: 'Кинжалы' },
    { articleId: 'weapons-duals', label: 'Дуалы' },
    { articleId: 'weapons-blunt', label: 'Дубинки' },
    { articleId: 'weapons-two-handed-blunt', label: 'Двуручные дубинки' },
    { articleId: 'weapons-fists', label: 'Кастеты' },
    { articleId: 'weapons-pole', label: 'Алебарды' },
    { articleId: 'weapons-rapier', label: 'Рапиры' },
    { articleId: 'weapons-magic-books', label: 'Магические книги' },
];

const ARTICLE_PARAM_RE = /[?&]article=([^&#]+)/i;

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const getArticleIdFromHref = (href = '') => {
    const match = String(href).match(ARTICLE_PARAM_RE);
    return match ? decodeURIComponent(match[1]) : '';
};

const normalizeGradeKey = (value = '') => {
    const normalized = String(value).trim().toLowerCase();

    if (!normalized) {
        return '';
    }

    if (normalized.includes('s84')) {
        return 's84';
    }

    if (normalized.includes('s80')) {
        return 's80';
    }

    if (normalized.includes('no grade') || normalized === 'ng') {
        return 'ng';
    }

    if (/^s\b/.test(normalized) || normalized === 's grade') {
        return 's';
    }

    if (/^a\b/.test(normalized) || normalized === 'a grade') {
        return 'a';
    }

    if (/^b\b/.test(normalized) || normalized === 'b grade') {
        return 'b';
    }

    if (/^c\b/.test(normalized) || normalized === 'c grade') {
        return 'c';
    }

    if (/^d\b/.test(normalized) || normalized === 'd grade') {
        return 'd';
    }

    return '';
};

const getPreviewHtml = (article, label) => {
    const firstTable = (article.blocks || []).find((block) => block.type === 'table' && Array.isArray(block.rows) && block.rows.length);
    const previewHtml = firstTable?.rows?.[0]?.cells?.[0]?.html || '';

    if (!previewHtml) {
        return escapeHtml(label);
    }

    return `
        <span class="weapon-category-link">
            ${previewHtml}
            <span class="weapon-category-link__label">${escapeHtml(label)}</span>
        </span>
    `.trim();
};

const getGradeTargets = (article) => {
    const targets = {};

    (article.blocks || []).forEach((block) => {
        if (block.type !== 'table') {
            return;
        }

        const gradeKey = normalizeGradeKey(block.title || block.id || '');

        if (gradeKey && !targets[gradeKey] && block.id) {
            targets[gradeKey] = block.id;
        }
    });

    return targets;
};

const buildHubTable = ({ articleId, label, sourceBlockId, emptyText, fallbackCategories = [] }) => {
    const article = database.articles[articleId];
    const sourceBlock = (article.blocks || []).find((block) => block.id === sourceBlockId);
    const sourceRows = sourceBlock?.rows?.length
        ? sourceBlock.rows
        : fallbackCategories.map((category) => ({
              id: category.articleId,
              href: `/pages/article.html?article=${encodeURIComponent(category.articleId)}`,
              cells: [{ value: category.label }],
          }));

    if (!article || !sourceRows.length) {
        throw new Error(`Missing hub source block for ${articleId}`);
    }

    return {
        id: `${articleId}-grade-overview`,
        type: 'table',
        title: label,
        columns: [{ key: 'category', label }].concat(
            GRADE_COLUMNS.map((column) => ({
                key: column.key,
                label: column.label,
                align: 'center',
            }))
        ),
        rows: sourceRows.map((row) => {
            const categoryLabel = row.cells?.[0]?.value || 'Категория';
            const linkedArticleId = getArticleIdFromHref(row.href || row.cells?.[0]?.href || '');
            const linkedArticle = database.articles[linkedArticleId];
            const gradeTargets = linkedArticle ? getGradeTargets(linkedArticle) : {};
            const categoryHref = linkedArticleId ? `/pages/article.html?article=${encodeURIComponent(linkedArticleId)}` : row.href || '';

            return {
                id: `${articleId}-${linkedArticleId || row.id || 'row'}`,
                cells: [
                    {
                        value: categoryLabel,
                        href: categoryHref || undefined,
                        html: linkedArticle ? getPreviewHtml(linkedArticle, categoryLabel) : escapeHtml(categoryLabel),
                    },
                ].concat(
                    GRADE_COLUMNS.map((column) => {
                        const blockId = gradeTargets[column.key];

                        if (!linkedArticleId || !blockId) {
                            return {
                                value: emptyText || '—',
                            };
                        }

                        return {
                            value: column.label,
                            href: `/pages/article.html?article=${encodeURIComponent(linkedArticleId)}&grade=${encodeURIComponent(column.label)}`,
                        };
                    })
                ),
            };
        }),
        compact: true,
    };
};

const buildWeaponHubTable = () => ({
    id: 'weapons-overview-table',
    type: 'table',
    title: 'Оружие',
    columns: [{ key: 'category', label: 'Оружие' }].concat(
        GRADE_COLUMNS.map((column) => ({
            key: column.key,
            label: column.label,
            align: 'center',
        }))
    ),
    rows: WEAPON_HUB_CATEGORIES.map(({ articleId, label }) => {
        const article = database.articles[articleId];
        const gradeTargets = article ? getGradeTargets(article) : {};
        const categoryHref = `/pages/article.html?article=${encodeURIComponent(articleId)}`;

        return {
            id: `weapons-overview-${articleId}`,
            cells: [
                {
                    value: label,
                    href: categoryHref,
                    html: article ? getPreviewHtml(article, label) : escapeHtml(label),
                },
            ].concat(
                GRADE_COLUMNS.map((column) => {
                    const blockId = gradeTargets[column.key];

                    if (!blockId) {
                        return {
                            value: '—',
                        };
                    }

                    return {
                        value: column.label,
                        href: `${categoryHref}&grade=${encodeURIComponent(column.label)}`,
                    };
                })
            ),
        };
    }),
    compact: false,
});

const replaceHubBlocks = ({ articleId, summary, introParagraphs, sourceBlockId, tableLabel, emptyText, fallbackCategories }) => {
    const article = database.articles[articleId];

    if (!article) {
        throw new Error(`Missing article ${articleId}`);
    }

    const overviewBlock = (article.blocks || []).find((block) => block.type === 'prose');
    const generatedBlockId = `${articleId}-grade-overview`;
    const relatedBlocks = (article.blocks || []).filter(
        (block) => block.type === 'table' && block.id !== sourceBlockId && block.id !== generatedBlockId
    );

    article.summary = summary;

    if (overviewBlock) {
        overviewBlock.title = tableLabel === 'Броня' ? 'Броня по грейдам' : 'Бижутерия по грейдам';
        overviewBlock.paragraphs = introParagraphs;
    }

    article.blocks = []
        .concat(overviewBlock ? [overviewBlock] : [])
        .concat([buildHubTable({ articleId, label: tableLabel, sourceBlockId, emptyText, fallbackCategories })])
        .concat(relatedBlocks);
};

const replaceWeaponHubBlocks = ({ articleIds, summary }) => {
    const tableBlock = buildWeaponHubTable();

    articleIds.forEach((articleId) => {
        const article = database.articles[articleId];

        if (!article) {
            return;
        }

        article.summary = summary;
        article.layout = 'catalog';
        article.blocks = [tableBlock];
    });
};

replaceWeaponHubBlocks({
    articleIds: ['items-weapons', 'weapons-overview'],
    summary: 'Каталог оружия по типам и грейдам с картинками категорий и быстрыми переходами в S84, S80, S, A, B, C, D и NG.',
});

replaceHubBlocks({
    articleId: 'items-armor',
    summary: 'Хаб по тяжелой, легкой, магической броне, шлемам, перчаткам, ботинкам и щитам с быстрым переходом в нужный грейд.',
    introParagraphs: [
        'Раздел больше не свален в один общий список: каждая категория брони вынесена в отдельную строку, а грейды открываются сразу на нужной таблице.',
        'Если в конкретной категории на текущем импорте еще нет отдельной S84-таблицы, в ячейке остается прочерк, а остальные грейды ведут прямо к данным.',
    ],
    sourceBlockId: 'items-armor-categories',
    tableLabel: 'Броня',
    emptyText: '—',
    fallbackCategories: [
        { articleId: 'items-armor-heavy-armor', label: 'Тяжелая броня' },
        { articleId: 'items-armor-light-armor', label: 'Легкая броня' },
        { articleId: 'items-armor-magic-armor', label: 'Магическая броня' },
        { articleId: 'items-armor-gloves', label: 'Перчатки' },
        { articleId: 'items-armor-boots', label: 'Ботинки' },
        { articleId: 'items-armor-helmet', label: 'Шлемы' },
        { articleId: 'items-armor-shields', label: 'Щиты' },
    ],
});

replaceHubBlocks({
    articleId: 'items-accessories',
    summary: 'Хаб по кольцам, серьгам и ожерельям с прямыми переходами в таблицы NG, D, C, B, A, S, S80 и S84.',
    introParagraphs: [
        'Бижутерия теперь собрана в том же формате, что и оружие: картинка категории слева и быстрые ссылки по грейдам справа.',
        'Так проще сравнивать кольца, серьги и ожерелья без длинной прокрутки и лишних переходов назад.',
    ],
    sourceBlockId: 'items-accessories-categories',
    tableLabel: 'Бижутерия',
    emptyText: '—',
    fallbackCategories: [
        { articleId: 'items-jewelry-rings', label: 'Кольца' },
        { articleId: 'items-jewelry-earrings', label: 'Серьги' },
        { articleId: 'items-jewelry-necklaces', label: 'Ожерелья' },
    ],
});

database.updatedAt = new Date().toISOString();

fs.writeFileSync(canonicalPath, JSON.stringify(database), 'utf8');
fs.writeFileSync(
    metaPath,
    JSON.stringify({
        version: Number(database.version) || 2,
        updatedAt: database.updatedAt,
        site: {
            name: database.site?.name || '',
            subtitle: database.site?.subtitle || '',
        },
        counts: {
            sections: Object.keys(database.sections || {}).length,
            articles: Object.keys(database.articles || {}).length,
        },
    }),
    'utf8'
);

if (fs.existsSync(path.dirname(localStorageCanonicalPath))) {
    fs.writeFileSync(localStorageCanonicalPath, JSON.stringify(database), 'utf8');
    fs.writeFileSync(
        localStorageMetaPath,
        JSON.stringify({
            version: Number(database.version) || 2,
            updatedAt: database.updatedAt,
            site: {
                name: database.site?.name || '',
                subtitle: database.site?.subtitle || '',
            },
            counts: {
                sections: Object.keys(database.sections || {}).length,
                articles: Object.keys(database.articles || {}).length,
            },
        }),
        'utf8'
    );
}

console.log('Updated armor and accessories hub pages.');
