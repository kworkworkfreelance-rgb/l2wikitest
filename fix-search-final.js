const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove ALL search-modal CSS links
html = html.replace(/<link[^>]*search-modal\.css[^>]*>\s*/g, '');

// 2. Remove ALL search-modal HTML blocks (entire modal structure)
html = html.replace(/<div class="search-modal-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*/g, '');

// 3. Remove ALL search-modal JavaScript
html = html.replace(/<script>[\s\S]*?Search Modal Logic[\s\S]*?<\/script>\s*/g, '');

// 4. Fix z-index for search-dropdown to be above everything
html = html.replace(/z-index:\s*99999/g, 'z-index: 99999999');

// 5. Add !important to critical search styles
if (html.includes('search-dropdown')) {
    html = html.replace(/class="search-dropdown"/g, 'class="search-dropdown" style="z-index: 99999999 !important;"');
}

// 6. Update version string
html = html.replace(/v=20260408-search-final/g, 'v=20260408-search-above-all');

fs.writeFileSync('index.html', html, 'utf8');

console.log('✅ Cleaned up index.html:');
console.log('   - Removed search-modal CSS');
console.log('   - Removed search-modal HTML');
console.log('   - Removed search-modal JavaScript');
console.log('   - Set z-index to 99999999 (above all cards)');
console.log('   - Updated version string');
