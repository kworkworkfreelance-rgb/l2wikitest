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

const { deepClone, normalizeDatabase } = require('./lib/rich-content-schema');
const { ensureSqliteSchema, syncCanonicalToSqlite } = require('./lib/canonical-store');
const {
    AUTH_FILE_PATH,
    ensureAdminAuthFile,
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
const STATIC_DATA_PATH = path.join(MUTABLE_ASSETS_DIR, 'static-data.js');
const APP_STATIC_DATA_PATH = path.join(ROOT_DIR, 'assets', 'js', 'static-data.js');
const STORAGE_CANONICAL_PATH = path.join(CANONICAL_DIR, 'l2wiki-canonical.json');
const APP_CANONICAL_PATH = path.join(ROOT_DIR, 'data', 'canonical', 'l2wiki-canonical.json');
const LEGACY_JSON_PATH = path.join(ROOT_DIR, 'l2wiki-db-2026-04-07.json');
const DB_PATH = path.join(STORAGE_DIR, 'l2wiki.db');

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_COOKIE_NAME = 'admin_token';
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';
const REQUEST_BODY_LIMIT = process.env.L2WIKI_REQUEST_BODY_LIMIT || '100mb';
const SQLITE_SYNC_ENABLED = /^(1|true|yes)$/i.test(String(process.env.L2WIKI_ENABLE_SQLITE_SYNC || ''));

const ADMIN_SESSIONS = new Map();

let mutationQueue = Promise.resolve();
let sqliteSyncQueue = Promise.resolve();

const ensureDir = (targetPath) => {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
};

const ensureMutableStorage = () => {
    [STORAGE_DIR, MUTABLE_ASSETS_DIR, MUTABLE_DATA_DIR, BACKUP_DIR, CANONICAL_DIR].forEach(ensureDir);

    if (STATIC_DATA_PATH !== APP_STATIC_DATA_PATH && !fs.existsSync(STATIC_DATA_PATH) && fs.existsSync(APP_STATIC_DATA_PATH)) {
        fs.copyFileSync(APP_STATIC_DATA_PATH, STATIC_DATA_PATH);
    }
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

const buildStaticDataSource = (database, sourceLabel = 'server-publish') =>
    `window.L2WIKI_SEED_DATA=${JSON.stringify(compactForStorage(database) || {})};window.L2WIKI_SEED_SOURCE=${JSON.stringify({
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

const writeStaticDataFile = (database, sourceLabel = 'server-publish') => {
    const normalized = normalizeDatabase(database);
    return writeFileAtomic(STATIC_DATA_PATH, buildStaticDataSource(normalized, sourceLabel));
};

const writeBackupSnapshot = (database, reason = 'publish') => {
    ensureDir(BACKUP_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = String(reason || 'publish').replace(/[^a-z0-9_-]+/gi, '-');
    const fileName = `${stamp}-${safeReason}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(compactForStorage(normalizeDatabase(database)) || {}), 'utf8');
    return {
        fileName,
        filePath,
    };
};

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

const parseDatabaseTimestamp = (database) => {
    const timestamp = Date.parse(database?.updatedAt || '');
    return Number.isFinite(timestamp) ? timestamp : 0;
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

const loadJsonCandidate = (filePath, label) => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        if (isGitLfsPointerFile(filePath)) {
            return null;
        }

        return {
            label,
            data: normalizeDatabase(JSON.parse(fs.readFileSync(filePath, 'utf8'))),
        };
    } catch (error) {
        console.warn(`[boot] Failed to parse ${label}: ${error.message}`);
        return null;
    }
};

const loadStaticSeedCandidate = (filePath, label) => {
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
            data: normalizeDatabase(parsedDatabase),
        };
    } catch (error) {
        console.warn(`[boot] Failed to evaluate ${label}: ${error.message}`);
        return null;
    }
};

const loadInitialDatabase = () => {
    const seenPaths = new Set();
    const candidateSpecs = [
        { filePath: STATIC_DATA_PATH, label: 'storage static-data', kind: 'static' },
        { filePath: STORAGE_CANONICAL_PATH, label: 'storage canonical', kind: 'json' },
        { filePath: APP_STATIC_DATA_PATH, label: 'app static-data', kind: 'static' },
        { filePath: APP_CANONICAL_PATH, label: 'app canonical', kind: 'json' },
        { filePath: LEGACY_JSON_PATH, label: 'legacy json', kind: 'json' },
    ];

    const candidates = candidateSpecs
        .map((spec) => {
            if (seenPaths.has(spec.filePath)) {
                return null;
            }

            seenPaths.add(spec.filePath);
            return spec.kind === 'static'
                ? loadStaticSeedCandidate(spec.filePath, spec.label)
                : loadJsonCandidate(spec.filePath, spec.label);
        })
        .filter(Boolean)
        .sort((left, right) => {
            const timestampDelta = parseDatabaseTimestamp(right.data) - parseDatabaseTimestamp(left.data);
            if (timestampDelta !== 0) {
                return timestampDelta;
            }

            return left.label.localeCompare(right.label);
        });

    if (candidates.length) {
        const selected = candidates[0];
        console.log(
            `[boot] Using ${selected.label}: ${Object.keys(selected.data.sections || {}).length} sections, ${
                Object.keys(selected.data.articles || {}).length
            } articles`
        );
        return selected.data;
    }

    console.warn('[boot] No canonical or static seed found. Starting with an empty database.');

    return normalizeDatabase({
        version: 2,
        updatedAt: new Date().toISOString(),
        site: {
            name: 'L2Wiki.Su',
            subtitle: 'База знаний по Lineage II',
        },
        sections: {},
        articles: {},
    });
};

