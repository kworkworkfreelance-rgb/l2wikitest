// ═══════════════════════════════════════════════════════════════
// L2WIKI SEARCH ENGINE - ENHANCED WITH REAL-TIME SYNC
// ═══════════════════════════════════════════════════════════════

class FuzzySearch {
    static levenshteinDistance(a, b) {
        const an = a.length;
        const bn = b.length;
        const dp = Array(an + 1)
            .fill(null)
            .map(() => Array(bn + 1).fill(0));

        for (let i = 0; i <= an; i++) dp[i][0] = i;
        for (let j = 0; j <= bn; j++) dp[0][j] = j;

        for (let i = 1; i <= an; i++) {
            for (let j = 1; j <= bn; j++) {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            }
        }
        return dp[an][bn];
    }

    static calculateSimilarity(query, target) {
        const q = query.toLowerCase();
        const t = target.toLowerCase();

        // Exact match
        if (q === t) return 1.0;

        // Substring match
        if (t.includes(q)) return 0.95;

        // Starts with
        if (t.startsWith(q)) return 0.9;

        // In-order character match
        let matched = 0;
        let lastIndex = 0;
        for (let char of q) {
            const index = t.indexOf(char, lastIndex);
            if (index === -1) break;
            matched++;
            lastIndex = index + 1;
        }
        if (matched === q.length) return 0.8;

        // Levenshtein distance
        const distance = this.levenshteinDistance(q, t);
        const similarity = 1 - distance / Math.max(q.length, t.length);
        return Math.max(0.0, similarity * 0.7);
    }

    static search(query, items, getSearchText, threshold = 0.35, limit = 10) {
        if (!query || !items) return [];

        const results = items
            .map((item) => ({
                item,
                text: getSearchText(item),
                score: this.calculateSimilarity(query, getSearchText(item)),
            }))
            .filter((result) => result.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return results.map((r) => ({ ...r.item, relevance: r.score }));
    }
}

class SearchUI {
    constructor() {
        this.searchInput = null;
        this.suggestionsContainer = null;
        this.cache = new Map();
        this.selectedIndex = -1;
        this.debounceTimeout = null;
    }

