const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist-static');

const ensureDir = (targetPath) => {
    fs.mkdirSync(targetPath, { recursive: true });
};

const copyFile = (sourcePath, targetPath) => {
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
};

const copyDir = (sourcePath, targetPath, filter) => {
    ensureDir(path.dirname(targetPath));
    fs.cpSync(sourcePath, targetPath, { recursive: true, filter });
};

const cleanOutputDir = () => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    ensureDir(OUTPUT_DIR);
};

const copyRootAssets = () => {
    const allowedExtensions = new Set(['.html', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.xml', '.webp', '.ico']);

    fs.readdirSync(ROOT_DIR, { withFileTypes: true }).forEach((entry) => {
        if (!entry.isFile()) {
            return;
        }

        const extension = path.extname(entry.name).toLowerCase();

        if (!allowedExtensions.has(extension)) {
            return;
        }

        copyFile(path.join(ROOT_DIR, entry.name), path.join(OUTPUT_DIR, entry.name));
    });
};

const copyIfExists = (relativePath) => {
    const sourcePath = path.join(ROOT_DIR, relativePath);

    if (!fs.existsSync(sourcePath)) {
        return;
    }

    const targetPath = path.join(OUTPUT_DIR, relativePath);
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
        copyDir(sourcePath, targetPath);
        return;
    }

    copyFile(sourcePath, targetPath);
};

const copyCanonicalFiles = () => {
    ['l2wiki-canonical.json', 'l2wiki-meta.json'].forEach((fileName) => {
        copyIfExists(path.join('data', 'canonical', fileName));
    });
};

const main = () => {
    cleanOutputDir();
    copyRootAssets();
    copyIfExists('robots.txt');

    copyDir(path.join(ROOT_DIR, 'assets'), path.join(OUTPUT_DIR, 'assets'), (sourcePath) => {
        const normalized = sourcePath.replace(/\\/g, '/');
        return !/\/assets\/js\/static-data([-.].+)?\.js$/i.test(normalized) && !/\/assets\/js\/static-data\.orig\.js$/i.test(normalized);
    });
    ['pages', 'guns'].forEach(copyIfExists);
    copyCanonicalFiles();

    console.log('[build-static] Export ready:', OUTPUT_DIR);
};

main();
