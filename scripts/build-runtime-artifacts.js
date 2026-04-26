#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { normalizeDatabase } = require('../lib/rich-content-schema');

const ROOT_DIR = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT_DIR, 'data', 'canonical', 'l2wiki-canonical.json');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'page-data');
const ARTICLES_DIR = path.join(OUTPUT_DIR, 'articles');
const SECTIONS_DIR = path.join(OUTPUT_DIR, 'sections');
const ADMIN_BOOTSTRAP_PATH = path.join(ROOT_DIR, 'data', 'admin-bootstrap.json');

const FEATURED_ARTICLE_IDS = ['class-tree', 'catacombs-necropolis', 'mammon-services', 'spoiler-guide'];
const LEGACY_GROUP_ALIASES = {
    quests: {
        epic: 'epic-bosses',
        'profession-4': 'alternative-profession',
        profession4: 'alternative-profession',
        'fourth-profession': 'alternative-profession',
    },
};

const ensureDir = (targetPath) => {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
};

const writeJson = (filePath, payload) => {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
};

const sortByOrder = (left, right) => {
    const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : 9999;
    const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : 9999;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return String(left?.title || left?.label || left?.id || '').localeCompare(String(right?.title || right?.label || right?.id || ''), 'ru');
};

const getArticleById = (database, articleId) => database?.articles?.[articleId] || null;

const normalizeGroupId = (section, groupId = '') => LEGACY_GROUP_ALIASES[section?.id]?.[groupId] || groupId;

const resolveGroup = (section, groupId = '') => {
    const normalizedGroupId = normalizeGroupId(section, groupId);

    if (section?.id === 'quests' && normalizedGroupId === 'profession') {
        const professionGroups = (section.groups || []).filter((group) => /^profession-\d+$/.test(group.id) || group.id === 'alternative-profession');
        return {
            id: 'profession',
            label: 'На профессию',
            description: 'Квесты и цепочки для всех смен профессии.',
            entries: professionGroups.flatMap((group) => group.entries || []),
        };
    }

    return (section?.groups || []).find((group) => group.id === normalizedGroupId) || null;
};

const getGroupLeadArticleId = (database, section, group) => {
    if (!group) {
        return '';
    }

    if (group.landingArticleId && getArticleById(database, group.landingArticleId)) {
        return group.landingArticleId;
    }

    return (
        (group.entries || []).find((articleId) => {
            const article = getArticleById(database, articleId);
            return article && (!section || article.section === section.id);
        }) || ''
    );
};

const createPublicGroupSummary = (database, section, group = {}) => ({
    id: group.id || '',
    label: group.label || '',
    description: group.description || '',
    order: Number.isFinite(Number(group.order)) ? Number(group.order) : 9999,
    entries: [getGroupLeadArticleId(database, section, group)].filter(Boolean),
    landingArticleId: group.landingArticleId || '',
    iconSrc: group.iconSrc || '',
    iconAlt: group.iconAlt || '',
});

const createPublicSectionSummary = (database, section = {}) => ({
    id: section.id || '',
    title: section.title || '',
    description: section.description || '',
    order: Number.isFinite(Number(section.order)) ? Number(section.order) : 9999,
    groups: Array.isArray(section.groups) ? section.groups.map((group) => createPublicGroupSummary(database, section, group)) : [],
});

const buildPublicBase = (database) => ({
    version: Number(database?.version) || 2,
    updatedAt: database?.updatedAt || new Date().toISOString(),
    site: database?.site || {},
    sections: Object.fromEntries(
        Object.values(database?.sections || {})
            .sort(sortByOrder)
            .map((section) => [section.id, createPublicSectionSummary(database, section)])
    ),
    articles: {},
});

const buildPublicArticleSummary = (article = {}) => ({
    id: article.id || '',
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
});

const stripHtmlTags = (value = '') => String(value || '').replace(/<[^>]+>/g, ' ');

const collectQuestGuideEntryText = (entries = []) =>
    (Array.isArray(entries) ? entries : [])
        .map((entry) =>
            [
                entry?.text,
                stripHtmlTags(entry?.html),
                entry?.iconAlt,
                entry?.location,
                entry?.npc,
                entry?.rewardPreview,
                collectQuestGuideEntryText(entry?.substeps || []),
            ]
                .filter(Boolean)
                .join(' ')
        )
        .join(' ');

