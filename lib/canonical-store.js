const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('./rich-content-schema');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CANONICAL_DIR = path.join(DATA_DIR, 'canonical');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const RAW_DIR = path.join(DATA_DIR, 'raw', 'archive');
const CANONICAL_PATH = path.join(CANONICAL_DIR, 'l2wiki-canonical.json');
const CANONICAL_META_PATH = path.join(CANONICAL_DIR, 'l2wiki-meta.json');
const LEGACY_JSON_PATH = path.join(ROOT_DIR, 'l2wiki-db-2026-04-07.json');
const STATIC_DATA_PATH = path.join(ROOT_DIR, 'assets', 'js', 'static-data.js');

// Cache the parsed canonical snapshot until the source file actually changes.
let databaseCache = null;
let databaseCacheSignature = '';
let metadataCache = null;
let metadataCacheSignature = '';

const invalidateCache = () => {
    databaseCache = null;
    databaseCacheSignature = '';
    metadataCache = null;
    metadataCacheSignature = '';
};

const ensureDir = (targetPath) => {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
};

const ensureStorageDirs = () => {
    [DATA_DIR, CANONICAL_DIR, BACKUP_DIR, RAW_DIR].forEach(ensureDir);
};

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const readJsonIfExists = (filePath) => (fs.existsSync(filePath) ? readJsonFile(filePath) : null);

const mergeCanonicalParts = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.concat(b);
    }

    if (a && typeof a === 'object' && b && typeof b === 'object') {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        const out = {};

        for (const k of keys) {
            const va = a[k];
            const vb = b[k];

            if (Array.isArray(va) && Array.isArray(vb)) {
                out[k] = va.concat(vb);
            } else if (va && typeof va === 'object' && vb && typeof vb === 'object') {
                out[k] = { ...va, ...vb };
            } else {
                out[k] = vb !== undefined ? vb : va;
            }
        }

        return out;
    }

    return b !== undefined ? b : a;
};

const compactForStorage = (value) => {
    if (Array.isArray(value)) {
        const items = value.map(compactForStorage).filter((item) => item !== undefined);
        return items.length ? items : undefined;
    }

    if (value && typeof value === 'object') {
        const compacted = Object.fromEntries(
            Object.entries(value)
                .map(([key, entry]) => [key, compactForStorage(entry)])
                .filter(([, entry]) => entry !== undefined)
        );

        return Object.keys(compacted).length ? compacted : undefined;
    }

    if (value === '' || value == null) {
        return undefined;
    }

    return value;
};

const buildCanonicalMeta = (database) => ({
    version: Number(database?.version) || 2,
    updatedAt: database?.updatedAt || new Date().toISOString(),
    site: {
        name: database?.site?.name || '',
        subtitle: database?.site?.subtitle || '',
    },
    counts: {
        sections: Object.keys(database?.sections || {}).length,
        articles: Object.keys(database?.articles || {}).length,
    },
});

const writeCanonicalMeta = (database) => {
    const meta = buildCanonicalMeta(database);
    fs.writeFileSync(CANONICAL_META_PATH, JSON.stringify(meta), 'utf8');
    metadataCache = meta;
    metadataCacheSignature = `${meta.updatedAt}:${meta.counts.sections}:${meta.counts.articles}`;
    return CANONICAL_META_PATH;
};

const getFileSignature = (filePath) => {
    const stats = fs.statSync(filePath);
    return `${stats.size}:${stats.mtimeMs}`;
};

const buildStaticDataSource = (database, sourceLabel = 'canonical-store') =>
    `window.L2WIKI_SEED_DATA=${JSON.stringify(compactForStorage(database) || {})};window.L2WIKI_SEED_SOURCE=${JSON.stringify({
        source: sourceLabel,
        generatedAt: new Date().toISOString(),
        articles: Object.keys(database.articles || {}).length,
        sections: Object.keys(database.sections || {}).length,
    })};`;

const writeStaticData = (database, sourceLabel = 'canonical-store') => {
    const normalized = normalizeDatabase(database);
    fs.writeFileSync(STATIC_DATA_PATH, buildStaticDataSource(normalized, sourceLabel), 'utf8');
    return STATIC_DATA_PATH;
};

