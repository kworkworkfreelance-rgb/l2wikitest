/**
 * Data loader - fetches canonical JSON/page-data and sets window.L2WIKI_SEED_DATA
 * Adds small session cache + route prefetch so page switches feel instant.
 */
(function () {
    'use strict';

    var loadPromise = null;
    var body = document.body || null;
    var currentPage = body && body.dataset ? body.dataset.page || 'home' : 'home';
    var searchParams = new URLSearchParams(window.location.search);
    var SESSION_PREFIX = 'l2wiki:page-data:v3:';
    var SESSION_INDEX_KEY = SESSION_PREFIX + 'index';
    var SESSION_MAX_ENTRIES = 40;

    window.L2WIKI_DATA_LOADED = false;
    window.L2WIKI_DATA_LOADING = true;

    var canUseSessionStorage = function () {
        try {
            return typeof window.sessionStorage !== 'undefined';
        } catch (error) {
            return false;
        }
    };

    var getSessionKey = function (url) {
        return SESSION_PREFIX + url;
    };

    var readSessionIndex = function () {
        if (!canUseSessionStorage()) {
            return [];
        }

        try {
            var raw = window.sessionStorage.getItem(SESSION_INDEX_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    };

    var writeSessionIndex = function (items) {
        if (!canUseSessionStorage()) {
            return;
        }

        try {
            window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(items.slice(0, SESSION_MAX_ENTRIES)));
        } catch (error) {}
    };

    var rememberSessionEntry = function (url) {
        var items = readSessionIndex().filter(function (entry) {
            return entry !== url;
        });

        items.unshift(url);

        while (items.length > SESSION_MAX_ENTRIES) {
            try {
                window.sessionStorage.removeItem(getSessionKey(items.pop()));
            } catch (error) {
                break;
            }
        }

        writeSessionIndex(items);
    };

    var readCachedPayload = function (url) {
        if (!url || !canUseSessionStorage()) {
            return null;
        }

        try {
            var raw = window.sessionStorage.getItem(getSessionKey(url));
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    };

    var writeCachedPayload = function (url, payload) {
        if (!url || !payload || !canUseSessionStorage()) {
            return;
        }

        try {
            window.sessionStorage.setItem(getSessionKey(url), JSON.stringify(payload));
            rememberSessionEntry(url);
        } catch (error) {}
    };

    var publishLoadedData = function (data, source) {
        window.L2WIKI_SEED_DATA = data;
        window.L2WIKI_CONTENT = data;
        window.L2WIKI_DATA_LOADED = true;
        window.L2WIKI_DATA_LOADING = false;

        window.dispatchEvent(
            new CustomEvent('l2wiki:data-loaded', {
                detail: {
                    payload: data,
                    source: source,
                },
            })
        );

        return data;
    };

    var publishPageData = function (payload, sourceLabel) {
        window.L2WIKI_PAGE_DATA = payload || null;
        return publishLoadedData((payload && payload.database) || {}, sourceLabel || (payload && payload.mode) || 'page-data');
    };

    var buildPageDataUrlFor = function (page, params) {
        if (page !== 'home' && page !== 'article' && page !== 'section' && page !== 'search') {
            return '';
        }

        var nextParams = new URLSearchParams();
        nextParams.set('page', page);

        if (page === 'article') {
            var articleId = params.get('article');

            if (!articleId) {
                return '';
            }

            nextParams.set('article', articleId);
        }

        if (page === 'section') {
            var sectionId = params.get('section');
            var groupId = params.get('group');

            if (sectionId) {
                nextParams.set('section', sectionId);
            }

            if (groupId) {
                nextParams.set('group', groupId);
            }
        }

        if (page === 'search') {
            nextParams.set('query', params.get('query') || '');
        }

        return '/api/page-data?' + nextParams.toString();
    };

    var buildPageDataUrl = function () {
        return buildPageDataUrlFor(currentPage, searchParams);
    };

    var buildPageDataUrlFromHref = function (href) {
        if (!href) {
            return '';
        }

        try {
            var url = new URL(href, window.location.origin);

            if (url.origin !== window.location.origin) {
                return '';
            }

            var pathname = url.pathname.replace(/\/+$/, '');
            var rootPath = '/index.html';
            var articlePath = '/pages/article.html';
            var sectionPath = '/pages/section.html';
            var searchPath = '/pages/search.html';
            var page = '';

            if (pathname === '' || pathname === '/') {
                page = 'home';
            } else if (pathname === rootPath) {
                page = 'home';
            } else if (pathname === articlePath) {
                page = 'article';
            } else if (pathname === sectionPath) {
                page = 'section';
            } else if (pathname === searchPath) {
                page = 'search';
            }

            return buildPageDataUrlFor(page, url.searchParams);
        } catch (error) {
            return '';
        }
    };

    var loadJson = function (url) {
        return fetch(url, {
            cache: 'no-store',
            credentials: 'same-origin',
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('Failed to load ' + url);
            }

            return response.json();
        });
    };

    var refreshPageData = function (pageDataUrl, sourceLabel) {
        return loadJson(pageDataUrl).then(function (payload) {
            writeCachedPayload(pageDataUrl, payload);
            return publishPageData(payload, sourceLabel || 'page-data');
        });
    };

    var prefetchPageData = function (href) {
        var pageDataUrl = buildPageDataUrlFromHref(href);

        if (!pageDataUrl || readCachedPayload(pageDataUrl)) {
            return Promise.resolve(null);
        }

        return loadJson(pageDataUrl)
            .then(function (payload) {
                writeCachedPayload(pageDataUrl, payload);
                return payload;
            })
            .catch(function () {
                return null;
            });
    };

    var loadCanonicalData = function () {
        if (loadPromise) {
            return loadPromise;
        }

        var canonicalUrl = '/data/canonical/l2wiki-canonical.json';
        var pageDataUrl = buildPageDataUrl();
        var cachedPayload = pageDataUrl ? readCachedPayload(pageDataUrl) : null;

        if (cachedPayload) {
            publishPageData(cachedPayload, 'page-data-cache');
        }

        loadPromise = (pageDataUrl ? refreshPageData(pageDataUrl, cachedPayload ? 'page-data-refresh' : 'page-data') : Promise.reject(new Error('page-data-disabled')))
            .catch(function (pageError) {
                if (pageDataUrl) {
                    console.warn('[data-loader] Failed to load page data:', pageError.message);
                    console.warn('[data-loader] Falling back to canonical JSON');
                }

                return loadJson(canonicalUrl + '?v=' + Date.now()).then(function (data) {
                    return publishLoadedData(data || {}, 'canonical-json');
                });
            })
            .catch(function (error) {
                console.warn('[data-loader] Failed to load canonical data:', error.message);
                console.warn('[data-loader] Falling back to empty database');

                return publishLoadedData(
                    {
                        site: { name: 'L2Wiki.Su' },
                        sections: {},
                        articles: {},
                    },
                    'empty-fallback'
                );
            });

        return loadPromise;
    };

    window.L2WIKI_PREFETCH_PAGE_DATA = prefetchPageData;

    loadCanonicalData();
})();
