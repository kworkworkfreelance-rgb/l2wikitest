const DEFAULT_SITE = {
    name: 'L2Wiki.Su',
    subtitle: 'База знаний по Lineage II в духе классических community-сайтов',
};

const DEFAULT_AD_SLOTS = {
    homeHeader: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    homeSidebar: { enabled: true, label: 'Рекламный блок (300x250)', text: '' },
    homeSectionBreak: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    homeContentBottom: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    articleTop: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    articleBottom: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    sectionTop: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
};

const BLOCK_TYPES = new Set(['prose', 'list', 'steps', 'table', 'callout', 'media', 'html', 'questGuide', 'classTree', 'imageMap']);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const toArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value, fallback = 9999) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};
const toStringValue = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());

const normalizeId = (value) =>
    toStringValue(value)
        .toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
        .replace(/^-+|-+$/g, '');

const normalizeTextArray = (value) =>
    toArray(value)
        .map((item) => toStringValue(item))
        .filter(Boolean);

const normalizeMetaArray = (value) =>
    toArray(value)
        .map((item) => {
            if (!isObject(item)) {
                return null;
            }

            const label = toStringValue(item.label);
            const metaValue = toStringValue(item.value);

            if (!label || !metaValue) {
                return null;
            }

            return {
                label,
                value: metaValue,
            };
        })
        .filter(Boolean);

const normalizeAliasArray = (value) =>
    Array.from(new Set(normalizeTextArray(value).map((item) => item.toLowerCase())));

const normalizeSource = (value) => {
    if (!isObject(value)) {
        return {};
    }

    const normalized = {
        url: toStringValue(value.url),
        archivedAt: toStringValue(value.archivedAt),
        path: toStringValue(value.path),
        snapshot: toStringValue(value.snapshot),
        sourceType: toStringValue(value.sourceType),
    };

    return Object.fromEntries(Object.entries(normalized).filter(([, entry]) => entry));
};

const normalizeAdSlot = (value, fallback = {}) => {
    const source = isObject(value) ? value : {};

    return {
        enabled: source.enabled == null ? fallback.enabled !== false : Boolean(source.enabled),
        label: toStringValue(source.label) || toStringValue(fallback.label),
        text: toStringValue(source.text) || toStringValue(fallback.text),
        html: toStringValue(source.html),
        imageSrc: toStringValue(source.imageSrc),
        imageAlt: toStringValue(source.imageAlt),
        href: toStringValue(source.href),
    };
};

const normalizeAds = (value) => {
    const source = isObject(value) ? value : {};
    const slotIds = Array.from(new Set([...Object.keys(DEFAULT_AD_SLOTS), ...Object.keys(source)]));

    return Object.fromEntries(slotIds.map((slotId) => [slotId, normalizeAdSlot(source[slotId], DEFAULT_AD_SLOTS[slotId] || {})]));
};

const normalizeFactArray = normalizeMetaArray;

const normalizeMenuNodes = (value, fallbackPrefix = 'menu') =>
    toArray(value)
        .map((node, index) => {
            if (!isObject(node)) {
                return null;
            }

            const label = toStringValue(node.label || node.title);

            if (!label) {
                return null;
            }

            return {
                id: normalizeId(node.id || `${fallbackPrefix}-${index + 1}`) || `${fallbackPrefix}-${index + 1}`,
                label,
                articleId: normalizeId(node.articleId),
                sourcePath: toStringValue(node.sourcePath),
                children: normalizeMenuNodes(node.children, `${fallbackPrefix}-${index + 1}`),
            };
        })
        .filter(Boolean);

const normalizeTableColumns = (value) =>
    toArray(value)
        .map((column, index) => {
            if (typeof column === 'string') {
                const label = toStringValue(column);
                return label
                    ? {
                          key: normalizeId(label) || `column-${index + 1}`,
                          label,
                      }
                    : null;
            }

            if (!isObject(column)) {
                return null;
            }

            const label = toStringValue(column.label || column.title || column.key);

            if (!label) {
                return null;
            }

            return {
                key: normalizeId(column.key || label) || `column-${index + 1}`,
                label,
                align: toStringValue(column.align),
                width: toStringValue(column.width),
            };
        })
        .filter(Boolean);

