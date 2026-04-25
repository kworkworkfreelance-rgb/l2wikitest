const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Remove search-modal CSS link
html = html.replace(/<link[^>]*search-modal\.css[^>]*>/g, '');

// Remove search-modal HTML (entire modal div)
html = html.replace(/<!-- Search Modal HTML -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g, '');

// Remove any remaining search-modal references
html = html.replace(/search-modal-overlay/g, '');
html = html.replace(/searchModal/g, '');
html = html.replace(/searchModalInput/g, '');
html = html.replace(/searchModalClose/g, '');
html = html.replace(/searchModalResults/g, '');

// Remove duplicate search scripts - keep only compact dropdown logic
const scriptRegex = /<script>[\s\S]*?Compact Search Dropdown Logic[\s\S]*?<\/script>/g;
const scripts = html.match(scriptRegex);

if (scripts && scripts.length > 1) {
    // Keep only the first occurrence
    html = html.replace(scriptRegex, 'PLACEHOLDER_SCRIPT');
    html = html.replace('PLACEHOLDER_SCRIPT', scripts[0]);
    // Remove remaining scripts
    html = html.replace(/<script>[\s\S]*?<\/script>/g, '');
    html = html.replace('PLACEHOLDER_SCRIPT', scripts[0]);
}

fs.writeFileSync('index.html', html, 'utf8');

console.log('✅ Cleaned up index.html');
console.log('   - Removed search-modal CSS');
console.log('   - Removed search-modal HTML');
console.log('   - Kept only compact dropdown search');
