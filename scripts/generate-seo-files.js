#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const ROBOTS_PATH = path.join(ROOT, 'robots.txt');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://l2wiki.su';

const escapeXml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const lastmod = new Date(database.updatedAt || Date.now()).toISOString().slice(0, 10);

const urls = new Set([
    `${SITE_URL}/`,
    `${SITE_URL}/index.html`,
    `${SITE_URL}/pages/article.html`,
    `${SITE_URL}/pages/section.html`,
    `${SITE_URL}/pages/search.html`,
]);

Object.keys(database.sections || {}).forEach((sectionId) => {
    urls.add(`${SITE_URL}/pages/section.html?section=${encodeURIComponent(sectionId)}`);
});

Object.keys(database.articles || {}).forEach((articleId) => {
    urls.add(`${SITE_URL}/pages/article.html?article=${encodeURIComponent(articleId)}`);
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(
    urls
)
    .sort()
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n')}\n</urlset>\n`;

const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

fs.writeFileSync(ROBOTS_PATH, robotsTxt, 'utf8');
fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

console.log(`SEO files generated. URLs in sitemap: ${urls.size}`);
