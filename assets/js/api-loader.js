// Load data from API and publish it for the store.
(function () {
    const publishLoadedData = (payload, source) => {
        if (!payload || typeof payload !== 'object') {
            return;
        }

        window.L2WIKI_SEED_DATA = payload;
        window.L2WIKI_CONTENT = payload;
        window.L2WIKI_DATA_LOADED = true;
        window.dispatchEvent(
            new CustomEvent('l2wiki:data-loaded', {
                detail: {
                    payload,
                    source,
                },
            })
        );
    };

    async function loadData() {
        if (window.L2WIKI_SEED_DATA) {
            publishLoadedData(window.L2WIKI_SEED_DATA, 'seed');
            return;
        }

        try {
            const response = await fetch('/data/canonical/l2wiki-canonical.json', {
                cache: 'no-store',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Canonical JSON is unavailable');
            }

            const payload = await response.json();

            if (payload && Object.keys(payload.sections || {}).length) {
                publishLoadedData(payload, 'canonical-json');
                return;
            }
        } catch (error) {
            console.warn('[L2Wiki] No data source available');
        }
    }

    loadData();
})();
