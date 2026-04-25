const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const ARCHIVE_ASSETS_DIR = path.join(ROOT, 'assets', 'img', 'archive');

const articleHref = (id) => `/pages/article.html?article=${id}`;

const normalize = (value = '') =>
    String(value)
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9а-яё]+/gi, '');

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (db) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const assetFiles = fs.existsSync(ARCHIVE_ASSETS_DIR) ? fs.readdirSync(ARCHIVE_ASSETS_DIR) : [];

const iconOverrides = {
    warrior: 'quest-warrior-35fe0899ff8e.gif',
    'human knight': 'quest-humanknight-664b9705e49e.gif',
    rogue: 'quest-rogue-16dc39e65921.gif',
    wizard: 'quest-wizard-07e63ddea2bf.gif',
    cleric: 'quest-cleric-8c097a2547b9.gif',
    'elven knight': 'quest-elvenknight-d9cc4bea5830.gif',
    'elven scout': 'quest-silverranger-a3d73ac76dd4.gif',
    'elven wizard': 'quest-elvenwizard-005e5a323c94.gif',
    'elven oracle': 'quest-elvenoracle-48373db6d09d.gif',
    'palus knight': 'quest-palusknight-35391a2bb265.gif',
    assassin: 'quest-abysswalker-1fd084333080.gif',
    'dark wizard': 'quest-darkwizard-2abe16e62adc.gif',
    'shillien oracle': 'quest-shillienoracle-ab056db25efd.gif',
    'orc raider': 'quest-orcraider-f0707333b32a.gif',
    monk: 'quest-monk-74aee4adc1db.gif',
    'orc shaman': 'quest-orcshaman-8159f163dfb7.gif',
    scavenger: 'quest-scavenger-b042c1b78218.gif',
    artisan: 'quest-artisan-96ee0bf76fd0.gif',
    trooper: 'quest-trooper-f1a70c5e7907.gif',
    warder: 'quest-warder-1cd2e61d2545.gif',
    berserker: 'quest-berserker-e1c749514bfa.gif',
    'male soul breaker': 'quest-soulbreaker-c8e199bec023.gif',
    'female soul breaker': 'quest-soulbreaker-c8e199bec023.gif',
    inspector: 'quest-inspector-a36dbe2677b8.gif',
    judicator: 'quest-judicator-343c71f8b305.gif',
};

const findIcon = (label) => {
    const normalizedLabel = normalize(label);
    const directOverride = iconOverrides[String(label).toLowerCase()];

    if (directOverride && assetFiles.includes(directOverride)) {
        return `/assets/img/archive/${directOverride}`;
    }

    const candidates = assetFiles
        .filter((file) => {
            const cleaned = normalize(file);
            return cleaned.includes(normalizedLabel) || normalizedLabel.includes(cleaned);
        })
        .sort((left, right) => {
            const leftGif = left.endsWith('.gif') ? 0 : 1;
            const rightGif = right.endsWith('.gif') ? 0 : 1;
            return leftGif - rightGif || left.length - right.length;
        });

    return candidates[0] ? `/assets/img/archive/${candidates[0]}` : '';
};

const findArticleId = (db, patterns = []) => {
    const articles = Object.values(db.articles || {});

    for (const rawPattern of patterns) {
        const pattern = String(rawPattern).toLowerCase();
        const exact = articles.find((article) => String(article.title || '').toLowerCase() === pattern);

        if (exact) {
            return exact.id;
        }
    }

    for (const rawPattern of patterns) {
        const pattern = String(rawPattern).toLowerCase();
        const match = articles.find((article) => String(article.title || '').toLowerCase().includes(pattern));

        if (match) {
            return match.id;
        }
    }

    return '';
};

const ensureLocationArticle = (db, spec) => {
    if (db.articles[spec.id]) {
        return spec.id;
    }

    db.articles[spec.id] = {
        id: spec.id,
        section: 'locations',
        group: spec.group || 'farming',
        title: spec.title,
        summary: spec.summary,
        eyebrow: 'Локации | Карта мира',
        meta: [
            spec.level ? { label: 'Рекомендуемый уровень', value: spec.level } : null,
            spec.kind ? { label: 'Тип', value: spec.kind } : null,
        ].filter(Boolean),
        intro: [spec.summary],
        related: ['world-map-locations', 'locations-overview', 'locations-cities'].filter((item) => item !== spec.id),
        order: spec.order || 9000,
        blocks: [
            {
                id: `${spec.id}-overview`,
                type: 'prose',
                title: 'Кратко о локации',
                paragraphs: [
                    spec.description || spec.summary,
                    spec.route || 'Используйте карту мира на странице локаций, чтобы быстро найти нужную точку и соседние маршруты.',
                ],
            },
            {
                id: `${spec.id}-facts`,
                type: 'table',
                title: 'Быстрые факты',
                columns: [
                    { key: 'fact', label: 'Параметр' },
                    { key: 'value', label: 'Значение' },
                ],
                rows: [
                    { cells: [{ value: 'Название' }, { value: spec.title }] },
                    spec.level ? { cells: [{ value: 'Уровень' }, { value: spec.level }] } : null,
                    spec.kind ? { cells: [{ value: 'Тип' }, { value: spec.kind }] } : null,
                    spec.near ? { cells: [{ value: 'Рядом' }, { value: spec.near }] } : null,
                ].filter(Boolean),
            },
        ],
    };

    return spec.id;
};

