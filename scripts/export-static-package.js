#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'dist-static');
const ITEMS_TO_COPY = ['assets', 'pages', 'index.html', 'robots.txt', 'sitemap.xml'];

const removeDir = (targetPath) => {
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
};

const copyItem = (sourcePath, targetPath) => {
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        fs.cpSync(sourcePath, targetPath, { recursive: true });
        return;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
};

const getDirSize = (targetPath) => {
    const entry = fs.statSync(targetPath);

    if (!entry.isDirectory()) {
        return entry.size;
    }

    return fs.readdirSync(targetPath).reduce((total, name) => {
        return total + getDirSize(path.join(targetPath, name));
    }, 0);
};

removeDir(OUTPUT_DIR);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

ITEMS_TO_COPY.forEach((item) => {
    const sourcePath = path.join(ROOT, item);

    if (!fs.existsSync(sourcePath)) {
        return;
    }

    copyItem(sourcePath, path.join(OUTPUT_DIR, item));
});

const sizeMb = Math.round((getDirSize(OUTPUT_DIR) / (1024 * 1024)) * 100) / 100;
console.log(`Static package exported to ${OUTPUT_DIR}`);
console.log(`Static package size: ${sizeMb} MB`);