const normalizeTableCell = (value) => {
    if (typeof value === 'string' || typeof value === 'number') {
        return {
            value: toStringValue(value),
        };
    }

    if (!isObject(value)) {
        return {
            value: '',
        };
    }

    return {
        value: toStringValue(value.value),
        href: toStringValue(value.href),
        html: toStringValue(value.html),
    };
};

const normalizeTableRows = (value) =>
    toArray(value)
        .map((row, rowIndex) => {
            if (Array.isArray(row)) {
                return {
                    id: `row-${rowIndex + 1}`,
                    cells: row.map(normalizeTableCell),
                };
            }

            if (!isObject(row)) {
                return null;
            }

            return {
                id: normalizeId(row.id || `row-${rowIndex + 1}`),
                title: toStringValue(row.title),
                href: toStringValue(row.href),
                cells: toArray(row.cells).map(normalizeTableCell),
                meta: normalizeFactArray(row.meta),
            };
        })
        .filter(Boolean);

const normalizeMediaItems = (value) =>
    toArray(value)
        .map((item) => {
            if (!isObject(item)) {
                return null;
            }

            const src = toStringValue(item.src);

            if (!src) {
                return null;
            }

            return {
                src,
                alt: toStringValue(item.alt),
                caption: toStringValue(item.caption),
            };
        })
        .filter(Boolean);

const normalizeClassTreeTabs = (value) =>
    toArray(value)
        .map((item, index) => {
            if (typeof item === 'string') {
                const label = toStringValue(item);

                if (!label) {
                    return null;
                }

                return {
                    id: normalizeId(label) || `tab-${index + 1}`,
                    label,
                };
            }

            if (!isObject(item)) {
                return null;
            }

            const label = toStringValue(item.label || item.title);

            if (!label) {
                return null;
            }

            return {
                id: normalizeId(item.id || label) || `tab-${index + 1}`,
                label,
            };
        })
        .filter(Boolean);

const normalizeClassTreeGroups = (value) =>
    toArray(value)
        .map((item, index) => {
            if (!isObject(item)) {
                return null;
            }

            const title = toStringValue(item.title || item.label);

            if (!title) {
                return null;
            }

            return {
                id: normalizeId(item.id || title) || `group-${index + 1}`,
                tabId: normalizeId(item.tabId || item.raceTab || item.tab),
                title,
                description: toStringValue(item.description),
                columns: Math.max(1, toNumber(item.columns, 1)),
                rows: Math.max(1, toNumber(item.rows, 1)),
            };
        })
        .filter(Boolean);

const normalizeClassTreeNodes = (value) =>
    toArray(value)
        .map((item, index) => {
            if (!isObject(item)) {
                return null;
            }

            const label = toStringValue(item.label || item.title);

            if (!label) {
                return null;
            }

            return {
                id: normalizeId(item.id || label) || `node-${index + 1}`,
                label,
                iconSrc: toStringValue(item.iconSrc),
                iconAlt: toStringValue(item.iconAlt),
                href: toStringValue(item.href),
                tier: Math.max(1, toNumber(item.tier, 1)),
                raceTab: normalizeId(item.raceTab || item.tabId || item.tab),
                groupId: normalizeId(item.groupId || item.group),
                column: Math.max(1, toNumber(item.column, 1)),
                row: Math.max(1, toNumber(item.row, 1)),
                note: toStringValue(item.note),
            };
        })
        .filter(Boolean);

const normalizeClassTreeLinks = (value) =>
    toArray(value)
        .map((item, index) => {
            if (!isObject(item)) {
                return null;
            }

            const from = normalizeId(item.from);
            const to = normalizeId(item.to);

            if (!from || !to) {
                return null;
            }

            return {
                id: normalizeId(item.id || `${from}-${to}`) || `link-${index + 1}`,
                from,
                to,
                raceTab: normalizeId(item.raceTab || item.tabId || item.tab),
                groupId: normalizeId(item.groupId || item.group),
                style: toStringValue(item.style),
            };
        })
        .filter(Boolean);

const normalizeImageMapMarkers = (value) =>
    toArray(value)
        .map((item, index) => {
            if (!isObject(item)) {
                return null;
            }

            const label = toStringValue(item.label || item.title);
            const x = Number(item.x);
            const y = Number(item.y);

            if (!label || !Number.isFinite(x) || !Number.isFinite(y)) {
                return null;
            }

            return {
                id: normalizeId(item.id || label) || `marker-${index + 1}`,
                label,
                x: Math.max(0, Math.min(100, x)),
                y: Math.max(0, Math.min(100, y)),
                kind: toStringValue(item.kind) || 'location',
                href: toStringValue(item.href),
                note: toStringValue(item.note),
            };
        })
        .filter(Boolean);

