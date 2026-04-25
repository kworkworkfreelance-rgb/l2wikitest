#!/usr/bin/env node

/**
 * FIX ALL PATHS FOR PRODUCTION DEPLOYMENT
 * Converts all relative paths (../ and ./) to absolute paths (/)
 * This fixes the "white screen" and "styles not loading" issues on Render
 */

const fs = require('fs');
const path = require('path');

const htmlFiles = [
    'index.html',
    'pages/article.html',
    'pages/section.html',
    'pages/search.html',
    'admin.html',
    'admin-v2.html'
];

// All path replacements
const pathReplacements = [
    // CSS files - pages folder (../)
    { from: /href="\.\.\/assets\/sass\/css\/index\.min\.css/g, to: 'href="/assets/sass/css/index.min.css' },
    { from: /href="\.\.\/assets\/css\/improvements\.css/g, to: 'href="/assets/css/improvements.css' },
    { from: /href="\.\.\/assets\/css\/seo-optimizations\.css/g, to: 'href="/assets/css/seo-optimizations.css' },
    { from: /href="\.\.\/assets\/css\/ad-blocks\.css/g, to: 'href="/assets/css/ad-blocks.css' },
    { from: /href="\.\.\/assets\/css\/search-modal\.css/g, to: 'href="/assets/css/search-modal.css' },
    { from: /href="\.\.\/assets\/css\/admin\.css/g, to: 'href="/assets/css/admin.css' },
    
    // CSS files - root folder (./)
    { from: /href="\.\/assets\/sass\/css\/index\.min\.css/g, to: 'href="/assets/sass/css/index.min.css' },
    { from: /href="\.\/assets\/css\/improvements\.css/g, to: 'href="/assets/css/improvements.css' },
    { from: /href="\.\/assets\/css\/seo-optimizations\.css/g, to: 'href="/assets/css/seo-optimizations.css' },
    { from: /href="\.\/assets\/css\/ad-blocks\.css/g, to: 'href="/assets/css/ad-blocks.css' },
    { from: /href="\.\/assets\/css\/search-modal\.css/g, to: 'href="/assets/css/search-modal.css' },
    
    // JS files - pages folder (../)
    { from: /src="\.\.\/assets\/js\/static-data\.js/g, to: 'src="/assets/js/static-data.js' },
    { from: /src="\.\.\/assets\/js\/content\.js/g, to: 'src="/assets/js/content.js' },
    { from: /src="\.\.\/assets\/js\/api-loader\.js/g, to: 'src="/assets/js/api-loader.js' },
    { from: /src="\.\.\/assets\/js\/data-store\.js/g, to: 'src="/assets/js/data-store.js' },
    { from: /src="\.\.\/assets\/js\/search\.js/g, to: 'src="/assets/js/search.js' },
    { from: /src="\.\.\/assets\/js\/search-v2\.js/g, to: 'src="/assets/js/search-v2.js' },
    { from: /src="\.\.\/assets\/js\/wiki\.js/g, to: 'src="/assets/js/wiki.js' },
    { from: /src="\.\.\/assets\/js\/index\.js/g, to: 'src="/assets/js/index.js' },
    { from: /src="\.\.\/assets\/js\/seo-structured-data\.js/g, to: 'src="/assets/js/seo-structured-data.js' },
    
    // JS files - root folder (./)
    { from: /src="\.\/assets\/js\/static-data\.js/g, to: 'src="/assets/js/static-data.js' },
    { from: /src="\.\/assets\/js\/content\.js/g, to: 'src="/assets/js/content.js' },
    { from: /src="\.\/assets\/js\/api-loader\.js/g, to: 'src="/assets/js/api-loader.js' },
    { from: /src="\.\/assets\/js\/data-store\.js/g, to: 'src="/assets/js/data-store.js' },
    { from: /src="\.\/assets\/js\/search\.js/g, to: 'src="/assets/js/search.js' },
    { from: /src="\.\/assets\/js\/wiki\.js/g, to: 'src="/assets/js/wiki.js' },
    { from: /src="\.\/assets\/js\/index\.js/g, to: 'src="/assets/js/index.js' },
    { from: /src="\.\/assets\/js\/seo-structured-data\.js/g, to: 'src="/assets/js/seo-structured-data.js' },
    
    // Admin script
    { from: /src="\.\.\/admin-script\.js/g, to: 'src="/admin-script.js' },
    { from: /src="admin-script\.js/g, to: 'src="/admin-script.js' },
    { from: /src="admin-script-v2\.js/g, to: 'src="/admin-script-v2.js' },
    
    // HTML links - logo
    { from: /href="\.\.\/index\.html/g, to: 'href="/index.html' },
    { from: /href="\.\/index\.html/g, to: 'href="/index.html' },
    
    // HTML links - pages from root
    { from: /href="\.\/pages\/article\.html/g, to: 'href="/pages/article.html' },
    { from: /href="\.\/pages\/section\.html/g, to: 'href="/pages/section.html' },
    { from: /href="\.\/pages\/search\.html/g, to: 'href="/pages/search.html' },
    
    // HTML links - pages from pages folder
    { from: /href="\.\.\/pages\/article\.html/g, to: 'href="/pages/article.html' },
    { from: /href="\.\.\/pages\/section\.html/g, to: 'href="/pages/section.html' },
    { from: /href="\.\.\/pages\/search\.html/g, to: 'href="/pages/search.html' },
    
    // Admin links
    { from: /href="\.\/admin\.html/g, to: 'href="/admin.html' },
    { from: /href="\.\.\/admin\.html/g, to: 'href="/admin.html' },
    
    // Images
    { from: /src="\.\.\/assets\/img/g, to: 'src="/assets/img' },
    { from: /src="\.\/assets\/img/g, to: 'src="/assets/img' },
    { from: /url\(['"]\.\.\/assets\/img/g, to: "url('/assets/img" },
    { from: /url\(['"]\.\/assets\/img/g, to: "url('/assets/img" },
    { from: /background-image:\s*url\(\.\.\/assets\/img/g, to: 'background-image: url(/assets/img' },
    { from: /background-image:\s*url\(\.\/assets\/img/g, to: 'background-image: url(/assets/img' },
    
    // Search modal URLs in JavaScript
    { from: /\`\.\/pages\/article\.html\?article=/g, to: '`/pages/article.html?article=' },
    { from: /\`\.\/pages\/section\.html\?section=/g, to: '`/pages/section.html?section=' },
];

console.log('🔧 Fixing all paths for production deployment...\n');
console.log('This will fix:');
console.log('  - Styles not loading');
console.log('  - Scripts not loading');
console.log('  - Images not loading');
console.log('  - Links not working');
console.log('  - White screen issues\n');

let totalChanges = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${file}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanges = 0;
    
    pathReplacements.forEach(replacement => {
        const matches = content.match(replacement.from);
        if (matches) {
            content = content.replace(replacement.from, replacement.to);
            fileChanges += matches.length;
        }
    });
    
    if (fileChanges > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${file} - ${fileChanges} paths fixed`);
        totalChanges += fileChanges;
    } else {
        console.log(`⏭️  ${file} - no changes needed`);
    }
});

console.log(`\n✨ TOTAL: ${totalChanges} paths fixed!`);
console.log('📝 All paths now use ABSOLUTE paths starting with /');
console.log('🚀 Ready for deployment to Render!');
console.log('\n📋 Next steps:');
console.log('   1. git add .');
console.log('   2. git commit -m "Fix all paths to absolute for production"');
console.log('   3. git push origin main');
console.log('   4. Deploy to Render');
