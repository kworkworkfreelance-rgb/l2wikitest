#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const META_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-meta.json');
const STORAGE_CANONICAL_PATH = path.join(ROOT, '.l2wiki-storage', 'data', 'canonical', 'l2wiki-canonical.json');
const STORAGE_META_PATH = path.join(ROOT, '.l2wiki-storage', 'data', 'canonical', 'l2wiki-meta.json');

const HUB_HERO_OVERRIDES = {
    'items-weapons': '/assets/img/generated/hub-items-weapons-collage.png',
    'items-armor': '/assets/img/generated/hub-items-armor-collage.png',
    'items-accessories': '/assets/img/generated/hub-items-accessories-collage.png',
    'quest-profession-fourth': '/4_prof.png',
};

const GROUP_ICON_OVERRIDES = {
    'quests:profession-1': '/1st_prof.png',
    'quests:profession-2': '/2nd_prof.png',
    'quests:profession-3': '/3rd_prof.png',
    'quests:alternative-profession': '/4_prof.png',
    'locations:castles': '/assets/img/archive/quest-aden-castle-b4b234df5d13.jpg',
    'locations:catacombs': '/assets/img/home/card-catacombs.jpg',
    'locations:necropolis': '/assets/img/home/card-catacombs.jpg',
    'locations:temples': '/assets/img/quest-heroes/quest-guide-hero-pagan-temple-pass.png',
    'misc:epic': '/assets/img/quest-heroes/quest-guide-hero-baium-entry.png',
    'misc:contacts': '/assets/img/base/logo-like.png',
    'npc:services': '/assets/img/home/card-mammon.jpg',
    'monsters:overview': '/assets/img/archive/quest-angels-f295c086c34a.jpg',
};

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const articleHref = (articleId) => `/pages/article.html?article=${encodeURIComponent(articleId)}`;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const extractImageSourcesFromHtml = (html = '') => {
    const matches = [];
    const pattern = /<img\b[^>]*\bsrc=(["'])(.*?)\1/gi;
    let match = pattern.exec(String(html || ''));

    while (match) {
        if (match[2]) {
            matches.push(match[2].trim());
        }

        match = pattern.exec(String(html || ''));
    }

    return matches.filter(Boolean);
};

const normalizeImageCandidate = (value = '') => String(value || '').trim();

const isGradeIcon = (value = '') =>
    /(?:\/images\/all\/(?:Grade_|Rang_)|item[_ -]grade|grade[_ -]icon)/i.test(String(value || ''));

const pushImageCandidate = (list, value) => {
    const normalized = normalizeImageCandidate(value);

    if (!normalized || isGradeIcon(normalized)) {
        return;
    }

    list.push(normalized);
};

const collectQuestEntryImages = (entries = [], bucket = []) => {
    (entries || []).forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        pushImageCandidate(bucket, entry.iconSrc);
        extractImageSourcesFromHtml(entry.html).forEach((src) => pushImageCandidate(bucket, src));
        collectQuestEntryImages(entry.substeps || [], bucket);
    });

    return bucket;
};

const collectBlockImages = (block = {}, bucket = []) => {
    if (!block || typeof block !== 'object') {
        return bucket;
    }

    pushImageCandidate(bucket, block.imageSrc);
    pushImageCandidate(bucket, block.src);

    (block.items || []).forEach((item) => {
        pushImageCandidate(bucket, item?.src);
        pushImageCandidate(bucket, item?.imageSrc);
    });

    (block.heroMedia || []).forEach((item) => pushImageCandidate(bucket, item?.src));

    (block.rows || []).forEach((row) => {
        (row?.cells || []).forEach((cell) => {
            pushImageCandidate(bucket, cell?.icon);
            extractImageSourcesFromHtml(cell?.html).forEach((src) => pushImageCandidate(bucket, src));
        });
    });

    (block.paragraphs || []).forEach((paragraph) => {
        extractImageSourcesFromHtml(paragraph).forEach((src) => pushImageCandidate(bucket, src));
    });

    extractImageSourcesFromHtml(block.html).forEach((src) => pushImageCandidate(bucket, src));

    if (block.type === 'questGuide') {
        collectQuestEntryImages(block.prepItems || [], bucket);
        collectQuestEntryImages(block.steps || [], bucket);
        collectQuestEntryImages(block.rewards || [], bucket);
    }

    return bucket;
};