const createWorldTable = (id, title, rows) => ({
    id,
    type: 'table',
    title,
    columns: [
        { key: 'name', label: 'Название' },
        { key: 'level', label: 'Уровень' },
        { key: 'details', label: 'Особенности' },
    ],
    rows: rows.map((row, index) => ({
        id: `${id}-row-${index + 1}`,
        cells: [
            { value: row.label, href: articleHref(row.articleId) },
            { value: row.level },
            { value: row.details },
        ],
    })),
});

const buildClassTreeBlock = (db) => {
    const tabs = [
        { id: 'human', label: 'Human' },
        { id: 'elf', label: 'Elf' },
        { id: 'dark-elf', label: 'Dark Elf' },
        { id: 'dwarf', label: 'Dwarf' },
        { id: 'orc', label: 'Orc' },
        { id: 'kamael', label: 'Kamael' },
    ];

    const groups = [
        { id: 'human-fighter', tabId: 'human', title: 'Human Fighter', columns: 6, rows: 3 },
        { id: 'human-mystic', tabId: 'human', title: 'Human Mystic', columns: 6, rows: 3 },
        { id: 'elf-fighter', tabId: 'elf', title: 'Elven Fighter', columns: 5, rows: 3 },
        { id: 'elf-mystic', tabId: 'elf', title: 'Elven Mystic', columns: 4, rows: 3 },
        { id: 'dark-fighter', tabId: 'dark-elf', title: 'Dark Fighter', columns: 5, rows: 3 },
        { id: 'dark-mystic', tabId: 'dark-elf', title: 'Dark Mystic', columns: 4, rows: 3 },
        { id: 'dwarf-fighter', tabId: 'dwarf', title: 'Dwarven Fighter', columns: 4, rows: 3 },
        { id: 'orc-fighter', tabId: 'orc', title: 'Orc Fighter', columns: 6, rows: 3 },
        { id: 'orc-mystic', tabId: 'orc', title: 'Orc Mystic', columns: 4, rows: 3 },
        { id: 'kamael-male', tabId: 'kamael', title: 'Male Soldier', columns: 5, rows: 3 },
        { id: 'kamael-female', tabId: 'kamael', title: 'Female Soldier', columns: 5, rows: 3 },
    ];

    const nodeSpecs = [
        ['Warrior', ['warrior (воитель)'], 'human', 'human-fighter', 2, 1],
        ['Human Knight', ['human knight (рыцарь)'], 'human', 'human-fighter', 4, 1],
        ['Rogue', ['rogue (разбойник)'], 'human', 'human-fighter', 6, 1],
        ['Warlord', ['warlord'], 'human', 'human-fighter', 1, 2],
        ['Gladiator', ['gladiator'], 'human', 'human-fighter', 2, 2],
        ['Paladin', ['paladin'], 'human', 'human-fighter', 3, 2],
        ['Dark Avenger', ['dark avenger'], 'human', 'human-fighter', 4, 2],
        ['Treasure Hunter', ['treasure hunter'], 'human', 'human-fighter', 5, 2],
        ['Hawkeye', ['hawkeye'], 'human', 'human-fighter', 6, 2],
        ['Dreadnought', ['dreadnought'], 'human', 'human-fighter', 1, 3],
        ['Duelist', ['duelist'], 'human', 'human-fighter', 2, 3],
        ['Phoenix Knight', ['phoenix knight'], 'human', 'human-fighter', 3, 3],
        ['Hell Knight', ['hell knight'], 'human', 'human-fighter', 4, 3],
        ['Adventurer', ['adventurer'], 'human', 'human-fighter', 5, 3],
        ['Sagittarius', ['sagittarius'], 'human', 'human-fighter', 6, 3],

        ['Wizard', ['wizard (маг)'], 'human', 'human-mystic', 2, 1],
        ['Cleric', ['cleric (клерик)'], 'human', 'human-mystic', 5, 1],
        ['Sorcerer', ['sorcerer'], 'human', 'human-mystic', 1, 2],
        ['Necromancer', ['necromancer'], 'human', 'human-mystic', 2, 2],
        ['Warlock', ['warlock'], 'human', 'human-mystic', 3, 2],
        ['Bishop', ['bishop'], 'human', 'human-mystic', 5, 2],
        ['Prophet', ['prophet'], 'human', 'human-mystic', 6, 2],
        ['Archmage', ['archmage'], 'human', 'human-mystic', 1, 3],
        ['Soultaker', ['soultaker'], 'human', 'human-mystic', 2, 3],
        ['Arcana Lord', ['arcana lord'], 'human', 'human-mystic', 3, 3],
        ['Cardinal', ['cardinal'], 'human', 'human-mystic', 5, 3],
        ['Hierophant', ['hierophant'], 'human', 'human-mystic', 6, 3],

        ['Elven Knight', ['elven knight'], 'elf', 'elf-fighter', 2, 1],
        ['Elven Scout', ['elven scout'], 'elf', 'elf-fighter', 4, 1],
        ['Temple Knight', ['temple knight'], 'elf', 'elf-fighter', 1, 2],
        ['Swordsinger', ['swordsinger'], 'elf', 'elf-fighter', 2, 2],
        ['Plains Walker', ['plains walker'], 'elf', 'elf-fighter', 4, 2],
        ['Silver Ranger', ['silver ranger'], 'elf', 'elf-fighter', 5, 2],
        ["Eva's Templar", ["eva's templar"], 'elf', 'elf-fighter', 1, 3],
        ['Sword Muse', ['sword muse'], 'elf', 'elf-fighter', 2, 3],
        ['Wind Rider', ['wind rider'], 'elf', 'elf-fighter', 4, 3],
        ['Moonlight Sentinel', ['moonlight sentinel'], 'elf', 'elf-fighter', 5, 3],

        ['Elven Wizard', ['elven wizard'], 'elf', 'elf-mystic', 2, 1],
        ['Elven Oracle', ['elven oracle'], 'elf', 'elf-mystic', 4, 1],
        ['Spellsinger', ['spellsinger'], 'elf', 'elf-mystic', 1, 2],
        ['Elemental Summoner', ['elemental summoner'], 'elf', 'elf-mystic', 2, 2],
        ['Elven Elder', ['elven elder'], 'elf', 'elf-mystic', 4, 2],
        ['Mystic Muse', ['mystic muse'], 'elf', 'elf-mystic', 1, 3],
        ['Elemental Master', ['elemental master'], 'elf', 'elf-mystic', 2, 3],
        ["Eva's Saint", ["eva's saint"], 'elf', 'elf-mystic', 4, 3],

        ['Palus Knight', ['palus knight'], 'dark-elf', 'dark-fighter', 2, 1],
        ['Assassin', ['assassin'], 'dark-elf', 'dark-fighter', 4, 1],
        ['Shillien Knight', ['shillien knight'], 'dark-elf', 'dark-fighter', 1, 2],
        ['Bladedancer', ['bladedancer'], 'dark-elf', 'dark-fighter', 2, 2],
        ['Abyss Walker', ['abyss walker'], 'dark-elf', 'dark-fighter', 4, 2],
        ['Phantom Ranger', ['phantom ranger'], 'dark-elf', 'dark-fighter', 5, 2],
        ['Shillien Templar', ['shillien templar'], 'dark-elf', 'dark-fighter', 1, 3],
        ['Spectral Dancer', ['spectral dancer'], 'dark-elf', 'dark-fighter', 2, 3],
        ['Ghost Hunter', ['ghost hunter'], 'dark-elf', 'dark-fighter', 4, 3],
        ['Ghost Sentinel', ['ghost sentinel'], 'dark-elf', 'dark-fighter', 5, 3],

        ['Dark Wizard', ['dark wizard'], 'dark-elf', 'dark-mystic', 2, 1],
        ['Shillien Oracle', ['shillien oracle'], 'dark-elf', 'dark-mystic', 4, 1],
        ['Spellhowler', ['spellhowler'], 'dark-elf', 'dark-mystic', 1, 2],
        ['Phantom Summoner', ['phantom summoner'], 'dark-elf', 'dark-mystic', 2, 2],
        ['Shillien Elder', ['shillien elder'], 'dark-elf', 'dark-mystic', 4, 2],
        ['Storm Screamer', ['storm screamer'], 'dark-elf', 'dark-mystic', 1, 3],
        ['Spectral Master', ['spectral master'], 'dark-elf', 'dark-mystic', 2, 3],
        ['Shillien Saint', ['shillien saint'], 'dark-elf', 'dark-mystic', 4, 3],

        ['Scavenger', ['scavenger'], 'dwarf', 'dwarf-fighter', 1, 1],
        ['Artisan', ['artisan'], 'dwarf', 'dwarf-fighter', 3, 1],
        ['Bounty Hunter', ['bounty hunter'], 'dwarf', 'dwarf-fighter', 1, 2],
        ['Warsmith', ['warsmith'], 'dwarf', 'dwarf-fighter', 3, 2],
        ['Fortune Seeker', ['fortune seeker'], 'dwarf', 'dwarf-fighter', 1, 3],
        ['Maestro', ['maestro'], 'dwarf', 'dwarf-fighter', 3, 3],

        ['Orc Raider', ['orc raider'], 'orc', 'orc-fighter', 2, 1],
        ['Monk', ['monk'], 'orc', 'orc-fighter', 5, 1],
        ['Destroyer', ['destroyer'], 'orc', 'orc-fighter', 2, 2],
        ['Tyrant', ['tyrant'], 'orc', 'orc-fighter', 5, 2],
        ['Titan', ['titan'], 'orc', 'orc-fighter', 2, 3],
        ['Grand Khavatari', ['grand khavatari'], 'orc', 'orc-fighter', 5, 3],

        ['Orc Shaman', ['orc shaman'], 'orc', 'orc-mystic', 2, 1],
        ['Overlord', ['overlord'], 'orc', 'orc-mystic', 1, 2],
        ['Warcryer', ['warcryer'], 'orc', 'orc-mystic', 3, 2],
        ['Dominator', ['dominator'], 'orc', 'orc-mystic', 1, 3],
        ['Doomcryer', ['doomcryer'], 'orc', 'orc-mystic', 3, 3],

        ['Trooper', ['trooper (солдат)'], 'kamael', 'kamael-male', 2, 1],
        ['Male Soul Breaker', ['male soul breaker'], 'kamael', 'kamael-male', 4, 1],
        ['Berserker', ['berserker'], 'kamael', 'kamael-male', 1, 2],
        ['Inspector', ['inspector'], 'kamael', 'kamael-male', 5, 2],
        ['Doombringer', ['doombringer'], 'kamael', 'kamael-male', 1, 3],
        ['Male Soul Hound', ['male soul hound'], 'kamael', 'kamael-male', 4, 3],
        ['Judicator', ['judicator'], 'kamael', 'kamael-male', 5, 3],

        ['Warder', ['warder'], 'kamael', 'kamael-female', 2, 1],
        ['Female Soul Breaker', ['female soul breaker'], 'kamael', 'kamael-female', 4, 1],
        ['Arbalester', ['arbalester'], 'kamael', 'kamael-female', 1, 2],
        ['Inspector', ['inspector'], 'kamael', 'kamael-female', 5, 2],
        ['Trickster', ['trickster'], 'kamael', 'kamael-female', 1, 3],
        ['Female Soul Hound', ['female soul hound'], 'kamael', 'kamael-female', 4, 3],
        ['Judicator', ['judicator'], 'kamael', 'kamael-female', 5, 3],
    ];

    const linkSpecs = [
        ['human-fighter', 'Warrior', ['Warlord', 'Gladiator']],
        ['human-fighter', 'Human Knight', ['Paladin', 'Dark Avenger']],
        ['human-fighter', 'Rogue', ['Treasure Hunter', 'Hawkeye']],
        ['human-fighter', 'Warlord', ['Dreadnought']],
        ['human-fighter', 'Gladiator', ['Duelist']],
        ['human-fighter', 'Paladin', ['Phoenix Knight']],
        ['human-fighter', 'Dark Avenger', ['Hell Knight']],
        ['human-fighter', 'Treasure Hunter', ['Adventurer']],
        ['human-fighter', 'Hawkeye', ['Sagittarius']],
        ['human-mystic', 'Wizard', ['Sorcerer', 'Necromancer', 'Warlock']],
        ['human-mystic', 'Cleric', ['Bishop', 'Prophet']],
        ['human-mystic', 'Sorcerer', ['Archmage']],
        ['human-mystic', 'Necromancer', ['Soultaker']],
        ['human-mystic', 'Warlock', ['Arcana Lord']],
        ['human-mystic', 'Bishop', ['Cardinal']],
        ['human-mystic', 'Prophet', ['Hierophant']],
        ['elf-fighter', 'Elven Knight', ['Temple Knight', 'Swordsinger']],
        ['elf-fighter', 'Elven Scout', ['Plains Walker', 'Silver Ranger']],
        ['elf-fighter', 'Temple Knight', ["Eva's Templar"]],
        ['elf-fighter', 'Swordsinger', ['Sword Muse']],
        ['elf-fighter', 'Plains Walker', ['Wind Rider']],
        ['elf-fighter', 'Silver Ranger', ['Moonlight Sentinel']],
        ['elf-mystic', 'Elven Wizard', ['Spellsinger', 'Elemental Summoner']],
        ['elf-mystic', 'Elven Oracle', ['Elven Elder']],
        ['elf-mystic', 'Spellsinger', ['Mystic Muse']],
        ['elf-mystic', 'Elemental Summoner', ['Elemental Master']],
        ['elf-mystic', 'Elven Elder', ["Eva's Saint"]],
        ['dark-fighter', 'Palus Knight', ['Shillien Knight', 'Bladedancer']],
        ['dark-fighter', 'Assassin', ['Abyss Walker', 'Phantom Ranger']],
        ['dark-fighter', 'Shillien Knight', ['Shillien Templar']],
        ['dark-fighter', 'Bladedancer', ['Spectral Dancer']],
        ['dark-fighter', 'Abyss Walker', ['Ghost Hunter']],
        ['dark-fighter', 'Phantom Ranger', ['Ghost Sentinel']],
        ['dark-mystic', 'Dark Wizard', ['Spellhowler', 'Phantom Summoner']],
        ['dark-mystic', 'Shillien Oracle', ['Shillien Elder']],
        ['dark-mystic', 'Spellhowler', ['Storm Screamer']],
        ['dark-mystic', 'Phantom Summoner', ['Spectral Master']],
        ['dark-mystic', 'Shillien Elder', ['Shillien Saint']],
        ['dwarf-fighter', 'Scavenger', ['Bounty Hunter']],
        ['dwarf-fighter', 'Artisan', ['Warsmith']],
        ['dwarf-fighter', 'Bounty Hunter', ['Fortune Seeker']],
        ['dwarf-fighter', 'Warsmith', ['Maestro']],
        ['orc-fighter', 'Orc Raider', ['Destroyer']],
        ['orc-fighter', 'Monk', ['Tyrant']],
        ['orc-fighter', 'Destroyer', ['Titan']],
        ['orc-fighter', 'Tyrant', ['Grand Khavatari']],
        ['orc-mystic', 'Orc Shaman', ['Overlord', 'Warcryer']],
        ['orc-mystic', 'Overlord', ['Dominator']],
        ['orc-mystic', 'Warcryer', ['Doomcryer']],
        ['kamael-male', 'Trooper', ['Berserker']],
        ['kamael-male', 'Male Soul Breaker', ['Male Soul Hound', 'Inspector']],
        ['kamael-male', 'Berserker', ['Doombringer']],
        ['kamael-male', 'Inspector', ['Judicator']],
        ['kamael-female', 'Warder', ['Arbalester']],
        ['kamael-female', 'Female Soul Breaker', ['Female Soul Hound', 'Inspector']],
        ['kamael-female', 'Arbalester', ['Trickster']],
        ['kamael-female', 'Inspector', ['Judicator']],
    ];

    const nodes = nodeSpecs.map(([label, patterns, raceTab, groupId, column, row]) => {
        const articleId = findArticleId(db, patterns);
        return {
            id: `${groupId}-${normalize(label)}`,
            label,
            iconSrc: findIcon(label),
            iconAlt: label,
            href: articleId ? articleHref(articleId) : '',
            tier: row,
            raceTab,
            groupId,
            column,
            row,
        };
    });

    const links = linkSpecs
        .flatMap(([groupId, fromLabel, toLabels]) =>
            toLabels.map((toLabel) => ({
                id: `${groupId}-${normalize(fromLabel)}-${normalize(toLabel)}`,
                from: `${groupId}-${normalize(fromLabel)}`,
                to: `${groupId}-${normalize(toLabel)}`,
                raceTab: groups.find((group) => group.id === groupId)?.tabId || '',
                groupId,
            }))
        )
        .filter((link) => nodes.find((node) => node.id === link.from) && nodes.find((node) => node.id === link.to));

    return {
        id: 'class-tree-visual',
        type: 'classTree',
        title: '',
        tabs,
        groups,
        nodes,
        links,
    };
};