    initialize() {
        this.searchInput = document.getElementById('searchInput') || document.querySelector('input[type="search"]');
        this.suggestionsContainer = document.getElementById('searchSuggestions') || document.createElement('div');

        if (!this.searchInput) {
            console.warn('Search input not found');
            return;
        }

        // Setup suggestions container
        if (!this.suggestionsContainer.id) {
            this.suggestionsContainer.id = 'searchSuggestions';
            this.suggestionsContainer.className = 'search-suggestions';
            this.suggestionsContainer.style.cssText = `
                position: fixed;
                background: rgba(20, 20, 40, 0.95);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 8px;
                max-height: 400px;
                overflow-y: auto;
                z-index: 999999;
                display: none;
                width: 400px;
            `;
            document.body.appendChild(this.suggestionsContainer);
        }

        // Event listeners
        this.searchInput.addEventListener('input', (e) => this.handleInput(e));
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyboard(e));
        this.searchInput.addEventListener('blur', () => setTimeout(() => this.hideSuggestions(), 200));
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.length > 0) this.generateSuggestions();
        });

        // Initial content load
        this.initializeContent();
    }

    initializeContent() {
        // Try to load from localStorage (updated by admin panel)
        try {
            const contentStr = localStorage.getItem('l2wiki_content');
            if (contentStr) {
                window.L2WIKI_CONTENT = JSON.parse(contentStr);
                console.log('Loaded content from localStorage:', window.L2WIKI_CONTENT.length, 'items');
            }
        } catch (e) {
            console.warn('Could not load content from localStorage:', e);
        }

        // Fallback to window object
        if (!window.L2WIKI_CONTENT) {
            window.L2WIKI_CONTENT = [];
            console.warn('No content available, initializing empty');
        }
    }

    handleInput(e) {
        clearTimeout(this.debounceTimeout);
        const query = e.target.value.trim();

        if (query.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.debounceTimeout = setTimeout(() => {
            this.generateSuggestions();
        }, 150);
    }

    handleKeyboard(e) {
        if (this.suggestionsContainer.style.display === 'none') return;

        const items = this.suggestionsContainer.querySelectorAll('.search-suggestion-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection(items);
                break;

            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                    items[this.selectedIndex].click();
                }
                break;

            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    updateSelection(items) {
        items.forEach((item, idx) => {
            if (idx === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    generateSuggestions() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        // Check cache
        if (this.cache.has(query)) {
            this.renderSuggestions(this.cache.get(query), query);
            return;
        }

        // Perform search
        const results = FuzzySearch.search(query, window.L2WIKI_CONTENT || [], (item) => item.title || '', 0.35, 5);

        // Cache results
        this.cache.set(query, results);
        this.renderSuggestions(results, query);
    }

    renderSuggestions(results, query) {
        this.suggestionsContainer.innerHTML = '';

        if (results.length === 0) {
            this.hideSuggestions();
            return;
        }

        const query_lower = query.toLowerCase();

        results.forEach((result) => {
            const div = document.createElement('div');
            div.className = 'search-suggestion-item';

            const highlightedTitle = (result.title || '').replace(new RegExp(`(${query})`, 'gi'), '<strong>$1</strong>');

            div.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">
                        ${highlightedTitle}
                    </div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6);">
                        ${result.summary || 'Нет описания'}
                    </div>
                    <div style="font-size: 10px; color: rgba(102,126,234,0.7); margin-top: 4px;">
                        ${result.section || 'General'} • Совпадение: ${(result.relevance * 100).toFixed(0)}%
                    </div>
                </div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.5);">
                    →
                </div>
            `;

            div.style.cssText = `
                padding: 12px 16px;
                border-bottom: 1px solid rgba(102, 126, 234, 0.1);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s;
            `;

            div.addEventListener('mouseenter', () => {
                div.style.background = 'rgba(102, 126, 234, 0.2)';
            });

            div.addEventListener('mouseleave', () => {
                div.style.background = 'transparent';
            });

            div.addEventListener('click', () => {
                this.selectResult(result);
            });

            this.suggestionsContainer.appendChild(div);
        });

        this.selectedIndex = -1;
        this.showSuggestions();
    }

    selectResult(result) {
        console.log('Selected:', result);

        // Update search input
        this.searchInput.value = result.title;

        // Trigger custom event
        const event = new CustomEvent('search-selected', { detail: result });
        this.searchInput.dispatchEvent(event);

        // Navigate or perform action
        if (result.id) {
            // Could navigate to page or trigger display update
            localStorage.setItem('lastSearchResult', JSON.stringify(result));
            window.dispatchEvent(new Event('l2wiki-search-update'));
        }

        this.hideSuggestions();
    }

    showSuggestions() {
        const rect = this.searchInput.getBoundingClientRect();
        const containerWidth = 480;
        const containerHeight = 400; // max-height

        // Позиционируем ПОД поисковой строкой с помощью fixed
        this.suggestionsContainer.style.position = 'fixed';
        this.suggestionsContainer.style.top = `${rect.bottom + 10}px`;
        this.suggestionsContainer.style.left = `${rect.right - containerWidth}px`;
        this.suggestionsContainer.style.right = 'auto';
        this.suggestionsContainer.style.width = `${containerWidth}px`;
        this.suggestionsContainer.style.zIndex = '2147483647';

        // Если не помещается справа - показываем слева
        if (rect.right - containerWidth < 0) {
            this.suggestionsContainer.style.left = `${rect.left}px`;
        }

        this.suggestionsContainer.style.display = 'block';
    }

    hideSuggestions() {
        this.suggestionsContainer.style.display = 'none';
        this.selectedIndex = -1;
    }

    clearCache() {
        this.cache.clear();
    }
}

// Global search UI instance
let searchUI = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    searchUI = new SearchUI();
    searchUI.initialize();
    console.log('🔍 Search Engine v2.0 initialized');
});

// Listen for real-time updates from admin panel
window.addEventListener('storage', (e) => {
    if (e.key === 'l2wiki_content') {
        console.log('📡 Content updated from localStorage');
        if (searchUI) {
            searchUI.initializeContent();
            searchUI.clearCache();
        }
    }
});

// Periodically sync content (fallback)
setInterval(() => {
    try {
        const contentStr = localStorage.getItem('l2wiki_content');
        if (contentStr) {
            const content = JSON.parse(contentStr);
            if (content.length > 0 && (!window.L2WIKI_CONTENT || window.L2WIKI_CONTENT.length === 0)) {
                window.L2WIKI_CONTENT = content;
                if (searchUI) searchUI.clearCache();
                console.log('✅ Content synced from admin updates');
            }
        }
    } catch (e) {
        // Silent fail
    }
}, 1000);

// Export for use in other files
window.FuzzySearch = FuzzySearch;
window.SearchUI = SearchUI;

// CSS for suggestions
const style = document.createElement('style');
style.textContent = `
    .search-suggestion-item {
        animation: slideInDown 0.2s ease-out;
    }

    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    #searchSuggestions::-webkit-scrollbar {
        width: 6px;
    }

    #searchSuggestions::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }

    #searchSuggestions::-webkit-scrollbar-thumb {
        background: rgba(102, 126, 234, 0.4);
        border-radius: 3px;
    }

    #searchSuggestions::-webkit-scrollbar-thumb:hover {
        background: rgba(102, 126, 234, 0.6);
    }
`;
document.head.appendChild(style);
