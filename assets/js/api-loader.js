// Load data from API and set L2WIKI_CONTENT
async function loadData() {
    if (window.L2WIKI_SEED_DATA) {
        window.L2WIKI_CONTENT = window.L2WIKI_SEED_DATA;
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
            window.L2WIKI_CONTENT = payload;
            return;
        }
    } catch (error) {
        console.warn('[L2Wiki] No data source available');
    }
}

loadData();