const updateWorldMapArticle = (db) => {
    const article = db.articles['world-map-locations'];

    if (!article) {
        return;
    }

    const locationSpecs = [
        {
            id: 'location-talking-island',
            title: 'Talking Island Village',
            level: '1-20',
            kind: 'Стартовый город',
            summary: 'Стартовая зона людей с быстрым доступом к первым квестам, тренерам и раннему маршруту в Gludin.',
            description: 'Talking Island удобно использовать как стартовую точку для новичков и для быстрой ориентации по ранним маршрутам.',
            near: 'Стартовые квесты, Gatekeeper, Gludin',
        },
        {
            id: 'location-gludin',
            title: 'The Village of Gludin',
            level: '10-25',
            kind: 'Город',
            summary: 'Портовый город ранней игры, через который удобно выходить к некрополям, Ruins of Despair и на Talking Island.',
            description: 'Gludin остаётся важной транспортной развязкой и удобным промежуточным пунктом для ранних уровней.',
            near: 'Ruins of Despair, Necropolis of Sacrifice',
        },
        {
            id: 'location-giran',
            title: 'Town of Giran',
            level: '40-60',
            kind: 'Торговый центр',
            summary: 'Главный торговый город сервера: рынок, телепорты, квестовые NPC и быстрый доступ к центральным зонам.',
            description: 'Giran чаще всего становится базой для торговли, встреч и маршрутов к локациям среднего уровня.',
            near: 'Cruma Tower, Catacombs, Gorgon Flower Garden',
        },
        {
            id: 'location-ruins-despair',
            title: 'Ruins of Despair',
            level: '10-20',
            kind: 'Фарм-зона',
            summary: 'Ранний спот с плотными мобами, аденой и удобным маршрутом от Gludin.',
            near: 'Gludin',
        },
        {
            id: 'location-elven-forest',
            title: 'Elven Forest',
            level: '15-25',
            kind: 'Фарм-зона',
            summary: 'Спокойная лесная зона со стартовым фармом, ресурсами и удобным прокачочным темпом.',
            near: 'Elven Village',
        },
        {
            id: 'location-dark-elven-forest',
            title: 'Dark Elven Forest',
            level: '15-25',
            kind: 'Фарм-зона',
            summary: 'Лесная зона тёмных эльфов с ранними маршрутами и крафтовыми ресурсами.',
            near: 'Dark Elven Village',
        },
        {
            id: 'location-cruma-tower',
            title: 'Cruma Tower',
            level: '30-45',
            kind: 'Подземелье',
            summary: 'Классическая башня для среднего уровня с плотным фармом, квестами и C-grade добычей.',
            near: 'Dion, Giran',
        },
        {
            id: 'location-sea-spores',
            title: 'Sea of Spores',
            level: '40-55',
            kind: 'Фарм-зона',
            summary: 'Плотный спот возле Oren и Ivory Tower, где удобно совмещать опыт и ресурсы.',
            near: 'Oren, Ivory Tower',
        },
        {
            id: 'location-devastated-castle',
            title: 'Devastated Castle',
            level: '50-65',
            kind: 'Фарм-зона',
            summary: 'Высокоуровневая зона перед Aden и Tower of Insolence с полезным дропом и маршрутом к позднему PvE.',
            near: 'Aden, The Disciple’s Necropolis',
        },
        {
            id: 'location-tower-insolence',
            title: 'Tower of Insolence',
            level: '60-75',
            kind: 'Башня',
            summary: 'Одна из ключевых high-level зон с лестницей этажей, боссами и дорогим дропом.',
            near: 'Aden',
        },
        {
            id: 'location-primeval-isle',
            title: 'Primeval Isle',
            level: '70-80',
            kind: 'Фарм-зона',
            summary: 'Остров с динозаврами, плотным опытом и высокоуровневым лутом.',
            near: 'Rune, Wharf',
        },
        {
            id: 'location-stakato-nest',
            title: 'Stakato Nest',
            level: '70-80',
            kind: 'Фарм-зона',
            summary: 'Поздняя пещерная зона с плотной прокачкой, агрессивными пачками и маршрутом от Rune.',
            near: 'Rune',
        },
        {
            id: 'location-mithril-mines',
            title: 'Mithril Mines',
            level: '40-60',
            kind: 'Подземелье',
            summary: 'Шахты рядом со Schuttgart, полезные для фарма материалов и стабильного опыта.',
            near: 'Schuttgart',
        },
        {
            id: 'location-valley-saints',
            title: 'Valley of Saints',
            level: '60-75',
            kind: 'Фарм-зона',
            summary: 'Зона возле Rune для среднего и высокого уровня с востребованными ресурсами.',
            near: 'Rune',
        },
        {
            id: 'location-ivory-tower',
            title: 'Ivory Tower',
            level: '50-70',
            kind: 'Ориентир',
            summary: 'Ключевой ориентир рядом с Oren, Sea of Spores и частью магических маршрутов.',
            near: 'Oren, Sea of Spores',
        },
    ];

    locationSpecs.forEach((spec) => ensureLocationArticle(db, spec));

    const townRows = [
        ['Talking Island Village', 'location-talking-island', '1-20', 'Стартовая локация'],
        ['The Village of Gludin', 'location-gludin', '10-25', 'Порт, ранние маршруты'],
        ['Town of Gludio', 'archive-location-castle-item-3443-gludio-castle', '20-40', 'Катакомбы рядом'],
        ['Town of Dion', 'archive-location-castle-item-3444-dion-castle', '30-50', 'Фермы и Cruma Tower'],
        ['Town of Giran', 'location-giran', '40-60', 'Центр торговли'],
        ['Town of Oren', 'archive-location-castle-item-3447-oren-castle', '50-70', 'Ivory Tower'],
        ['Town of Aden', 'archive-location-castle-item-3451-aden-castle', '60-80', 'Столица и Tower of Insolence'],
        ['Town of Goddard', 'archive-location-castle-item-3449-goddard-castle', '70-80', 'Северные маршруты'],
        ['Town of Schuttgart', 'archive-location-castle-item-3448-schuttgart-castle', '70-80', 'Шахты и гиганты'],
        ['Town of Rune', 'archive-location-castle-item-3450-rune-castle', '70-80', 'Primeval Isle и Stakato Nest'],
    ].map(([label, articleId, level, details]) => ({ label, articleId, level, details }));

    const farmingRows = [
        ['Ruins of Despair', 'location-ruins-despair', '10-20', 'Adena, материалы'],
        ['Elven Forest', 'location-elven-forest', '15-25', 'Ресурсы для крафта'],
        ['Dark Elven Forest', 'location-dark-elven-forest', '15-25', 'Кости, кожа'],
        ['Cruma Tower', 'location-cruma-tower', '30-45', 'C-grade, рецепты'],
        ['Sea of Spores', 'location-sea-spores', '40-55', 'Ресурсы, магические маршруты'],
        ['Devastated Castle', 'location-devastated-castle', '50-65', 'B-grade дроп'],
        ['Tower of Insolence', 'location-tower-insolence', '60-75', 'A-grade и high-level фарм'],
        ['Catacombs / Necropolis', 'catacombs-necropolis', '60-80', 'Seal Stones, Ancient Adena'],
        ['Primeval Isle', 'location-primeval-isle', '70-80', 'Динозавры, S-grade'],
        ['Stakato Nest', 'location-stakato-nest', '70-80', 'Стакато и плотные паки'],
        ['Mithril Mines', 'location-mithril-mines', '40-60', 'Мифрил, материалы'],
        ['Valley of Saints', 'location-valley-saints', '60-75', 'Материалы S-grade'],
    ].map(([label, articleId, level, details]) => ({ label, articleId, level, details }));

    const npcTable = {
        id: 'world-npc-services',
        type: 'table',
        title: 'Важные NPC и сервисы',
        columns: [
            { key: 'npc', label: 'NPC / сервис' },
            { key: 'place', label: 'Где искать' },
            { key: 'why', label: 'Зачем нужен' },
        ],
        rows: [
            {
                id: 'npc-services-1',
                cells: [
                    { value: 'Valkon', href: articleHref('archive-npc-item-5447-valkon') },
                    { value: 'Giran' },
                    { value: 'Маршруты и связанные profession/Saga-материалы' },
                ],
            },
            {
                id: 'npc-services-2',
                cells: [
                    { value: 'Gatekeeper Network', href: articleHref('gatekeeper-network') },
                    { value: 'Основные города' },
                    { value: 'Быстрое перемещение между точками карты' },
                ],
            },
            {
                id: 'npc-services-3',
                cells: [
                    { value: 'Mammon Services', href: articleHref('mammon-services') },
                    { value: 'Ключевые Seven Signs маршруты' },
                    { value: 'Распечатка, обмен и улучшение экипировки' },
                ],
            },
        ],
    };

    const markers = [
        { label: 'Talking Island Village', href: articleHref('location-talking-island'), x: 7.8, y: 83.8, kind: 'location' },
        { label: 'Gludin', href: articleHref('location-gludin'), x: 10.4, y: 70.7, kind: 'location' },
        { label: 'Gludio', href: articleHref('archive-location-castle-item-3443-gludio-castle'), x: 14.8, y: 74.6, kind: 'location' },
        { label: 'Dion', href: articleHref('archive-location-castle-item-3444-dion-castle'), x: 23.8, y: 69.6, kind: 'location' },
        { label: 'Giran', href: articleHref('location-giran'), x: 30.9, y: 82.1, kind: 'location' },
        { label: 'Oren', href: articleHref('archive-location-castle-item-3447-oren-castle'), x: 39.7, y: 60.5, kind: 'location' },
        { label: 'Ivory Tower', href: articleHref('location-ivory-tower'), x: 46.3, y: 58.2, kind: 'location' },
        { label: 'Aden', href: articleHref('archive-location-castle-item-3451-aden-castle'), x: 50.6, y: 48.2, kind: 'location' },
        { label: 'Goddard', href: articleHref('archive-location-castle-item-3449-goddard-castle'), x: 68.5, y: 39.3, kind: 'location' },
        { label: 'Schuttgart', href: articleHref('archive-location-castle-item-3448-schuttgart-castle'), x: 51.1, y: 24.6, kind: 'location' },
        { label: 'Rune', href: articleHref('archive-location-castle-item-3450-rune-castle'), x: 63.7, y: 27.1, kind: 'location' },
        { label: 'Cruma Tower', href: articleHref('location-cruma-tower'), x: 24.8, y: 78.2, kind: 'location' },
        { label: 'Tower of Insolence', href: articleHref('location-tower-insolence'), x: 58.4, y: 49.7, kind: 'location' },
        { label: 'Primeval Isle', href: articleHref('location-primeval-isle'), x: 71.2, y: 90.8, kind: 'location' },
        { label: 'Stakato Nest', href: articleHref('location-stakato-nest'), x: 68.9, y: 33.4, kind: 'location' },
        { label: 'Valley of Saints', href: articleHref('location-valley-saints'), x: 57.6, y: 33.7, kind: 'location' },
        { label: 'Mithril Mines', href: articleHref('location-mithril-mines'), x: 48.7, y: 18.5, kind: 'location' },
        { label: 'Gatekeeper Routes', href: articleHref('gatekeeper-network'), x: 31.3, y: 81.5, kind: 'npc', note: 'Быстрые перемещения через Giran' },
        { label: 'Valkon', href: articleHref('archive-npc-item-5447-valkon'), x: 30.6, y: 81.8, kind: 'npc', note: 'Giran' },
        { label: 'Mammon Services', href: articleHref('mammon-services'), x: 68.8, y: 39.8, kind: 'npc', note: 'Маршруты Seven Signs' },
    ];

    article.summary = 'Полная карта мира Lineage 2 с городами, фарм-зонами и важными NPC на одном полотне.';
    article.related = Array.from(
        new Set(['locations-overview', 'locations-cities', 'gatekeeper-network', 'mammon-services', ...(article.related || [])])
    );
    article.blocks = [
        {
            id: 'world-interactive-map',
            type: 'imageMap',
            title: 'Интерактивная карта мира',
            imageSrc: '/map.png',
            imageAlt: 'Карта мира Lineage II с отмеченными точками городов, локаций и NPC',
            markers,
            legend: [
                { id: 'legend-location', label: 'Локации и города', kind: 'location' },
                { id: 'legend-npc', label: 'NPC и сервисы', kind: 'npc' },
            ],
        },
        createWorldTable('main-towns', 'Основные города (Towns)', townRows),
        createWorldTable('farming-zones', 'Фарм-зоны по уровням', farmingRows),
        npcTable,
        {
            id: 'world-map-tip',
            type: 'callout',
            title: 'Как пользоваться картой',
            tone: 'info',
            items: [
                'Красные точки открывают локальные статьи без перехода на внешний сайт.',
                'Сначала смотрите ближайший город, затем соседние споты и сервисы вокруг него.',
                'Для Seven Signs и обмена Ancient Adena удобнее держать рядом маршруты к Gatekeeper и Mammon.',
            ],
        },
    ];
};

const main = () => {
    const db = readDatabase();
    const classTreeArticle = db.articles['class-tree'];

    if (classTreeArticle) {
        classTreeArticle.summary = 'Полная схема профессий Lineage II по расам с переходами на локальные статьи классов.';
        classTreeArticle.blocks = [buildClassTreeBlock(db)];
        classTreeArticle.related = Array.from(
            new Set([
                'quest-profession-first',
                'quest-profession-second',
                'quest-profession-third',
                ...(classTreeArticle.related || []),
            ])
        );
    }

    updateWorldMapArticle(db);
    db.updatedAt = new Date().toISOString();
    writeDatabase(db);
    console.log('Updated class tree and world map structures.');
};

main();