const normalizeImageMapLegend = (value) =>
    toArray(value)
        .map((item, index) => {
            if (typeof item === 'string') {
                const label = toStringValue(item);
                return label
                    ? {
                          id: `legend-${index + 1}`,
                          label,
                          kind: 'location',
                      }
                    : null;
            }

            if (!isObject(item)) {
                return null;
            }

            const label = toStringValue(item.label || item.title);

            if (!label) {
                return null;
            }

            return {
                id: normalizeId(item.id || label) || `legend-${index + 1}`,
                label,
                kind: toStringValue(item.kind) || 'location',
            };
        })
        .filter(Boolean);

const normalizeQuestGuideEntry = (value) => {
    if (typeof value === 'string') {
        const text = toStringValue(value);
        return text
            ? {
                  text,
                  html: '',
                  iconSrc: '',
                  iconAlt: '',
                  quantity: '',
                  location: '',
                  npc: '',
                  rewardPreview: '',
                  substeps: [],
              }
            : null;
    }

    if (!isObject(value)) {
        return null;
    }

    const text = toStringValue(value.text);
    const html = toStringValue(value.html);
    const substeps = toArray(value.substeps).map(normalizeQuestGuideEntry).filter(Boolean);

    if (!text && !html && !substeps.length) {
        return null;
    }

    return {
        text,
        html,
        iconSrc: toStringValue(value.iconSrc),
        iconAlt: toStringValue(value.iconAlt),
        quantity: toStringValue(value.quantity),
        location: toStringValue(value.location),
        npc: toStringValue(value.npc),
        rewardPreview: toStringValue(value.rewardPreview),
        substeps,
    };
};

const normalizeQuestGuideEntries = (value) => toArray(value).map(normalizeQuestGuideEntry).filter(Boolean);

const compatibilityQuestGuideForArticle = (article) => {
    if (!article || article.section !== 'quests' || article.layout === 'catalog') {
        return null;
    }

    const overviewParagraphs = normalizeTextArray(article.intro);
    const prepItems = normalizeTextArray(article.checklist).map((item) => ({ text: item }));
    const steps = normalizeTextArray(article.steps).map((item) => ({ text: item }));
    const rewards = normalizeTextArray(article.rewards).map((item) => ({ text: item }));
    const notes = normalizeTextArray(article.tips);
    const heroMedia = [];

    if (!overviewParagraphs.length && article.summary) {
        overviewParagraphs.push(article.summary);
    }

    if (!overviewParagraphs.length && !prepItems.length && !steps.length && !rewards.length && !notes.length) {
        return null;
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
        relatedQuestIds: normalizeTextArray(article.related),
    };
};

const normalizeBlock = (block, fallbackId) => {
    const source = isObject(block) ? block : {};
    const type = BLOCK_TYPES.has(source.type) ? source.type : 'prose';

    const normalized = {
        id: normalizeId(source.id || fallbackId || `${type}-block`) || `${type}-block`,
        type,
        title: toStringValue(source.title),
    };

    if (type === 'prose') {
        normalized.paragraphs = normalizeTextArray(source.paragraphs || source.items || source.lines || source.content);
    }

    if (type === 'list' || type === 'steps') {
        normalized.style = type === 'steps' ? 'ordered' : toStringValue(source.style) || 'unordered';
        normalized.items = normalizeTextArray(source.items || source.paragraphs || source.lines || source.content);
    }

    if (type === 'table') {
        normalized.columns = normalizeTableColumns(source.columns || source.headers);
        normalized.rows = normalizeTableRows(source.rows);
        normalized.compact = Boolean(source.compact);
    }

    if (type === 'callout') {
        normalized.tone = toStringValue(source.tone) || 'info';
        normalized.text = toStringValue(source.text);
        normalized.items = normalizeTextArray(source.items);
    }

    if (type === 'media') {
        normalized.items = normalizeMediaItems(source.items);
    }

    if (type === 'html') {
        normalized.html = toStringValue(source.html);
    }

    if (type === 'questGuide') {
        normalized.heroMedia = normalizeMediaItems(source.heroMedia || source.media || source.items);
        normalized.overviewParagraphs = normalizeTextArray(source.overviewParagraphs || source.overview || source.paragraphs);
        normalized.prepItems = normalizeQuestGuideEntries(source.prepItems || source.preparation || source.checklist);
        normalized.steps = normalizeQuestGuideEntries(source.steps);
        normalized.rewards = normalizeQuestGuideEntries(source.rewards);
        normalized.notes = normalizeTextArray(source.notes || source.tips);
        normalized.relatedQuestIds = normalizeTextArray(source.relatedQuestIds || source.related);
    }

    if (type === 'classTree') {
        normalized.tabs = normalizeClassTreeTabs(source.tabs);
        normalized.groups = normalizeClassTreeGroups(source.groups);
        normalized.nodes = normalizeClassTreeNodes(source.nodes);
        normalized.links = normalizeClassTreeLinks(source.links);
    }

    if (type === 'imageMap') {
        normalized.imageSrc = toStringValue(source.imageSrc || source.src);
        normalized.imageAlt = toStringValue(source.imageAlt || source.alt);
        normalized.markers = normalizeImageMapMarkers(source.markers);
        normalized.legend = normalizeImageMapLegend(source.legend);
    }

    return normalized;
};

