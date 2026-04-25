#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const BACKUP_PATH = path.join(ROOT, 'data', 'backups', 'canonical-simple-close-2026-04-11T07-33-11-706Z.json');
const WORLD_MAP_SRC = '/assets/img/world-map.png';

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const findMatchingBrace = (text, startIndex) => {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = false;
            }

            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            depth += 1;
            continue;
        }

        if (char === '}') {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    throw new Error(`Unable to find matching brace from index ${startIndex}`);
};

const findJsonStringEnd = (text, quoteIndex) => {
    let escaped = false;

    for (let index = quoteIndex + 1; index < text.length; index += 1) {
        const char = text[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            return index;
        }
    }

    throw new Error(`Unable to find end quote from index ${quoteIndex}`);
};

const extractHtmlFromBrokenBackup = (backupText, articleId) => {
    const articleMarker = `"${articleId}": {`;
    const articleIndex = backupText.indexOf(articleMarker);

    if (articleIndex === -1) {
        throw new Error(`Article "${articleId}" not found in backup`);
    }

    const objectStart = backupText.indexOf('{', articleIndex);
    const objectEnd = findMatchingBrace(backupText, objectStart);
    const articleText = backupText.slice(objectStart, objectEnd + 1);
    const htmlKey = '"html":';
    const htmlKeyIndex = articleText.indexOf(htmlKey);

    if (htmlKeyIndex === -1) {
        throw new Error(`No html block found for "${articleId}"`);
    }

    const quoteIndex = articleText.indexOf('"', htmlKeyIndex + htmlKey.length);
    const quoteEnd = findJsonStringEnd(articleText, quoteIndex);
    const rawJsonString = articleText.slice(quoteIndex, quoteEnd + 1);

    return JSON.parse(rawJsonString);
};

const ensureWorldMapGroup = (database) => {
    const locations = database.sections?.locations;

    if (!locations) {
        throw new Error('Section "locations" is missing');
    }

    const existingGroup = (locations.groups || []).find((group) => group.id === 'world');

    if (existingGroup) {
        existingGroup.label = 'Карта мира';
        existingGroup.description = 'Общая карта мира с локациями и ключевыми NPC.';
        existingGroup.entries = ['world-map-locations'];
        existingGroup.order = -1;
        return;
    }

    locations.groups = [
        {
            id: 'world',
            label: 'Карта мира',
            description: 'Общая карта мира с локациями и ключевыми NPC.',
            entries: ['world-map-locations'],
            order: -1,
        },
        ...(locations.groups || []),
    ];
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const upsertImageMapBlock = (article, block) => {
    const blocks = (article.blocks || []).filter((item) => item.type !== 'imageMap');
    article.blocks = [block, ...blocks];
};

const upsertLandingImageMapBlock = (section, block) => {
    const blocks = (section.landingBlocks || []).filter((item) => item.type !== 'imageMap');
    section.landingBlocks = [block, ...blocks];
};

const addOverviewMaps = (database) => {
    const worldMapArticle = database.articles?.['world-map-locations'];
    const worldMapBlock = (worldMapArticle?.blocks || []).find((block) => block.type === 'imageMap');

    if (!worldMapBlock) {
        throw new Error('World image map block is missing');
    }

    const locationMarkers = (worldMapBlock.markers || []).filter((marker) => marker.kind === 'location');
    const npcMarkers = (worldMapBlock.markers || []).filter((marker) => marker.kind === 'npc');
    const locationsOverview = database.articles?.['locations-overview'];
    const npcOverview = database.articles?.['npc-overview'];

    if (!locationsOverview || !npcOverview) {
        throw new Error('Overview articles for NPC or locations are missing');
    }

    upsertImageMapBlock(locationsOverview, {
        id: 'locations-overview-map',
        type: 'imageMap',
        title: 'Карта локаций',
        imageSrc: WORLD_MAP_SRC,
        imageAlt: 'Карта мира Lineage II с отмеченными локациями',
        markers: clone(locationMarkers),
        legend: [
            {
                id: 'legend-location-only',
                label: 'Локации и города',
                kind: 'location',
            },
        ],
    });

    upsertImageMapBlock(npcOverview, {
        id: 'npc-overview-map',
        type: 'imageMap',
        title: 'Карта NPC',
        imageSrc: WORLD_MAP_SRC,
        imageAlt: 'Карта мира Lineage II с отмеченными NPC и сервисами',
        markers: clone(npcMarkers),
        legend: [
            {
                id: 'legend-npc-only',
                label: 'NPC и сервисы',
                kind: 'npc',
            },
        ],
    });

    upsertLandingImageMapBlock(database.sections.locations, {
        id: 'locations-section-map',
        type: 'imageMap',
        title: 'Карта локаций',
        imageSrc: WORLD_MAP_SRC,
        imageAlt: 'Карта мира Lineage II с отмеченными локациями и городами',
        markers: clone(locationMarkers),
        legend: [
            {
                id: 'legend-location-section',
                label: 'Локации и города',
                kind: 'location',
            },
        ],
    });

    upsertLandingImageMapBlock(database.sections.npc, {
        id: 'npc-section-map',
        type: 'imageMap',
        title: 'Карта NPC',
        imageSrc: WORLD_MAP_SRC,
        imageAlt: 'Карта мира Lineage II с отмеченными NPC и сервисами',
        markers: clone(npcMarkers),
        legend: [
            {
                id: 'legend-npc-section',
                label: 'NPC и сервисы',
                kind: 'npc',
            },
        ],
    });
};

const splitWeaponLabel = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();

    if (!normalized || !/[A-Za-z]/.test(normalized) || !/[А-Яа-яЁё]/.test(normalized)) {
        return null;
    }

    const match = normalized.match(/^(.+?)([А-Яа-яЁё].*)$/);

    if (!match) {
        return null;
    }

    const english = match[1].trim();
    const russian = match[2].trim();

    if (!english || !russian) {
        return null;
    }

    return { english, russian };
};

