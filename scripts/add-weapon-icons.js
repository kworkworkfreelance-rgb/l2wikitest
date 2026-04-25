const fs = require('fs');
const path = require('path');

// Read canonical database
const dbPath = path.join(__dirname, '..', 'data', 'canonical', 'l2wiki-canonical.json');
if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// L2Int weapon icon CDN pattern
// Icons are typically at: https://l2int.ru/uploads/items/{id}.png or similar
// For Lineage 2 Interlude, weapon icons follow a pattern based on weapon ID

// Map of weapon article IDs to their icon URLs (from l2int.ru or L2 official)
const weaponIcons = {
    // Swords
    'weapon-sword-of-revolution': 'https://l2hub.info/c3/icons/weapon_sword_of_revolution_i00.png',
    'weapon-samurai-sword': 'https://l2hub.info/c3/icons/weapon_samurai_sword_i00.png',
    'weapon-dark-elven-long-sword': 'https://l2hub.info/c3/icons/weapon_dark_elven_long_sword_i00.png',
    
    // Add more weapon icons as needed
    // Pattern: https://l2hub.info/c3/icons/weapon_{weapon_name}_i00.png
};

// Add icon field to all weapon articles
let updatedCount = 0;
for (const [articleId, article] of Object.entries(db.articles || {})) {
    if (article.section === 'items' && article.group === 'weapons') {
        // Try to find icon from mapping
        if (weaponIcons[articleId]) {
            article.icon = weaponIcons[articleId];
            updatedCount++;
        } else {
            // Try to extract weapon name from article ID and generate icon URL
            const weaponName = articleId.replace('weapon-', '').replace(/-/g, '_');
            article.icon = `https://l2hub.info/c3/icons/weapon_${weaponName}_i00.png`;
            updatedCount++;
        }
    }
}

console.log(`Updated ${updatedCount} weapon articles with icons`);

// Write back
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('✅ Database updated with weapon icons!');
console.log('Restart server to see changes.');