const compatibilityBlocksForArticle = (article) => {
    const blocks = [];

    if (normalizeTextArray(article.intro).length) {
        blocks.push({
            id: 'overview',
            type: 'prose',
            title: 'Кратко по теме',
            paragraphs: normalizeTextArray(article.intro),
        });
    }

    if (normalizeTextArray(article.checklist).length) {
        blocks.push({
            id: 'checklist',
            type: 'list',
            title: 'Что подготовить',
            style: 'check',
            items: normalizeTextArray(article.checklist),
        });
    }

    if (normalizeTextArray(article.steps).length) {
        blocks.push({
            id: 'steps',
            type: 'steps',
            title: 'Порядок действий',
            style: 'ordered',
            items: normalizeTextArray(article.steps),
        });
    }

    if (normalizeTextArray(article.rewards).length) {
        blocks.push({
            id: 'rewards',
            type: 'list',
            title: 'Награды и результат',
            style: 'unordered',
            items: normalizeTextArray(article.rewards),
        });
    }

    if (normalizeTextArray(article.tips).length) {
        blocks.push({
            id: 'tips',
            type: 'callout',
            title: 'Полезные заметки',
            tone: 'info',
            items: normalizeTextArray(article.tips),
        });
    }

    return blocks;
};

const sortByOrder = (left, right) => {
    const leftOrder = toNumber(left?.order);
    const rightOrder = toNumber(right?.order);

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return toStringValue(left?.title || left?.label || '').localeCompare(toStringValue(right?.title || right?.label || ''), 'ru');
};

const normalizeGroup = (group, fallbackId, defaultOrder = 9999) => {
    const source = isObject(group) ? group : {};
    const id = normalizeId(source.id || fallbackId || 'group');

    return {
        id,
        label: toStringValue(source.label) || id,
        description: toStringValue(source.description),
        entries: normalizeTextArray(source.entries),
        landingArticleId: normalizeId(source.landingArticleId),
        iconSrc: toStringValue(source.iconSrc),
        order: toNumber(source.order, defaultOrder),
    };
};

const normalizeSection = (section, fallbackId, defaultOrder = 9999) => {
    const source = isObject(section) ? section : {};
    const id = normalizeId(source.id || fallbackId || 'section');

    return {
        id,
        title: toStringValue(source.title) || id,
        description: toStringValue(source.description),
        stats: normalizeMetaArray(source.stats),
        groups: toArray(source.groups)
            .map((group, index) => normalizeGroup(group, `${id}-group-${index + 1}`, index))
            .sort(sortByOrder),
        order: toNumber(source.order, defaultOrder),
        landingLayout: toStringValue(source.landingLayout) || '',
        landingBlocks: toArray(source.landingBlocks).map((block, index) => normalizeBlock(block, `${id}-landing-${index + 1}`)),
        landingSidebarFacts: normalizeFactArray(source.landingSidebarFacts),
        catalogColumns: normalizeTableColumns(source.catalogColumns),
        catalogRows: normalizeTableRows(source.catalogRows),
        menuTree: normalizeMenuNodes(source.menuTree, `${id}-menu`),
    };
};

