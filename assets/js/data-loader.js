/**
 * Data loader - fetches canonical JSON and sets window.L2WIKI_SEED_DATA
 * Replaces the 50MB+ static-data.js file with lazy loading
 */
(function () {
    'use strict';

    var loadPromise = null;
    var body = document.body || null;
    var currentPage = body && body.dataset ? body.dataset.page || 'home' : 'home';
    var searchParams = new URLSearchParams(window.location.search);

    window.L2WIKI_DATA_LOADED = false;
    window.L2WIKI_DATA_LOADING = true;

    var publishLoadedData = function (data, source) {
        window.L2WIKI_SEED_DATA = data;
        window.L2WIKI_CONTENT = data;
        window.L2WIKI_DATA_LOADED = true;
        window.L2WIKI_DATA_LOADING = false;

        console.log('[data-loader] Data source:', source, Object.keys(data.articles || {}).length, 'articles');
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

    var publishPageData = function (payload) {
        window.L2WIKI_PAGE_DATA = payload || null;
        return publishLoadedData((payload && payload.database) || {}, (payload && payload.mode) || 'page-data');
    };

    var buildPageDataUrl = function () {
        if (currentPage !== 'article' && currentPage !== 'section' && currentPage !== 'search') {
            return '';
        }

        var params = new URLSearchParams();
        params.set('page', currentPage);

        if (currentPage === 'article') {
            var articleId = searchParams.get('article');

            if (!articleId) {
                return '';
            }

            params.set('article', articleId);
        }

        if (currentPage === 'section') {
            var sectionId = searchParams.get('section');
            var groupId = searchParams.get('group');

            if (sectionId) {
                params.set('section', sectionId);
            }

            if (groupId) {
                params.set('group', groupId);
            }
        }

        if (currentPage === 'search') {
            params.set('query', searchParams.get('query') || '');
        }

        return '/api/page-data?' + params.toString();
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

    var loadCanonicalData = function () {
        if (loadPromise) {
            return loadPromise;
        }

        var canonicalUrl = '/data/canonical/l2wiki-canonical.json';
        var pageDataUrl = buildPageDataUrl();

        loadPromise = (pageDataUrl ? loadJson(pageDataUrl) : Promise.reject(new Error('page-data-disabled')))
            .then(function (payload) {
                return {
                    handled: true,
                    data: publishPageData(payload),
                };
            })
            .catch(function (pageError) {
                if (pageDataUrl) {
                    console.warn('[data-loader] Failed to load page data:', pageError.message);
                    console.warn('[data-loader] Falling back to canonical JSON');
                }

                return loadJson(canonicalUrl + '?v=' + Date.now()).then(function (data) {
                    return {
                        handled: false,
                        data: data,
                    };
                });
            })
            .then(function (result) {
                if (result && result.handled) {
                    return result.data;
                }

                return publishLoadedData((result && result.data) || {}, 'canonical-json');
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

    loadCanonicalData();
})();
