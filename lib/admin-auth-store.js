const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.L2WIKI_STORAGE_DIR
    ? path.resolve(process.env.L2WIKI_STORAGE_DIR)
    : path.resolve(__dirname, '..');
const PRIVATE_DIR = path.join(ROOT_DIR, 'data', '.private');
const AUTH_FILE_PATH = path.join(PRIVATE_DIR, 'admin-auth.json');
const PASSWORD_SOURCE_BOOTSTRAP = 'bootstrap';
const PASSWORD_SOURCE_MANUAL = 'manual';
const PASSWORD_SOURCE_LEGACY = 'legacy';

const ensurePrivateDir = () => {
    if (!fs.existsSync(PRIVATE_DIR)) {
        fs.mkdirSync(PRIVATE_DIR, { recursive: true });
    }
};

const normalizeUsername = (value, fallback = 'admin') => String(value || fallback || 'admin').trim() || 'admin';

const createPasswordHash = (password, saltHex = crypto.randomBytes(16).toString('hex')) => {
    const salt = Buffer.from(saltHex, 'hex');
    const hash = crypto.scryptSync(String(password || ''), salt, 64);
    return `scrypt$${saltHex}$${hash.toString('hex')}`;
};

const verifyPassword = (password, storedHash = '') => {
    const [algorithm, saltHex, hashHex] = String(storedHash || '').split('$');

    if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
        return false;
    }

    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), expected.length);

    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const writeAuthState = (payload) => {
    ensurePrivateDir();
    const tempPath = `${AUTH_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempPath, AUTH_FILE_PATH);
    return payload;
};

const createBootstrapAuthState = (fallbackUsername, fallbackPassword) => ({
    username: normalizeUsername(fallbackUsername),
    passwordHash: createPasswordHash(fallbackPassword || 'admin'),
    passwordSource: PASSWORD_SOURCE_BOOTSTRAP,
    updatedAt: new Date().toISOString(),
});

const normalizeAuthState = (payload, fallbackUsername, fallbackPassword) => {
    const username = normalizeUsername(payload?.username, fallbackUsername);
    const passwordHash = String(payload?.passwordHash || '').trim();
    const passwordSource = [PASSWORD_SOURCE_BOOTSTRAP, PASSWORD_SOURCE_MANUAL, PASSWORD_SOURCE_LEGACY].includes(
        String(payload?.passwordSource || '').trim()
    )
        ? String(payload.passwordSource).trim()
        : passwordHash
          ? PASSWORD_SOURCE_LEGACY
          : PASSWORD_SOURCE_BOOTSTRAP;

    if (passwordHash) {
        return {
            username,
            passwordHash,
            passwordSource,
            updatedAt: payload?.updatedAt || new Date().toISOString(),
        };
    }

    return createBootstrapAuthState(fallbackUsername, fallbackPassword);
};

const shouldRefreshBootstrapAuth = (payload, fallbackUsername, fallbackPassword) => {
    if (payload?.passwordSource !== PASSWORD_SOURCE_BOOTSTRAP) {
        return false;
    }

    const fallbackUser = normalizeUsername(fallbackUsername);
    const fallbackPass = String(fallbackPassword || 'admin');

    if (payload.username !== fallbackUser) {
        return true;
    }

    return !verifyPassword(fallbackPass, payload.passwordHash);
};

const ensureAdminAuthFile = (fallbackUsername, fallbackPassword) => {
    ensurePrivateDir();

    if (!fs.existsSync(AUTH_FILE_PATH)) {
        return writeAuthState(createBootstrapAuthState(fallbackUsername, fallbackPassword));
    }

    try {
        const payload = JSON.parse(fs.readFileSync(AUTH_FILE_PATH, 'utf8'));
        const normalized = normalizeAuthState(payload, fallbackUsername, fallbackPassword);

        if (shouldRefreshBootstrapAuth(normalized, fallbackUsername, fallbackPassword)) {
            return writeAuthState(createBootstrapAuthState(fallbackUsername, fallbackPassword));
        }

        if (
            normalized.username !== payload?.username ||
            normalized.passwordHash !== payload?.passwordHash ||
            normalized.passwordSource !== payload?.passwordSource ||
            normalized.updatedAt !== payload?.updatedAt
        ) {
            return writeAuthState(normalized);
        }

        return normalized;
    } catch (error) {
        return writeAuthState(createBootstrapAuthState(fallbackUsername, fallbackPassword));
    }
};

const readAdminAuth = (fallbackUsername, fallbackPassword) => ensureAdminAuthFile(fallbackUsername, fallbackPassword);

const verifyAdminCredentials = (username, password, fallbackUsername, fallbackPassword) => {
    const auth = readAdminAuth(fallbackUsername, fallbackPassword);
    const candidateUsername = normalizeUsername(username, fallbackUsername);
    const candidatePassword = String(password || '');

    if (candidateUsername === auth.username && verifyPassword(candidatePassword, auth.passwordHash)) {
        return true;
    }

    const fallbackUser = normalizeUsername(fallbackUsername);
    const fallbackPasswordValue = String(fallbackPassword || 'admin');

    if (
        auth.passwordSource !== PASSWORD_SOURCE_MANUAL &&
        candidateUsername === fallbackUser &&
        candidatePassword === fallbackPasswordValue
    ) {
        if (
            auth.passwordSource !== PASSWORD_SOURCE_BOOTSTRAP ||
            auth.username !== fallbackUser ||
            !verifyPassword(fallbackPasswordValue, auth.passwordHash)
        ) {
            writeAuthState(createBootstrapAuthState(fallbackUser, fallbackPasswordValue));
        }

        return true;
    }

    return false;
};

const updateAdminPassword = (nextPassword, fallbackUsername, fallbackPassword) => {
    const current = readAdminAuth(fallbackUsername, fallbackPassword);
    const normalized = {
        username: current.username,
        passwordHash: createPasswordHash(nextPassword),
        passwordSource: PASSWORD_SOURCE_MANUAL,
        updatedAt: new Date().toISOString(),
    };

    return writeAuthState(normalized);
};

module.exports = {
    AUTH_FILE_PATH,
    ensureAdminAuthFile,
    readAdminAuth,
    verifyAdminCredentials,
    updateAdminPassword,
};