const normalizeArticle = (article, fallbackId, defaultOrder = 9999) => {
    const source = isObject(article) ? article : {};
    const id = normalizeId(source.id || fallbackId || 'article');

    const normalized = {
        id,
        section: normalizeId(source.section),
        group: normalizeId(source.group),
        title: toStringValue(source.title) || id,
        summary: toStringValue(source.summary),
        eyebrow: toStringValue(source.eyebrow),
        meta: normalizeMetaArray(source.meta),
        intro: normalizeTextArray(source.intro),
        checklist: normalizeTextArray(source.checklist),
        steps: normalizeTextArray(source.steps),
        rewards: normalizeTextArray(source.rewards),
        tips: normalizeTextArray(source.tips),
        related: normalizeTextArray(source.related),
        order: toNumber(source.order, defaultOrder),
        layout: toStringValue(source.layout) || '',
        sidebarFacts: normalizeFactArray(source.sidebarFacts),
        source: normalizeSource(source.source),
        aliases: normalizeAliasArray(source.aliases),
        blocks: toArray(source.blocks).map((block, index) => normalizeBlock(block, `${id}-block-${index + 1}`)),
    };

    if (!normalized.blocks.length) {
        const questGuide = compatibilityQuestGuideForArticle(normalized);
        normalized.blocks = questGuide ? [questGuide] : compatibilityBlocksForArticle(normalized);
    }

    return normalized;
};

const normalizeSite = (site) => {
    const source = isObject(site) ? site : {};
    return {
        name: toStringValue(source.name) || DEFAULT_SITE.name,
        subtitle: toStringValue(source.subtitle) || DEFAULT_SITE.subtitle,
        ads: normalizeAds(source.ads),
    };
};

const rebuildSectionEntries = (database) => {
    Object.values(database.sections).forEach((section) => {
        section.groups = section.groups.map((group) => ({
            ...group,
            entries: [],
        }));
    });

    Object.values(database.articles)
        .sort(sortByOrder)
        .forEach((article) => {
            const section = database.sections[article.section];

            if (!section) {
                return;
            }

            let group = section.groups.find((item) => item.id === article.group);

            if (!group && section.groups[0]) {
                group = section.groups[0];
                article.group = group.id;
            }

            if (!group) {
                return;
            }

            if (!group.entries.includes(article.id)) {
                group.entries.push(article.id);
            }
        });

    Object.values(database.sections).forEach((section) => {
        section.groups.forEach((group) => {
            group.entries.sort((leftId, rightId) => sortByOrder(database.articles[leftId], database.articles[rightId]));
        });
    });

    return database;
};

const normalizeDatabase = (raw) => {
    const source = isObject(raw) ? raw : {};
    const sections = {};
    const articles = {};

    Object.entries(isObject(source.sections) ? source.sections : {}).forEach(([sectionId, section], index) => {
        const normalized = normalizeSection(section, sectionId, index);
        sections[normalized.id] = normalized;
    });

    Object.entries(isObject(source.articles) ? source.articles : {}).forEach(([articleId, article], index) => {
        const normalized = normalizeArticle(article, articleId, index);
        articles[normalized.id] = normalized;
    });

    const database = {
        version: toNumber(source.version, 2),
        updatedAt: toStringValue(source.updatedAt) || new Date().toISOString(),
        site: normalizeSite(source.site),
        sections,
        articles,
    };

    Object.values(database.articles).forEach((article) => {
        const section = database.sections[article.section];

        if (!section) {
            return;
        }

        if (!section.groups.find((group) => group.id === article.group) && section.groups[0]) {
            article.group = section.groups[0].id;
        }
    });

    return rebuildSectionEntries(database);
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

module.exports = {
    BLOCK_TYPES,
    compatibilityBlocksForArticle,
    compatibilityQuestGuideForArticle,
    deepClone,
    normalizeAliasArray,
    normalizeArticle,
    normalizeBlock,
    normalizeDatabase,
    normalizeClassTreeGroups,
    normalizeClassTreeLinks,
    normalizeClassTreeNodes,
    normalizeClassTreeTabs,
    normalizeFactArray,
    normalizeGroup,
    normalizeId,
    normalizeImageMapLegend,
    normalizeImageMapMarkers,
    normalizeMetaArray,
    normalizeSection,
    normalizeSite,
    normalizeSource,
    normalizeTableColumns,
    normalizeTableRows,
    normalizeTextArray,
    sortByOrder,
    toStringValue,
};
