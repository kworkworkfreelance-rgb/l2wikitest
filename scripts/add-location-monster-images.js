#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { CANONICAL_PATH, writeCanonicalMeta, writeStaticData } = require('../lib/canonical-store');

// Location images from l2hub.info CDN pattern
const locationImages = {
    'farming-talking-island': 'https://l2hub.info/c3/locations/talking_island.jpg',
    'farming-gludin': 'https://l2hub.info/c3/locations/gludin_village.jpg',
    'farming-gludio': 'https://l2hub.info/c3/locations/gludio_castle.jpg',
    'farming-ruins-despair': 'https://l2hub.info/c3/locations/ruins_of_despair.jpg',
    'farming-elven-forest': 'https://l2hub.info/c3/locations/elven_forest.jpg',
    'farming-dark-elven-forest': 'https://l2hub.info/c3/locations/dark_elven_forest.jpg',
    'farming-sea-spores': 'https://l2hub.info/c3/locations/sea_of_spores.jpg',
    'farming-cruma-tower-1': 'https://l2hub.info/c3/locations/cruma_tower.jpg',
    'farming-cruma-tower-2': 'https://l2hub.info/c3/locations/cruma_tower_interior.jpg',
    'farming-devastated-castle': 'https://l2hub.info/c3/locations/devastated_castle.jpg',
    'farming-tower-insolence': 'https://l2hub.info/c3/locations/tower_of_insolence.jpg',
    'farming-catacombs': 'https://l2hub.info/c3/locations/catacomb_entrance.jpg',
    'farming-necropolis': 'https://l2hub.info/c3/locations/necropolis.jpg',
    'farming-primeval-isle': 'https://l2hub.info/c3/locations/primeval_isle.jpg',
    'farming-stakato-nest': 'https://l2hub.info/c3/locations/stakato_nest.jpg',
    'farming-valley-saints': 'https://l2hub.info/c3/locations/valley_of_saints.jpg',
    'farming-ivory-tower': 'https://l2hub.info/c3/locations/ivory_tower.jpg',
    'farming-mithril-mines': 'https://l2hub.info/c3/locations/mithril_mines.jpg',
};

const addImagesToFarmingZones = (database) => {
    Object.entries(locationImages).forEach(([articleId, imageUrl]) => {
        const article = database.articles[articleId];
        if (!article || !article.blocks) {
            return;
        }

        // Add image block after overview
        const imageBlock = {
            id: `${articleId}-image`,
            type: 'media',
            title: 'Локация',
            items: [
                {
                    src: imageUrl,
                    alt: article.title,
                    caption: article.title,
                },
            ],
        };

        // Insert after first prose block
        const firstProseIndex = article.blocks.findIndex((b) => b.type === 'prose');
        if (firstProseIndex !== -1) {
            article.blocks.splice(firstProseIndex + 1, 0, imageBlock);
        }
    });

    console.log(`[images] Added images to ${Object.keys(locationImages).length} farming zones`);
};

const addMonsterImages = (database) => {
    const monsterArticles = Object.keys(database.articles).filter(
        (id) => database.articles[id]?.section === 'monsters' && !id.includes('overview') && !id.includes('raid')
    );

    let added = 0;
    monsterArticles.forEach((id) => {
        const article = database.articles[id];
        if (!article || !article.blocks) {
            return;
        }

        const monsterName = article.title.replace(/\s*\(монстр\)/, '').replace(/\s+/g, '_');
        const imageUrl = `https://l2int.ru/images/monsters/${monsterName}.png`;

        // Check if image block already exists
        const hasImage = article.blocks.some((b) => b.type === 'media');
        if (hasImage) {
            return;
        }

        const imageBlock = {
            id: `${id}-icon`,
            type: 'media',
            title: 'Монстр',
            items: [
                {
                    src: imageUrl,
                    alt: article.title,
                    caption: article.title,
                },
            ],
        };

        // Insert after first prose block
        const firstProseIndex = article.blocks.findIndex((b) => b.type === 'prose');
        if (firstProseIndex !== -1) {
            article.blocks.splice(firstProseIndex + 1, 0, imageBlock);
            added++;
        }
    });

    console.log(`[images] Added images to ${added} monster articles`);
};

const main = async () => {
    const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));

    addImagesToFarmingZones(database);
    addMonsterImages(database);

    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(normalized), 'utf8');
    writeCanonicalMeta(normalized);
    writeStaticData(normalized, 'add-location-monster-images');

    console.log(`\n[images] Articles: ${Object.keys(normalized.articles || {}).length}`);
    console.log(`[images] Output: ${path.relative(process.cwd(), CANONICAL_PATH)}`);
};

main().catch((error) => {
    console.error(`[images] Failed: ${error.stack || error.message}`);
    process.exit(1);
});
