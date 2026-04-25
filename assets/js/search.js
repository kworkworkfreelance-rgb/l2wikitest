(function () {
    const body = document.body;
    const currentPage = body?.dataset?.page || 'home';
    const isRootPage = currentPage === 'home';
    const store = window.L2WikiStore || null;

    const routes = {
        article: isRootPage ? './pages/article.html' : './article.html',
        section: isRootPage ? './pages/section.html' : './section.html',
        search: isRootPage ? './pages/search.html' : './search.html',
    };

    const SYNONYMS = {
        профа: ['профессия', 'класс', 'class'],
        профессия: ['профа', 'класс', 'class'],
        саб: ['сабкласс', 'subclass', 'sub-class'],
        сабкласс: ['саб', 'subclass', 'sub-class'],
        маммон: ['mammon', 'кузница', 'кузнец', 'blacksmith'],
        квест: ['quest', 'задание'],
        спойл: ['spoil', 'spoiler', 'спойлер'],
        баф: ['buff', 'бафф'],
        эпик: ['epic', 'рейд', 'raid', 'boss'],
        фрея: ['freya'],
        баюм: ['baium'],
        антарас: ['antharas'],
        валакас: ['valakas'],
        фринтеза: ['frintezza'],
        фринтеза: ['frintezza'],
        рыбалка: ['fishing'],
        манор: ['manor'],
        трансформация: ['transform', 'transformation'],
        катакомбы: ['catacomb', 'catacombs'],
        некрополь: ['necropolis'],
        некрополи: ['necropolis'],
        адена: ['adena'],
        дворянин: ['noblesse', 'noble'],
        нубл: ['noblesse', 'noble'],
        олимп: ['олимпиада', 'olympiad'],
        олимпиада: ['олимп', 'olympiad'],
        осада: ['siege', 'castle'],
        осады: ['siege', 'castle'],
        seven: ['signs', 'seven-signs', 'печати'],
        signs: ['seven', 'seven-signs', 'печати'],
        toi: ['tower', 'insolence', 'toi'],
        tower: ['toi', 'insolence'],
        атрибут: ['attribute', 'stone', 'stones'],
        шоты: ['soulshot', 'spiritshot', 'shot'],
        soulshot: ['шоты', 'spiritshot'],
        spiritshot: ['шоты', 'soulshot'],
    };

    const escapeHtml = (value = '') =>
        String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    const normalize = (value = '') =>
        String(value)
            .toLowerCase()
            .replaceAll('ё', 'е')
            .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
            .trim();

    const tokenize = (value = '') => normalize(value).split(/\s+/).filter(Boolean);

    const unique = (items) => Array.from(new Set(items.filter(Boolean)));

    const expandTokens = (tokens) =>
        unique(
            tokens.flatMap((token) => [
                token,
                ...(SYNONYMS[token] || []),
                ...Object.entries(SYNONYMS)
                    .filter(([, values]) => values.includes(token))
                    .map(([key]) => key),
            ])
        );

    const levenshteinDistance = (left, right) => {
        const a = normalize(left);
        const b = normalize(right);

        if (!a || !b) {
            return Math.max(a.length, b.length);
        }

        const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

        for (let i = 0; i <= a.length; i += 1) {
            matrix[i][0] = i;
        }

        for (let j = 0; j <= b.length; j += 1) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
        }

        return matrix[a.length][b.length];
    };

    const bestFuzzyWordScore = (token, words) => {
        let bestScore = 0;

        words.forEach((word) => {
            if (!word) {
                return;
            }

            if (word.startsWith(token)) {
                bestScore = Math.max(bestScore, 0.92);
                return;
            }

            if (word.includes(token)) {
                bestScore = Math.max(bestScore, 0.82);
                return;
            }

            const distance = levenshteinDistance(token, word);
            const similarity = 1 - distance / Math.max(token.length, word.length, 1);

            if (similarity > bestScore) {
                bestScore = similarity;
            }
        });

        return bestScore;
    };

    const buildHref = (item) =>
        item.hrefType === 'section'
            ? `${routes.section}?section=${encodeURIComponent(item.id)}`
            : `${routes.article}?article=${encodeURIComponent(item.id)}`;

    const getIndex = () => store?.buildSearchIndex?.() || [];

    const scoreItem = (query, item) => {
        const normalizedQuery = normalize(query);
        const queryTokens = tokenize(query);
        const expandedTokens = expandTokens(queryTokens);

        const titleText = normalize(item.title);
        const summaryText = normalize(item.summary);
        const sectionText = normalize(item.sectionTitle || item.section || '');
        const groupText = normalize(item.groupTitle || item.group || '');
        const searchableText = normalize(item.searchableText || `${item.title} ${item.summary || ''}`);
        const allWords = unique(
            `${titleText} ${summaryText} ${sectionText} ${groupText} ${searchableText}`.split(/\s+/).filter(Boolean)
        );

        let score = 0;

        if (titleText === normalizedQuery) {
            score += 7;
        }

        if (titleText.startsWith(normalizedQuery)) {
            score += 5;
        } else if (titleText.includes(normalizedQuery)) {
            score += 4.1;
        }

        if (searchableText.includes(normalizedQuery)) {
            score += 2.6;
        }

        expandedTokens.forEach((token) => {
            if (!token) {
                return;
            }

            if (titleText.includes(token)) {
                score += 1.9;
            } else if (summaryText.includes(token)) {
                score += 1.25;
            } else if (sectionText.includes(token) || groupText.includes(token)) {
                score += 1.1;
            } else if (searchableText.includes(token)) {
                score += 0.9;
            } else {
                const fuzzy = bestFuzzyWordScore(token, allWords);

                if (fuzzy >= 0.88) {
                    score += 1.05;
                } else if (fuzzy >= 0.74) {
                    score += 0.7;
                } else if (fuzzy >= 0.62) {
                    score += 0.38;
                }
            }
        });

        if (item.type === 'section' && (sectionText.includes(normalizedQuery) || titleText.includes(normalizedQuery))) {
            score += 0.45;
        }

        return score;
    };

    const search = (query, options = {}) => {
        const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8;
        const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 1.15;
        const source = options.source || getIndex();
        const normalizedQuery = normalize(query);

        if (!normalizedQuery) {
            return [];
        }

        return source
            .map((item) => ({
                ...item,
                score: scoreItem(query, item),
            }))
            .filter((item) => item.score >= threshold)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    };

    const suggest = (query, options = {}) => {
        const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 4;
        const source = options.source || getIndex();
        const normalizedQuery = normalize(query);

        if (!normalizedQuery) {
            return [];
        }

        return source
            .map((item) => ({
                ...item,
                score: scoreItem(query, item),
            }))
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    };

    const highlightMatch = (text, query) => {
        const tokens = expandTokens(tokenize(query))
            .sort((left, right) => right.length - left.length)
            .slice(0, 8);

        if (!tokens.length) {
            return escapeHtml(text);
        }

        const escapedText = escapeHtml(text);
        const pattern = tokens
            .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean)
            .join('|');

        if (!pattern) {
            return escapedText;
        }

        return escapedText.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
    };

    const buildMetaLine = (item) => {
        const parts = [];

        if (item.type === 'article' && item.sectionTitle) {
            parts.push(item.sectionTitle);
        }

        if (item.type === 'article' && item.groupTitle) {
            parts.push(item.groupTitle);
        }

        if (item.type === 'section') {
            parts.push('Раздел базы знаний');
        }

        return parts.join(' • ');
    };

    const createSuggestionElement = (item, query) => {
        const element = document.createElement('a');
        element.className = 'search-suggestion';
        element.href = buildHref(item);
        element.innerHTML = `
            <span class="search-suggestion__badge search-suggestion__badge--${item.type === 'section' ? 'section' : 'article'}">
                ${item.type === 'section' ? 'Раздел' : 'Статья'}
            </span>
            <span class="search-suggestion__content">
                <span class="search-suggestion__title">${highlightMatch(item.title, query)}</span>
                <span class="search-suggestion__meta">${escapeHtml(buildMetaLine(item) || item.summary || 'Материал из базы знаний')}</span>
                <span class="search-suggestion__summary">${highlightMatch(item.summary || 'Открыть материал', query)}</span>
            </span>
            <span class="search-suggestion__score">${Math.round(item.score * 12)}%</span>
        `;
        return element;
    };

    const createNoResultsElement = (query) => {
        const suggestions = suggest(query, { limit: 3 });
        const element = document.createElement('div');
        element.className = 'search-no-results';

        element.innerHTML = `
            <div class="search-no-results__content">
                <div class="search-no-results__title">По запросу <strong>${escapeHtml(query)}</strong> точных совпадений не найдено</div>
                <div class="search-no-results__hint">Попробуй похожие материалы ниже.</div>
                ${
                    suggestions.length
                        ? `
                            <div class="search-no-results__list">
                                ${suggestions
                                    .map(
                                        (item) => `
                                            <a class="search-no-results__link" href="${buildHref(item)}">
                                                ${escapeHtml(item.title)}
                                            </a>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : ''
                }
            </div>
        `;

        return element;
    };

    const initializeSearchForm = (form) => {
        if (form.dataset.searchReady === 'true') {
            return;
        }

        const input = form.querySelector('.header__search-input');

        if (!input) {
            return;
        }

        const container = document.createElement('div');
        container.className = 'search-suggestions';
        form.appendChild(container);

        let activeIndex = -1;

        const closeSuggestions = () => {
            activeIndex = -1;
            container.style.display = 'none';
            container.innerHTML = '';
        };

        const openSuggestions = (query) => {
            const results = search(query, { limit: 7 });
            container.innerHTML = '';

            if (!results.length) {
                container.appendChild(createNoResultsElement(query));
                container.style.display = 'block';
                return;
            }

            results.forEach((item) => {
                container.appendChild(createSuggestionElement(item, query));
            });

            container.style.display = 'block';
        };

        const focusSuggestion = (direction) => {
            const items = Array.from(container.querySelectorAll('.search-suggestion'));

            if (!items.length) {
                return;
            }

            activeIndex += direction;

            if (activeIndex < 0) {
                activeIndex = items.length - 1;
            }

            if (activeIndex >= items.length) {
                activeIndex = 0;
            }

            items.forEach((item, index) => {
                item.classList.toggle('is-focused', index === activeIndex);
            });
        };

        input.addEventListener('input', () => {
            const query = input.value.trim();

            if (!query) {
                closeSuggestions();
                return;
            }

            openSuggestions(query);
        });

        input.addEventListener('keydown', (event) => {
            const items = Array.from(container.querySelectorAll('.search-suggestion'));

            if (event.key === 'Escape') {
                closeSuggestions();
                return;
            }

            if (!items.length) {
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusSuggestion(1);
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusSuggestion(-1);
            }

            if (event.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
                event.preventDefault();
                window.location.href = items[activeIndex].href;
            }
        });

        input.addEventListener('focus', () => {
            if (input.value.trim()) {
                openSuggestions(input.value.trim());
            }
        });

        form.addEventListener('focusout', () => {
            window.setTimeout(() => {
                if (!form.contains(document.activeElement)) {
                    closeSuggestions();
                }
            }, 0);
        });

        document.addEventListener('click', (event) => {
            if (!form.contains(event.target)) {
                closeSuggestions();
            }
        });

        form.dataset.searchReady = 'true';
    };

    const bootSearch = () => {
        document.querySelectorAll('.header__search').forEach(initializeSearchForm);
    };

    window.L2WikiSearchEngine = {
        search,
        suggest,
        normalize,
    };

    bootSearch();

    if (store?.subscribe) {
        store.subscribe(() => {
            bootSearch();
        });
    }
})();
