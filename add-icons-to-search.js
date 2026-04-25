const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Replace the search modal script with icon version
const newScript = `
        <script>
            // Search Modal Logic with Icons
            (function() {
                const searchInput = document.getElementById('site-search');
                const searchButton = document.getElementById('searchButton');
                const modal = document.getElementById('searchModal');
                const modalInput = document.getElementById('searchModalInput');
                const modalClose = document.getElementById('searchModalClose');
                const modalResults = document.getElementById('searchModalResults');
                
                if (!modal || !searchInput) return;
                
                let searchTimeout;
                
                // Icon mapping for article types
                const iconMap = {
                    'profession': 'icon--profession-1',
                    'quest-profession': 'icon--profession-1',
                    'wolf': 'icon--wolf',
                    'buffalo': 'icon--bull',
                    'kookabura': 'icon--bird',
                    'cougar': 'icon--tiger',
                    'dragonflute': 'icon--dragon',
                    'dragon-bugle': 'icon--wyvern',
                    'soul-crystal': 'icon--soul',
                    'sa': 'icon--soul',
                    'pk': 'icon--pk',
                    'wash-pk': 'icon--pk',
                    'transformation': 'icon--transform',
                    'cubic': 'icon--cube',
                    'subclass': 'icon--subclass',
                    'noblesse': 'icon--noblesse',
                    'enchant': 'icon--enchant',
                    'wedding': 'icon--wedding',
                    'ears': 'icon--ears',
                    'freya': 'icon--freya',
                    'frintezza': 'icon--frintezza',
                    'antharas': 'icon--antharas',
                    'valakas': 'icon--valakas',
                    'baium': 'icon--baium',
                    'pailaka': 'icon--pailaka-1',
                    'pagan': 'icon--pagan',
                    'clan': 'icon--clan',
                    'squad': 'icon--squad',
                    'fishing': 'icon--fishing',
                    'tree': 'icon--tree',
                    'manor': 'icon--manor',
                    'class-tree': 'icon--tree',
                    'class': 'icon--profession-1',
                    'skill': 'icon--enchant',
                    'npc': 'icon--clan',
                    'monster': 'icon--antharas',
                    'location': 'icon--pagan',
                    'guide': 'icon--fishing'
                };
                
                function getIconClass(articleId, title, section) {
                    const id = articleId.toLowerCase();
                    const ttl = title.toLowerCase();
                    const sec = section.toLowerCase();
                    
                    for (const [key, icon] of Object.entries(iconMap)) {
                        if (id.includes(key) || ttl.includes(key)) {
                            return icon;
                        }
                    }
                    
                    // Default by section
                    if (sec.includes('quests')) return 'icon--profession-1';
                    if (sec.includes('npc')) return 'icon--clan';
                    if (sec.includes('monster')) return 'icon--antharas';
                    if (sec.includes('location')) return 'icon--pagan';
                    if (sec.includes('guide')) return 'icon--fishing';
                    if (sec.includes('skill')) return 'icon--enchant';
                    if (sec.includes('item')) return 'icon--soul';
                    
                    return 'icon--profession-1';
                }
                
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
                        if (!window.L2WIKI_SEED_DATA) return;
                        
                        const { articles, sections } = window.L2WIKI_SEED_DATA;
                        const results = [];
                        
                        Object.values(articles).forEach(article => {
                            const searchable = [article.title, article.summary, article.eyebrow, ...(article.intro||[]), ...(article.steps||[])].join(' ').toLowerCase();
                            if (searchable.includes(query)) {
                                const section = sections[article.section];
                                results.push({
                                    type: 'article',
                                    title: article.title,
                                    description: article.summary || '',
                                    url: '/pages/article.html?article=' + article.id,
                                    icon: getIconClass(article.id, article.title, section ? section.title : ''),
                                    sectionName: section ? section.title : ''
                                });
                            }
                        });
                        
                        Object.values(sections).forEach(section => {
                            const searchable = [section.title, section.description].join(' ').toLowerCase();
                            if (searchable.includes(query)) {
                                results.push({
                                    type: 'раздел',
                                    title: section.title,
                                    description: section.description || '',
                                    url: '/pages/section.html?section=' + section.id,
                                    icon: 'icon--clan',
                                    sectionName: ''
                                });
                            }
                        });
                        
                        if (results.length === 0) {
                            modalResults.innerHTML = '<div class="search-modal__no-results"><div class="search-modal__no-results-icon">😔</div><div class="search-modal__no-results-text">Ничего не найдено</div><div class="search-modal__no-results-hint">Попробуйте другой запрос</div></div>';
                        } else {
                            modalResults.innerHTML = '<div class="search-modal__count">Найдено: ' + results.length + '</div>' + results.slice(0,10).map(item => '<a href="' + item.url + '" class="search-modal__item"><div class="search-modal__icon"><div class="' + item.icon + '" style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;color:white;font-weight:700;box-shadow:0 4px 12px rgba(59,130,246,0.3);">' + item.type.charAt(0).toUpperCase() + '</div></div><div class="search-modal__content"><div class="search-modal__title">' + item.title + '</div><div class="search-modal__desc">' + item.description + '</div></div></a>').join('');
                        }
                    }, 200);
                });
                
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });
            })();
        </script>
`;

// Replace old script with new one
html = html.replace(/<script>[\s\S]*?Search Modal Logic[\s\S]*?<\/script>/g, newScript);

// Update version string
html = html.replace(/v=20260408-modal-working/g, 'v=20260408-modal-icons');

fs.writeFileSync('index.html', html, 'utf8');

console.log('✅ Added icons to search modal:');
console.log('   - Icon mapping for all article types');
console.log('   - Visual icons in search results');
console.log('   - Section-based icon defaults');
console.log('   - Updated version string');
