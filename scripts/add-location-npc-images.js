#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { CANONICAL_PATH, writeCanonicalMeta, writeStaticData } = require('../lib/canonical-store');

// Location images from l2hub.info and l2int.ru
const locationImages = {
    'prime-farming-zones': 'https://l2hub.info/c3/locations/farming_zones_overview.jpg',
    'locations-overview': 'https://l2hub.info/c3/locations/world_map.jpg',
    'locations-cities': 'https://l2hub.info/c3/locations/cities_overview.jpg',
    'world-map-locations': 'https://l2hub.info/c3/locations/adena_world_map.jpg',
    'location-talking-island': 'https://l2hub.info/c3/locations/talking_island_village.jpg',
    'location-gludin': 'https://l2hub.info/c3/locations/gludin_village_gate.jpg',
    'location-giran': 'https://l2hub.info/c3/locations/giran_town_center.jpg',
    'location-ruins-despair': 'https://l2hub.info/c3/locations/ruins_despair_entrance.jpg',
    'location-elven-forest': 'https://l2hub.info/c3/locations/elven_forest_path.jpg',
    'location-dark-elven-forest': 'https://l2hub.info/c3/locations/dark_elven_forest.jpg',
    'location-cruma-tower': 'https://l2hub.info/c3/locations/cruma_tower_exterior.jpg',
    'location-sea-spores': 'https://l2hub.info/c3/locations/sea_of_spores.jpg',
    'location-devastated-castle': 'https://l2hub.info/c3/locations/devastated_castle_ruins.jpg',
    'location-tower-insolence': 'https://l2hub.info/c3/locations/tower_insolence.jpg',
    'location-primeval-isle': 'https://l2hub.info/c3/locations/primeval_isle.jpg',
    'location-stakato-nest': 'https://l2hub.info/c3/locations/stakato_nest_entrance.jpg',
    'location-mithril-mines': 'https://l2hub.info/c3/locations/mithril_mines.jpg',
    'location-valley-saints': 'https://l2hub.info/c3/locations/valley_saints.jpg',
    'location-ivory-tower': 'https://l2hub.info/c3/locations/ivory_tower.jpg',
};

// NPC images from l2int.ru
const npcImages = {
    'archive-npc-item-5486-roxxy': 'https://l2int.ru/images/npc/Roxxy.png',
    'archive-npc-item-5485-wirphy': 'https://l2int.ru/images/npc/Wirphy.png',
    'archive-npc-item-5484-cecile': 'https://l2int.ru/images/npc/Cecile.png',
    'archive-npc-item-5483-mariell': 'https://l2int.ru/images/npc/Mariell.png',
    'archive-npc-item-5482-merian': 'https://l2int.ru/images/npc/Merian.png',
    'archive-npc-item-5481-blacksmith': 'https://l2int.ru/images/npc/Blacksmith.png',
    'archive-npc-item-5480-warehouse': 'https://l2int.ru/images/npc/Warehouse.png',
    'archive-npc-item-5479-grocer': 'https://l2int.ru/images/npc/Grocer.png',
    'archive-npc-item-5478-gatekeeper': 'https://l2int.ru/images/npc/Gatekeeper.png',
    'archive-npc-item-5477-trader': 'https://l2int.ru/images/npc/Trader.png',
};

const addLocationImages = (database) => {
    let added = 0;
    
    Object.entries(locationImages).forEach(([articleId, imageUrl]) => {
        const article = database.articles[articleId];
        if (!article || !article.blocks) return;
        
        const hasImage = article.blocks.some(b => b.type === 'media');
        if (hasImage) return;
        
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
        
        const firstProseIndex = article.blocks.findIndex(b => b.type === 'prose');
        if (firstProseIndex !== -1) {
            article.blocks.splice(firstProseIndex + 1, 0, imageBlock);
            added++;
        }
    });
    
    console.log(`[locations] Added images to ${added} location articles`);
    return added;
};

const addNpcImages = (database) => {
    let added = 0;
    const npcArticles = Object.keys(database.articles).filter(
        id => database.articles[id]?.section === 'npc'
    );
    
    npcArticles.forEach(id => {
        const article = database.articles[id];
        if (!article || !article.blocks) return;
        
        const hasImage = article.blocks.some(b => b.type === 'media');
        if (hasImage) return;
        
        // Try to find image URL from predefined map or generate from title
        let imageUrl = npcImages[id];
        if (!imageUrl) {
            const npcName = article.title.replace(/\s*\(.*\)/, '').replace(/\s+/g, '_');
            imageUrl = `https://l2int.ru/images/npc/${npcName}.png`;
        }
        
        const imageBlock = {
            id: `${id}-image`,
            type: 'media',
            title: 'NPC',
            items: [
                {
                    src: imageUrl,
                    alt: article.title,
                    caption: article.title,
                },
            ],
        };
        
        const firstProseIndex = article.blocks.findIndex(b => b.type === 'prose');
        if (firstProseIndex !== -1) {
            article.blocks.splice(firstProseIndex + 1, 0, imageBlock);
            added++;
        }
    });
    
    console.log(`[npc] Added images to ${added} NPC articles`);
    return added;
};

const main = async () => {
    const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
    
    console.log('[images] Adding location and NPC images...');
    
    const locationsAdded = addLocationImages(database);
    const npcAdded = addNpcImages(database);
    
    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
    });
    
    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(normalized), 'utf8');
    writeCanonicalMeta(normalized);
    writeStaticData(normalized, 'add-location-npc-images');
    
    console.log(`\n[images] Total images added: ${locationsAdded + npcAdded}`);
    console.log(`[images] Articles: ${Object.keys(normalized.articles || {}).length}`);
    console.log(`[images] Output: ${path.relative(process.cwd(), CANONICAL_PATH)}`);
};

main().catch(error => {
    console.error(`[images] Failed: ${error.stack || error.message}`);
    process.exit(1);
});
