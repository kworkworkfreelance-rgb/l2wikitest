const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing data loss & global search...\n');

// 1. Verify static-data.js exists and has content
const dbPath = path.join(__dirname, 'assets', 'js', 'static-data.js');
if (!fs.existsSync(dbPath)) {
    console.error('❌ CRITICAL: static-data.js is missing!');
    process.exit(1);
}
const dbContent = fs.readFileSync(dbPath, 'utf8');
if (!dbContent.includes('L2WIKI_SEED_DATA')) {
    console.error('❌ CRITICAL: static-data.js is corrupted!');
    process.exit(1);
}
console.log('✅ static-data.js verified (contains L2WIKI_SEED_DATA)');

// 2. Create global search script (works on ALL pages)
const searchGlobalJs = `
// Global Search Modal - Works on all pages
(function() {
    // Inject modal HTML if not already in DOM
    if (!document.getElementById('searchModal')) {
        const modalHTML = \`
        <div class="search-modal-overlay" id="searchModal" style="display: none;">
            <div class="search-modal">
                <div class="search-modal__header">
                    <div class="search-modal__input-wrapper">
                        <input type="search" class="search-modal__input" id="searchModalInput" placeholder="Поиск по базе знаний..." autocomplete="off" />
                        <button class="search-modal__close" id="searchModalClose">&times;</button>
                    </div>
                </div>
                <div class="search-modal__results" id="searchModalResults">
                    <div class="search-modal__empty">
                        <div class="search-modal__empty-icon">🔍</div>
                        <div class="search-modal__empty-text">Введите запрос для поиска</div>
                        <div class="search-modal__empty-hint">Например: квесты, локации, монстры</div>
                    </div>
                </div>
            </div>
        </div>\`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const searchInput = document.getElementById('site-search');
    const searchButton = document.getElementById('searchButton');
    const modal = document.getElementById('searchModal');
    const modalInput = document.getElementById('searchModalInput');
    const modalClose = document.getElementById('searchModalClose');
    const modalResults = document.getElementById('searchModalResults');

    if (!modal || !searchInput) return;

    let searchTimeout;

    function openModal() {
        modal.style.display = 'flex';
        setTimeout(() => modalInput.focus(), 100);
    }

    function closeModal() {
        modal.style.display = 'none';
        modalInput.value = '';
        modalResults.innerHTML = '<div class="search-modal__empty"><div class="search-modal__empty-icon">🔍</div><div class="search-modal__empty-text">Введите запрос для поиска</div><div class="search-modal__empty-hint">Например: квесты, локации, монстры</div></div>';
    }

    searchInput.addEventListener('click', openModal);
    if (searchButton) searchButton.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modalInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();

        if (!query) {
            modalResults.innerHTML = '<div class="search-modal__empty"><div class="search-modal__empty-icon">🔍</div><div class="search-modal__empty-text">Введите запрос для поиска</div><div class="search-modal__empty-hint">Например: квесты, локации, монстры</div></div>';
            return;
        }

        searchTimeout = setTimeout(() => {
            if (!window.L2WIKI_SEED_DATA) {
                console.warn('⚠️ L2WIKI_SEED_DATA not loaded yet');
                return;
            }

            const { articles, sections } = window.L2WIKI_SEED_DATA;
            const results = [];

            Object.values(articles).forEach(article => {
                const searchable = [article.title, article.summary, article.eyebrow, ...(article.intro||[]), ...(article.steps||[])].join(' ').toLowerCase();
                if (searchable.includes(query)) {
                    results.push({ type: 'article', title: article.title, description: article.summary || '', url: '/pages/article.html?article=' + article.id });
                }
            });

            Object.values(sections).forEach(section => {
                const searchable = [section.title, section.description].join(' ').toLowerCase();
                if (searchable.includes(query)) {
                    results.push({ type: 'раздел', title: section.title, description: section.description || '', url: '/pages/section.html?section=' + section.id });
                }
            });

            if (results.length === 0) {
                modalResults.innerHTML = '<div class="search-modal__no-results"><div class="search-modal__no-results-icon">😔</div><div class="search-modal__no-results-text">Ничего не найдено</div><div class="search-modal__no-results-hint">Попробуйте другой запрос</div></div>';
            } else {
                modalResults.innerHTML = '<div class="search-modal__count">Найдено: ' + results.length + '</div>' + 
                    results.slice(0,10).map(item => 
                        '<a href="' + item.url + '" class="search-modal__item">' +
                        '<div class="search-modal__icon"><div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;color:white;font-weight:700;box-shadow:0 4px 12px rgba(59,130,246,0.3);">' + 
                        item.type.charAt(0).toUpperCase() + '</div></div>' +
                        '<div class="search-modal__content"><div class="search-modal__title">' + item.title + '</div><div class="search-modal__desc">' + item.description + '</div></div></a>'
                    ).join('');
            }
        }, 200);
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });
})();
`;

fs.writeFileSync(path.join(__dirname, 'assets', 'js', 'search-global.js'), searchGlobalJs);
console.log('✅ Created assets/js/search-global.js');

// 3. Fix all HTML pages
const pages = ['index.html', 'pages/article.html', 'pages/section.html', 'pages/search.html'];
const version = 'v=20260408-data-restored';

pages.forEach(page => {
    let html = fs.readFileSync(page, 'utf8');
    
    // A. Ensure static-data.js is loaded FIRST
    if (!html.includes('static-data.js')) {
        html = html.replace(/(<script src="[^"]*\/assets\/js\/content\.js")/, '<script src="/assets/js/static-data.js"></script>\n        $1');
        console.log(`   📦 Added static-data.js to ${page}`);
    }
    
    // B. Remove ALL old inline search scripts to prevent conflicts
    html = html.replace(/<script>[\s\S]*?Search Modal Logic[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?Compact Search Dropdown Logic[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?Global Search Modal Script[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?search-global\.js[\s\S]*?<\/script>/g, '');
    
    // C. Add global search script before </body>
    if (!html.includes('search-global.js')) {
        html = html.replace(/<\/body>/, `        <script src="/assets/js/search-global.js?${version}"></script>\n    </body>`);
        console.log(`   🔍 Added global search to ${page}`);
    }
    
    // D. Ensure search-modal.css is linked
    if (!html.includes('search-modal.css')) {
        html = html.replace(/(<link rel="stylesheet" href="[^"]*\/assets\/css\/ad-blocks\.css[^>]*>)/, `$1\n        <link rel="stylesheet" href="/assets/css/search-modal.css?${version}" />`);
        console.log(`   🎨 Added search CSS to ${page}`);
    }
    
    // E. Bust cache on all assets
    html = html.replace(/v=20260408-[a-z0-9-]+/g, version);
    
    fs.writeFileSync(page, html, 'utf8');
    console.log(`✅ Fixed ${page}`);
});

console.log('\n🎉 FIXED!');
console.log('   ✅ Data loading order corrected (static-data.js loads first)');
console.log('   ✅ Search modal works on ALL pages now');
console.log('   ✅ Cache busted for fresh load');
console.log('\n🔄 Please hard refresh (Ctrl+Shift+R) to see changes!');
