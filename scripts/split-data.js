#!/usr/bin/env node
/**
 * Split static-data.js into smaller chunks for Git (< 50MB each)
 * Creates a loader that fetches chunks dynamically
 */

const fs = require('fs');
const path = require('path');

const STATIC_DATA_PATH = path.resolve(__dirname, 'assets/js/static-data.js');
const CHUNKS_DIR = path.resolve(__dirname, 'assets/js/data-chunks');
const MAX_CHUNK_SIZE = 40 * 1024 * 1024; // 40MB chunks (safe for Git)

// Ensure chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// Read the static-data.js file
console.log('📦 Reading static-data.js...');
const content = fs.readFileSync(STATIC_DATA_PATH, 'utf8');

// Extract the JSON part (between first { and last })
const jsonStart = content.indexOf('{');
const jsonEnd = content.lastIndexOf('}') + 1;
const jsonStr = content.substring(jsonStart, jsonEnd);

// Parse the JSON
console.log('📊 Parsing JSON data...');
const data = JSON.parse(jsonStr);
const source = content.substring(jsonEnd).trim();

// Split articles into chunks
const articles = data.articles || {};
const articleIds = Object.keys(articles);
const chunks = [];
let currentChunk = {};
let currentSize = 0;

for (const id of articleIds) {
    const article = articles[id];
    const articleSize = JSON.stringify(article).length;
    
    if (currentSize + articleSize > MAX_CHUNK_SIZE && Object.keys(currentChunk).length > 0) {
        chunks.push({ ...currentChunk });
        currentChunk = {};
        currentSize = 0;
    }
    
    currentChunk[id] = article;
    currentSize += articleSize;
}

if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
}

console.log(`✂️  Split into ${chunks.length} chunks`);

// Write chunks
chunks.forEach((chunk, index) => {
    const chunkPath = path.join(CHUNKS_DIR, `chunk-${index + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunk), 'utf8');
    console.log(`📝 Chunk ${index + 1}: ${Object.keys(chunk).length} articles (${(fs.statSync(chunkPath).size / 1024 / 1024).toFixed(2)}MB)`);
});

// Write the loader script
const loaderContent = `
// Auto-generated data loader for split chunks
(function() {
    const CHUNKS = ${JSON.stringify(chunks.map((_, i) => `./data-chunks/chunk-${i + 1}.json`))};
    const SOURCE = ${source}
    
    let loadedData = ${JSON.stringify({
        site: data.site,
        sections: data.sections,
        articles: {}
    }, null, 2)};
    
    // Load all chunks
    async function loadAllChunks() {
        for (const chunkUrl of CHUNKS) {
            try {
                const response = await fetch(chunkUrl);
                const chunkData = await response.json();
                Object.assign(loadedData.articles, chunkData);
            } catch (e) {
                console.error('Failed to load chunk:', chunkUrl, e);
            }
        }
        window.L2WIKI_SEED_DATA = loadedData;
        window.L2WIKI_DATA_LOADED = true;
        window.dispatchEvent(new CustomEvent('l2wiki:data-loaded', { detail: loadedData }));
        console.log(\`✅ Loaded \${Object.keys(loadedData.articles).length} articles from \${CHUNKS.length} chunks\`);
    }
    
    // Start loading
    loadAllChunks();
})();
`;

const loaderPath = path.join(CHUNKS_DIR, 'loader.js');
fs.writeFileSync(loaderPath, loaderContent, 'utf8');
console.log(`🔧 Created loader.js`);

console.log('\n✅ Done! Update your HTML to use the loader:');
console.log('   <script src="/assets/js/data-chunks/loader.js"></script>');
