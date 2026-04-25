#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const WORLD_MAP_SRC = '/map.png';

const clone = (value) => JSON.parse(JSON.stringify(value));
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const articleUrl = (articleId) => `/pages/article.html?article=${articleId}`;
const roundCoord = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const extractArticleIdFromHref = (href = '') => {
    if (!href || !href.includes('article=')) {
        return '';
    }

    try {
        const url = new URL(href, 'https://l2wiki.local');
        return url.searchParams.get('article') || '';
    } catch (error) {
        const match = String(href).match(/[?&]article=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }
};

const CITY_POINTS = {
    'talking-island': { x: 7.4, y: 93.2 },
    gludin: { x: 6.1, y: 68.5 },
    gludio: { x: 12.5, y: 72.9 },
    dion: { x: 35.8, y: 61.2 },
    giran: { x: 51.5, y: 63.2 },
    innadril: { x: 61.8, y: 86.8 },
    heine: { x: 61.8, y: 86.8 },
    oren: { x: 44.7, y: 31.4 },
    'ivory-tower': { x: 50.2, y: 34.9 },
    aden: { x: 54.7, y: 28.6 },
    schuttgart: { x: 58.5, y: 15.7 },
    rune: { x: 74.0, y: 13.4 },
    goddard: { x: 70.7, y: 39.7 },
    'cruma-tower': { x: 55.9, y: 54.5 },
    'tower-insolence': { x: 63.1, y: 31.2 },
    'primeval-isle': { x: 88.8, y: 93.5 },
    'stakato-nest': { x: 74.5, y: 36.1 },
    'valley-saints': { x: 67.5, y: 24.4 },
    'mithril-mines': { x: 43.6, y: 42.9 },
    'ruins-despair': { x: 18.7, y: 70.1 },
    'elven-forest': { x: 27.1, y: 22.4 },
    'dark-elven-forest': { x: 14.9, y: 79.9 },
    'sea-spores': { x: 53.6, y: 28.4 },
    'devastated-castle': { x: 57.9, y: 45.8 },
    'pagan-temple': { x: 87.1, y: 30.1 },
    'imperial-tomb': { x: 84.6, y: 33.4 },
    'race-track': { x: 49.0, y: 48.9 },
    'elven-village': { x: 24.9, y: 23.3 },
    'dark-elven-village': { x: 13.8, y: 80.9 },
    'dwarven-village': { x: 40.8, y: 45.8 },
    'orc-village': { x: 4.7, y: 91.5 },
    'kamael-village': { x: 88.9, y: 93.4 },
    'catacomb-heretic': { x: 31.0, y: 59.2 },
    'necropolis-sacrifice': { x: 16.5, y: 67.4 },
    'necropolis-pilgrim': { x: 27.7, y: 63.5 },
    'necropolis-worship': { x: 41.8, y: 55.9 },
    'necropolis-patriot': { x: 30.2, y: 68.5 },
    'necropolis-devotion': { x: 49.3, y: 46.8 },
    'necropolis-martyrdom': { x: 61.0, y: 49.6 },
    'necropolis-saint': { x: 67.8, y: 22.7 },
    'necropolis-disciple': { x: 73.6, y: 27.1 },
};

const LOCATION_OVERVIEW_IDS = new Set([
    'archive-location-castle',
    'catacombs-detailed-guide',
    'catacombs-necropolis',
    'locations-cities',
    'locations-overview',
    'necropolis-routes',
    'prime-farming-zones',
    'world-map-locations',
]);

const LOCATION_POINT_OVERRIDES = {
    'archive-location-castle-item-3443-gludio-castle': 'gludio',
    'archive-location-castle-item-3444-dion-castle': 'dion',
    'archive-location-castle-item-3445-giran-castle': 'giran',
    'archive-location-castle-item-3446-innadril-castle': 'innadril',
    'archive-location-castle-item-3447-oren-castle': 'oren',
    'archive-location-castle-item-3448-schuttgart-castle': 'schuttgart',
    'archive-location-castle-item-3449-goddard-castle': 'goddard',
    'archive-location-castle-item-3450-rune-castle': 'rune',
    'archive-location-castle-item-3451-aden-castle': 'aden',
    'archive-location-necropolis-catacombs-item-3141-catacomb-of-the-heretic': 'catacomb-heretic',
    'archive-location-necropolis-catacombs-item-3147-necropolis-of-sacrifice': 'necropolis-sacrifice',
    'archive-location-necropolis-catacombs-item-3148-the-pilgrim-s-necropolis': 'necropolis-pilgrim',
    'archive-location-necropolis-catacombs-item-3149-necropolis-of-worship': 'necropolis-worship',
    'archive-location-necropolis-catacombs-item-3150-the-patriot-s-necropolis': 'necropolis-patriot',
    'archive-location-necropolis-catacombs-item-3151-necropolis-of-devotion': 'necropolis-devotion',
    'archive-location-necropolis-catacombs-item-3152-necropolis-of-martyrdom': 'necropolis-martyrdom',
    'archive-location-necropolis-catacombs-item-3153-the-saint-s-necropolis': 'necropolis-saint',
    'archive-location-necropolis-catacombs-item-3154-the-disciple-s-necropolis': 'necropolis-disciple',
    'imperial-tomb-route': 'imperial-tomb',
    'location-cruma-tower': 'cruma-tower',
    'location-dark-elven-forest': 'dark-elven-forest',
    'location-devastated-castle': 'devastated-castle',
    'location-elven-forest': 'elven-forest',
    'location-giran': 'giran',
    'location-gludin': 'gludin',
    'location-ivory-tower': 'ivory-tower',
    'location-mithril-mines': 'mithril-mines',
    'location-primeval-isle': 'primeval-isle',
    'location-ruins-despair': 'ruins-despair',
    'location-sea-spores': 'sea-spores',
    'location-stakato-nest': 'stakato-nest',
    'location-talking-island': 'talking-island',
    'location-tower-insolence': 'tower-insolence',
    'location-valley-saints': 'valley-saints',
    'pagan-temple-location': 'pagan-temple',
};

const BROAD_NPC_IDS = new Set([
    'clan-support-npcs',
    'gatekeeper-network',
    'mammon-services',
    'npc-overview',
    'quest-hub-npcs',
]);

const NPC_MANUAL_POINT_OVERRIDES = {
    'archive-npc-item-5447-valkon': 'giran',
    'archive-npc-item-5476-race-track-gatekeeper': 'race-track',
    'clan-support-npcs': 'aden',
    'gatekeeper-network': 'giran',
    'mammon-services': 'goddard',
    'npc-overview': 'giran',
    'quest-hub-npcs': 'aden',
};

const NPC_SNAPSHOT_PATTERNS = [
    ['Talking Island Village', 'talking-island'],
    ['Talking Island', 'talking-island'],
    ['Monster Derby Track', 'race-track'],
    ['Race Track', 'race-track'],
    ['Imperial Tomb', 'imperial-tomb'],
    ['Pagan Temple', 'pagan-temple'],
    ['Primeval Isle', 'primeval-isle'],
    ['Valley of Saints', 'valley-saints'],
    ['Stakato Nest', 'stakato-nest'],
    ['Mithril Mines', 'mithril-mines'],
    ['Sea of Spores', 'sea-spores'],
    ['Ivory Tower', 'ivory-tower'],
    ['Cruma Tower', 'cruma-tower'],
    ['Kamael Village', 'kamael-village'],
    ['Orc Village', 'orc-village'],
    ['Dwarven Village', 'dwarven-village'],
    ['Dark Elven Village', 'dark-elven-village'],
    ['Elven Village', 'elven-village'],
    ['Innadril Territory', 'innadril'],
    ['Heine', 'heine'],
    ['Rune Territory', 'rune'],
    ['Goddard Territory', 'goddard'],
    ['Schuttgart Territory', 'schuttgart'],
    ['Aden Territory', 'aden'],
    ['Oren Territory', 'oren'],
    ['Giran Territory', 'giran'],
    ['Dion Territory', 'dion'],
    ['Gludio Territory', 'gludio'],
    ['Gludin', 'gludin'],
    ['Gludio', 'gludio'],
    ['Dion', 'dion'],
    ['Giran', 'giran'],
    ['Oren', 'oren'],
    ['Aden', 'aden'],
    ['Rune', 'rune'],
    ['Goddard', 'goddard'],
    ['Schuttgart', 'schuttgart'],
    ['Innadril', 'innadril'],
];

const REMOTE_HTML_CACHE = new Map();

const getPoint = (pointKey) => (pointKey && CITY_POINTS[pointKey] ? clone(CITY_POINTS[pointKey]) : null);

const makeMarker = ({ articleId, label, kind, pointKey, note = '' }) => {
    const point = getPoint(pointKey);

    if (!point) {
        return null;
    }

    return {
        label,
        href: articleUrl(articleId),
        x: roundCoord(point.x),
        y: roundCoord(point.y),
        kind,
        ...(note ? { note } : {}),
    };
};

const replaceImageMapBlock = (article, block) => {
    const blocks = ensureArray(article.blocks).filter((item) => item.type !== 'imageMap');
    article.blocks = [block, ...blocks];
};

const replaceLandingImageMapBlock = (section, block) => {
    const blocks = ensureArray(section.landingBlocks).filter((item) => item.type !== 'imageMap');
    section.landingBlocks = [block, ...blocks];
};

const spreadMarkers = (markers) => {
    const groups = new Map();

    markers.forEach((marker) => {
        const key = `${roundCoord(marker.x)}:${roundCoord(marker.y)}:${marker.kind}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(marker);
    });

    const result = [];

    for (const group of groups.values()) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        const radius = group.length <= 4 ? 1.1 : group.length <= 8 ? 1.5 : 2;

        group.forEach((marker, index) => {
            const angle = (Math.PI * 2 * index) / group.length;
            result.push({
                ...marker,
                x: roundCoord(clamp(marker.x + Math.cos(angle) * radius, 1.5, 98.5)),
                y: roundCoord(clamp(marker.y + Math.sin(angle) * radius, 1.5, 98.5)),
            });
        });
    }

    return result;
};

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (database) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(database, null, 2)}\n`, 'utf8');

const readSnapshot = (relativePath = '') => {
    if (!relativePath) {
        return '';
    }

    const snapshotPath = path.join(ROOT, relativePath);
    return fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf8') : '';
};

const detectPointKeyFromText = (text = '') => {
    if (!text) {
        return '';
    }

    const lowered = text.toLowerCase();
    for (const [pattern, pointKey] of NPC_SNAPSHOT_PATTERNS) {
        if (lowered.includes(pattern.toLowerCase())) {
            return pointKey;
        }
    }

    return '';
};

const normalizeSourceUrl = (url = '') => {
    if (!url) {
        return '';
    }

    return String(url)
        .replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//i, '')
        .replace(/^https?:\/\/www\.l2int\.ru/i, 'https://l2int.ru')
        .replace(/^http:\/\//i, 'https://');
};

const fetchRemoteHtml = async (url = '') => {
    const normalizedUrl = normalizeSourceUrl(url);

    if (!normalizedUrl) {
        return '';
    }

    if (REMOTE_HTML_CACHE.has(normalizedUrl)) {
        return REMOTE_HTML_CACHE.get(normalizedUrl);
    }

    try {
        const response = await fetch(normalizedUrl, {
            signal: AbortSignal.timeout(12000),
            headers: {
                'user-agent': 'Mozilla/5.0 (compatible; L2WikiMapSync/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        REMOTE_HTML_CACHE.set(normalizedUrl, html);
        return html;
    } catch (error) {
        REMOTE_HTML_CACHE.set(normalizedUrl, '');
        return '';
    }
};

const resolveNpcPointKey = async (article) => {
    const manual = NPC_MANUAL_POINT_OVERRIDES[article.id];
    if (manual) {
        return manual;
    }

    const snapshotHtml = readSnapshot(article.source?.snapshot);
    const snapshotPointKey = detectPointKeyFromText(snapshotHtml);
    if (snapshotPointKey) {
        return snapshotPointKey;
    }

    const remoteHtml = await fetchRemoteHtml(article.source?.url);
    const remotePointKey = detectPointKeyFromText(remoteHtml);
    if (remotePointKey) {
        return remotePointKey;
    }

    const summary = `${article.title || ''} ${article.summary || ''}`.toLowerCase();
    if (summary.includes('race track')) {
        return 'race-track';
    }
    if (summary.includes('chamberlain')) {
        return 'aden';
    }
    if (summary.includes('warehouse keeper') || summary.includes('trader') || summary.includes('gatekeeper')) {
        return 'giran';
    }

    return 'giran';
};

const collectLocationMarkers = (database) => {
    const markers = [];

    Object.values(database.articles || {})
        .filter((article) => article.section === 'locations')
        .forEach((article) => {
            if (LOCATION_OVERVIEW_IDS.has(article.id)) {
                return;
            }

            const pointKey = LOCATION_POINT_OVERRIDES[article.id];
            const marker = pointKey
                ? makeMarker({
                      articleId: article.id,
                      label: article.title,
                      kind: 'location',
                      pointKey,
                  })
                : null;

            if (marker) {
                markers.push(marker);
            }
        });

    return markers;
};

const collectNpcMarkers = async (database) => {
    const npcArticles = Object.values(database.articles || {}).filter((article) => article.section === 'npc' && article.id !== 'npc-overview');
    const markers = await Promise.all(
        npcArticles.map(async (article) => {
            const pointKey = await resolveNpcPointKey(article);
            return makeMarker({
                articleId: article.id,
                label: article.title,
                kind: 'npc',
                pointKey,
            });
        })
    );

    return markers.filter(Boolean);
};

const createImageMapBlock = ({ id, title, imageAlt, markers, legend }) => ({
    id,
    type: 'imageMap',
    title,
    imageSrc: WORLD_MAP_SRC,
    imageAlt,
    markers,
    legend,
});

const splitWeaponLabel = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();

    if (!normalized || !/[A-Za-z]/.test(normalized) || !/[?-??-???]/.test(normalized)) {
        return null;
    }

    const englishMatch = normalized.match(/^[A-Za-z0-9'()[\]\-+,:.s]+/);
    const english = englishMatch ? englishMatch[0].replace(/s*/s*$/g, '').trim() : '';
    const russian = normalized.slice(english.length).replace(/^[s/]+/, '').trim();

    if (!english || !russian) {
        return null;
    }

    return { english, russian };
};

const cleanWeaponCategoryLabels = (database) => {
    Object.values(database.articles || {}).forEach((article) => {
        if (!article?.id?.startsWith('weapons-')) {
            return;
        }

        ensureArray(article.blocks).forEach((block) => {
            if (block.type !== 'table') {
                return;
            }

            ensureArray(block.rows).forEach((row) => {
                const firstCell = row?.cells?.[0];
                const parts = splitWeaponLabel(firstCell?.value);

                if (!firstCell || !parts) {
                    return;
                }

                firstCell.value = `${parts.english} / ${parts.russian}`;
                firstCell.html = `${parts.english}<br><span class="weapon-table__local-name">${parts.russian}</span>`;
            });
        });
    });
};

const cleanWeaponItemTitles = (database) => {
    Object.values(database.articles || {}).forEach((article) => {
        if (!article?.id?.startsWith('weapon-item-') || typeof article.title !== 'string') {
            return;
        }

        article.title = article.title.replace(/([A-Za-z0-9)])\(/g, '$1 (');
    });
};

const filterMarkers = (markers, ids) => {
    const allowed = new Set(ids);
    return markers.filter((marker) => allowed.has(extractArticleIdFromHref(marker.href)));
};

const buildLocationArticleMap = (article, locationMarkers) => {
    const exactMarker = locationMarkers.find((marker) => extractArticleIdFromHref(marker.href) === article.id);
    const castleIds = [
        'archive-location-castle-item-3443-gludio-castle',
        'archive-location-castle-item-3444-dion-castle',
        'archive-location-castle-item-3445-giran-castle',
        'archive-location-castle-item-3446-innadril-castle',
        'archive-location-castle-item-3447-oren-castle',
        'archive-location-castle-item-3448-schuttgart-castle',
        'archive-location-castle-item-3449-goddard-castle',
        'archive-location-castle-item-3450-rune-castle',
        'archive-location-castle-item-3451-aden-castle',
    ];
    const catacombIds = [
        'archive-location-necropolis-catacombs-item-3141-catacomb-of-the-heretic',
        'archive-location-necropolis-catacombs-item-3147-necropolis-of-sacrifice',
        'archive-location-necropolis-catacombs-item-3148-the-pilgrim-s-necropolis',
        'archive-location-necropolis-catacombs-item-3149-necropolis-of-worship',
        'archive-location-necropolis-catacombs-item-3150-the-patriot-s-necropolis',
        'archive-location-necropolis-catacombs-item-3151-necropolis-of-devotion',
        'archive-location-necropolis-catacombs-item-3152-necropolis-of-martyrdom',
        'archive-location-necropolis-catacombs-item-3153-the-saint-s-necropolis',
        'archive-location-necropolis-catacombs-item-3154-the-disciple-s-necropolis',
    ];
    const coreLocationIds = [
        'location-talking-island',
        'location-gludin',
        'location-giran',
        'location-ruins-despair',
        'location-elven-forest',
        'location-dark-elven-forest',
        'location-cruma-tower',
        'location-sea-spores',
        'location-devastated-castle',
        'location-tower-insolence',
        'location-primeval-isle',
        'location-stakato-nest',
        'location-mithril-mines',
        'location-valley-saints',
        'location-ivory-tower',
        'pagan-temple-location',
        'imperial-tomb-route',
    ];

    if (exactMarker) {
        return createImageMapBlock({
            id: 'article-marker-map',
            title: 'Положение на карте',
            imageAlt: `Lineage II world map marker for ${article.title}`,
            markers: [clone(exactMarker)],
            legend: [{ id: 'legend-location', label: 'Локация', kind: 'location' }],
        });
    }

    if (article.id === 'archive-location-castle' || article.id === 'locations-cities') {
        return createImageMapBlock({
            id: 'article-marker-map',
            title: 'Карта замков и городов',
            imageAlt: 'Lineage II world map with castles and cities',
            markers: spreadMarkers(filterMarkers(locationMarkers, castleIds)),
            legend: [{ id: 'legend-castles', label: 'Замки и города', kind: 'location' }],
        });
    }

    if (article.id === 'catacombs-detailed-guide' || article.id === 'catacombs-necropolis' || article.id === 'necropolis-routes') {
        return createImageMapBlock({
            id: 'article-marker-map',
            title: 'Карта катакомб и некрополей',
            imageAlt: 'Lineage II world map with catacombs and necropolises',
            markers: spreadMarkers(filterMarkers(locationMarkers, catacombIds)),
            legend: [{ id: 'legend-catacombs', label: 'Катакомбы и некрополи', kind: 'location' }],
        });
    }

    if (article.id === 'prime-farming-zones' || article.id === 'locations-overview') {
        return createImageMapBlock({
            id: 'article-marker-map',
            title: 'Ключевые локации',
            imageAlt: 'Lineage II world map with key locations',
            markers: spreadMarkers(filterMarkers(locationMarkers, coreLocationIds)),
            legend: [{ id: 'legend-core', label: 'Ключевые локации', kind: 'location' }],
        });
    }

    return createImageMapBlock({
        id: 'article-marker-map',
        title: 'Карта локаций',
        imageAlt: 'Lineage II world map with marked locations',
        markers: spreadMarkers(locationMarkers),
        legend: [{ id: 'legend-all-locations', label: 'Локации и города', kind: 'location' }],
    });
};

const buildNpcArticleMap = (article, npcMarkers) => {
    const exactMarker = npcMarkers.find((marker) => extractArticleIdFromHref(marker.href) === article.id);

    if (exactMarker && !BROAD_NPC_IDS.has(article.id)) {
        return createImageMapBlock({
            id: 'article-marker-map',
            title: 'Положение на карте',
            imageAlt: `Lineage II world map marker for ${article.title}`,
            markers: [clone(exactMarker)],
            legend: [{ id: 'legend-npc', label: 'NPC', kind: 'npc' }],
        });
    }

    return createImageMapBlock({
        id: 'article-marker-map',
        title: 'Карта NPC и сервисов',
        imageAlt: 'Lineage II world map with marked NPCs and services',
        markers: spreadMarkers(npcMarkers),
        legend: [{ id: 'legend-npc-all', label: 'NPC и сервисы', kind: 'npc' }],
    });
};

const ensureWorldGroupAndEntries = (database) => {
    const locations = database.sections?.locations;
    if (!locations) {
        return;
    }

    const worldGroup = ensureArray(locations.groups).find((group) => group.id === 'world');
    if (worldGroup) {
        worldGroup.entries = ['world-map-locations'];
        worldGroup.label = 'Карта мира';
        worldGroup.order = -1;
    }

    const catacombsGroup = ensureArray(locations.groups).find((group) => group.id === 'catacombs');
    if (catacombsGroup) {
        const entries = new Set(ensureArray(catacombsGroup.entries));
        entries.add('catacombs-detailed-guide');
        entries.add('catacombs-necropolis');
        catacombsGroup.entries = Array.from(entries);
    }
};

const main = async () => {
    const database = readDatabase();
    const originalArticleCount = Object.keys(database.articles || {}).length;

    ensureWorldGroupAndEntries(database);
    cleanWeaponCategoryLabels(database);
    cleanWeaponItemTitles(database);

    const locationMarkers = collectLocationMarkers(database);
    const npcMarkers = await collectNpcMarkers(database);
    const worldMarkers = spreadMarkers([...locationMarkers, ...npcMarkers]);

    const worldMapArticle = database.articles['world-map-locations'];
    replaceImageMapBlock(
        worldMapArticle,
        createImageMapBlock({
            id: 'world-interactive-map',
            title: 'Интерактивная карта мира',
            imageAlt: 'Lineage II world map with red markers for NPCs and locations',
            markers: worldMarkers,
            legend: [
                { id: 'legend-world-locations', label: 'Локации и города', kind: 'location' },
                { id: 'legend-world-npcs', label: 'NPC и сервисы', kind: 'npc' },
            ],
        })
    );

    replaceLandingImageMapBlock(
        database.sections.locations,
        createImageMapBlock({
            id: 'locations-section-map',
            title: 'Карта локаций',
            imageAlt: 'Lineage II world map with marked locations',
            markers: spreadMarkers(locationMarkers),
            legend: [{ id: 'legend-section-locations', label: 'Локации и города', kind: 'location' }],
        })
    );

    replaceLandingImageMapBlock(
        database.sections.npc,
        createImageMapBlock({
            id: 'npc-section-map',
            title: 'Карта NPC',
            imageAlt: 'Lineage II world map with marked NPCs and services',
            markers: spreadMarkers(npcMarkers),
            legend: [{ id: 'legend-section-npc', label: 'NPC и сервисы', kind: 'npc' }],
        })
    );

    Object.values(database.articles || {}).forEach((article) => {
        if (article.id === 'world-map-locations') {
            return;
        }

        if (article.section === 'locations') {
            replaceImageMapBlock(article, buildLocationArticleMap(article, locationMarkers));
        }

        if (article.section === 'npc') {
            replaceImageMapBlock(article, buildNpcArticleMap(article, npcMarkers));
        }
    });

    const finalArticleCount = Object.keys(database.articles || {}).length;

    if (finalArticleCount !== originalArticleCount) {
        throw new Error(`Article count changed unexpectedly: ${originalArticleCount} -> ${finalArticleCount}`);
    }

    database.updatedAt = new Date().toISOString();
    writeDatabase(database);

    console.log(
        `Map coverage applied safely. Articles preserved: ${finalArticleCount}, location markers: ${locationMarkers.length}, npc markers: ${npcMarkers.length}.`
    );
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
