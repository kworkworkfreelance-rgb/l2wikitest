#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const stripWrappingQuotes = (value) => {
    const trimmed = String(value || '').trim();

    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
};

const initialEnvKeys = new Set(Object.keys(process.env));
const loadedEnvKeys = new Set();

const loadEnvFile = (filePath, options = {}) => {
    const overrideLoadedKeys = Boolean(options.overrideLoadedKeys);

    if (!fs.existsSync(filePath)) {
        return;
    }

    const source = fs.readFileSync(filePath, 'utf8');

    source.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const normalizedLine = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const separatorIndex = normalizedLine.indexOf('=');

        if (separatorIndex <= 0) {
            return;
        }

        const key = normalizedLine.slice(0, separatorIndex).trim();

        if (!key || initialEnvKeys.has(key) || (!overrideLoadedKeys && loadedEnvKeys.has(key))) {
            return;
        }

        process.env[key] = stripWrappingQuotes(normalizedLine.slice(separatorIndex + 1));
        loadedEnvKeys.add(key);
    });
};

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'), { overrideLoadedKeys: true });

const parseBooleanEnv = (value, fallback = false) => {
    if (value == null || String(value).trim() === '') {
        return fallback;
    }

    return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const { deepClone, normalizeArticle, normalizeDatabase, normalizeSection, normalizeSite, rebuildSectionEntries } = require('./lib/rich-content-schema');
const { ensureSqliteSchema, syncCanonicalToSqlite } = require('./lib/canonical-store');
const {
    AUTH_FILE_PATH,
    ensureAdminAuthFile,
    isAdminAuthManagedByEnv,
    readAdminAuth,
    updateAdminPassword,
    verifyAdminCredentials,
} = require('./lib/admin-auth-store');

const app = express();

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DEFAULT_STORAGE_DIR = process.env.RENDER && fs.existsSync('/var/data') ? '/var/data/l2wiki' : ROOT_DIR;
const STORAGE_DIR = process.env.L2WIKI_STORAGE_DIR ? path.resolve(process.env.L2WIKI_STORAGE_DIR) : DEFAULT_STORAGE_DIR;
const MUTABLE_ASSETS_DIR = path.join(STORAGE_DIR, 'assets', 'js');
const MUTABLE_DATA_DIR = path.join(STORAGE_DIR, 'data');
const BACKUP_DIR = path.join(MUTABLE_DATA_DIR, 'backups');
const CANONICAL_DIR = path.join(MUTABLE_DATA_DIR, 'canonical');
const PAGE_DATA_DIR = path.join(MUTABLE_DATA_DIR, 'page-data');
const PAGE_DATA_ARTICLES_DIR = path.join(PAGE_DATA_DIR, 'articles');
const PAGE_DATA_SECTIONS_DIR = path.join(PAGE_DATA_DIR, 'sections');
const PAGE_DATA_BASE_PATH = path.join(PAGE_DATA_DIR, 'public-base.json');
const PAGE_DATA_ARTICLE_SUMMARIES_PATH = path.join(PAGE_DATA_DIR, 'article-summaries.json');
const PAGE_DATA_SEARCH_INDEX_PATH = path.join(PAGE_DATA_DIR, 'search-index.json');
const ADMIN_BOOTSTRAP_PATH = path.join(MUTABLE_DATA_DIR, 'admin-bootstrap.json');
const STATIC_DATA_PATH = path.join(MUTABLE_ASSETS_DIR, 'static-data.js');
const APP_STATIC_DATA_PATH = path.join(ROOT_DIR, 'assets', 'js', 'static-data.js');
const STORAGE_CANONICAL_PATH = path.join(CANONICAL_DIR, 'l2wiki-canonical.json');
const STORAGE_CANONICAL_META_PATH = path.join(CANONICAL_DIR, 'l2wiki-meta.json');
const APP_CANONICAL_PATH = path.join(ROOT_DIR, 'data', 'canonical', 'l2wiki-canonical.json');
const APP_CANONICAL_META_PATH = path.join(ROOT_DIR, 'data', 'canonical', 'l2wiki-meta.json');
const APP_PAGE_DATA_DIR = path.join(ROOT_DIR, 'data', 'page-data');
const APP_PAGE_DATA_ARTICLES_DIR = path.join(APP_PAGE_DATA_DIR, 'articles');
const APP_PAGE_DATA_SECTIONS_DIR = path.join(APP_PAGE_DATA_DIR, 'sections');
const APP_PAGE_DATA_BASE_PATH = path.join(APP_PAGE_DATA_DIR, 'public-base.json');
const APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH = path.join(APP_PAGE_DATA_DIR, 'article-summaries.json');
const APP_PAGE_DATA_SEARCH_INDEX_PATH = path.join(APP_PAGE_DATA_DIR, 'search-index.json');
const APP_ADMIN_BOOTSTRAP_PATH = path.join(ROOT_DIR, 'data', 'admin-bootstrap.json');
const LEGACY_JSON_PATH = path.join(ROOT_DIR, 'l2wiki-db-2026-04-07.json');
const DB_PATH = path.join(STORAGE_DIR, 'l2wiki.db');

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_COOKIE_NAME = 'admin_token';
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';
const REQUEST_BODY_LIMIT = process.env.L2WIKI_REQUEST_BODY_LIMIT || '100mb';
const SQLITE_SYNC_ENABLED = parseBooleanEnv(process.env.L2WIKI_ENABLE_SQLITE_SYNC, false);
const STATIC_PUBLISH_ENABLED = parseBooleanEnv(process.env.L2WIKI_ENABLE_STATIC_PUBLISH, !process.env.RENDER);
const BACKUP_SNAPSHOTS_ENABLED = parseBooleanEnv(process.env.L2WIKI_ENABLE_BACKUPS, !process.env.RENDER);
const ARTIFACT_MUTATIONS_ENABLED = parseBooleanEnv(process.env.L2WIKI_MUTATE_ARTIFACTS, Boolean(process.env.RENDER));

const ADMIN_SESSIONS = new Map();

let mutationQueue = Promise.resolve();
let sqliteSyncQueue = Promise.resolve();

const createEmptyDatabase = () =>
    normalizeDatabase({
        version: 2,
        updatedAt: new Date().toISOString(),
        site: {
            name: 'L2Wiki.Su',
            subtitle: 'Р‘Р°Р·Р° Р·РЅР°РЅРёР№ РїРѕ Lineage II',
        },
        sections: {},
        articles: {},
    });

const ensureDir = (targetPath) => {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
};

const copyDirIfExists = (sourceDir, targetDir) => {
    if (!fs.existsSync(sourceDir)) {
        return;
    }

    ensureDir(path.dirname(targetDir));
    fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
};

const ensureMutableStorage = () => {
    [STORAGE_DIR, MUTABLE_ASSETS_DIR, MUTABLE_DATA_DIR, BACKUP_DIR, CANONICAL_DIR, PAGE_DATA_DIR, PAGE_DATA_ARTICLES_DIR, PAGE_DATA_SECTIONS_DIR].forEach(
        ensureDir
    );

    if (STATIC_PUBLISH_ENABLED && STATIC_DATA_PATH !== APP_STATIC_DATA_PATH && !fs.existsSync(STATIC_DATA_PATH) && fs.existsSync(APP_STATIC_DATA_PATH)) {
        fs.copyFileSync(APP_STATIC_DATA_PATH, STATIC_DATA_PATH);
    }
};

const buildStaticDataSource = (serializedDatabase, database, sourceLabel = 'server-publish') =>
    `window.L2WIKI_SEED_DATA=${serializedDatabase};window.L2WIKI_SEED_SOURCE=${JSON.stringify({
        source: sourceLabel,
        generatedAt: new Date().toISOString(),
        articles: Object.keys(database.articles || {}).length,
        sections: Object.keys(database.sections || {}).length,
    })};`;

const writeFileAtomic = (targetPath, contents) => {
    ensureDir(path.dirname(targetPath));
    const tempPath = `${targetPath}.tmp`;
    fs.writeFileSync(tempPath, contents, 'utf8');
    fs.renameSync(tempPath, targetPath);
    return targetPath;
};

const writeChunk = (stream, chunk) =>
    new Promise((resolve, reject) => {
        if (!stream.write(chunk, 'utf8')) {
            stream.once('drain', resolve);
            return;
        }

        resolve();
    });

const writeDatabaseJsonFile = async (targetPath, database) => {
    ensureDir(path.dirname(targetPath));
    const tempPath = `${targetPath}.tmp`;

    await new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(tempPath, { encoding: 'utf8' });

        stream.on('error', reject);
        stream.on('finish', resolve);

        (async () => {
            await writeChunk(stream, '{');
            await writeChunk(stream, `"version":${JSON.stringify(database.version || 2)},`);
            await writeChunk(stream, `"updatedAt":${JSON.stringify(database.updatedAt || new Date().toISOString())},`);
            await writeChunk(stream, `"site":${JSON.stringify(database.site || {})},`);
            await writeChunk(stream, '"sections":{');

            let isFirst = true;
            for (const [sectionId, section] of Object.entries(database.sections || {})) {
                await writeChunk(stream, `${isFirst ? '' : ','}${JSON.stringify(sectionId)}:${JSON.stringify(section)}`);
                isFirst = false;
            }

            await writeChunk(stream, '},');
            await writeChunk(stream, '"articles":{');

            isFirst = true;
            for (const [articleId, article] of Object.entries(database.articles || {})) {
                await writeChunk(stream, `${isFirst ? '' : ','}${JSON.stringify(articleId)}:${JSON.stringify(article)}`);
                isFirst = false;
            }

            await writeChunk(stream, '}}');
            stream.end();
        })().catch((error) => {
            stream.destroy(error);
        });
    });

    fs.renameSync(tempPath, targetPath);
    return targetPath;
};

const writeStaticDataFile = (serializedDatabase, database, sourceLabel = 'server-publish') =>
    writeFileAtomic(STATIC_DATA_PATH, buildStaticDataSource(serializedDatabase, database, sourceLabel));

