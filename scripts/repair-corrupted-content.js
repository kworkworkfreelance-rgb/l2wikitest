const fs = require('fs');
const path = require('path');
const { publishCanonical, readCanonical } = require('../lib/canonical-store');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLEAN_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'backups', '2026-04-12T17-48-39-749Z-article-contacts.json');
const SQLITE_FILES = ['l2wiki.db', 'l2wiki.db-journal', 'l2wiki.db-wal', 'l2wiki.db-shm'];

const RESTORE_IDS = [
    'clan-skills',
    'squad-skills',
    'enchanting-skills',
    'quest-wolf-collar',
    'quest-baby-buffalo',
    'quest-baby-kookabura',
    'quest-baby-cougar',
    'quest-dragonflute',
    'quest-dragon-bugle',
];

const CONTACTS_ARTICLE = {
    id: 'contacts',
    section: 'misc',
    group: 'contacts',
    title: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b',
    summary: '',
    eyebrow: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b',
    meta: [],
    intro: [],
    related: [],
    order: 0,
    layout: 'contacts-page',
    sidebarFacts: [],
    aliases: ['contact', 'contacts-page', 'svyaz'],
    blocks: [
        {
            id: 'contacts-intro',
            type: 'prose',
            title: '\u0421\u0432\u044f\u0437\u044c \u0441 \u043d\u0430\u043c\u0438',
            paragraphs: [
                '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0434\u043e\u0431\u043d\u044b\u0439 \u043a\u0430\u043d\u0430\u043b \u0441\u0432\u044f\u0437\u0438 \u0438 \u043d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043d\u0430\u043c \u043f\u043e \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430, \u043f\u0440\u0430\u0432\u043e\u043a, \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u0438\u043b\u0438 \u0442\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u043e\u0448\u0438\u0431\u043e\u043a \u043d\u0430 \u0441\u0430\u0439\u0442\u0435.',
                '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u0447\u0435\u0440\u0435\u0437 \u0430\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u043c\u0435\u043d\u044f\u0442\u044c \u0442\u0435\u043a\u0441\u0442, \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0443 \u0438 \u0441\u0430\u043c\u0438 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0431\u0435\u0437 \u043f\u0440\u0430\u0432\u043a\u0438 \u0448\u0430\u0431\u043b\u043e\u043d\u0430.'
            ]
        },
        {
            id: 'contacts-table',
            type: 'table',
            title: '\u041a\u0430\u043d\u0430\u043b\u044b \u0441\u0432\u044f\u0437\u0438',
            columns: [
                { key: 'direction', label: '\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435' },
                { key: 'person', label: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442' },
                { key: 'channel', label: '\u041a\u0430\u043d\u0430\u043b \u0441\u0432\u044f\u0437\u0438' },
                { key: 'note', label: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439' },
            ],
            rows: [
                {
                    id: 'contacts-support-email',
                    cells: [
                        { value: '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430' },
                        { value: '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440 \u0441\u0430\u0439\u0442\u0430' },
                        { value: 'contact@lwiki.su', href: 'mailto:contact@lwiki.su' },
                        { value: '\u0412\u043e\u043f\u0440\u043e\u0441\u044b \u043f\u043e \u043e\u0448\u0438\u0431\u043a\u0430\u043c, \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0443 \u0438 \u043d\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044e \u0441\u0442\u0440\u0430\u043d\u0438\u0446' },
                    ],
                },
                {
                    id: 'contacts-telegram',
                    cells: [
                        { value: 'Telegram' },
                        { value: 'L2Wiki Support' },
                        { value: 'https://t.me/lwiki_support', href: 'https://t.me/lwiki_support' },
                        { value: '\u0411\u044b\u0441\u0442\u0440\u0430\u044f \u0441\u0432\u044f\u0437\u044c \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c \u0438 \u0441\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d\u0438\u044f\u043c' },
                    ],
                },
                {
                    id: 'contacts-github',
                    cells: [
                        { value: 'GitHub' },
                        { value: '\u0420\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442\u0430' },
                        { value: 'https://github.com/botitg/l2Wiki', href: 'https://github.com/botitg/l2Wiki' },
                        { value: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439 \u0438 \u0440\u0430\u0431\u043e\u0447\u0438\u0439 \u043a\u043e\u0434 \u0441\u0430\u0439\u0442\u0430' },
                    ],
                },
            ],
            compact: false,
        },
    ],
};

const removeSqliteFiles = () => {
    for (const fileName of SQLITE_FILES) {
        const filePath = path.join(ROOT_DIR, fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`removed ${fileName}`);
        }
    }
};

const main = async () => {
    const current = readCanonical();
    const cleanBackup = JSON.parse(fs.readFileSync(CLEAN_BACKUP_PATH, 'utf8'));

    for (const id of RESTORE_IDS) {
        if (cleanBackup.articles?.[id]) {
            current.articles[id] = cleanBackup.articles[id];
            console.log(`restored ${id}`);
        }
    }

    current.articles.contacts = CONTACTS_ARTICLE;

    await publishCanonical(null, current, 'repair-corrupted-content');
    removeSqliteFiles();
    console.log('canonical and static-data repaired; sqlite will rebuild on next start');
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
