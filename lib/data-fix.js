const fs = require('fs');
const path = require('path');

const STATIC_DATA_PATH = path.resolve(__dirname, '../assets/js/static-data.js');
const CANONICAL_PATH = path.resolve(__dirname, '../data/canonical/l2wiki-canonical.json');

// Extract JSON from static-data.js (window.L2WIKI_SEED_DATA = {...};)
const extractDataFromStaticFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find the JSON between first { and last }
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
        return null;
    }
    
    const jsonStr = content.substring(startIdx, endIdx + 1);
    
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[data-fix] Failed to parse static-data.js:', e.message);
        return null;
    }
};

// Try to load from static-data.js first, fallback to canonical JSON
const loadDatabase = () => {
    // 1. Try static-data.js (always in repo, ~62MB)
    const staticData = extractDataFromStaticFile(STATIC_DATA_PATH);
    if (staticData) {
        console.log('[data-fix] ✅ Loaded from static-data.js');
        console.log(`[data-fix] Articles: ${Object.keys(staticData.articles || {}).length}`);
        return staticData;
    }

    // 2. Fallback to canonical JSON (may be LFS pointer on Render)
    if (fs.existsSync(CANONICAL_PATH)) {
        const content = fs.readFileSync(CANONICAL_PATH, 'utf8');
        
        // Check if it's an LFS pointer
        if (content.startsWith('version https://git-lfs')) {
            console.log('[data-fix] ⚠️  canonical.json is LFS pointer, skipping');
        } else {
            try {
                const data = JSON.parse(content);
                console.log('[data-fix] ✅ Loaded from canonical.json');
                return data;
            } catch (e) {
                console.error('[data-fix] Failed to parse canonical.json:', e.message);
            }
        }
    }

    // 3. Return empty database
    console.warn('[data-fix] ⚠️  No data found, using empty database');
    return {
        site: { name: 'L2Wiki.Su' },
        sections: {},
        articles: {}
    };
};

// Monkey-patch the canonical-store module
const canonicalStorePath = require.resolve('./canonical-store');
const originalModule = require(canonicalStorePath);

// Override getDatabase to use our loader
const cachedData = loadDatabase();

module.exports = {
    ...originalModule,
    getDatabase: () => cachedData,
    loadDatabase: () => cachedData,
};