const writeBackupSnapshot = (sourceFilePath, reason = 'publish') => {
    ensureDir(BACKUP_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = String(reason || 'publish').replace(/[^a-z0-9_-]+/gi, '-');
    const fileName = `${stamp}-${safeReason}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.copyFileSync(sourceFilePath, filePath);
    return {
        fileName,
        filePath,
    };
};

const writeCanonicalJsonFile = (database) => writeDatabaseJsonFile(STORAGE_CANONICAL_PATH, database);

const writeCanonicalMetaFile = (database) => writeFileAtomic(STORAGE_CANONICAL_META_PATH, JSON.stringify(buildMeta(database)));

const listBackupSnapshots = () => {
    ensureDir(BACKUP_DIR);

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
                size: stats.size,
                updatedAt: stats.mtime.toISOString(),
            };
        });
};

const readFilePrefix = (filePath, maxBytes = 256) => {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
        return buffer.slice(0, bytesRead).toString('utf8');
    } finally {
        fs.closeSync(fd);
    }
};

const isGitLfsPointerFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    try {
        return readFilePrefix(filePath).startsWith(LFS_POINTER_PREFIX);
    } catch {
        return false;
    }
};

const extractSeedDataFromInlineScript = (source) => {
    const prefix = 'window.L2WIKI_SEED_DATA=';
    const suffix = ';window.L2WIKI_SEED_SOURCE=';
    const startIndex = source.indexOf(prefix);

    if (startIndex === -1) {
        return null;
    }

    const endIndex = source.indexOf(suffix, startIndex + prefix.length);
    const jsonText = source.slice(startIndex + prefix.length, endIndex === -1 ? undefined : endIndex).trim();

    if (!jsonText) {
        return null;
    }

    return JSON.parse(jsonText);
};

const extractSeedDataFromChunkLoader = (source, filePath) => {
    const matches = Array.from(source.matchAll(/static-data-chunk-\d+\.js/g));

    if (!matches.length) {
        return null;
    }

    const chunkNames = Array.from(new Set(matches.map((match) => match[0])));
    const chunkDir = path.dirname(filePath);
    const base64 = chunkNames
        .map((chunkName) => {
            const chunkPath = path.join(chunkDir, chunkName);

            if (!fs.existsSync(chunkPath)) {
                throw new Error(`Missing chunk file: ${chunkName}`);
            }

            const chunkSource = fs.readFileSync(chunkPath, 'utf8');
            const chunkMatch = chunkSource.match(/window\.__L2WIKI_CHUNKS\.push\("([A-Za-z0-9+/=]+)"\);/);

            if (!chunkMatch) {
                throw new Error(`Could not parse chunk payload: ${chunkName}`);
            }

            return chunkMatch[1];
        })
        .join('');

    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
};

const resolveCanonicalJsonPath = () =>
    [STORAGE_CANONICAL_PATH, APP_CANONICAL_PATH].find((filePath) => fs.existsSync(filePath) && !isGitLfsPointerFile(filePath)) || null;

const resolveCanonicalMetaPath = () =>
    [STORAGE_CANONICAL_META_PATH, APP_CANONICAL_META_PATH].find((filePath) => fs.existsSync(filePath) && !isGitLfsPointerFile(filePath)) || null;

const prepareLoadedDatabase = (raw) => {
    const database = raw && typeof raw === 'object' ? raw : createEmptyDatabase();

    database.version = Number(database.version) || 2;
    database.updatedAt = database.updatedAt || new Date().toISOString();
    database.site = normalizeSite(database.site);
    database.sections = database.sections && typeof database.sections === 'object' ? database.sections : {};
    database.articles = database.articles && typeof database.articles === 'object' ? database.articles : {};

    return database;
};

const loadJsonCandidate = (filePath, label, options = {}) => {
    const shouldNormalize = Boolean(options.normalize);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        if (isGitLfsPointerFile(filePath)) {
            return null;
        }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        return {
            label,
            data: prepareLoadedDatabase(shouldNormalize ? normalizeDatabase(raw) : raw),
        };
    } catch (error) {
        console.warn(`[boot] Failed to parse ${label}: ${error.message}`);
        return null;
    }
};

const loadStaticSeedCandidate = (filePath, label, options = {}) => {
    const shouldNormalize = Boolean(options.normalize);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const source = fs.readFileSync(filePath, 'utf8');
        const parsedDatabase =
            extractSeedDataFromInlineScript(source) || extractSeedDataFromChunkLoader(source, filePath);

        if (!parsedDatabase) {
            return null;
        }

        return {
            label,
            data: prepareLoadedDatabase(shouldNormalize ? normalizeDatabase(parsedDatabase) : parsedDatabase),
        };
    } catch (error) {
        console.warn(`[boot] Failed to evaluate ${label}: ${error.message}`);
        return null;
    }
};

const getCanonicalTimestamp = (metaPath, canonicalPath) => {
    if (metaPath && fs.existsSync(metaPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const timestamp = Date.parse(meta?.updatedAt || '');

            if (Number.isFinite(timestamp)) {
                return timestamp;
            }
        } catch (error) {
            console.warn(`[boot] Failed to parse meta timestamp from ${metaPath}: ${error.message}`);
        }
    }

    if (canonicalPath && fs.existsSync(canonicalPath)) {
        try {
            return fs.statSync(canonicalPath).mtimeMs;
        } catch {}
    }

    return 0;
};

const syncAppCanonicalToStorageIfNewer = () => {
    if (!fs.existsSync(APP_CANONICAL_PATH) || isGitLfsPointerFile(APP_CANONICAL_PATH)) {
        return;
    }

    const appTimestamp = getCanonicalTimestamp(APP_CANONICAL_META_PATH, APP_CANONICAL_PATH);
    const storageTimestamp = getCanonicalTimestamp(STORAGE_CANONICAL_META_PATH, STORAGE_CANONICAL_PATH);
    const shouldSync = !fs.existsSync(STORAGE_CANONICAL_PATH) || appTimestamp > storageTimestamp;

    if (!shouldSync) {
        return;
    }

    ensureDir(path.dirname(STORAGE_CANONICAL_PATH));
    fs.copyFileSync(APP_CANONICAL_PATH, STORAGE_CANONICAL_PATH);

    if (fs.existsSync(APP_CANONICAL_META_PATH)) {
        fs.copyFileSync(APP_CANONICAL_META_PATH, STORAGE_CANONICAL_META_PATH);
    } else {
        writeFileAtomic(STORAGE_CANONICAL_META_PATH, JSON.stringify(buildMeta(loadJsonCandidate(APP_CANONICAL_PATH, 'app canonical copy')?.data || createEmptyDatabase())));
    }

    fs.rmSync(PAGE_DATA_DIR, { recursive: true, force: true });
    copyDirIfExists(APP_PAGE_DATA_DIR, PAGE_DATA_DIR);

    if (fs.existsSync(APP_ADMIN_BOOTSTRAP_PATH)) {
        fs.copyFileSync(APP_ADMIN_BOOTSTRAP_PATH, ADMIN_BOOTSTRAP_PATH);
    }

    if (STATIC_PUBLISH_ENABLED && fs.existsSync(APP_STATIC_DATA_PATH)) {
        ensureDir(path.dirname(STATIC_DATA_PATH));
        fs.copyFileSync(APP_STATIC_DATA_PATH, STATIC_DATA_PATH);
    }

    console.log(
        `[boot] Synced app canonical into storage because app data is newer (${new Date(appTimestamp).toISOString()} > ${
            storageTimestamp ? new Date(storageTimestamp).toISOString() : 'missing storage snapshot'
        })`
    );
};

const loadDatabaseFromDisk = () => {
    syncAppCanonicalToStorageIfNewer();

    const loaders = [
        () => loadJsonCandidate(STORAGE_CANONICAL_PATH, 'storage canonical'),
        () => loadJsonCandidate(APP_CANONICAL_PATH, 'app canonical'),
        () => loadStaticSeedCandidate(STATIC_DATA_PATH, 'storage static-data'),
        () => loadStaticSeedCandidate(APP_STATIC_DATA_PATH, 'app static-data'),
        () => loadJsonCandidate(LEGACY_JSON_PATH, 'legacy json', { normalize: true }),
    ];

    for (const loadCandidate of loaders) {
        const candidate = loadCandidate();

        if (candidate) {
            return candidate;
        }
    }

    return {
        label: 'empty database',
        data: createEmptyDatabase(),
    };
};

const buildMeta = (database) => {
    const site = normalizeSite(database?.site);

    return {
        version: Number(database?.version) || 2,
        updatedAt: database?.updatedAt || new Date().toISOString(),
        site: {
            name: site.name || '',
            subtitle: site.subtitle || '',
        },
        counts: {
            sections: Object.keys(database?.sections || {}).length,
            articles: Object.keys(database?.articles || {}).length,
        },
    };
};

const cloneDatabase = (database) => deepClone(database || {});
const prepareDatabaseForPublish = (database) => {
    const prepared = database && typeof database === 'object' ? database : createEmptyDatabase();

    prepared.version = 2;
    prepared.updatedAt = new Date().toISOString();
    prepared.site = normalizeSite(prepared.site);
    prepared.sections = prepared.sections && typeof prepared.sections === 'object' ? prepared.sections : {};
    prepared.articles = prepared.articles && typeof prepared.articles === 'object' ? prepared.articles : {};

    return rebuildSectionEntries(prepared);
};

const loadMetaFromDisk = () => {
    const metaPath = resolveCanonicalMetaPath();

    if (metaPath) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const site = normalizeSite(meta?.site || {});

            return {
                version: Number(meta?.version) || 2,
                updatedAt: meta?.updatedAt || new Date().toISOString(),
                site: {
                    name: site.name,
                    subtitle: site.subtitle,
                },
                counts: {
                    sections: Number(meta?.counts?.sections) || 0,
                    articles: Number(meta?.counts?.articles) || 0,
                },
            };
        } catch (error) {
            console.warn(`[boot] Failed to parse canonical meta: ${error.message}`);
        }
    }

    const canonicalPath = resolveCanonicalJsonPath();

    if (canonicalPath) {
        try {
            const stats = fs.statSync(canonicalPath);
            return {
                version: 2,
                updatedAt: stats.mtime.toISOString(),
                site: {
                    name: 'L2Wiki.Su',
                    subtitle: '',
                },
                counts: {
                    sections: 0,
                    articles: 0,
                },
            };
        } catch {}
    }

    return buildMeta(createEmptyDatabase());
};

const getLiveMeta = () => app.locals.databaseMeta || buildMeta(app.locals.database || createEmptyDatabase());
const getDatabaseSnapshot = () => {
    if (app.locals.database) {
        return cloneDatabase(app.locals.database);
    }

    return loadDatabaseFromDisk().data;
};
const getWritableDatabase = () => getDatabaseSnapshot();

const sortByOrder = (left, right) => {
    const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : 9999;
    const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : 9999;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return String(left?.title || left?.label || left?.id || '').localeCompare(
        String(right?.title || right?.label || right?.id || ''),
        'ru'
    );
};

const enqueueSqliteSync = (database, reason = 'sync') => {
    if (!SQLITE_SYNC_ENABLED || !app.locals.db) {
        return Promise.resolve(null);
    }

    const run = async () => syncCanonicalToSqlite(app.locals.db, database);

    const task = sqliteSyncQueue.then(run, async (error) => {
        console.error(`[sqlite] Previous sync failed before "${reason}":`, error);
        return run();
    });

    sqliteSyncQueue = task.then(
        () => undefined,
        (error) => {
            console.error(`[sqlite] Sync failed for "${reason}":`, error);
            return undefined;
        }
    );

    return task;
};

const publishDatabase = async (database, reason = 'publish') => {
    const normalized = prepareDatabaseForPublish(database);

    await writeCanonicalJsonFile(normalized);
    writeCanonicalMetaFile(normalized);
    writeRuntimeArtifacts(normalized);

    if (STATIC_PUBLISH_ENABLED) {
        const serializedDatabase = fs.readFileSync(STORAGE_CANONICAL_PATH, 'utf8');
        writeStaticDataFile(serializedDatabase, normalized, reason);
    }

    if (BACKUP_SNAPSHOTS_ENABLED) {
        writeBackupSnapshot(STORAGE_CANONICAL_PATH, reason);
    }

    app.locals.database = null;
    app.locals.databaseMeta = buildMeta(normalized);
    invalidateArtifactCache();
    enqueueSqliteSync(normalized, reason);

    return normalized;
};

const queueDatabaseMutation = (reason, mutator) => {
    const run = async () => {
        const draft = getWritableDatabase();
        const nextDatabase = await mutator(draft);
        return publishDatabase(nextDatabase, reason);
    };

    const task = mutationQueue.then(run, async (error) => {
        console.error(`[publish] Previous mutation failed before "${reason}":`, error);
        return run();
    });

    mutationQueue = task.then(
        () => undefined,
        () => undefined
    );

    return task;
};

const getAdminSessionPayload = (session) => ({
    ok: true,
    authenticated: Boolean(session),
    username: session?.username,
    passwordManagedByEnv: isAdminAuthManagedByEnv(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD),
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const createAdminSession = (username) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    ADMIN_SESSIONS.set(token, { username, expiresAt });
    return token;
};

const pruneAdminSessions = () => {
    const now = Date.now();

    for (const [token, session] of ADMIN_SESSIONS.entries()) {
        if (!session || session.expiresAt <= now) {
            ADMIN_SESSIONS.delete(token);
        }
    }
};

const getAdminToken = (req) => req.cookies?.[ADMIN_COOKIE_NAME] || req.headers['x-admin-token'];

const getAdminSession = (req) => {
    pruneAdminSessions();
    const token = getAdminToken(req);
    return token ? ADMIN_SESSIONS.get(token) || null : null;
};

const setAdminCookie = (req, res, token, maxAgeSeconds = ADMIN_SESSION_TTL_MS / 1000) => {
    const isSecure = req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
    const parts = [`${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];

    if (isSecure) {
        parts.push('Secure');
    }

    res.setHeader('Set-Cookie', parts.join('; '));
};

const clearAdminCookie = (req, res) => {
    const isSecure = req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
    const parts = [`${ADMIN_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];

    if (isSecure) {
        parts.push('Secure');
    }

    res.setHeader('Set-Cookie', parts.join('; '));
};

const requireAdmin = (req, res, next) => {
    const session = getAdminSession(req);

    if (!session) {
        res.status(401).json({ error: 'Требуется авторизация' });
        return;
    }

    req.adminSession = session;
    next();
};

const sendNoStoreJson = (res, payload) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(payload);
};

const sendMutableFile = (res, filePath, contentType) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (contentType) {
        res.type(contentType);
    }

    res.sendFile(filePath);
};

const sendCanonicalDatabase = (res) => {
    const canonicalPath = resolveCanonicalJsonPath();

    if (!canonicalPath) {
        return false;
    }

    sendMutableFile(res, canonicalPath, 'application/json; charset=utf-8');
    return true;
};

const readJsonFileIfExists = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.warn(`[artifacts] Failed to parse ${filePath}: ${error.message}`);
        return null;
    }
};

const getArtifactCache = () => {
    if (!app.locals.artifactCache) {
        app.locals.artifactCache = {
            publicBase: null,
            articleSummaries: null,
            searchIndex: null,
            adminBootstrap: null,
            sections: new Map(),
        };
    }

    return app.locals.artifactCache;
};

const invalidateArtifactCache = () => {
    app.locals.artifactCache = {
        publicBase: null,
        articleSummaries: null,
        searchIndex: null,
        adminBootstrap: null,
        sections: new Map(),
    };
};

const loadPublicBaseArtifact = () => {
    const cache = getArtifactCache();

    if (!cache.publicBase) {
        cache.publicBase = readJsonFileIfExists(PAGE_DATA_BASE_PATH) || readJsonFileIfExists(APP_PAGE_DATA_BASE_PATH);
    }

    return cache.publicBase;
};

const loadArticleSummariesArtifact = () => {
    const cache = getArtifactCache();

    if (!cache.articleSummaries) {
        cache.articleSummaries = readJsonFileIfExists(PAGE_DATA_ARTICLE_SUMMARIES_PATH) || readJsonFileIfExists(APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH);
    }

    return cache.articleSummaries;
};

const loadSearchIndexArtifact = () => {
    const cache = getArtifactCache();

    if (!cache.searchIndex) {
        cache.searchIndex = readJsonFileIfExists(PAGE_DATA_SEARCH_INDEX_PATH) || readJsonFileIfExists(APP_PAGE_DATA_SEARCH_INDEX_PATH);
    }

    return cache.searchIndex;
};

const loadAdminBootstrapArtifact = () => {
    const cache = getArtifactCache();

    if (!cache.adminBootstrap) {
        cache.adminBootstrap = readJsonFileIfExists(ADMIN_BOOTSTRAP_PATH) || readJsonFileIfExists(APP_ADMIN_BOOTSTRAP_PATH);
    }

    return cache.adminBootstrap;
};

const loadSectionArtifact = (sectionId) => {
    const normalizedId = String(sectionId || '').trim();

    if (!normalizedId) {
        return null;
    }

    const cache = getArtifactCache();

    if (!cache.sections.has(normalizedId)) {
        const sectionPath = path.join(PAGE_DATA_SECTIONS_DIR, `${normalizedId}.json`);
        const appSectionPath = path.join(APP_PAGE_DATA_SECTIONS_DIR, `${normalizedId}.json`);
        cache.sections.set(normalizedId, readJsonFileIfExists(sectionPath) || readJsonFileIfExists(appSectionPath) || null);
    }

    return cache.sections.get(normalizedId) || null;
};

const loadArticleArtifact = (articleId) => {
    const normalizedId = String(articleId || '').trim();

    if (!normalizedId) {
        return null;
    }

    return (
        readJsonFileIfExists(path.join(PAGE_DATA_ARTICLES_DIR, `${normalizedId}.json`)) ||
        readJsonFileIfExists(path.join(APP_PAGE_DATA_ARTICLES_DIR, `${normalizedId}.json`))
    );
};

const normalizeSearchText = (value = '') =>
    String(value)
        .toLowerCase()
        .replaceAll('ё', 'е')
        .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
        .trim();

const stripHtmlTags = (value = '') => String(value || '').replace(/<[^>]+>/g, ' ');

const getSectionById = (database, sectionId) => database?.sections?.[sectionId] || null;
const getArticleById = (database, articleId) => database?.articles?.[articleId] || null;
const getSectionGroupById = (section, groupId = '') =>
    Array.isArray(section?.groups) ? section.groups.find((group) => group?.id === groupId) || null : null;
const LEGACY_GROUP_ALIASES = {
    quests: {
        epic: 'epic-bosses',
        'profession-4': 'alternative-profession',
        profession4: 'alternative-profession',
        'fourth-profession': 'alternative-profession',
    },
};

const normalizeServerGroupId = (section, groupId = '') => {
    if (!section || !groupId) {
        return groupId;
    }

    return LEGACY_GROUP_ALIASES[section.id]?.[groupId] || groupId;
};

const buildServerVirtualGroup = (section, groupId = '') => {
    if (section?.id !== 'quests' || groupId !== 'profession') {
        return null;
    }

    const professionGroups = (section.groups || []).filter(
        (group) => /^profession-\d+$/.test(group.id) || group.id === 'alternative-profession'
    );

    if (!professionGroups.length) {
        return null;
    }

    return {
        id: 'profession',
        label: 'На профессию',
        description: 'Квесты и цепочки для всех смен профессии.',
        entries: professionGroups.flatMap((group) => group.entries || []),
    };
};

const resolveServerGroup = (section, groupId = '') => {
    const normalizedGroupId = normalizeServerGroupId(section, groupId);
    return buildServerVirtualGroup(section, normalizedGroupId) || getSectionGroupById(section, normalizedGroupId);
};

const getServerGroupLeadArticleId = (database, section, group) => {
    if (!group) {
        return '';
    }

    if (group.landingArticleId && getArticleById(database, group.landingArticleId)) {
        return group.landingArticleId;
    }

    return (
        (group.entries || []).find((articleId) => {
            const article = getArticleById(database, articleId);
            return article && (!section || article.section === section.id);
        }) || ''
    );
};

const HOME_FEATURED_ARTICLE_IDS = ['class-tree', 'catacombs-necropolis', 'mammon-services', 'spoiler-guide'];

const createPublicGroupSummary = (database, section, group = {}) => ({
    id: group.id || '',
    label: group.label || '',
    description: group.description || '',
    order: Number.isFinite(Number(group.order)) ? Number(group.order) : 9999,
    entries: [getServerGroupLeadArticleId(database, section, group)].filter(Boolean),
    landingArticleId: group.landingArticleId || '',
    iconSrc: group.iconSrc || '',
    iconAlt: group.iconAlt || '',
});

const createPublicSectionSummary = (database, section = {}) => ({
    id: section.id || '',
    title: section.title || '',
    description: section.description || '',
    order: Number.isFinite(Number(section.order)) ? Number(section.order) : 9999,
    groups: Array.isArray(section.groups) ? section.groups.map((group) => createPublicGroupSummary(database, section, group)) : [],
});

const createPublicDatabaseBase = (database, options = {}) => {
    const fullSectionIds = new Set(Array.isArray(options.fullSectionIds) ? options.fullSectionIds.filter(Boolean) : []);
    const sections = {};

    Object.values(database?.sections || {}).forEach((section) => {
        sections[section.id] = fullSectionIds.has(section.id) ? deepClone(section) : createPublicSectionSummary(database, section);
    });

    return {
        version: Number(database?.version) || 2,
        updatedAt: database?.updatedAt || new Date().toISOString(),
        site: deepClone(database?.site || {}),
        sections,
        articles: {},
    };
};

const addArticleToPublicDatabase = (target, database, articleId) => {
    if (!articleId || target.articles[articleId] || !getArticleById(database, articleId)) {
        return;
    }

    target.articles[articleId] = deepClone(database.articles[articleId]);
};

const addNavigationLeadArticles = (target, database) => {
    Object.values(database?.sections || {}).forEach((section) => {
        (section.groups || []).forEach((group) => {
            addArticleToPublicDatabase(target, database, getServerGroupLeadArticleId(database, section, group));
        });
    });
};

const collectQuestGuideEntryText = (entries = []) =>
    (Array.isArray(entries) ? entries : [])
        .map((entry) =>
            [
                entry?.text,
                stripHtmlTags(entry?.html),
                entry?.iconAlt,
                entry?.location,
                entry?.npc,
                entry?.rewardPreview,
                collectQuestGuideEntryText(entry?.substeps || []),
            ]
                .filter(Boolean)
                .join(' ')
        )
        .join(' ');

const collectSearchTextFromBlock = (block = {}) => {
    if (!block || typeof block !== 'object') {
        return '';
    }

    if (block.type === 'prose') {
        return [block.title, ...(block.paragraphs || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'list' || block.type === 'steps') {
        return [block.title, ...(block.items || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'callout') {
        return [block.title, block.text, ...(block.items || [])].filter(Boolean).join(' ');
    }

    if (block.type === 'table') {
        const columns = (block.columns || []).map((column) => column?.label).filter(Boolean);
        const rows = (block.rows || []).flatMap((row) => [
            row?.title,
            ...(row?.meta || []).flatMap((item) => [item?.label, item?.value]),
            ...(row?.cells || []).flatMap((cell) => [cell?.value, stripHtmlTags(cell?.html)]),
        ]);

        return [block.title, ...columns, ...rows].filter(Boolean).join(' ');
    }

    if (block.type === 'media') {
        return [block.title, ...(block.items || []).flatMap((item) => [item?.alt, item?.caption])].filter(Boolean).join(' ');
    }

    if (block.type === 'html') {
        return [block.title, stripHtmlTags(block.html)].filter(Boolean).join(' ');
    }

    if (block.type === 'questGuide') {
        return [
            ...(block.overviewParagraphs || []),
            collectQuestGuideEntryText(block.prepItems || []),
            collectQuestGuideEntryText(block.steps || []),
            collectQuestGuideEntryText(block.rewards || []),
        ]
            .filter(Boolean)
            .join(' ');
    }

    return block.title || '';
};

const buildArticleSearchRecord = (database, article) => {
    const section = getSectionById(database, article?.section);
    const group = getSectionGroupById(section, article?.group);

    return {
        id: article.id,
        type: 'article',
        title: article.title || '',
        summary: article.summary || '',
        section: article.section || '',
        sectionTitle: section?.title || '',
        group: article.group || '',
        groupTitle: group?.label || '',
        previewImage: article.heroImage || '',
        searchableText: [
            article.title,
            article.summary,
            article.eyebrow,
            ...(article.aliases || []),
            ...(article.intro || []),
            ...(article.meta || []).flatMap((item) => [item?.label, item?.value]),
            ...(article.sidebarFacts || []).flatMap((item) => [item?.label, item?.value]),
            ...(article.blocks || []).map(collectSearchTextFromBlock),
        ]
            .filter(Boolean)
            .join(' '),
    };
};

const buildSectionSearchRecord = (section) => ({
    id: section.id,
    type: 'section',
    title: section.title || '',
    summary: section.description || '',
    section: section.id,
    sectionTitle: section.title || '',
    previewImage: (section.groups || []).find((group) => group?.iconSrc)?.iconSrc || '',
    searchableText: [
        section.title,
        section.description,
        ...(section.stats || []).flatMap((item) => [item?.label, item?.value]),
        ...(section.groups || []).flatMap((group) => [group?.label, group?.description]),
    ]
        .filter(Boolean)
        .join(' '),
});

const buildPublicArticleSummary = (article = {}) => ({
    id: article.id || '',
    section: article.section || '',
    group: article.group || '',
    title: article.title || '',
    summary: article.summary || '',
    eyebrow: article.eyebrow || '',
    order: Number.isFinite(Number(article.order)) ? Number(article.order) : 9999,
    layout: article.layout || '',
    heroImage: article.heroImage || '',
    meta: deepClone(article.meta || []),
    sidebarFacts: deepClone(article.sidebarFacts || []),
    aliases: deepClone(article.aliases || []),
    related: deepClone(article.related || []),
    source: deepClone(article.source || {}),
});

const buildSearchIndex = (database) => [
    ...Object.values(database?.sections || {}).map(buildSectionSearchRecord),
    ...Object.values(database?.articles || {}).map((article) => buildArticleSearchRecord(database, article)),
];

const buildAdminBootstrapPayload = (database) => {
    const articles = {};
    const articleSummaryIds = [];

    Object.values(database?.articles || {})
        .sort(sortByOrder)
        .forEach((article) => {
            if (!article?.id) {
                return;
            }

            if (article.id === 'contacts') {
                articles[article.id] = deepClone(article);
                return;
            }

            articles[article.id] = buildPublicArticleSummary(article);
            articleSummaryIds.push(article.id);
        });

    return {
        ok: true,
        updatedAt: database?.updatedAt || new Date().toISOString(),
        articleSummaryIds,
        database: {
            version: Number(database?.version) || 2,
            updatedAt: database?.updatedAt || new Date().toISOString(),
            site: deepClone(database?.site || {}),
            sections: deepClone(database?.sections || {}),
            articles,
        },
    };
};

const writeSharedRuntimeArtifacts = (database) => {
    const normalized = database && typeof database === 'object' ? database : createEmptyDatabase();
    const publicBase = createPublicDatabaseBase(normalized);
    const articleSummaries = Object.fromEntries(
        Object.values(normalized.articles || {}).map((article) => [article.id, buildPublicArticleSummary(article)])
    );
    const searchIndex = buildSearchIndex(normalized);
    const adminBootstrap = buildAdminBootstrapPayload(normalized);

    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
    writeFileAtomic(PAGE_DATA_ARTICLE_SUMMARIES_PATH, JSON.stringify(articleSummaries));
    writeFileAtomic(PAGE_DATA_SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
};

const writeSectionArtifacts = (database, sectionIds = null) => {
    const normalized = database && typeof database === 'object' ? database : createEmptyDatabase();
    const targetIds = Array.isArray(sectionIds) ? Array.from(new Set(sectionIds.filter(Boolean))) : Object.keys(normalized.sections || {});

    ensureDir(PAGE_DATA_SECTIONS_DIR);

    for (const sectionId of targetIds) {
        const sectionPath = path.join(PAGE_DATA_SECTIONS_DIR, `${sectionId}.json`);
        const section = normalized.sections?.[sectionId];

        if (!section) {
            fs.rmSync(sectionPath, { force: true });
            continue;
        }

        writeFileAtomic(sectionPath, JSON.stringify(section));
    }
};

const writeArticleArtifacts = (database, articleIds = null) => {
    const normalized = database && typeof database === 'object' ? database : createEmptyDatabase();
    const targetIds = Array.isArray(articleIds) ? Array.from(new Set(articleIds.filter(Boolean))) : Object.keys(normalized.articles || {});

    ensureDir(PAGE_DATA_ARTICLES_DIR);

    for (const articleId of targetIds) {
        const articlePath = path.join(PAGE_DATA_ARTICLES_DIR, `${articleId}.json`);
        const article = normalized.articles?.[articleId];

        if (!article) {
            fs.rmSync(articlePath, { force: true });
            continue;
        }

        writeFileAtomic(articlePath, JSON.stringify(article));
    }
};

const writeRuntimeArtifacts = (database, reason = 'publish') => {
    const normalized = database && typeof database === 'object' ? database : createEmptyDatabase();
    writeSharedRuntimeArtifacts(normalized);

    if (/^(import|reset)$/.test(String(reason || '')) || !/^(article-|delete-article-|section-|delete-section-|site-settings$)/.test(String(reason || ''))) {
        fs.rmSync(PAGE_DATA_ARTICLES_DIR, { recursive: true, force: true });
        fs.rmSync(PAGE_DATA_SECTIONS_DIR, { recursive: true, force: true });
        writeSectionArtifacts(normalized);
        writeArticleArtifacts(normalized);
        return;
    }

    if (/^site-settings$/.test(reason)) {
        return;
    }

    if (/^(section-|delete-section-)/.test(reason)) {
        writeSectionArtifacts(normalized);
        return;
    }

    if (/^(article-|delete-article-)/.test(reason)) {
        const articleId = String(reason).replace(/^(article-|delete-article-)/, '');
        writeSectionArtifacts(normalized);
        writeArticleArtifacts(normalized, [articleId]);
    }
};

const loadWritableJsonArtifact = (storagePath, fallbackPath, label) => {
    const fromStorage = readJsonFileIfExists(storagePath);

    if (fromStorage) {
        return fromStorage;
    }

    const fromApp = readJsonFileIfExists(fallbackPath);

    if (fromApp) {
        writeFileAtomic(storagePath, JSON.stringify(fromApp));
        return fromApp;
    }

    console.warn(`[artifacts] Missing ${label || 'artifact'}: ${storagePath}`);
    return null;
};

const buildPublicSectionSummaryFromSection = (section = {}) => ({
    id: section.id || '',
    title: section.title || '',
    description: section.description || '',
    order: Number.isFinite(Number(section.order)) ? Number(section.order) : 9999,
    groups: (Array.isArray(section.groups) ? section.groups : []).map((group) => ({
        id: group?.id || '',
        label: group?.label || '',
        description: group?.description || '',
        order: Number.isFinite(Number(group?.order)) ? Number(group.order) : 9999,
        entries: [group?.landingArticleId || (group?.entries || [])[0] || ''].filter(Boolean),
        landingArticleId: group?.landingArticleId || '',
        iconSrc: group?.iconSrc || '',
        iconAlt: group?.iconAlt || '',
    })),
});

const upsertArticleIntoSharedArtifacts = (article) => {
    const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
    const articleSummaries = loadWritableJsonArtifact(
        PAGE_DATA_ARTICLE_SUMMARIES_PATH,
        APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH,
        'article-summaries'
    );
    const searchIndex = loadWritableJsonArtifact(PAGE_DATA_SEARCH_INDEX_PATH, APP_PAGE_DATA_SEARCH_INDEX_PATH, 'search-index');
    const adminBootstrap = loadWritableJsonArtifact(ADMIN_BOOTSTRAP_PATH, APP_ADMIN_BOOTSTRAP_PATH, 'admin-bootstrap');

    if (!publicBase || !articleSummaries || !searchIndex || !adminBootstrap) {
        return;
    }

    articleSummaries[article.id] = buildPublicArticleSummary(article);

    const searchRecord = buildArticleSearchRecord({ sections: publicBase.sections || {}, articles: {} }, article);
    const recordIndex = Array.isArray(searchIndex)
        ? searchIndex.findIndex((record) => record?.type === 'article' && record?.id === article.id)
        : -1;

    if (Array.isArray(searchIndex)) {
        if (recordIndex >= 0) {
            searchIndex[recordIndex] = searchRecord;
        } else {
            searchIndex.push(searchRecord);
        }
    }

    if (adminBootstrap?.database?.articles) {
        adminBootstrap.database.articles[article.id] = buildPublicArticleSummary(article);
        adminBootstrap.articleSummaryIds = Array.isArray(adminBootstrap.articleSummaryIds) ? adminBootstrap.articleSummaryIds : [];

        if (!adminBootstrap.articleSummaryIds.includes(article.id)) {
            adminBootstrap.articleSummaryIds.push(article.id);
        }
    }

    const updatedAt = new Date().toISOString();
    publicBase.updatedAt = updatedAt;
    adminBootstrap.updatedAt = updatedAt;
    if (adminBootstrap?.database) {
        adminBootstrap.database.updatedAt = updatedAt;
    }

    writeFileAtomic(PAGE_DATA_ARTICLE_SUMMARIES_PATH, JSON.stringify(articleSummaries));
    writeFileAtomic(PAGE_DATA_SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
};

const deleteArticleFromSharedArtifacts = (articleId) => {
    const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
    const articleSummaries = loadWritableJsonArtifact(
        PAGE_DATA_ARTICLE_SUMMARIES_PATH,
        APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH,
        'article-summaries'
    );
    const searchIndex = loadWritableJsonArtifact(PAGE_DATA_SEARCH_INDEX_PATH, APP_PAGE_DATA_SEARCH_INDEX_PATH, 'search-index');
    const adminBootstrap = loadWritableJsonArtifact(ADMIN_BOOTSTRAP_PATH, APP_ADMIN_BOOTSTRAP_PATH, 'admin-bootstrap');

    if (!publicBase || !articleSummaries || !searchIndex || !adminBootstrap) {
        return;
    }

    delete articleSummaries[articleId];

    if (Array.isArray(searchIndex)) {
        const next = searchIndex.filter((record) => !(record?.type === 'article' && record?.id === articleId));
        searchIndex.length = 0;
        next.forEach((item) => searchIndex.push(item));
    }

    if (adminBootstrap?.database?.articles) {
        delete adminBootstrap.database.articles[articleId];
        if (Array.isArray(adminBootstrap.articleSummaryIds)) {
            adminBootstrap.articleSummaryIds = adminBootstrap.articleSummaryIds.filter((id) => id !== articleId);
        }
    }

    const updatedAt = new Date().toISOString();
    publicBase.updatedAt = updatedAt;
    adminBootstrap.updatedAt = updatedAt;
    if (adminBootstrap?.database) {
        adminBootstrap.database.updatedAt = updatedAt;
    }

    writeFileAtomic(PAGE_DATA_ARTICLE_SUMMARIES_PATH, JSON.stringify(articleSummaries));
    writeFileAtomic(PAGE_DATA_SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
};

const upsertSectionIntoSharedArtifacts = (section) => {
    const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
    const searchIndex = loadWritableJsonArtifact(PAGE_DATA_SEARCH_INDEX_PATH, APP_PAGE_DATA_SEARCH_INDEX_PATH, 'search-index');
    const adminBootstrap = loadWritableJsonArtifact(ADMIN_BOOTSTRAP_PATH, APP_ADMIN_BOOTSTRAP_PATH, 'admin-bootstrap');

    if (!publicBase || !searchIndex || !adminBootstrap) {
        return;
    }

    const summary = buildPublicSectionSummaryFromSection(section);
    publicBase.sections = publicBase.sections || {};
    publicBase.sections[section.id] = summary;

    if (Array.isArray(searchIndex)) {
        const sectionRecord = buildSectionSearchRecord(summary);
        const index = searchIndex.findIndex((record) => record?.type === 'section' && record?.id === section.id);
        if (index >= 0) {
            searchIndex[index] = sectionRecord;
        } else {
            searchIndex.push(sectionRecord);
        }
    }

    if (adminBootstrap?.database?.sections) {
        adminBootstrap.database.sections[section.id] = deepClone(section);
    }

    const updatedAt = new Date().toISOString();
    publicBase.updatedAt = updatedAt;
    adminBootstrap.updatedAt = updatedAt;
    if (adminBootstrap?.database) {
        adminBootstrap.database.updatedAt = updatedAt;
    }

    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
    writeFileAtomic(PAGE_DATA_SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
};

const upsertSiteIntoSharedArtifacts = (site) => {
    const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
    const adminBootstrap = loadWritableJsonArtifact(ADMIN_BOOTSTRAP_PATH, APP_ADMIN_BOOTSTRAP_PATH, 'admin-bootstrap');

    if (!publicBase || !adminBootstrap) {
        return;
    }

    publicBase.site = deepClone(site || {});
    if (adminBootstrap?.database) {
        adminBootstrap.database.site = deepClone(site || {});
    }

    const updatedAt = new Date().toISOString();
    publicBase.updatedAt = updatedAt;
    adminBootstrap.updatedAt = updatedAt;
    if (adminBootstrap?.database) {
        adminBootstrap.database.updatedAt = updatedAt;
    }

    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
};

const queueArtifactMutation = (reason, mutator) => {
    const run = async () => mutator();

    const task = mutationQueue.then(run, async (error) => {
        console.error(`[artifacts] Previous mutation failed before "${reason}":`, error);
        return run();
    });

    mutationQueue = task.then(
        () => undefined,
        () => undefined
    );

    return task;
};

const listJsonBasenames = (dirPath) => {
    if (!dirPath || !fs.existsSync(dirPath)) {
        return [];
    }

    try {
        return fs
            .readdirSync(dirPath, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => entry.name.replace(/\.json$/i, ''));
    } catch (error) {
        console.warn(`[artifacts] Failed to read directory ${dirPath}: ${error.message}`);
        return [];
    }
};

const loadAllSectionArtifacts = () => {
    const ids = new Set([...listJsonBasenames(PAGE_DATA_SECTIONS_DIR), ...listJsonBasenames(APP_PAGE_DATA_SECTIONS_DIR)]);
    return Array.from(ids)
        .map((id) => loadSectionArtifact(id))
        .filter(Boolean);
};

const loadSectionForMutation = (sectionId) => {
    const normalizedId = String(sectionId || '').trim();
    if (!normalizedId) {
        return null;
    }

    const fromArtifact = loadSectionArtifact(normalizedId);
    if (fromArtifact) {
        return deepClone(fromArtifact);
    }

    const bootstrap = loadAdminBootstrapArtifact();
    const fromBootstrap = bootstrap?.database?.sections?.[normalizedId];
    return fromBootstrap ? deepClone(fromBootstrap) : null;
};

const writeSectionArtifactFile = (section) => {
    if (!section?.id) {
        return;
    }

    writeFileAtomic(path.join(PAGE_DATA_SECTIONS_DIR, `${section.id}.json`), JSON.stringify(section));
};

const writeArticleArtifactFile = (article) => {
    if (!article?.id) {
        return;
    }

    writeFileAtomic(path.join(PAGE_DATA_ARTICLES_DIR, `${article.id}.json`), JSON.stringify(article));
};

const removeArticleArtifactFile = (articleId) => {
    const normalizedId = String(articleId || '').trim();
    if (!normalizedId) {
        return;
    }

    const targetPath = path.join(PAGE_DATA_ARTICLES_DIR, `${normalizedId}.json`);

    try {
        fs.rmSync(targetPath, { force: true });
    } catch (error) {
        console.warn(`[artifacts] Failed to remove ${targetPath}: ${error.message}`);
    }
};

const updateSectionArticleMembership = (articleId, previousSummary, nextArticle) => {
    const normalizedArticleId = String(articleId || '').trim();
    if (!normalizedArticleId) {
        return;
    }

    const prevSectionId = String(previousSummary?.section || '').trim();
    const prevGroupId = String(previousSummary?.group || '').trim();
    const nextSectionId = String(nextArticle?.section || '').trim();
    const nextGroupId = String(nextArticle?.group || '').trim();

    const touched = new Map();
    const dirty = new Set();

    const loadTouchedSection = (sectionId) => {
        const normalizedId = String(sectionId || '').trim();
        if (!normalizedId) {
            return null;
        }

        if (touched.has(normalizedId)) {
            return touched.get(normalizedId) || null;
        }

        const section = loadSectionForMutation(normalizedId);
        touched.set(normalizedId, section);
        return section;
    };

    const mutateGroupEntries = (section, groupId, mutator) => {
        if (!section || !groupId) {
            return false;
        }

        const groups = Array.isArray(section.groups) ? section.groups : [];
        const group = groups.find((candidate) => candidate?.id === groupId);

        if (!group) {
            return false;
        }

        group.entries = Array.isArray(group.entries) ? group.entries : [];
        const before = group.entries.join('\u0000');
        mutator(group.entries);
        const after = group.entries.join('\u0000');
        return before !== after;
    };

    // Remove from previous section/group if moved.
    if (prevSectionId && prevGroupId && (prevSectionId !== nextSectionId || prevGroupId !== nextGroupId)) {
        const prevSection = loadTouchedSection(prevSectionId);
        const changed = mutateGroupEntries(prevSection, prevGroupId, (entries) => {
            const next = entries.filter((id) => id !== normalizedArticleId);
            entries.length = 0;
            next.forEach((id) => entries.push(id));
        });

        if (changed) {
            dirty.add(prevSectionId);
        }
    }

    // Ensure present in target section/group.
    if (nextSectionId && nextGroupId) {
        const nextSection = loadTouchedSection(nextSectionId);
        const changed = mutateGroupEntries(nextSection, nextGroupId, (entries) => {
            if (!entries.includes(normalizedArticleId)) {
                entries.push(normalizedArticleId);
            }
        });

        if (changed) {
            dirty.add(nextSectionId);
        }
    }

    for (const sectionId of dirty) {
        const section = touched.get(sectionId);
        if (!section?.id) {
            continue;
        }

        writeSectionArtifactFile(section);
        upsertSectionIntoSharedArtifacts(section);
    }
};

const searchRecords = (source, query, options = {}) => {
    const normalized = normalizeSearchText(query);

    if (!normalized) {
        return [];
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 24;

    return source
        .map((item) => {
            const title = normalizeSearchText(item.title);
            const haystack = normalizeSearchText(item.searchableText || `${item.title} ${item.summary || ''}`);

            let score = 0;

            if (title === normalized) {
                score += 10;
            }

            if (title.includes(normalized)) {
                score += 6;
            }

            if (haystack.includes(normalized)) {
                score += 4;
            }

            tokens.forEach((token) => {
                if (haystack.includes(token)) {
                    score += 1;
                }
            });

            return {
                ...item,
                score,
            };
        })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ score, searchableText, ...item }) => item);
};

const searchPublicDatabase = (database, query, options = {}) => searchRecords(buildSearchIndex(database), query, options);

const addSummaryArticleToDatabase = (target, summaries, articleId) => {
    if (!articleId || target.articles[articleId] || !summaries?.[articleId]) {
        return;
    }

    target.articles[articleId] = deepClone(summaries[articleId]);
};

const buildPageDataPayloadFromArtifacts = (query = {}) => {
    const requestedPage = String(query.page || '').trim();
    const requestedArticleId = String(query.article || '').trim();
    const requestedSectionId = String(query.section || '').trim();
    const requestedGroupId = String(query.group || '').trim();
    const requestedQuery = String(query.query || '').trim();
    const publicBase = loadPublicBaseArtifact();
    const articleSummaries = loadArticleSummariesArtifact();

    if (!publicBase || !articleSummaries) {
        return null;
    }

    if (requestedPage === 'home') {
        const database = deepClone(publicBase);
        HOME_FEATURED_ARTICLE_IDS.forEach((articleId) => addSummaryArticleToDatabase(database, articleSummaries, articleId));

        return {
            ok: true,
            mode: 'home',
            isPartial: true,
            database,
        };
    }

    if (requestedPage === 'article') {
        const article = loadArticleArtifact(requestedArticleId);

        if (!article) {
            return null;
        }

        const database = deepClone(publicBase);
        database.articles[requestedArticleId] = article;

        const questGuideBlock = (article.blocks || []).find((block) => block?.type === 'questGuide') || null;
        const relatedIds = new Set([...(article.related || []), ...(questGuideBlock?.relatedQuestIds || [])]);
        relatedIds.forEach((articleId) => addSummaryArticleToDatabase(database, articleSummaries, articleId));

        return {
            ok: true,
            mode: 'article',
            isPartial: true,
            requestedArticleId,
            database,
        };
    }

    if (requestedPage === 'section') {
        const fallbackSectionId = Object.values(publicBase.sections || {}).sort(sortByOrder)[0]?.id || '';
        const sectionId = requestedSectionId || fallbackSectionId;
        const section = loadSectionArtifact(sectionId);

        if (!section) {
            return null;
        }

        const normalizedGroupId = normalizeServerGroupId(section, requestedGroupId);
        const activeGroup = resolveServerGroup(section, requestedGroupId);
        const database = deepClone(publicBase);
        database.sections[sectionId] = section;

        if (activeGroup) {
            (activeGroup.entries || []).forEach((articleId) => addSummaryArticleToDatabase(database, articleSummaries, articleId));
            addSummaryArticleToDatabase(database, articleSummaries, getServerGroupLeadArticleId({ articles: articleSummaries }, section, activeGroup));
        } else {
            (section.groups || []).forEach((group) => {
                addSummaryArticleToDatabase(database, articleSummaries, getServerGroupLeadArticleId({ articles: articleSummaries }, section, group));
            });
        }

        return {
            ok: true,
            mode: 'section',
            isPartial: true,
            requestedSectionId: sectionId,
            requestedGroupId,
            resolvedGroupId: normalizedGroupId,
            database,
        };
    }

    if (requestedPage === 'search') {
        return {
            ok: true,
            mode: 'search',
            isPartial: true,
            requestedQuery,
            searchResults: searchRecords(loadSearchIndexArtifact(), requestedQuery, { limit: 30 }),
            database: deepClone(publicBase),
        };
    }

    return null;
};

const buildPageDataPayload = (database, query = {}) => {
    const requestedPage = String(query.page || '').trim();
    const requestedArticleId = String(query.article || '').trim();
    const requestedSectionId = String(query.section || '').trim();
    const requestedGroupId = String(query.group || '').trim();
    const requestedQuery = String(query.query || '').trim();
    const partialDatabase = createPublicDatabaseBase(database, {
        fullSectionIds: requestedPage === 'section' && requestedSectionId ? [requestedSectionId] : [],
    });

    if (requestedPage === 'home') {
        HOME_FEATURED_ARTICLE_IDS.forEach((articleId) => addArticleToPublicDatabase(partialDatabase, database, articleId));

        return {
            ok: true,
            mode: 'home',
            isPartial: true,
            database: partialDatabase,
        };
    }

    if (requestedPage === 'article') {
        const article = getArticleById(database, requestedArticleId);
        addArticleToPublicDatabase(partialDatabase, database, requestedArticleId);

        if (article) {
            const questGuideBlock = (article.blocks || []).find((block) => block?.type === 'questGuide') || null;
            const relatedIds = new Set([...(article.related || []), ...(questGuideBlock?.relatedQuestIds || [])]);
            relatedIds.forEach((articleId) => addArticleToPublicDatabase(partialDatabase, database, articleId));
        }

        return {
            ok: true,
            mode: 'article',
            isPartial: true,
            requestedArticleId,
            database: partialDatabase,
        };
    }

    if (requestedPage === 'section') {
        const fallbackSectionId = Object.values(database.sections || {}).sort(sortByOrder)[0]?.id || '';
        const sectionId = requestedSectionId || fallbackSectionId;
        const section = getSectionById(database, sectionId);
        const normalizedGroupId = section ? normalizeServerGroupId(section, requestedGroupId) : requestedGroupId;
        const activeGroup = section ? resolveServerGroup(section, requestedGroupId) : null;

        if (section) {
            partialDatabase.sections[sectionId] = deepClone(section);
        }

        if (section && activeGroup) {
            (activeGroup.entries || []).forEach((articleId) => addArticleToPublicDatabase(partialDatabase, database, articleId));
            addArticleToPublicDatabase(partialDatabase, database, getServerGroupLeadArticleId(database, section, activeGroup));
        } else if (section) {
            (section.groups || []).forEach((group) => {
                addArticleToPublicDatabase(partialDatabase, database, getServerGroupLeadArticleId(database, section, group));
            });
        }

        return {
            ok: true,
            mode: 'section',
            isPartial: true,
            requestedSectionId: sectionId,
            requestedGroupId,
            resolvedGroupId: normalizedGroupId,
            database: partialDatabase,
        };
    }

    if (requestedPage === 'search') {
        return {
            ok: true,
            mode: 'search',
            isPartial: true,
            requestedQuery,
            searchResults: searchPublicDatabase(database, requestedQuery, { limit: 30 }),
            database: partialDatabase,
        };
    }

    return {
        ok: true,
        mode: 'canonical',
        isPartial: false,
        database: deepClone(database),
    };
};

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

app.use((req, res, next) => {
    req.cookies = {};

    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.split('=');
            if (name && rest.length) {
                req.cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
            }
        });
    }

    next();
});

app.get(
    '/assets/js/static-data.js',
    asyncRoute(async (req, res) => {
        const filePath = fs.existsSync(STATIC_DATA_PATH) ? STATIC_DATA_PATH : APP_STATIC_DATA_PATH;
        sendMutableFile(res, filePath, 'application/javascript; charset=utf-8');
    })
);

app.get(
    '/data/canonical/l2wiki-canonical.json',
    asyncRoute(async (req, res) => {
        if (!sendCanonicalDatabase(res)) {
            sendNoStoreJson(res, getDatabaseSnapshot());
        }
    })
);

app.get(
    '/data/canonical/l2wiki-meta.json',
    asyncRoute(async (req, res) => {
        const metaPath = resolveCanonicalMetaPath();

        if (metaPath) {
            sendMutableFile(res, metaPath, 'application/json; charset=utf-8');
            return;
        }

        sendNoStoreJson(res, getLiveMeta());
    })
);

app.get(
    '/data/backups/:fileName',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const fileName = path.basename(String(req.params.fileName || ''));
        const filePath = path.join(BACKUP_DIR, fileName);

        if (!fileName || !fs.existsSync(filePath)) {
            res.status(404).json({ error: 'Backup not found' });
            return;
        }

        sendMutableFile(res, filePath, 'application/json; charset=utf-8');
    })
);

app.post(
    '/api/admin/login',
    asyncRoute(async (req, res) => {
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');

        if (!verifyAdminCredentials(username, password, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD)) {
            res.status(401).json({ error: 'Неверный логин или пароль' });
            return;
        }

        const token = createAdminSession(username);
        setAdminCookie(req, res, token);
        res.json(getAdminSessionPayload({ username }));
    })
);

app.post(
    '/api/admin/logout',
    asyncRoute(async (req, res) => {
        const token = getAdminToken(req);

        if (token) {
            ADMIN_SESSIONS.delete(token);
        }

        clearAdminCookie(req, res);
        res.json({ ok: true });
    })
);

app.get(
    '/api/admin/session',
    asyncRoute(async (req, res) => {
        const session = getAdminSession(req);
        res.json(getAdminSessionPayload(session));
    })
);

app.post(
    '/api/admin/change-password',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');
        const confirmPassword = String(req.body?.confirmPassword || '');
        const auth = readAdminAuth(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);

        if (isAdminAuthManagedByEnv(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD)) {
            res.status(400).json({ error: 'Пароль администратора управляется переменной ADMIN_PASSWORD в окружении.' });
            return;
        }

        if (!currentPassword) {
            res.status(400).json({ error: 'Введите текущий пароль' });
            return;
        }

        if (!newPassword || newPassword.length < 4) {
            res.status(400).json({ error: 'Новый пароль должен содержать минимум 4 символа' });
            return;
        }

        if (newPassword !== confirmPassword) {
            res.status(400).json({ error: 'Подтверждение пароля не совпадает' });
            return;
        }

        if (!verifyAdminCredentials(auth.username, currentPassword, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD)) {
            res.status(400).json({ error: 'Текущий пароль указан неверно' });
            return;
        }

        updateAdminPassword(newPassword, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);

        res.json({
            ok: true,
            username: auth.username,
            message: 'Пароль обновлен',
        });
    })
);

app.get(
    '/api/database',
    asyncRoute(async (req, res) => {
        const wantsFullDatabase = String(req.query.full || '') === '1';
        sendNoStoreJson(res, {
            ok: true,
            database: wantsFullDatabase && !ARTIFACT_MUTATIONS_ENABLED ? getDatabaseSnapshot() : null,
            meta: getLiveMeta(),
        });
    })
);

app.get(
    '/api/page-data',
    asyncRoute(async (req, res) => {
        const artifactPayload = buildPageDataPayloadFromArtifacts(req.query || {});

        if (artifactPayload) {
            sendNoStoreJson(res, artifactPayload);
            return;
        }

        if (ARTIFACT_MUTATIONS_ENABLED) {
            const requestedPage = String((req.query || {}).page || '').trim();
            const requestedArticleId = String((req.query || {}).article || '').trim();
            const requestedSectionId = String((req.query || {}).section || '').trim();
            const requestedGroupId = String((req.query || {}).group || '').trim();
            const publicBase = loadPublicBaseArtifact() || { version: 2, updatedAt: new Date().toISOString(), site: { name: 'L2Wiki.Su' }, sections: {}, articles: {} };

            sendNoStoreJson(res, {
                ok: false,
                mode: requestedPage || 'unknown',
                isPartial: true,
                requestedArticleId,
                requestedSectionId,
                requestedGroupId,
                error: 'Материал не найден',
                database: deepClone(publicBase),
            });
            return;
        }

        const database = getDatabaseSnapshot();
        sendNoStoreJson(res, buildPageDataPayload(database, req.query || {}));
    })
);

app.get(
    '/api/admin/bootstrap',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const artifactPayload = loadAdminBootstrapArtifact();

        if (artifactPayload) {
            sendNoStoreJson(res, artifactPayload);
            return;
        }

        if (ARTIFACT_MUTATIONS_ENABLED) {
            res.status(500).json({ error: 'Admin bootstrap is missing' });
            return;
        }

        const database = getDatabaseSnapshot();
        sendNoStoreJson(res, buildAdminBootstrapPayload(database));
    })
);

app.get(
    '/api/export',
    requireAdmin,
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const publicBase = loadPublicBaseArtifact();
            const articleSummaries = loadArticleSummariesArtifact();
            const adminBootstrap = loadAdminBootstrapArtifact();
            const sections = adminBootstrap?.database?.sections || Object.fromEntries(loadAllSectionArtifacts().map((section) => [section.id, section]));

            sendNoStoreJson(res, {
                ok: true,
                mode: 'artifacts',
                database: {
                    version: Number(publicBase?.version) || 2,
                    updatedAt: publicBase?.updatedAt || new Date().toISOString(),
                    site: deepClone(publicBase?.site || {}),
                    sections: deepClone(sections || {}),
                    articles: deepClone(articleSummaries || {}),
                },
            });
            return;
        }

        if (!sendCanonicalDatabase(res)) {
            sendNoStoreJson(res, getDatabaseSnapshot());
        }
    })
);

app.get(
    '/api/backups',
    requireAdmin,
    asyncRoute(async (req, res) => {
        res.json({
            ok: true,
            backups: listBackupSnapshots(),
        });
    })
);

app.get(
    '/api/sections',
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const adminBootstrap = loadAdminBootstrapArtifact();
            const fromBootstrap = adminBootstrap?.database?.sections && typeof adminBootstrap.database.sections === 'object' ? adminBootstrap.database.sections : null;
            const sections = (fromBootstrap ? Object.values(fromBootstrap) : loadAllSectionArtifacts()).sort(sortByOrder);
            res.json(sections.map((section) => deepClone(section)));
            return;
        }

        const database = getDatabaseSnapshot();
        const sections = Object.values(database.sections || {}).sort(sortByOrder);
        res.json(sections);
    })
);

app.get(
    '/api/section/:id',
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const section = loadSectionForMutation(req.params.id);

            if (!section) {
                res.status(404).json({ error: 'Section not found' });
                return;
            }

            res.json(deepClone(section));
            return;
        }

        const database = getDatabaseSnapshot();
        const section = database.sections?.[req.params.id];

        if (!section) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }

        res.json(deepClone(section));
    })
);

app.put(
    '/api/section/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const sectionId = String(req.params.id || '').trim();
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const savedSection = await queueArtifactMutation(`section-${sectionId}`, async () => {
                const existing = loadSectionForMutation(sectionId) || {};
                const nextSection = normalizeSection(
                    {
                        ...existing,
                        ...(req.body || {}),
                        id: sectionId,
                    },
                    sectionId
                );

                writeSectionArtifactFile(nextSection);
                upsertSectionIntoSharedArtifacts(nextSection);
                invalidateArtifactCache();

                return nextSection;
            });

            res.json(deepClone(savedSection));
            return;
        }

        const savedDatabase = await queueDatabaseMutation(`section-${sectionId}`, async (database) => {
            const existing = database.sections?.[sectionId] || {};
            database.sections[sectionId] = normalizeSection(
                {
                    ...existing,
                    ...req.body,
                    id: sectionId,
                },
                sectionId
            );
            return database;
        });

        res.json(savedDatabase.sections[sectionId]);
    })
);

app.delete(
    '/api/section/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const sectionId = String(req.params.id || '').trim();
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const articleSummaries = loadArticleSummariesArtifact();
            const hasArticles = Object.values(articleSummaries || {}).some((article) => article?.section === sectionId);

            if (hasArticles) {
                res.status(400).json({ error: 'Сначала перенесите или удалите статьи из этого раздела' });
                return;
            }

            await queueArtifactMutation(`delete-section-${sectionId}`, async () => {
                const sectionPath = path.join(PAGE_DATA_SECTIONS_DIR, `${sectionId}.json`);
                try {
                    fs.rmSync(sectionPath, { force: true });
                } catch (error) {
                    console.warn(`[artifacts] Failed to remove ${sectionPath}: ${error.message}`);
                }

                const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
                const searchIndex = loadWritableJsonArtifact(PAGE_DATA_SEARCH_INDEX_PATH, APP_PAGE_DATA_SEARCH_INDEX_PATH, 'search-index');
                const adminBootstrap = loadWritableJsonArtifact(ADMIN_BOOTSTRAP_PATH, APP_ADMIN_BOOTSTRAP_PATH, 'admin-bootstrap');

                if (publicBase?.sections) {
                    delete publicBase.sections[sectionId];
                }

                if (Array.isArray(searchIndex)) {
                    const next = searchIndex.filter((record) => !(record?.type === 'section' && record?.id === sectionId));
                    searchIndex.length = 0;
                    next.forEach((item) => searchIndex.push(item));
                }

                if (adminBootstrap?.database?.sections) {
                    delete adminBootstrap.database.sections[sectionId];
                }

                const updatedAt = new Date().toISOString();
                if (publicBase) {
                    publicBase.updatedAt = updatedAt;
                }
                if (adminBootstrap) {
                    adminBootstrap.updatedAt = updatedAt;
                    if (adminBootstrap.database) {
                        adminBootstrap.database.updatedAt = updatedAt;
                    }
                }

                if (publicBase) {
                    writeFileAtomic(PAGE_DATA_BASE_PATH, JSON.stringify(publicBase));
                }
                if (searchIndex) {
                    writeFileAtomic(PAGE_DATA_SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
                }
                if (adminBootstrap) {
                    writeFileAtomic(ADMIN_BOOTSTRAP_PATH, JSON.stringify(adminBootstrap));
                }

                invalidateArtifactCache();
            });

            res.json({ ok: true });
            return;
        }

        const database = getDatabaseSnapshot();
        const hasArticles = Object.values(database.articles || {}).some((article) => article.section === sectionId);

        if (hasArticles) {
            res.status(400).json({ error: 'Сначала перенесите или удалите статьи из этого раздела' });
            return;
        }

        await queueDatabaseMutation(`delete-section-${sectionId}`, async (database) => {
            delete database.sections[sectionId];
            return database;
        });

        res.json({ ok: true });
    })
);

app.get(
    '/api/article/:id',
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const article = loadArticleArtifact(req.params.id);

            if (!article) {
                res.status(404).json({ error: 'Article not found' });
                return;
            }

            res.json(deepClone(article));
            return;
        }

        const database = getDatabaseSnapshot();
        const article = database.articles?.[req.params.id];

        if (!article) {
            res.status(404).json({ error: 'Article not found' });
            return;
        }

        res.json(deepClone(article));
    })
);

app.put(
    '/api/article/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const articleId = String(req.params.id || '').trim();
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const savedArticle = await queueArtifactMutation(`article-${articleId}`, async () => {
                const existingSummaries = loadWritableJsonArtifact(
                    PAGE_DATA_ARTICLE_SUMMARIES_PATH,
                    APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH,
                    'article-summaries'
                );
                const previousSummary = existingSummaries?.[articleId] || null;

                const existingArticle = loadArticleArtifact(articleId) || {};
                const nextArticle = normalizeArticle(
                    {
                        ...existingArticle,
                        ...(req.body || {}),
                        id: articleId,
                    },
                    articleId
                );

                writeArticleArtifactFile(nextArticle);
                upsertArticleIntoSharedArtifacts(nextArticle);
                updateSectionArticleMembership(articleId, previousSummary, nextArticle);
                invalidateArtifactCache();

                return nextArticle;
            });

            res.json(deepClone(savedArticle));
            return;
        }

        const savedDatabase = await queueDatabaseMutation(`article-${articleId}`, async (database) => {
            const existing = database.articles?.[articleId] || {};
            database.articles[articleId] = normalizeArticle(
                {
                    ...existing,
                    ...req.body,
                    id: articleId,
                },
                articleId
            );
            return database;
        });

        res.json(savedDatabase.articles[articleId]);
    })
);

app.delete(
    '/api/article/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const articleId = String(req.params.id || '').trim();

        if (ARTIFACT_MUTATIONS_ENABLED) {
            await queueArtifactMutation(`delete-article-${articleId}`, async () => {
                const summaries = loadWritableJsonArtifact(
                    PAGE_DATA_ARTICLE_SUMMARIES_PATH,
                    APP_PAGE_DATA_ARTICLE_SUMMARIES_PATH,
                    'article-summaries'
                );
                const previousSummary = summaries?.[articleId] || null;

                removeArticleArtifactFile(articleId);
                deleteArticleFromSharedArtifacts(articleId);
                updateSectionArticleMembership(articleId, previousSummary, null);
                invalidateArtifactCache();
            });

            res.json({ ok: true });
            return;
        }

        await queueDatabaseMutation(`delete-article-${articleId}`, async (database) => {
            delete database.articles[articleId];
            return database;
        });

        res.json({ ok: true });
    })
);

app.put(
    '/api/site',
    requireAdmin,
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            const nextSite = await queueArtifactMutation('site-settings', async () => {
                const publicBase = loadWritableJsonArtifact(PAGE_DATA_BASE_PATH, APP_PAGE_DATA_BASE_PATH, 'public-base');
                const currentSite = publicBase?.site || {};

                const site = normalizeSite({
                    ...(currentSite || {}),
                    ...(req.body || {}),
                });

                upsertSiteIntoSharedArtifacts(site);
                invalidateArtifactCache();
                return site;
            });

            res.json(deepClone(nextSite));
            return;
        }

        const savedDatabase = await queueDatabaseMutation('site-settings', async (database) => {
            database.site = normalizeSite({
                ...(database.site || {}),
                ...(req.body || {}),
            });
            return database;
        });

        res.json(savedDatabase.site);
    })
);

app.post(
    '/api/import',
    requireAdmin,
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            res.status(400).json({ error: 'Импорт отключен в режиме артефактов (Render). Используйте локальный импорт и деплой.' });
            return;
        }

        const savedDatabase = await queueDatabaseMutation('import', async () => normalizeDatabase(req.body || {}));

        res.json({
            ok: true,
            sections: Object.keys(savedDatabase.sections || {}).length,
            articles: Object.keys(savedDatabase.articles || {}).length,
        });
    })
);

app.post(
    '/api/reset',
    requireAdmin,
    asyncRoute(async (req, res) => {
        if (ARTIFACT_MUTATIONS_ENABLED) {
            res.status(400).json({ error: 'Сброс отключен в режиме артефактов (Render).' });
            return;
        }

        const savedDatabase = await queueDatabaseMutation('reset', async (database) => database);

        res.json({
            ok: true,
            updatedAt: savedDatabase.updatedAt,
        });
    })
);

app.use(express.static(ROOT_DIR));

app.get(
    '*',
    asyncRoute(async (req, res) => {
        res.sendFile(path.join(ROOT_DIR, 'index.html'));
    })
);

app.use((error, req, res, next) => {
    console.error('[server]', error);

    if (res.headersSent) {
        next(error);
        return;
    }

    if (req.path.startsWith('/api/') || req.path.startsWith('/data/')) {
        res.status(error.status || 500).json({
            error: error.message || 'Internal server error',
        });
        return;
    }

    res.status(error.status || 500).send('Internal server error');
});

const start = async () => {
    console.log('[boot] Starting L2Wiki server...');

    ensureMutableStorage();
    const adminAuth = ensureAdminAuthFile(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);
    const db = SQLITE_SYNC_ENABLED && !ARTIFACT_MUTATIONS_ENABLED ? new sqlite3.Database(DB_PATH) : null;
    const initialMeta = loadMetaFromDisk();

    app.locals.db = db;
    app.locals.database = null;
    app.locals.databaseMeta = initialMeta;
    invalidateArtifactCache();

    if (db) {
        const database = loadDatabaseFromDisk().data;
        await ensureSqliteSchema(db);
        await enqueueSqliteSync(database, 'boot');
    }

    app.listen(PORT, '0.0.0.0', () => {
        const activeStaticDataPath = fs.existsSync(STATIC_DATA_PATH) ? STATIC_DATA_PATH : APP_STATIC_DATA_PATH;
        console.log(`[boot] Storage directory: ${STORAGE_DIR}`);
        console.log(`[boot] Static data path: ${activeStaticDataPath}`);
        console.log(`[boot] JSON body limit: ${REQUEST_BODY_LIMIT}`);
        console.log(`[boot] Database ready: ${initialMeta.counts.sections} sections, ${initialMeta.counts.articles} articles`);
        console.log(
            `[boot] SQLite sync: ${db ? 'enabled' : SQLITE_SYNC_ENABLED ? 'disabled (artifact mode)' : 'disabled'}`
        );
        console.log(`[boot] Static publish: ${STATIC_PUBLISH_ENABLED ? 'enabled' : 'disabled'}`);
        console.log(`[boot] Backups: ${BACKUP_SNAPSHOTS_ENABLED ? 'enabled' : 'disabled'}`);
        console.log(`[boot] Server listening on http://0.0.0.0:${PORT} (bound to all interfaces)`);
        console.log(`[boot] Admin login: ${DEFAULT_ADMIN_USERNAME} (password is loaded from .env or stored admin state)`);
        console.log(`[boot] Admin auth file: ${AUTH_FILE_PATH} (${adminAuth.passwordSource || 'unknown'})`);

        if (process.platform === 'win32' && /^\/var\//.test(String(process.env.L2WIKI_STORAGE_DIR || '').trim())) {
            console.warn(
                `[boot] Windows detected with Linux-style L2WIKI_STORAGE_DIR=${process.env.L2WIKI_STORAGE_DIR}; local data is being stored in ${STORAGE_DIR}`
            );
        }
    });
};

start().catch((error) => {
    console.error('[boot] Failed to start server:', error);
    process.exit(1);
});
