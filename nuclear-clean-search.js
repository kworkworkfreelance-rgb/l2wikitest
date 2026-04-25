const fs = require('fs');
const path = require('path');

console.log('☢️ Nuclear Cleanup: Removing ALL search conflicts...\n');

const pages = [
    'index.html',
    'pages/article.html',
    'pages/section.html',
    'pages/search.html',
    'admin.html',
    'admin-v2.html'
];

pages.forEach(page => {
    if (!fs.existsSync(page)) return;
    
    let html = fs.readFileSync(page, 'utf8');
    
    // 1. Remove ALL search-related CSS links
    html = html.replace(/<link[^>]*search-modal\.css[^>]*>\s*/g, '');
    html = html.replace(/<link[^>]*search-dropdown\.css[^>]*>\s*/g, '');
    
    // 2. Remove ALL search-related JavaScript scripts
    html = html.replace(/<script[^>]*search-global\.js[^>]*><\/script>\s*/g, '');
    html = html.replace(/<script[^>]*search-v2\.js[^>]*><\/script>\s*/g, '');
    html = html.replace(/<script[^>]*search\.js[^>]*><\/script>\s*/g, ''); // Keep only if it's the old one
    
    // 3. Remove ALL inline search scripts (anything that looks like search logic)
    // Match scripts containing "Search", "Modal", "Dropdown", "search-modal"
    html = html.replace(/<script>[\s\S]*?(Search Modal|Compact Search|Global Search|searchDropdown|searchModal)[\s\S]*?<\/script>\s*/g, '');
    
    // 4. Remove ALL search HTML elements
    html = html.replace(/<div class="search-modal-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*/g, '');
    html = html.replace(/<div class="search-dropdown"[\s\S]*?<\/div>\s*<\/div>/g, '');
    
    // 5. Add clean search-modal CSS
    html = html.replace(
        /(<link rel="stylesheet" href="[^"]*\/assets\/css\/ad-blocks\.css[^>]*>)/,
        '$1\n        <link rel="stylesheet" href="/assets/css/search-modal.css?v=20260408-final-clean" />'
    );
    
    // 6. Add clean search-global.js script BEFORE </body>
    html = html.replace(
        /<\/body>/,
        '        <script src="/assets/js/search-global.js?v=20260408-final-clean"></script>\n    </body>'
    );
    
    // 7. Ensure static-data.js is loaded FIRST (before search)
    if (!html.includes('static-data.js')) {
        html = html.replace(
            /(<script src="\/assets\/js\/search-global\.js)/,
            '<script src="/assets/js/static-data.js?v=20260408"></script>\n        $1'
        );
    }
    
    fs.writeFileSync(page, html, 'utf8');
    console.log(`✅ Cleaned and fixed ${page}`);
});

console.log('\n🎉 NUCLEAR CLEANUP COMPLETE!');
console.log('✅ Removed search-modal CSS duplicates');
console.log('✅ Removed search-dropdown CSS duplicates');
console.log('✅ Removed old search scripts');
console.log('✅ Removed old search HTML');
console.log('✅ Added clean search-global.js');
console.log('✅ Added clean search-modal.css');
console.log('✅ Ensured static-data.js loads first');