const writeJsonAtomic = (targetPath, value) => {
    const tempPath = `${targetPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(compactForStorage(value) || {}), 'utf8');
    fs.renameSync(tempPath, targetPath);
};

const ensureCanonicalFile = () => {
    ensureStorageDirs();
    if (fs.existsSync(CANONICAL_PATH)) {
        if (!fs.existsSync(CANONICAL_META_PATH)) {
            writeCanonicalMeta(normalizeDatabase(readJsonFile(CANONICAL_PATH)));
        }
        return CANONICAL_PATH;
    }

    // If the canonical file is missing but split parts exist, prepare meta/static data from merged parts
    const part1 = path.join(CANONICAL_DIR, 'l2wiki-canonical-1.json');
    const part2 = path.join(CANONICAL_DIR, 'l2wiki-canonical-2.json');

    if (fs.existsSync(part1) && fs.existsSync(part2)) {
        const p1 = readJsonFile(part1);
        const p2 = readJsonFile(part2);
        const merged = normalizeDatabase(mergeCanonicalParts(p1, p2));

        if (!fs.existsSync(CANONICAL_META_PATH)) {
            writeCanonicalMeta(merged);
        }

        // Also write static data so other parts of the app can work without a single large canonical file
        writeStaticData(merged, 'split-parts');

        // Do not write the single large canonical file here (we avoid recreating the big file).
        return CANONICAL_PATH;
    }

    const initial = fs.existsSync(LEGACY_JSON_PATH)
        ? normalizeDatabase(readJsonFile(LEGACY_JSON_PATH))
        : normalizeDatabase({
              version: 2,
              updatedAt: new Date().toISOString(),
              site: {
                  name: 'L2Wiki.Su',
                  subtitle: 'База знаний по Lineage II',
              },
              sections: {},
              articles: {},
          });

    writeJsonAtomic(CANONICAL_PATH, initial);
    writeCanonicalMeta(initial);
    writeStaticData(initial, 'legacy-bootstrap');
    return CANONICAL_PATH;
};

const readCanonical = () => {
    ensureCanonicalFile();
    const part1 = path.join(CANONICAL_DIR, 'l2wiki-canonical-1.json');
    const part2 = path.join(CANONICAL_DIR, 'l2wiki-canonical-2.json');

    // If canonical single file exists, use it as before
    if (fs.existsSync(CANONICAL_PATH)) {
        const signature = getFileSignature(CANONICAL_PATH);

        if (databaseCache && databaseCacheSignature === signature) {
            return databaseCache;
        }

        const database = normalizeDatabase(readJsonFile(CANONICAL_PATH));
        databaseCache = database;
        databaseCacheSignature = signature;
        metadataCache = buildCanonicalMeta(database);
        metadataCacheSignature = signature;

        return database;
    }

    // If split parts exist, load and merge them in-memory (no single large file written)
    if (fs.existsSync(part1) && fs.existsSync(part2)) {
        const sig1 = getFileSignature(part1);
        const sig2 = getFileSignature(part2);
        const combinedSig = `${sig1}|${sig2}`;

        if (databaseCache && databaseCacheSignature === combinedSig) {
            return databaseCache;
        }

        const p1 = readJsonFile(part1);
        const p2 = readJsonFile(part2);
        const merged = normalizeDatabase(mergeCanonicalParts(p1, p2));

        databaseCache = merged;
        databaseCacheSignature = combinedSig;
        metadataCache = buildCanonicalMeta(merged);
        metadataCacheSignature = combinedSig;

        return merged;
    }

    // Fallback (shouldn't reach here because ensureCanonicalFile writes canonical if missing)
    const signature = getFileSignature(CANONICAL_PATH);

    if (databaseCache && databaseCacheSignature === signature) {
        return databaseCache;
    }

    const database = normalizeDatabase(readJsonFile(CANONICAL_PATH));
    databaseCache = database;
    databaseCacheSignature = signature;
    metadataCache = buildCanonicalMeta(database);
    metadataCacheSignature = signature;

    return database;
};

const readCanonicalMeta = () => {
    ensureCanonicalFile();

    if (!fs.existsSync(CANONICAL_META_PATH)) {
        const database = readCanonical();
        writeCanonicalMeta(database);
        return buildCanonicalMeta(database);
    }

    const signature = getFileSignature(CANONICAL_META_PATH);

    if (metadataCache && metadataCacheSignature === signature) {
        return metadataCache;
    }

    const meta = readJsonFile(CANONICAL_META_PATH);
    metadataCache = meta;
    metadataCacheSignature = signature;
    return meta;
};

const writeBackup = (database, reason = 'publish') => {
    ensureStorageDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = String(reason || 'publish').replace(/[^a-z0-9_-]+/gi, '-');
    const filePath = path.join(BACKUP_DIR, `${stamp}-${safeReason}.json`);
    fs.writeFileSync(filePath, JSON.stringify(compactForStorage(database) || {}), 'utf8');
    return filePath;
};

const listBackups = () => {
    ensureStorageDirs();

    return fs
        .readdirSync(BACKUP_DIR)
        .filter((fileName) => fileName.endsWith('.json'))
        .sort()
        .reverse()
        .map((fileName) => {
            const filePath = path.join(BACKUP_DIR, fileName);
            const stats = fs.statSync(filePath);
            return {
                fileName,
                filePath,
                size: stats.size,
                updatedAt: stats.mtime.toISOString(),
            };
        });
};

const runSql = (db, sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve(this);
        });
    });

const allSql = (db, sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });

const ensureSqliteColumns = async (db, tableName, columns) => {
    const existing = await allSql(db, `PRAGMA table_info(${tableName})`);
    const existingNames = new Set(existing.map((column) => column.name));

    for (const column of columns) {
        if (!existingNames.has(column.name)) {
            await runSql(db, `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`);
        }
    }
};

const ensureSqliteSchema = async (db) => {
    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS site (
            id INTEGER PRIMARY KEY,
            name TEXT,
            subtitle TEXT
        )`
    );

    await ensureSqliteColumns(db, 'site', [{ name: 'ads_json', type: 'TEXT' }]);

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS sections (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            order_num INTEGER
        )`
    );

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS section_stats (
            section_id TEXT,
            label TEXT,
            value TEXT
        )`
    );

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            section_id TEXT,
            label TEXT,
            description TEXT,
            order_num INTEGER
        )`
    );

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS group_entries (
            group_id TEXT,
            entry_id TEXT
        )`
    );

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            section TEXT,
            group_id TEXT,
            title TEXT,
            summary TEXT,
            eyebrow TEXT,
            intro TEXT,
            checklist TEXT,
            steps TEXT,
            rewards TEXT,
            tips TEXT,
            related TEXT
        )`
    );

    await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS article_meta (
            article_id TEXT,
            label TEXT,
            value TEXT
        )`
    );

    await ensureSqliteColumns(db, 'sections', [
        { name: 'landing_layout', type: 'TEXT' },
        { name: 'landing_blocks', type: 'TEXT' },
        { name: 'landing_sidebar_facts', type: 'TEXT' },
        { name: 'catalog_columns', type: 'TEXT' },
        { name: 'catalog_rows', type: 'TEXT' },
    ]);

    await ensureSqliteColumns(db, 'articles', [
        { name: 'order_num', type: 'INTEGER DEFAULT 9999' },
        { name: 'layout', type: 'TEXT' },
        { name: 'sidebar_facts', type: 'TEXT' },
        { name: 'source_json', type: 'TEXT' },
        { name: 'aliases', type: 'TEXT' },
        { name: 'blocks', type: 'TEXT' },
    ]);
};

