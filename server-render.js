#!/usr/bin/env node
/**
 * Minimal server for Render/Vercel - uses static-data.js directly
 * No canonical file dependencies, no SQLite, no admin API
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Load static-data.js
const STATIC_DATA_PATH = path.join(__dirname, 'assets', 'js', 'static-data.js');

let database = null;

try {
    const content = fs.readFileSync(STATIC_DATA_PATH, 'utf8');
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    const jsonStr = content.substring(startIdx, endIdx + 1);
    database = JSON.parse(jsonStr);
    console.log(`✅ Loaded static-data.js: ${Object.keys(database.articles || {}).length} articles`);
} catch (e) {
    console.error('❌ Failed to load static-data.js:', e.message);
    database = { site: { name: 'L2Wiki' }, sections: {}, articles: {} };
}

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// API endpoints
app.get('/api/database', (req, res) => {
    res.json(database);
});

app.get('/api/sections', (req, res) => {
    const sections = Object.values(database.sections || {}).sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(sections);
});

app.get('/api/section/:id', (req, res) => {
    const section = database.sections?.[req.params.id];
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    res.json(section);
});

app.get('/api/article/:id', (req, res) => {
    const article = database.articles?.[req.params.id];
    if (!article) {
        return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
});

// Serve canonical JSON for data-loader.js
app.get('/data/canonical/l2wiki-canonical.json', (req, res) => {
    res.json(database);
});

// Catch-all - serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 L2Wiki running on http://localhost:${PORT}`);
});