const uniqueImages = (images = []) => {
    const seen = new Set();
    return images.filter((image) => {
        const key = String(image || '').trim();

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};

const getPreferredImage = (images = []) => {
    const candidates = uniqueImages(images);

    const local = candidates.find((image) => image.startsWith('/assets/'));
    if (local) {
        return local;
    }

    const rootLocal = candidates.find((image) => image.startsWith('/'));
    if (rootLocal) {
        return rootLocal;
    }

    const httpsRemote = candidates.find((image) => /^https:\/\//i.test(image));
    if (httpsRemote) {
        return httpsRemote;
    }

    return candidates[0] || '';
};

const getArticleImageCandidates = (article = {}) => {
    const images = [];

    pushImageCandidate(images, article.heroImage);

    (article.blocks || []).forEach((block) => collectBlockImages(block, images));

    return uniqueImages(images);
};

const getArticleHeroImage = (article = {}) => {
    if (HUB_HERO_OVERRIDES[article.id]) {
        return HUB_HERO_OVERRIDES[article.id];
    }

    return getPreferredImage(getArticleImageCandidates(article));
};

const getGroupForArticle = (database, article = {}) =>
    database.sections?.[article.section]?.groups?.find((group) => group.id === article.group) || null;

const buildCategoryPreviewHtml = (label, imageSrc) => {
    const safeLabel = escapeHtml(label);

    if (!imageSrc) {
        return safeLabel;
    }

    return `
        <span class="weapon-category-link">
            <img class="wiki-item-thumb" src="${escapeHtml(imageSrc)}" alt="${safeLabel}" loading="lazy" />
            <span class="weapon-category-link__label">${safeLabel}</span>
        </span>
    `.trim();
};

const getArticleIdFromCell = (cell = {}) => {
    const href = String(cell?.href || '');
    const match = href.match(/[?&]article=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
};

const getArticleIdFromHref = (href = '') => {
    const match = String(href || '').match(/[?&]article=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
};

const getLinkedArticleIds = (article = {}) => {
    const ids = new Set();

    (article.related || []).forEach((id) => {
        if (id) {
            ids.add(id);
        }
    });

    (article.blocks || []).forEach((block) => {
        (block.rows || []).forEach((row) => {
            const rowTarget = getArticleIdFromHref(row?.href);
            if (rowTarget) {
                ids.add(rowTarget);
            }

            (row?.cells || []).forEach((cell) => {
                const cellTarget = getArticleIdFromHref(cell?.href);
                if (cellTarget) {
                    ids.add(cellTarget);
                }
            });
        });
    });

    return Array.from(ids);
};

const updateHubCategoryPreviews = (database) => {
    const overviewBlocks = [
        { articleId: 'items-weapons', blockId: 'weapons-overview-table' },
        { articleId: 'items-armor', blockId: 'items-armor-grade-overview' },
        { articleId: 'items-accessories', blockId: 'items-accessories-grade-overview' },
    ];

    overviewBlocks.forEach(({ articleId, blockId }) => {
        const article = database.articles?.[articleId];
        const block = (article?.blocks || []).find((item) => item.id === blockId);

        if (!block || !Array.isArray(block.rows)) {
            return;
        }

        block.rows.forEach((row) => {
            const leadCell = row?.cells?.[0];

            if (!leadCell) {
                return;
            }

            const targetArticleId = getArticleIdFromCell(leadCell);
            const targetArticle = database.articles?.[targetArticleId];
            const previewImage = targetArticle?.heroImage || getArticleHeroImage(targetArticle || {});
            const label = leadCell.value || targetArticle?.title || '';

            if (targetArticleId) {
                leadCell.href = articleHref(targetArticleId);
            }

            leadCell.html = buildCategoryPreviewHtml(label, previewImage);
        });
    });
};

const updateGroupIcons = (database) => {
    Object.values(database.sections || {}).forEach((section) => {
        (section.groups || []).forEach((group) => {
            const explicitOverride = GROUP_ICON_OVERRIDES[`${section.id}:${group.id}`];

            if (explicitOverride) {
                group.iconSrc = explicitOverride;
                return;
            }

            if (group.iconSrc) {
                return;
            }

            const landingCandidates = [group.landingArticleId, ...(group.entries || [])]
                .map((articleId) => database.articles?.[articleId])
                .filter(Boolean);

            const previewImage = getPreferredImage(
                landingCandidates.flatMap((article) => [article.heroImage, ...getArticleImageCandidates(article)])
            );

            if (previewImage) {
                group.iconSrc = previewImage;
            }
        });
    });
};

const buildMeta = (database) => ({
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
});

const writeDatabase = (filePath, metaFilePath, database) => {
    fs.writeFileSync(filePath, JSON.stringify(database), 'utf8');
    fs.writeFileSync(metaFilePath, JSON.stringify(buildMeta(database)), 'utf8');
};

const main = () => {
    const database = readJson(CANONICAL_PATH);

    Object.values(database.articles || {}).forEach((article) => {
        const heroImage = getArticleHeroImage(article);

        if (heroImage) {
            article.heroImage = heroImage;
        }
    });

    Object.values(database.articles || {}).forEach((article) => {
        if (article.heroImage) {
            return;
        }

        const linkedArticles = getLinkedArticleIds(article)
            .map((articleId) => database.articles?.[articleId])
            .filter(Boolean);
        const linkedHero = getPreferredImage(linkedArticles.flatMap((item) => [item.heroImage, ...getArticleImageCandidates(item)]));

        if (linkedHero) {
            article.heroImage = linkedHero;
        }
    });

    Object.values(database.articles || {}).forEach((article) => {
        if (article.heroImage) {
            return;
        }

        const group = getGroupForArticle(database, article);
        const groupArticles = (group?.entries || [])
            .map((articleId) => database.articles?.[articleId])
            .filter(Boolean);
        const groupHero = getPreferredImage([
            group?.iconSrc,
            ...groupArticles.flatMap((item) => [item.heroImage, ...getArticleImageCandidates(item)]),
        ]);

        if (groupHero) {
            article.heroImage = groupHero;
        }
    });

    updateHubCategoryPreviews(database);
    updateGroupIcons(database);

    database.updatedAt = new Date().toISOString();

    writeDatabase(CANONICAL_PATH, META_PATH, database);

    if (fs.existsSync(path.dirname(STORAGE_CANONICAL_PATH))) {
        writeDatabase(STORAGE_CANONICAL_PATH, STORAGE_META_PATH, database);
    }

    const articles = Object.values(database.articles || {});
    const groups = Object.values(database.sections || {}).flatMap((section) => section.groups || []);

    console.log(
        JSON.stringify(
            {
                updatedAt: database.updatedAt,
                heroImages: articles.filter((article) => article.heroImage).length,
                groupIcons: groups.filter((group) => group.iconSrc).length,
            },
            null,
            2
        )
    );
};

main();
