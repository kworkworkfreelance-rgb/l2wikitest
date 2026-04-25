/**
 * Data loader - fetches canonical JSON and sets window.L2WIKI_SEED_DATA
 * Replaces the 50MB+ static-data.js file with lazy loading
 */
(function () {
    'use strict';

    // Try to load from canonical JSON files
    var loadCanonicalData = function () {
        // Try loading from the main canonical file
        var canonicalUrl = '/data/canonical/l2wiki-canonical.json';

        return fetch(canonicalUrl)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load ' + canonicalUrl);
                }
                return response.json();
            })
            .then(function (data) {
                window.L2WIKI_SEED_DATA = data;
                window.L2WIKI_DATA_LOADED = true;
                console.log('[data-loader] Loaded canonical data:', Object.keys(data.articles || {}).length, 'articles');
                
                // Trigger custom event for other scripts waiting for data
                window.dispatchEvent(new CustomEvent('l2wiki:data-loaded', { detail: data }));
                
                return data;
            })
            .catch(function (error) {
                console.warn('[data-loader] Failed to load canonical data:', error.message);
                console.warn('[data-loader] Falling back to empty database');
                
                // Fallback to empty database
                window.L2WIKI_SEED_DATA = {
                    site: { name: 'L2Wiki.Su' },
                    sections: {},
                    articles: {}
                };
                window.L2WIKI_DATA_LOADED = true;
                
                window.dispatchEvent(new CustomEvent('l2wiki:data-loaded', { detail: window.L2WIKI_SEED_DATA }));
                
                return window.L2WIKI_SEED_DATA;
            });
    };

    // Start loading immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCanonicalData);
    } else {
        loadCanonicalData();
    }
})();