const toSqliteGroupId = (sectionId, groupId) => `${sectionId}::${groupId}`;

const syncCanonicalToSqliteUnsafe = async (db, database) => {
    if (!db) {
        return null;
    }

    const normalized = normalizeDatabase(database);

    await ensureSqliteSchema(db);
    await runSql(db, 'BEGIN TRANSACTION');

    try {
        await runSql(db, 'DELETE FROM article_meta');
        await runSql(db, 'DELETE FROM articles');
        await runSql(db, 'DELETE FROM group_entries');
        await runSql(db, 'DELETE FROM groups');
        await runSql(db, 'DELETE FROM section_stats');
        await runSql(db, 'DELETE FROM sections');
        await runSql(db, 'DELETE FROM site');

        await runSql(db, `INSERT INTO site (id, name, subtitle, ads_json) VALUES (1, ?, ?, ?)`, [
            normalized.site.name,
            normalized.site.subtitle,
            JSON.stringify(normalized.site.ads || {}),
        ]);

        for (const section of Object.values(normalized.sections)) {
            await runSql(
                db,
                `INSERT INTO sections (
                    id,
                    title,
                    description,
                    order_num,
                    landing_layout,
                    landing_blocks,
                    landing_sidebar_facts,
                    catalog_columns,
                    catalog_rows
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    section.id,
                    section.title,
                    section.description,
                    section.order,
                    section.landingLayout || '',
                    JSON.stringify(section.landingBlocks || []),
                    JSON.stringify(section.landingSidebarFacts || []),
                    JSON.stringify(section.catalogColumns || []),
                    JSON.stringify(section.catalogRows || []),
                ]
            );

            for (const stat of section.stats || []) {
                await runSql(db, `INSERT INTO section_stats (section_id, label, value) VALUES (?, ?, ?)`, [
                    section.id,
                    stat.label,
                    stat.value,
                ]);
            }

            for (const group of section.groups || []) {
                const sqliteGroupId = toSqliteGroupId(section.id, group.id);
                await runSql(db, `INSERT INTO groups (id, section_id, label, description, order_num) VALUES (?, ?, ?, ?, ?)`, [
                    sqliteGroupId,
                    section.id,
                    group.label,
                    group.description,
                    group.order,
                ]);

                for (const entryId of group.entries || []) {
                    await runSql(db, `INSERT INTO group_entries (group_id, entry_id) VALUES (?, ?)`, [sqliteGroupId, entryId]);
                }
            }
        }

        for (const article of Object.values(normalized.articles)) {
            await runSql(
                db,
                `INSERT INTO articles (
                    id,
                    section,
                    group_id,
                    title,
                    summary,
                    eyebrow,
                    intro,
                    checklist,
                    steps,
                    rewards,
                    tips,
                    related,
                    order_num,
                    layout,
                    sidebar_facts,
                    source_json,
                    aliases,
                    blocks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    article.id,
                    article.section,
                    toSqliteGroupId(article.section, article.group),
                    article.title,
                    article.summary,
                    article.eyebrow,
                    JSON.stringify(article.intro || []),
                    JSON.stringify(article.checklist || []),
                    JSON.stringify(article.steps || []),
                    JSON.stringify(article.rewards || []),
                    JSON.stringify(article.tips || []),
                    JSON.stringify(article.related || []),
                    article.order,
                    article.layout || '',
                    JSON.stringify(article.sidebarFacts || []),
                    JSON.stringify(article.source || {}),
                    JSON.stringify(article.aliases || []),
                    JSON.stringify(article.blocks || []),
                ]
            );

            for (const meta of article.meta || []) {
                await runSql(db, `INSERT INTO article_meta (article_id, label, value) VALUES (?, ?, ?)`, [
                    article.id,
                    meta.label,
                    meta.value,
                ]);
            }
        }

        await runSql(db, 'COMMIT');
        return null;
    } catch (error) {
        await runSql(db, 'ROLLBACK');
        throw error;
    }
};