const collectSearchTextFromBlock = (block = {}) => {
    if (!block || typeof block !== 'object') {
        return '';
    }

    if (block.type === 'prose') {
        return [block.title, ...(block.paragraphs || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'list' || block.type === 'steps') {
        return [block.title, ...(block.items || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'callout') {
        return [block.title, block.text, ...(block.items || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'table') {
        const columns = (block.columns || []).map((column) => column?.label).filter(Boolean);
        const rows = (block.rows || []).flatMap((row) => [
            row?.title,
            ...(row?.meta || []).flatMap((item) => [item?.label, item?.value]),
            ...(row?.cells || []).flatMap((cell) => [cell?.value, stripHtmlTags(cell?.html)]),
        ]);

        return [block.title, ...columns, ...rows].filter(Boolean).join(' ');
    }

    if (block.type === 'media') {
        return [block.title, ...(block.items || []).flatMap((item) => [item?.alt, item?.caption])].filter(Boolean).join(' ');
    }

    if (block.type === 'html') {
        return [block.title, stripHtmlTags(block.html)].filter(Boolean).join(' ');
    }

    if (block.type === 'questGuide') {
        return [
            ...(block.overviewParagraphs || []),
            collectQuestGuideEntryText(block.prepItems || []),
            collectQuestGuideEntryText(block.steps || []),
            collectQuestGuideEntryText(block.rewards || []),
        ]
            .filter(Boolean)
            .join(' ');
    }

    return block.title || '';
};

const buildArticleSearchRecord = (database, article) => {
    const section = database?.sections?.[article?.section] || null;
    const group = resolveGroup(section, article?.group || '');

    return {
        id: article.id,
        type: 'article',
        title: article.title || '',
        summary: article.summary || '',
        section: article.section || '',
        sectionTitle: section?.title || '',
        group: article.group || '',
        groupTitle: group?.label || '',
        previewImage: article.heroImage || '',
        searchableText: [
            article.title,
            article.summary,
            article.eyebrow,
            ...(article.aliases || []),
            ...(article.intro || []),
            ...(article.meta || []).flatMap((item) => [item?.label, item?.value]),
            ...(article.sidebarFacts || []).flatMap((item) => [item?.label, item?.value]),
            ...(article.blocks || []).map(collectSearchTextFromBlock),
        ]
            .filter(Boolean)
            .join(' '),
    };
};

const buildSectionSearchRecord = (section) => ({
    id: section.id,
    type: 'section',
    title: section.title || '',
    summary: section.description || '',
    section: section.id,
    sectionTitle: section.title || '',
    previewImage: (section.groups || []).find((group) => group?.iconSrc)?.iconSrc || '',
    searchableText: [
        section.title,
        section.description,
        ...(section.stats || []).flatMap((item) => [item?.label, item?.value]),
        ...(section.groups || []).flatMap((group) => [group?.label, group?.description]),
    ]
        .filter(Boolean)
        .join(' '),
});

const buildAdminBootstrap = (database) => {
    const articles = {};
    const articleSummaryIds = [];

    Object.values(database?.articles || {})
        .sort(sortByOrder)
        .forEach((article) => {
            if (!article?.id) {
                return;
            }

            if (article.id === 'contacts') {
                articles[article.id] = article;
                return;
            }

            articles[article.id] = buildPublicArticleSummary(article);
            articleSummaryIds.push(article.id);
        });

    return {
        ok: true,
        updatedAt: database.updatedAt,
        articleSummaryIds,
        database: {
            version: database.version,
            updatedAt: database.updatedAt,
            site: database.site,
            sections: database.sections,
            articles,
        },
    };
};

if (!fs.existsSync(CANONICAL_PATH)) {
    throw new Error(`Canonical JSON not found: ${CANONICAL_PATH}`);
}

const database = normalizeDatabase(JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8')));

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
ensureDir(ARTICLES_DIR);
ensureDir(SECTIONS_DIR);

writeJson(path.join(OUTPUT_DIR, 'public-base.json'), buildPublicBase(database));
writeJson(
    path.join(OUTPUT_DIR, 'article-summaries.json'),
    Object.fromEntries(Object.values(database.articles || {}).map((article) => [article.id, buildPublicArticleSummary(article)]))
);
writeJson(
    path.join(OUTPUT_DIR, 'search-index.json'),
    [
        ...Object.values(database.sections || {}).map(buildSectionSearchRecord),
        ...Object.values(database.articles || {}).map((article) => buildArticleSearchRecord(database, article)),
    ]
);
writeJson(ADMIN_BOOTSTRAP_PATH, buildAdminBootstrap(database));

Object.values(database.sections || {}).forEach((section) => {
    writeJson(path.join(SECTIONS_DIR, `${section.id}.json`), section);
});

Object.values(database.articles || {}).forEach((article) => {
    writeJson(path.join(ARTICLES_DIR, `${article.id}.json`), article);
});

console.log(
    `[artifacts] Built runtime artifacts: ${FEATURED_ARTICLE_IDS.length} featured, ${Object.keys(database.sections || {}).length} sections, ${
        Object.keys(database.articles || {}).length
    } articles`
);
