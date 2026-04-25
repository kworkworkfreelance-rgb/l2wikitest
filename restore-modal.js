const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove search-dropdown CSS link
html = html.replace(/<link[^>]*search-dropdown\.css[^>]*>\s*/g, '');

// 2. Remove search-dropdown HTML
html = html.replace(/<div class="search-dropdown"[\s\S]*?<\/div>\s*<\/div>/g, '');

// 3. Remove search-dropdown JavaScript
html = html.replace(/<script>[\s\S]*?Compact Search Dropdown Logic[\s\S]*?<\/script>\s*/g, '');

// 4. Add search-modal CSS link
html = html.replace(
    /(<link rel="stylesheet" href="\/assets\/css\/ad-blocks\.css[^>]*>)/,
    '$1\n        <link rel="stylesheet" href="/assets/css/search-modal.css?v=20260408-modal-fixed" />'
);

// 5. Add search-modal HTML before closing main tag
html = html.replace(
    /(<\/main>)/,
    `<!-- Search Modal -->
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
        </div>
        $1`
);

// 6. Add search-modal JavaScript before closing body tag
const searchScript = `
        <script>
            // Search Modal Logic
            (function() {
                const searchInput = document.getElementById('site-search');
                const searchButton = document.getElementById('searchButton');
                const modal = document.getElementById('searchModal');
                const modalInput = document.getElementById('searchModalInput');
                const modalClose = document.getElementById('searchModalClose');
                const modalResults = document.getElementById('searchModalResults');
                
                if (!modal || !searchInput) return;
                
                let searchTimeout;
                
                // Open modal on input focus or button click
                function openModal() {
                    modal.style.display = 'flex';
                    setTimeout(() => modalInput.focus(), 100);
                }
                
                // Close modal
                function closeModal() {
                    modal.style.display = 'none';
                    modalInput.value = '';
                    modalResults.innerHTML = '<div class="search-modal__empty"><div class="search-modal__empty-icon">🔍</div><div class="search-modal__empty-text">Введите запрос для поиска</div><div class="search-modal__empty-hint">Например: квесты, локации, монстры</div></div>';
                }
                
                searchInput.addEventListener('click', openModal);
                if (searchButton) searchButton.addEventListener('click', openModal);
                modalClose.addEventListener('click', closeModal);
                modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
                
                // Search on input
                modalInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    const query = e.target.value.trim().toLowerCase();
                    
                    if (!query) {
                        modalResults.innerHTML = '<div class="search-modal__empty"><div class="search-modal__empty-icon">🔍</div><div class="search-modal__empty-text">Введите запрос для поиска</div><div class="search-modal__empty-hint">Например: квесты, локации, монстры</div></div>';
                        return;
                    }
                    
                    searchTimeout = setTimeout(() => {
                        if (!window.L2WIKI_SEED_DATA) return;
                        
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
                            modalResults.innerHTML = '<div class="search-modal__count">Найдено: ' + results.length + '</div>' + results.slice(0,10).map(item => '<a href="' + item.url + '" class="search-modal__item"><span class="search-modal__badge">' + item.type + '</span><div class="search-modal__content"><div class="search-modal__title">' + item.title + '</div><div class="search-modal__desc">' + item.description + '</div></div></a>').join('');
                        }
                    }, 200);
                });
                
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });
            })();
        </script>
`;

html = html.replace(/<\/body>/, searchScript + '\n    </body>');

// 7. Update version strings
html = html.replace(/v=20260408-search-final-fix/g, 'v=20260408-modal-restored');

fs.writeFileSync('index.html', html, 'utf8');

console.log('✅ Restored old search modal:');
console.log('   - Removed search-dropdown completely');
console.log('   - Added search-modal CSS');
console.log('   - Added search-modal HTML');
console.log('   - Added search-modal JavaScript');
console.log('   - Updated version string');
