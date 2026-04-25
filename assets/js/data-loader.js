/**
 * Data loader - fetches canonical JSON and sets window.L2WIKI_SEED_DATA
 * Replaces the 50MB+ static-data.js file with lazy loading
 */
(function () {
    'use strict';

    var loadPromise = null;

    var publishLoadedData = function (data, source) {
        window.L2WIKI_SEED_DATA = data;
        window.L2WIKI_CONTENT = data;
        window.L2WIKI_DATA_LOADED = true;

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

    // Try to load from canonical JSON files
    var loadCanonicalData = function () {
        if (loadPromise) {
            return loadPromise;
        }

        // Try loading from the main canonical file
        var canonicalUrl = '/data/canonical/l2wiki-canonical.json';

        loadPromise = fetch(`${canonicalUrl}?v=${Date.now()}`, {
            cache: 'no-store',
            credentials: 'same-origin',
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load ' + canonicalUrl);
                }
                return response.json();
            })
            .then(function (data) {
                return publishLoadedData(data, 'canonical-json');
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
