(function () {
    'use strict';

    const store = window.L2WikiStore || null;
    const body = document.body || null;
    const currentPage = body && body.dataset ? body.dataset.page || 'home' : 'home';
    const preferDedicatedSearchPage = currentPage === 'article' || currentPage === 'section' || currentPage === 'search';

    const normalize = (value = '') =>
        String(value)
            .toLowerCase()
            .replaceAll('ё', 'е')
            .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
            .trim();

    const scoreResult = (query, item) => {
        const normalizedQuery = normalize(query);
        const haystack = normalize(item.searchableText || `${item.title} ${item.summary || ''}`);
        const title = normalize(item.title);

        let score = 0;

        if (title === normalizedQuery) {
            score += 10;
        }

        if (title.includes(normalizedQuery)) {
            score += 6;
        }

        if (haystack.includes(normalizedQuery)) {
            score += 4;
        }

        normalizedQuery.split(/\s+/).forEach((token) => {
            if (token && haystack.includes(token)) {
                score += 1;
            }
        });

        return score;
    };

    const searchIndex = (query) => {
        const index = store?.buildSearchIndex?.() || [];
        return index
            .map((item) => ({
                ...item,
                score: scoreResult(query, item),
            }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, 12);
    };

    if (preferDedicatedSearchPage) {
        return;
    }

    if (!document.getElementById('searchModal')) {
        document.body.insertAdjacentHTML(
            'beforeend',
            `
            <div class="search-modal-overlay" id="searchModal" style="display:none;">
                <div class="search-modal">
                    <div class="search-modal__header">
                        <div class="search-modal__input-wrapper">
                            <input type="search" class="search-modal__input" id="searchModalInput" placeholder="Поиск по базе знаний..." autocomplete="off" />
                            <button class="search-modal__close" id="searchModalClose" type="button">&times;</button>
                        </div>
                    </div>
                    <div class="search-modal__results" id="searchModalResults"></div>
                </div>
            </div>
            `
        );
    }

    const searchInput = document.getElementById('site-search') || document.querySelector('.header__search-input');
    const searchButton = document.getElementById('searchButton') || document.querySelector('.header__search-button');
    const modal = document.getElementById('searchModal');
    const modalInput = document.getElementById('searchModalInput');
    const modalClose = document.getElementById('searchModalClose');
    const modalResults = document.getElementById('searchModalResults');

    if (!modal || !modalInput || !modalResults) {
        return;
    }

    const routes = {
        article: '/pages/article.html?article=',
        section: '/pages/section.html?section=',
    };

    let timeoutId = null;

    const resetEmptyState = () => {
        modalResults.innerHTML = `
            <div class="search-modal__empty">
                <div class="search-modal__empty-icon">Поиск</div>
                <div class="search-modal__empty-text">Введите запрос для поиска</div>
                <div class="search-modal__empty-hint">Например: квест, mammon, gludio, noblesse</div>
            </div>
        `;
    };

    const openModal = () => {
        modal.style.display = 'flex';
        resetEmptyState();
        window.setTimeout(() => modalInput.focus(), 50);
    };

    const closeModal = () => {
        modal.style.display = 'none';
        modalInput.value = '';
        resetEmptyState();
    };

    const renderResults = (query) => {
        const results = searchIndex(query);

        if (!results.length) {
            modalResults.innerHTML = `
                <div class="search-modal__no-results">
                    <div class="search-modal__no-results-icon">0</div>
                    <div class="search-modal__no-results-text">Совпадений не найдено</div>
                    <div class="search-modal__no-results-hint">Попробуйте другой запрос или английское название объекта</div>
                </div>
            `;
            return;
        }

        modalResults.innerHTML = `
            <div class="search-modal__count">Найдено: ${results.length}</div>
            ${results
                .map((item) => {
                    const href = item.type === 'section' ? `${routes.section}${encodeURIComponent(item.id)}` : `${routes.article}${encodeURIComponent(item.id)}`;
                    const preview = item.previewImage
                        ? `<img class="search-modal__thumb" src="${item.previewImage}" alt="${item.title}" loading="lazy" />`
                        : `<div class="search-modal__glyph">${item.type === 'section' ? 'S' : 'A'}</div>`;
                    return `
                        <a href="${href}" class="search-modal__item">
                            <div class="search-modal__icon">
                                ${preview}
                            </div>
                            <div class="search-modal__content">
                                <div class="search-modal__title">${item.title}</div>
                                <div class="search-modal__desc">${item.summary || 'Открыть материал'}</div>
                            </div>
                        </a>
                    `;
                })
                .join('')}
        `;
    };

    const bindSearchTrigger = (element) => {
        if (!element) {
            return;
        }

        element.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openModal();
        });
    };

    bindSearchTrigger(searchInput);
    bindSearchTrigger(searchButton);

    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                openModal();
            }
        });
    }

    document.querySelectorAll('.header__search').forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            openModal();
        });
    });

    modalClose.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    modalInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();

        window.clearTimeout(timeoutId);

        if (!query) {
            resetEmptyState();
            return;
        }

        timeoutId = window.setTimeout(() => renderResults(query), 120);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    resetEmptyState();
})();