const cleanWeaponCategoryLabels = (database) => {
    for (const article of Object.values(database.articles || {})) {
        if (!article?.id?.startsWith('weapons-')) {
            continue;
        }

        for (const block of article.blocks || []) {
            if (block.type !== 'table') {
                continue;
            }

            for (const row of block.rows || []) {
                const firstCell = row?.cells?.[0];
                const parts = splitWeaponLabel(firstCell?.value);

                if (!firstCell || !parts) {
                    continue;
                }

                firstCell.html = `${escapeHtml(parts.english)}<br><span class="weapon-table__local-name">${escapeHtml(parts.russian)}</span>`;
                firstCell.value = `${parts.english} / ${parts.russian}`;
            }
        }
    }
};

const cleanWeaponItemTitles = (database) => {
    for (const article of Object.values(database.articles || {})) {
        if (!article?.id?.startsWith('weapon-item-') || typeof article.title !== 'string') {
            continue;
        }

        article.title = article.title.replace(/([A-Za-z0-9)])\(/g, '$1 (');
    }
};

const main = () => {
    const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    const backupText = fs.readFileSync(BACKUP_PATH, 'utf8');
    const classTreeHtml = extractHtmlFromBrokenBackup(backupText, 'class-tree');
    const spoilerGuideHtml = extractHtmlFromBrokenBackup(backupText, 'spoiler-guide');

    if (!database.articles?.['class-tree']) {
        throw new Error('Article "class-tree" is missing in canonical');
    }

    if (!database.articles?.['spoiler-guide']) {
        throw new Error('Article "spoiler-guide" is missing in canonical');
    }

    if (!database.articles?.['world-map-locations']) {
        throw new Error('Article "world-map-locations" is missing in canonical');
    }

    database.articles['class-tree'].blocks = [
        {
            id: 'class-tree-html-copy',
            type: 'html',
            html: classTreeHtml,
        },
    ];
    database.articles['class-tree'].source = {
        sourceType: 'local-copy',
        path: 'дерево классов1.html',
    };

    database.articles['spoiler-guide'].blocks = [
        {
            id: 'spoiler-guide-html-copy',
            type: 'html',
            html: spoilerGuideHtml,
        },
    ];
    database.articles['spoiler-guide'].source = {
        sourceType: 'local-copy',
        path: 'data/raw/archive/guide-item-3139-spoil--local.html',
    };

    database.articles['world-map-locations'].title = 'Карта мира Lineage 2 — NPC и локации';
    database.articles['world-map-locations'].eyebrow = 'Локации | Карта мира';
    database.articles['world-map-locations'].group = 'world';
    const worldMapBlock = (database.articles['world-map-locations'].blocks || []).find((block) => block.type === 'imageMap');

    if (worldMapBlock) {
        worldMapBlock.imageSrc = WORLD_MAP_SRC;
    }

    ensureWorldMapGroup(database);
    addOverviewMaps(database);
    cleanWeaponCategoryLabels(database);
    cleanWeaponItemTitles(database);

    database.updatedAt = new Date().toISOString();

    fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(database, null, 2)}\n`, 'utf8');

    console.log('Canonical data updated: HTML copies restored, world map navigation fixed, weapon labels cleaned.');
};

main();
