#!/usr/bin/env node

/**
 * Fix all relative paths to absolute paths for production deployment
 * This ensures paths work correctly on Render and any hosting
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

const fixes = [
    // CSS paths
    {
        pattern: /href="\.\.\/assets\/sass\/css\/index\.min\.css/g,
        replacement: 'href="/assets/sass/css/index.min.css'
    },
    {
        pattern: /href="\.\.\/assets\/css\/improvements\.css/g,
        replacement: 'href="/assets/css/improvements.css'
    },
    {
        pattern: /href="\.\.\/assets\/css\/seo-optimizations\.css/g,
        replacement: 'href="/assets/css/seo-optimizations.css'
    },
    {
        pattern: /href="\.\.\/assets\/css\/ad-blocks\.css/g,
        replacement: 'href="/assets/css/ad-blocks.css'
    },
    {
        pattern: /href="\.\.\/assets\/css\/search-modal\.css/g,
        replacement: 'href="/assets/css/search-modal.css'
    },
    {
        pattern: /href="\.\.\/assets\/css\/admin\.css/g,
        replacement: 'href="/assets/css/admin.css'
    },
    
    // JS paths
    {
        pattern: /src="\.\.\/assets\/js\/static-data\.js/g,
        replacement: 'src="/assets/js/static-data.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/content\.js/g,
        replacement: 'src="/assets/js/content.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/api-loader\.js/g,
        replacement: 'src="/assets/js/api-loader.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/data-store\.js/g,
        replacement: 'src="/assets/js/data-store.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/search\.js/g,
        replacement: 'src="/assets/js/search.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/wiki\.js/g,
        replacement: 'src="/assets/js/wiki.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/index\.js/g,
        replacement: 'src="/assets/js/index.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/seo-structured-data\.js/g,
        replacement: 'src="/assets/js/seo-structured-data.js'
    },
    {
        pattern: /src="\.\.\/assets\/js\/search-v2\.js/g,
        replacement: 'src="/assets/js/search-v2.js'
    },
    {
        pattern: /src="\.\.\/admin-script\.js/g,
        replacement: 'src="/admin-script.js'
    },
    
    // HTML links
    {
        pattern: /href="\.\.\/index\.html/g,
        replacement: 'href="/index.html'
    },
    {
        pattern: /href="\.\/index\.html/g,
        replacement: 'href="/index.html'
    },
    {
        pattern: /href="\.\/pages\/article\.html/g,
        replacement: 'href="/pages/article.html'
    },
    {
        pattern: /href="\.\/pages\/section\.html/g,
        replacement: 'href="/pages/section.html'
    },
    {
        pattern: /href="\.\/pages\/search\.html/g,
        replacement: 'href="/pages/search.html'
    },
    {
        pattern: /href="\.\.\/pages\/article\.html/g,
        replacement: 'href="/pages/article.html'
    },
    {
        pattern: /href="\.\.\/pages\/section\.html/g,
        replacement: 'href="/pages/section.html'
    },
    {
        pattern: /href="\.\.\/pages\/search\.html/g,
        replacement: 'href="/pages/search.html'
    },
    {
        pattern: /href="\.\/admin\.html/g,
        replacement: 'href="/admin.html'
    },
    {
        pattern: /href="\.\.\/admin\.html/g,
        replacement: 'href="/admin.html'
    },
    
    // Image paths
    {
        pattern: /src="\.\.\/assets\/img/g,
        replacement: 'src="/assets/img'
    },
    {
        pattern: /src="\.\/assets\/img/g,
        replacement: 'src="/assets/img'
    },
    {
        pattern: /url\('\.\.\/assets\/img/g,
        replacement: "url('/assets/img"
    },
    {
        pattern: /url\(\.\.\/assets\/img/g,
        replacement: "url(/assets/img"
    },
    
    // Index.html specific (./ paths)
    {
        pattern: /href="\.\/assets\/sass\/css\/index\.min\.css/g,
        replacement: 'href="/assets/sass/css/index.min.css'
    },
    {
        pattern: /href="\.\/assets\/css\/improvements\.css/g,
        replacement: 'href="/assets/css/improvements.css'
    },
    {
        pattern: /href="\.\/assets\/css\/seo-optimizations\.css/g,
        replacement: 'href="/assets/css/seo-optimizations.css'
    },
    {
        pattern: /href="\.\/assets\/css\/ad-blocks\.css/g,
        replacement: 'href="/assets/css/ad-blocks.css'
    },
    {
        pattern: /href="\.\/assets\/css\/search-modal\.css/g,
        replacement: 'href="/assets/css/search-modal.css'
    },
    {
        pattern: /src="\.\/assets\/js\/static-data\.js/g,
        replacement: 'src="/assets/js/static-data.js'
    },
    {
        pattern: /src="\.\/assets\/js\/content\.js/g,
        replacement: 'src="/assets/js/content.js'
    },
    {
        pattern: /src="\.\/assets\/js\/api-loader\.js/g,
        replacement: 'src="/assets/js/api-loader.js'
    },
    {
        pattern: /src="\.\/assets\/js\/data-store\.js/g,
        replacement: 'src="/assets/js/data-store.js'
    },
    {
        pattern: /src="\.\/assets\/js\/search\.js/g,
        replacement: 'src="/assets/js/search.js'
    },
    {
        pattern: /src="\.\/assets\/js\/wiki\.js/g,
        replacement: 'src="/assets/js/wiki.js'
    },
    {
        pattern: /src="\.\/assets\/js\/index\.js/g,
        replacement: 'src="/assets/js/index.js'
    },
    {
        pattern: /src="\.\/assets\/js\/seo-structured-data\.js/g,
        replacement: 'src="/assets/js/seo-structured-data.js'
    },
];

console.log('🔧 Fixing paths for production deployment...\n');

htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${file}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    fixes.forEach(fix => {
        const matches = content.match(fix.pattern);
        if (matches) {
            content = content.replace(fix.pattern, fix.replacement);
            changes += matches.length;
        }
    });
    
    if (changes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${file} - ${changes} paths fixed`);
    } else {
        console.log(`⏭️  ${file} - no changes needed`);
    }
});

console.log('\n✨ All paths fixed for production!');
console.log('📝 Paths now use absolute paths starting with /');
console.log('🚀 Ready for deployment to Render!');
