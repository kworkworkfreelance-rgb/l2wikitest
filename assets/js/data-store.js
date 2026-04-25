(function () {
    const DEFAULT_AD_SLOTS = {
        homeHeader: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
        homeSidebar: { enabled: true, label: 'Рекламный блок (300x250)', text: '' },
        homeSectionBreak: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
        homeContentBottom: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
        articleTop: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
        articleBottom: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
        sectionTop: { enabled: true, label: 'Рекламный блок (728x90)', text: '' },
    };

    const STORAGE_KEY = 'l2wiki.rich-db.v2';
    const UPDATE_EVENT = 'l2wiki:db-updated';
    const CHANNEL_NAME = 'l2wiki-db';
    const MAX_LOCAL_SNAPSHOT_SIZE = 4 * 1024 * 1024;

    const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const toArray = (value) => (Array.isArray(value) ? value : []);
    const toStringValue = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());
    const toNumber = (value, fallback = 9999) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    };
    const normalizeId = (value) =>
        toStringValue(value)
            .toLowerCase()
            .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
            .replace(/^-+|-+$/g, '');

    const now = () => new Date().toISOString();
    const deepClone = (value) => JSON.parse(JSON.stringify(value));

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

    const normalizeAliasArray = (value) => Array.from(new Set(normalizeTextArray(value).map((item) => item.toLowerCase())));
    const normalizeFactArray = normalizeMetaArray;

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

    const normalizeTableColumns = (value) =>
        toArray(value)
            .map((column, index) => {
                if (typeof column === 'string') {
                    const label = toStringValue(column);

                    if (!label) {
                        return null;
                    }

                    return {
                        key: normalizeId(label) || `column-${index + 1}`,
                        label,
                    };
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

    const normalizeBlock = (block, fallbackId) => {
        const source = isObject(block) ? block : {};
        const type = toStringValue(source.type) || 'prose';

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

    const compatibilityQuestGuideForArticle = (article) => {
        if (!article || article.section !== 'quests' || article.layout === 'catalog') {
            return null;
        }

        const overviewParagraphs = normalizeTextArray(article.intro);
        const prepItems = normalizeTextArray(article.checklist).map((item) => ({ text: item }));
        const steps = normalizeTextArray(article.steps).map((item) => ({ text: item }));
        const rewards = normalizeTextArray(article.rewards).map((item) => ({ text: item }));
        const notes = normalizeTextArray(article.tips);

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
            heroMedia: [],
            overviewParagraphs,
            prepItems,
            steps,
            rewards,
            notes,
            relatedQuestIds: normalizeTextArray(article.related),
        };
    };

    const compatibilityBlocksForArticle = (article) => {
        const blocks = [];

        if (article.intro.length) {
            blocks.push({
                id: 'overview',
                type: 'prose',
                title: 'Кратко по теме',
                paragraphs: article.intro,
            });
        }

        if (article.checklist.length) {
            blocks.push({
                id: 'checklist',
                type: 'list',
                title: 'Что подготовить',
                style: 'check',
                items: article.checklist,
            });
        }

        if (article.steps.length) {
            blocks.push({
                id: 'steps',
                type: 'steps',
                title: 'Порядок действий',
                style: 'ordered',
                items: article.steps,
            });
        }

        if (article.rewards.length) {
            blocks.push({
                id: 'rewards',
                type: 'list',
                title: 'Награды и результат',
                style: 'unordered',
                items: article.rewards,
            });
        }

        if (article.tips.length) {
            blocks.push({
                id: 'tips',
                type: 'callout',
                title: 'Полезные заметки',
                tone: 'info',
                items: article.tips,
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
            landingLayout: toStringValue(source.landingLayout),
            landingBlocks: toArray(source.landingBlocks).map((block, index) => normalizeBlock(block, `${id}-landing-${index + 1}`)),
            landingSidebarFacts: normalizeFactArray(source.landingSidebarFacts),
            catalogColumns: normalizeTableColumns(source.catalogColumns),
            catalogRows: normalizeTableRows(source.catalogRows),
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
            layout: toStringValue(source.layout),
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
            name: toStringValue(source.name) || 'L2Wiki.Su',
            subtitle: toStringValue(source.subtitle) || 'База знаний по Lineage II',
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
            updatedAt: toStringValue(source.updatedAt) || now(),
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

    const listeners = new Set();
    const channel = typeof window.BroadcastChannel === 'function' ? new window.BroadcastChannel(CHANNEL_NAME) : null;
    const readSeedDatabase = () => normalizeDatabase(window.L2WIKI_SEED_DATA || window.L2WIKI_CONTENT || {});
    let warnedAboutSnapshotSize = false;

    let currentDatabase = readSeedDatabase();

    const syncExternalDatabase = (database, source = 'external') => {
        currentDatabase = normalizeDatabase(database || {});
        notifyListeners(source);
        return deepClone(currentDatabase);
    };

    const notifyListeners = (source) => {
        const payload = deepClone(currentDatabase);
        listeners.forEach((listener) => {
            try {
                listener(payload, source);
            } catch (error) {
                console.error('[L2Wiki] Store listener failed:', error);
            }
        });

        window.dispatchEvent(
            new CustomEvent(UPDATE_EVENT, {
                detail: {
                    source,
                    database: payload,
                },
            })
        );
    };

    const persistLocalSnapshot = () => {
        const serialized = JSON.stringify(currentDatabase);

        try {
            if (serialized.length > MAX_LOCAL_SNAPSHOT_SIZE) {
                window.localStorage.removeItem(STORAGE_KEY);

                if (!warnedAboutSnapshotSize) {
                    console.warn('[L2Wiki] Local snapshot is too large for localStorage, skipping browser cache.');
                    warnedAboutSnapshotSize = true;
                }
            } else {
                window.localStorage.setItem(STORAGE_KEY, serialized);
            }
        } catch (error) {
            console.warn('[L2Wiki] Could not persist local snapshot:', error);
        }

        if (channel) {
            channel.postMessage({
                updatedAt: currentDatabase.updatedAt,
            });
        }
    };

    const updateDatabase = (database, source = 'manual') => {
        currentDatabase = normalizeDatabase({
            ...database,
            updatedAt: now(),
        });

        persistLocalSnapshot();
        notifyListeners(source);
        return deepClone(currentDatabase);
    };

    const setDatabase = (database, source = 'seed-data') => {
        window.L2WIKI_SEED_DATA = database;
        window.L2WIKI_CONTENT = database;
        return syncExternalDatabase(database, source);
    };

    const getDatabase = () => deepClone(currentDatabase);
    const getSeed = () => deepClone(readSeedDatabase());

    const extractTableText = (columns = [], rows = []) =>
        [
            ...columns.map((column) => column.label),
            ...rows.flatMap((row) => [
                row.title,
                ...(row.meta || []).flatMap((item) => [item.label, item.value]),
                ...(row.cells || []).flatMap((cell) => [cell.value, cell.html]),
            ]),
        ]
            .map((item) => toStringValue(item))
            .filter(Boolean)
            .join(' ');

    const extractBlockText = (block) => {
        if (!isObject(block)) {
            return '';
        }

        const title = toStringValue(block.title);

        if (block.type === 'prose') {
            return [title, ...normalizeTextArray(block.paragraphs)].join(' ');
        }

        if (block.type === 'list' || block.type === 'steps') {
            return [title, ...normalizeTextArray(block.items)].join(' ');
        }

        if (block.type === 'callout') {
            return [title, toStringValue(block.text), ...normalizeTextArray(block.items)].join(' ');
        }

        if (block.type === 'table') {
            return [title, extractTableText(block.columns, block.rows)].join(' ');
        }

        if (block.type === 'media') {
            return [title, ...toArray(block.items).flatMap((item) => [item.alt, item.caption])].join(' ');
        }

        if (block.type === 'html') {
            return [title, toStringValue(block.html).replace(/<[^>]+>/g, ' ')].join(' ');
        }

        if (block.type === 'questGuide') {
            const collectEntryText = (entry) => {
                if (!isObject(entry)) {
                    return '';
                }

                return [
                    toStringValue(entry.text),
                    toStringValue(entry.html).replace(/<[^>]+>/g, ' '),
                    toStringValue(entry.iconAlt),
                    toStringValue(entry.quantity),
                    toStringValue(entry.location),
                    toStringValue(entry.npc),
                    toStringValue(entry.rewardPreview),
                    ...toArray(entry.substeps).map(collectEntryText),
                ]
                    .filter(Boolean)
                    .join(' ');
            };

            return [
                title,
                ...normalizeTextArray(block.overviewParagraphs),
                ...toArray(block.heroMedia).flatMap((item) => [item.alt, item.caption]),
                ...toArray(block.prepItems).map(collectEntryText),
                ...toArray(block.steps).map(collectEntryText),
                ...toArray(block.rewards).map(collectEntryText),
                ...normalizeTextArray(block.notes),
                ...normalizeTextArray(block.relatedQuestIds),
            ]
                .filter(Boolean)
                .join(' ');
        }

        if (block.type === 'classTree') {
            return [
                title,
                ...toArray(block.tabs).flatMap((item) => [item.label]),
                ...toArray(block.groups).flatMap((item) => [item.title, item.description]),
                ...toArray(block.nodes).flatMap((item) => [item.label, item.note]),
            ]
                .filter(Boolean)
                .join(' ');
        }

        if (block.type === 'imageMap') {
            return [
                title,
                toStringValue(block.imageAlt),
                ...toArray(block.markers).flatMap((item) => [item.label, item.note, item.kind]),
                ...toArray(block.legend).flatMap((item) => [item.label, item.kind]),
            ]
                .filter(Boolean)
                .join(' ');
        }

        return title;
    };

    const getStats = () => {
        const sections = Object.values(currentDatabase.sections);
        return {
            sections: sections.length,
            articles: Object.keys(currentDatabase.articles).length,
            groups: sections.reduce((total, section) => total + section.groups.length, 0),
            updatedAt: currentDatabase.updatedAt,
        };
    };

    const listSections = () => Object.values(currentDatabase.sections).sort(sortByOrder);

    const listArticles = (filters = {}) => {
        const search = toStringValue(filters.search).toLowerCase();

        return Object.values(currentDatabase.articles)
            .filter((article) => {
                if (filters.section && article.section !== filters.section) {
                    return false;
                }

                if (filters.group && article.group !== filters.group) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                const haystack = [
                    article.title,
                    article.summary,
                    article.eyebrow,
                    ...article.aliases,
                    ...article.intro,
                    ...article.checklist,
                    ...article.steps,
                    ...article.rewards,
                    ...article.tips,
                    ...(article.meta || []).flatMap((item) => [item.label, item.value]),
                    ...(article.sidebarFacts || []).flatMap((item) => [item.label, item.value]),
                    ...(article.blocks || []).map(extractBlockText),
                ]
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(search);
            })
            .sort(sortByOrder);
    };

    const ensureSectionExists = (database, sectionId) => {
        if (!database.sections[sectionId]) {
            throw new Error(`Unknown section: ${sectionId}`);
        }
    };

    const saveArticle = (articleInput) => {
        const database = getDatabase();
        const candidate = normalizeArticle(articleInput, articleInput?.id);

        if (!candidate.id) {
            throw new Error('У статьи должен быть id.');
        }

        ensureSectionExists(database, candidate.section);

        const section = database.sections[candidate.section];
        const fallbackGroup = section.groups[0];

        if (!candidate.group && fallbackGroup) {
            candidate.group = fallbackGroup.id;
        }

        if (!section.groups.find((group) => group.id === candidate.group)) {
            candidate.group = fallbackGroup?.id || candidate.group;
        }

        database.articles[candidate.id] = {
            ...(database.articles[candidate.id] || {}),
            ...candidate,
        };

        return updateDatabase(database, 'save-article');
    };

    const deleteArticle = (articleId) => {
        const database = getDatabase();
        delete database.articles[articleId];
        return updateDatabase(database, 'delete-article');
    };

    const saveSection = (sectionInput) => {
        const database = getDatabase();
        const candidate = normalizeSection(sectionInput, sectionInput?.id);

        if (!candidate.id) {
            throw new Error('У раздела должен быть id.');
        }

        if (!candidate.groups.length) {
            throw new Error('Добавьте хотя бы одну группу в раздел.');
        }

        database.sections[candidate.id] = candidate;

        const allowedGroups = new Set(candidate.groups.map((group) => group.id));

        Object.values(database.articles).forEach((article) => {
            if (article.section !== candidate.id) {
                return;
            }

            if (!allowedGroups.has(article.group)) {
                article.group = candidate.groups[0].id;
            }
        });

        return updateDatabase(database, 'save-section');
    };

    const deleteSection = (sectionId) => {
        const database = getDatabase();
        const hasArticles = Object.values(database.articles).some((article) => article.section === sectionId);

        if (hasArticles) {
            throw new Error('Сначала перенесите или удалите статьи из этого раздела.');
        }

        delete database.sections[sectionId];
        return updateDatabase(database, 'delete-section');
    };

    const updateSite = (siteInput) => {
        const database = getDatabase();
        database.site = normalizeSite({
            ...database.site,
            ...(isObject(siteInput) ? siteInput : {}),
        });
        return updateDatabase(database, 'update-site');
    };

    const resetToSeed = () => updateDatabase(getSeed(), 'reset');
    const exportToJson = () => JSON.stringify(currentDatabase, null, 2);

    const importFromJson = (text) => {
        let parsed;

        try {
            parsed = JSON.parse(text);
        } catch (error) {
            throw new Error('Файл не похож на JSON базы знаний.');
        }

        const normalized = normalizeDatabase(parsed);

        if (!Object.keys(normalized.sections).length || !Object.keys(normalized.articles).length) {
            throw new Error('В импортируемом файле нет разделов или статей.');
        }

        return updateDatabase(normalized, 'import');
    };

    const buildSearchIndex = () => {
        const sectionItems = Object.values(currentDatabase.sections).map((section) => ({
            id: section.id,
            type: 'section',
            title: section.title,
            summary: section.description,
            section: section.id,
            sectionTitle: section.title,
            group: '',
            groupTitle: '',
            searchableText: [
                section.title,
                section.description,
                ...(section.stats || []).flatMap((item) => [item.label, item.value]),
                ...(section.groups || []).flatMap((group) => [group.label, group.description]),
                ...(section.landingSidebarFacts || []).flatMap((item) => [item.label, item.value]),
                ...(section.landingBlocks || []).map(extractBlockText),
                extractTableText(section.catalogColumns, section.catalogRows),
            ].join(' '),
            hrefType: 'section',
        }));

        const articleItems = Object.values(currentDatabase.articles).map((article) => ({
            id: article.id,
            type: 'article',
            title: article.title,
            summary: article.summary,
            section: article.section,
            group: article.group,
            sectionTitle: currentDatabase.sections[article.section]?.title || article.section,
            groupTitle:
                currentDatabase.sections[article.section]?.groups?.find((group) => group.id === article.group)?.label || article.group,
            searchableText: [
                article.title,
                article.summary,
                article.eyebrow,
                ...article.aliases,
                ...article.intro,
                ...article.checklist,
                ...article.steps,
                ...article.rewards,
                ...article.tips,
                ...(article.meta || []).flatMap((item) => [item.label, item.value]),
                ...(article.sidebarFacts || []).flatMap((item) => [item.label, item.value]),
                ...(article.blocks || []).map(extractBlockText),
            ].join(' '),
            hrefType: 'article',
        }));

        return [...sectionItems, ...articleItems];
    };

    const subscribe = (listener) => {
        if (typeof listener !== 'function') {
            return () => {};
        }

        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) {
            return;
        }

        try {
            currentDatabase = normalizeDatabase(JSON.parse(event.newValue));
            notifyListeners('storage');
        } catch (error) {
            console.warn('[L2Wiki] Failed to sync from storage:', error);
        }
    });

    if (channel) {
        channel.addEventListener('message', () => {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);

                if (!raw) {
                    return;
                }

                currentDatabase = normalizeDatabase(JSON.parse(raw));
                notifyListeners('broadcast');
            } catch (error) {
                console.warn('[L2Wiki] Failed to sync from broadcast:', error);
            }
        });
    }

    window.addEventListener('l2wiki:data-loaded', (event) => {
        const payload = event?.detail?.payload || event?.detail || window.L2WIKI_SEED_DATA || window.L2WIKI_CONTENT;

        if (!payload || typeof payload !== 'object') {
            return;
        }

        syncExternalDatabase(payload, event?.detail?.source || 'seed-data');
    });

    window.L2WikiStore = {
        storageKey: STORAGE_KEY,
        eventName: UPDATE_EVENT,
        getDatabase,
        getSeed,
        setDatabase,
        getStats,
        listSections,
        listArticles,
        saveArticle,
        deleteArticle,
        saveSection,
        deleteSection,
        updateSite,
        resetToSeed,
        exportToJson,
        importFromJson,
        buildSearchIndex,
        normalizeDatabase,
        subscribe,
    };
})();