const buildMeta = (database) => ({
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

const cloneDatabase = (database) => deepClone(database || {});

const getLiveDatabase = () => app.locals.database || normalizeDatabase({});
const getWritableDatabase = () => cloneDatabase(getLiveDatabase());

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

    sqliteSyncQueue = sqliteSyncQueue.then(run, async (error) => {
        console.error(`[sqlite] Previous sync failed before "${reason}":`, error);
        return run();
    });

    sqliteSyncQueue = sqliteSyncQueue.catch((error) => {
        console.error(`[sqlite] Sync failed for "${reason}":`, error);
    });

    return sqliteSyncQueue;
};

const publishDatabase = async (database, reason = 'publish') => {
    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
        version: 2,
    });

    writeStaticDataFile(normalized, reason);
    writeBackupSnapshot(normalized, reason);
    app.locals.database = normalized;
    enqueueSqliteSync(normalized, reason);

    return normalized;
};

const queueDatabaseMutation = (reason, mutator) => {
    const run = async () => {
        const draft = getWritableDatabase();
        const nextDatabase = await mutator(draft);
        return publishDatabase(nextDatabase, reason);
    };

    mutationQueue = mutationQueue.then(run, run);
    return mutationQueue;
};

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
            sendNoStoreJson(res, getLiveDatabase());
        }
    })
);

app.get(
    '/data/canonical/l2wiki-meta.json',
    asyncRoute(async (req, res) => {
        sendNoStoreJson(res, buildMeta(app.locals.database));
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
        res.json({ ok: true, username });
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
        res.json({
            ok: true,
            authenticated: Boolean(session),
            username: session?.username,
        });
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
        sendNoStoreJson(res, {
            ok: true,
            database: getLiveDatabase(),
            meta: buildMeta(getLiveDatabase()),
        });
    })
);

app.get(
    '/api/export',
    requireAdmin,
    asyncRoute(async (req, res) => {
        if (!sendCanonicalDatabase(res)) {
            sendNoStoreJson(res, getLiveDatabase());
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
        const sections = Object.values(app.locals.database.sections || {}).sort(sortByOrder);
        res.json(sections);
    })
);

app.get(
    '/api/section/:id',
    asyncRoute(async (req, res) => {
        const section = app.locals.database.sections?.[req.params.id];

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
        const savedDatabase = await queueDatabaseMutation(`section-${sectionId}`, async (database) => {
            const existing = database.sections?.[sectionId] || {};
            database.sections[sectionId] = {
                ...existing,
                ...req.body,
                id: sectionId,
            };
            return normalizeDatabase(database);
        });

        res.json(savedDatabase.sections[sectionId]);
    })
);

app.delete(
    '/api/section/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const sectionId = String(req.params.id || '').trim();
        const hasArticles = Object.values(app.locals.database.articles || {}).some((article) => article.section === sectionId);

        if (hasArticles) {
            res.status(400).json({ error: 'Сначала перенесите или удалите статьи из этого раздела' });
            return;
        }

        await queueDatabaseMutation(`delete-section-${sectionId}`, async (database) => {
            delete database.sections[sectionId];
            return normalizeDatabase(database);
        });

        res.json({ ok: true });
    })
);

app.get(
    '/api/article/:id',
    asyncRoute(async (req, res) => {
        const article = app.locals.database.articles?.[req.params.id];

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
        const savedDatabase = await queueDatabaseMutation(`article-${articleId}`, async (database) => {
            const existing = database.articles?.[articleId] || {};
            database.articles[articleId] = {
                ...existing,
                ...req.body,
                id: articleId,
            };
            return normalizeDatabase(database);
        });

        res.json(savedDatabase.articles[articleId]);
    })
);

app.delete(
    '/api/article/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const articleId = String(req.params.id || '').trim();

        await queueDatabaseMutation(`delete-article-${articleId}`, async (database) => {
            delete database.articles[articleId];
            return normalizeDatabase(database);
        });

        res.json({ ok: true });
    })
);

app.put(
    '/api/site',
    requireAdmin,
    asyncRoute(async (req, res) => {
        const savedDatabase = await queueDatabaseMutation('site-settings', async (database) => {
            database.site = {
                ...(database.site || {}),
                ...(req.body || {}),
            };
            return normalizeDatabase(database);
        });

        res.json(savedDatabase.site);
    })
);

app.post(
    '/api/import',
    requireAdmin,
    asyncRoute(async (req, res) => {
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
        const savedDatabase = await queueDatabaseMutation('reset', async (database) => normalizeDatabase(database));

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

    const database = loadInitialDatabase();
    const db = SQLITE_SYNC_ENABLED ? new sqlite3.Database(DB_PATH) : null;

    app.locals.db = db;
    app.locals.database = database;

    if (db) {
        await ensureSqliteSchema(db);
        await enqueueSqliteSync(database, 'boot');
    }

    app.listen(PORT, '0.0.0.0', () => {
        const activeStaticDataPath = fs.existsSync(STATIC_DATA_PATH) ? STATIC_DATA_PATH : APP_STATIC_DATA_PATH;
        console.log(`[boot] Storage directory: ${STORAGE_DIR}`);
        console.log(`[boot] Static data path: ${activeStaticDataPath}`);
        console.log(`[boot] JSON body limit: ${REQUEST_BODY_LIMIT}`);
        console.log(
            `[boot] Database ready: ${Object.keys(database.sections || {}).length} sections, ${Object.keys(database.articles || {}).length} articles`
        );
        console.log(`[boot] SQLite sync: ${SQLITE_SYNC_ENABLED ? 'enabled' : 'disabled'}`);
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
