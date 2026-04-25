// Load data from API and set L2WIKI_CONTENT
async function loadData() {
    if (window.L2WIKI_SEED_DATA) {
        window.L2WIKI_CONTENT = window.L2WIKI_SEED_DATA;
        return;
    }

    try {
        const response = await fetch('/api/database?full=1', {
            cache: 'no-store',
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Database API is unavailable');
        }

        const payload = await response.json();

        if (payload && payload.database && Object.keys(payload.database.sections || {}).length) {
            window.L2WIKI_CONTENT = payload.database;
            return;
        }
    } catch (error) {
        console.warn('[L2Wiki] No data source available');
    }
}

loadData();