let sqliteSyncQueue = Promise.resolve();

const syncCanonicalToSqlite = (db, database) => {
    if (!db) {
        return Promise.resolve(null);
    }

    const run = () => syncCanonicalToSqliteUnsafe(db, database);

    sqliteSyncQueue = sqliteSyncQueue.then(run, run);

    return sqliteSyncQueue;
};

const publishCanonical = async (db, database, reason = 'publish') => {
    ensureCanonicalFile();

    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
        version: 2,
    });

    writeJsonAtomic(CANONICAL_PATH, normalized);
    writeCanonicalMeta(normalized);
    const backupPath = writeBackup(normalized, reason);
    writeStaticData(normalized, reason);

    // Invalidate cache after writing to disk
    invalidateCache();

    await syncCanonicalToSqlite(db, normalized);

    return {
        database: normalized,
        canonicalPath: CANONICAL_PATH,
        backupPath,
        staticDataPath: STATIC_DATA_PATH,
    };
};

module.exports = {
    BACKUP_DIR,
    CANONICAL_PATH,
    CANONICAL_META_PATH,
    RAW_DIR,
    STATIC_DATA_PATH,
    ensureCanonicalFile,
    ensureSqliteSchema,
    ensureStorageDirs,
    invalidateCache,
    listBackups,
    publishCanonical,
    readCanonical,
    readCanonicalMeta,
    readJsonFile,
    syncCanonicalToSqlite,
    writeBackup,
    writeCanonicalMeta,
    writeStaticData,
};
