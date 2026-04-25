#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { CANONICAL_PATH, writeCanonicalMeta, writeStaticData } = require('../lib/canonical-store');

const SITE_ROOT = 'https://l2int.ru';
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'NG'];

const weaponCategoryConfigs = [
    { articleId: 'weapons-swords', remotePath: '/predmety/oruzhie/swords' },
    { articleId: 'weapons-two-handed', remotePath: '/predmety/oruzhie/two-handed-swords' },
    { articleId: 'weapons-bows', remotePath: '/predmety/oruzhie/bows' },
    { articleId: 'weapons-daggers', remotePath: '/predmety/oruzhie/daggers' },
    { articleId: 'weapons-duals', remotePath: '/predmety/oruzhie/duals' },
    { articleId: 'weapons-blunt', remotePath: '/predmety/oruzhie/blunts' },
    { articleId: 'weapons-two-handed-blunt', remotePath: '/predmety/oruzhie/two-handed-blunts' },
    { articleId: 'weapons-fists', remotePath: '/predmety/oruzhie/fists' },
    { articleId: 'weapons-pole', remotePath: '/predmety/oruzhie/pole' },
    { articleId: 'weapons-rapier', remotePath: '/predmety/oruzhie/rapier' },
    { articleId: 'weapons-magic-books', remotePath: '/predmety/oruzhie/magic-book' },
];

const weaponCategoryByPath = new Map(weaponCategoryConfigs.map((entry) => [entry.remotePath.replace(/\/+$/, ''), entry.articleId]));

const htmlCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchHtml = async (url) => {
    if (htmlCache.has(url)) {
        return htmlCache.get(url);
    }

    const response = await fetch(url, {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml',
        },
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    const html = await response.text();
    htmlCache.set(url, html);
    await sleep(120);
    return html;
};

const toAbsoluteUrl = (value) => {
    if (!value) {
        return '';
    }

    try {
        return new URL(value, SITE_ROOT).toString();
    } catch (error) {
        return value;
    }
};

const slugify = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/&nbsp;/g, ' ')
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '');

const normalizeSpaces = (value) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim();

const escapeHtml = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const extractWeaponNamesFromCell = (cell = {}) => {
    if (cell.html) {
        const $ = cheerio.load(`<div>${cell.html}</div>`);
        const lines = $('div')
            .text()
            .split('\n')
            .map((line) => normalizeSpaces(line))
            .filter(Boolean);

        if (lines.length >= 2) {
            return {
                en: lines[0],
                ru: lines.slice(1).join(' '),
            };
        }
    }

    const value = String(cell.value || '');
    if (value.includes('/')) {
        const parts = value.split('/').map((item) => normalizeSpaces(item));
        return {
            en: parts[0] || '',
            ru: parts.slice(1).join(' / '),
        };
    }

    return {
        en: value,
        ru: '',
    };
};

const buildWeaponNameHtml = ({ iconSrc, en, ru, alt }) => {
    const safeIcon = escapeHtml(iconSrc);
    const safeAlt = escapeHtml(alt || `${en} ${ru}`.trim() || 'Lineage II');
    return `
        <span class="weapon-table__item">
            <img class="wiki-item-thumb" src="${safeIcon}" alt="${safeAlt}" loading="lazy" />
            <span class="wiki-item-link">
                <span class="wiki-item-link__en">${escapeHtml(en)}</span>
                ${ru ? `<span class="wiki-item-link__ru">${escapeHtml(ru)}</span>` : ''}
            </span>
        </span>
    `.trim();
};

const buildWeaponCategoryHtml = ({ iconSrc, label }) => {
    const safeIcon = escapeHtml(iconSrc);
    const safeLabel = escapeHtml(label);
    return `
        <span class="weapon-category-link">
            <img class="wiki-item-thumb" src="${safeIcon}" alt="${safeLabel}" loading="lazy" />
            <span class="weapon-category-link__label">${safeLabel}</span>
        </span>
    `.trim();
};

const buildWeaponGradeHtml = ({ iconSrc, gradeLabel }) => {
    if (!iconSrc && !gradeLabel) {
        return '';
    }

    return `
        <span class="weapon-grade">
            ${iconSrc ? `<img class="weapon-grade__icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(gradeLabel || 'Grade')}" loading="lazy" />` : ''}
            <span>${escapeHtml(gradeLabel || '')}</span>
        </span>
    `.trim();
};

const getLocalWeaponCategoryId = (remoteHref = '') => {
    const href = String(remoteHref || '').replace(/\/+$/, '');

    for (const [remotePath, articleId] of weaponCategoryByPath.entries()) {
        if (href.startsWith(remotePath)) {
            return articleId;
        }
    }

    return '';
};

const buildLocalWeaponGradeHref = (articleId, grade) => {
    if (!articleId) {
        return '';
    }

    return `/pages/article.html?article=${articleId}#${String(grade || '').toLowerCase()}-grade-table`;
};

const buildWeaponOverviewRows = async (database) => {
    const html = await fetchHtml(`${SITE_ROOT}/predmety/oruzhie`);
    const $ = cheerio.load(html);
    const table = $('table').first();
    const rows = [];

    table.find('tr').each((index, tr) => {
        const cells = $(tr).find('> td');
        if (!cells.length) {
            return;
        }

        const leadCell = cells.eq(0);
        const label = normalizeSpaces(leadCell.find('strong').text() || leadCell.text());
        const iconSrc = toAbsoluteUrl(leadCell.find('img').attr('src'));
        const firstGradeHref = normalizeSpaces(cells.eq(1).find('a').attr('href'));
        const localArticleId = getLocalWeaponCategoryId(firstGradeHref);
        const localArticle = localArticleId ? database.articles[localArticleId] : null;
        const availableBlockIds = new Set((localArticle?.blocks || []).filter((block) => block.type === 'table').map((block) => block.id));

        const row = {
            id: `weapons-overview-${slugify(label || `row-${index + 1}`) || `row-${index + 1}`}`,
            cells: [
                {
                    value: label,
                    html: iconSrc ? buildWeaponCategoryHtml({ iconSrc, label }) : escapeHtml(label),
                    href: localArticleId ? `/pages/article.html?article=${localArticleId}` : '',
                },
            ],
        };

        GRADE_ORDER.forEach((grade, gradeIndex) => {
            const gradeCell = cells.eq(gradeIndex + 1);
            const hasGradeLink = Boolean(gradeCell.find('a').length);
            const gradeText = normalizeSpaces(gradeCell.text());
            const gradeBlockId = `${grade.toLowerCase()}-grade-table`;
            const href =
                hasGradeLink && localArticleId && availableBlockIds.has(gradeBlockId)
                    ? buildLocalWeaponGradeHref(localArticleId, grade)
                    : '';
            row.cells.push({
                value: gradeText || (hasGradeLink ? grade : ''),
                href,
            });
        });

        rows.push(row);
    });

    return rows;
};

const parseWeaponCategoryRows = async (url) => {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const table = $('table.table-category').first();
    const rows = new Map();

    table.find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('> td');
        if (cells.length < 7) {
            return;
        }

        const iconCell = cells.eq(0);
        const nameCell = cells.eq(1);
        const rankCell = cells.eq(cells.length - 1);
        const anchor = nameCell.find('a').first();
        const remoteItemHref = anchor.attr('href') || '';
        const match = remoteItemHref.match(/\/item\/(\d+)-([^/?#]+)/i);

        if (!match) {
            return;
        }

        const numericId = match[1];
        const ru = normalizeSpaces(nameCell.find('span').text()).replace(/^\(|\)$/g, '');
        const en = normalizeSpaces(anchor.clone().find('span').remove().end().text());
        const iconSrc = toAbsoluteUrl(iconCell.find('img').attr('src'));
        const gradeIcon = toAbsoluteUrl(rankCell.find('img').attr('src'));
        const gradeLabel = normalizeSpaces(rankCell.text());

        rows.set(numericId, {
            en,
            ru,
            iconSrc,
            gradeIcon,
            gradeLabel,
        });
    });

    return rows;
};

const enrichWeaponCategoryArticles = async (database) => {
    for (const config of weaponCategoryConfigs) {
        const article = database.articles[config.articleId];
        if (!article) {
            continue;
        }

        for (const block of article.blocks || []) {
            if (block.type !== 'table') {
                continue;
            }

            const grade = String(block.id || '')
                .split('-')[0]
                .toLowerCase();
            if (!grade) {
                continue;
            }

            let remoteRows;
            try {
                remoteRows = await parseWeaponCategoryRows(`${SITE_ROOT}${config.remotePath}/${grade}`);
            } catch (error) {
                console.warn(`[refresh] Skip ${config.articleId} ${grade}: ${error.message}`);
                continue;
            }

            block.rows = (block.rows || []).map((row) => {
                const cells = row.cells || [];
                if (!cells.length) {
                    return row;
                }

                const nameCell = cells[0];
                const localHref = String(nameCell.href || '');
                const match = localHref.match(/article=weapon-item-(\d+)-/i);
                if (!match) {
                    return row;
                }

                const remote = remoteRows.get(match[1]);
                if (!remote) {
                    return row;
                }

                const fallbackNames = extractWeaponNamesFromCell(nameCell);
                nameCell.html = buildWeaponNameHtml({
                    iconSrc: remote.iconSrc,
                    en: remote.en || fallbackNames.en,
                    ru: remote.ru || fallbackNames.ru,
                    alt: `${remote.en || fallbackNames.en} ${remote.ru || fallbackNames.ru}`.trim(),
                });

                const gradeCellIndex = Math.max(0, cells.length - 1);
                if (cells[gradeCellIndex]) {
                    cells[gradeCellIndex].html = buildWeaponGradeHtml({
                        iconSrc: remote.gradeIcon,
                        gradeLabel: remote.gradeLabel || cells[gradeCellIndex].value,
                    });
                }

                return row;
            });
        }
    }
};

const buildSkillStatsHtml = (cell) => {
    const $ = cheerio.load(`<div>${cell.html()}</div>`);
    const lines = [];
    let currentLabel = '';
    let currentText = '';

    $('div')
        .contents()
        .each((_, node) => {
            if (node.type === 'tag' && node.tagName === 'img') {
                if (currentLabel || currentText) {
                    lines.push({ label: currentLabel, text: normalizeSpaces(currentText) });
                }

                currentLabel = normalizeSpaces($(node).attr('title'));
                currentText = '';
                return;
            }

            if (node.type === 'tag' && node.tagName === 'br') {
                if (currentLabel || currentText) {
                    lines.push({ label: currentLabel, text: normalizeSpaces(currentText) });
                }

                currentLabel = '';
                currentText = '';
                return;
            }

            if (node.type === 'text') {
                currentText += ` ${$(node).text()}`;
            }
        });

    if (currentLabel || currentText) {
        lines.push({ label: currentLabel, text: normalizeSpaces(currentText) });
    }

    return `
        <span class="skill-stats">
            ${lines
                .map(({ label, text }) => {
                    const variant = /перезар/i.test(label) ? 'reuse' : /дистанц/i.test(label) ? 'range' : 'cast';
                    return `
                        <span class="skill-stats__line">
                            <span class="skill-stats__icon skill-stats__icon--${variant}"></span>
                            <span>${escapeHtml(text || '-')}</span>
                        </span>
                    `.trim();
                })
                .join('')}
        </span>
    `.trim();
};

const buildSkillPriceHtml = (cell) => {
    const img = cell.find('img').first();
    const iconSrc = toAbsoluteUrl(img.attr('src'));
    const text = normalizeSpaces(cell.text());

    return `
        <span class="skill-price">
            ${iconSrc ? `<img class="skill-price__icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(text || 'Цена')}" loading="lazy" />` : ''}
            <span>${escapeHtml(text)}</span>
        </span>
    `.trim();
};

const buildFishingSkillBlocks = async () => {
    const html = await fetchHtml(`${SITE_ROOT}/skills/fishing-skills`);
    const $ = cheerio.load(html);
    const root = $('.itemFullText').first();
    const introParagraph = normalizeSpaces(root.children('p').first().text());
    const tablesMarkup = [];

    const blocks = [
        {
            id: 'fishing-overview',
            type: 'prose',
            title: 'Где их можно выучить?',
            paragraphs: [
                introParagraph ||
                    'Скиллы можно купить у Fishing Guide NPC в Grocery (магических магазинах) любого города. Для получения умений выберите "Please teach me to fish" в меню разговора с NPC.',
            ],
        },
    ];

    root.children('h4').each((index, heading) => {
        const title = normalizeSpaces($(heading).text());
        const table = $(heading).nextAll('table').first();
        if (!table.length) {
            return;
        }

        const rowsMarkup = [];
        table
            .find('tr')
            .slice(1)
            .each((rowIndex, tr) => {
                const cells = $(tr).find('> td');
                if (cells.length < 7) {
                    return;
                }

                const iconSrc = toAbsoluteUrl(cells.eq(0).find('img').attr('src'));
                const nameCell = cells.eq(1);
                const en = normalizeSpaces(nameCell.find('strong').text());
                const ru = normalizeSpaces(nameCell.find('span').text()).replace(/^\(|\)$/g, '');
                const description = normalizeSpaces(cells.eq(2).text());
                const typeHtml = cells
                    .eq(3)
                    .html()
                    .split(/<br\s*\/?>/i)
                    .map((part) => escapeHtml(normalizeSpaces(part.replace(/<[^>]+>/g, ' '))))
                    .filter(Boolean)
                    .join('<br>');

                rowsMarkup.push(
                    `
                <tr>
                    <td>${iconSrc ? `<img class="wiki-skill-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(`${en} ${ru}`.trim())}" loading="lazy" />` : ''}</td>
                    <td>
                        <span class="skill-name">
                            <span class="skill-name__en">${escapeHtml(en)}</span>
                            ${ru ? `<span class="skill-name__ru">(${escapeHtml(ru)})</span>` : ''}
                        </span>
                    </td>
                    <td>${escapeHtml(description)}</td>
                    <td>${typeHtml}</td>
                    <td>${buildSkillStatsHtml(cells.eq(4))}</td>
                    <td>${escapeHtml(normalizeSpaces(cells.eq(5).text()))}</td>
                    <td>${buildSkillPriceHtml(cells.eq(6))}</td>
                </tr>
            `.trim()
                );
            });

        tablesMarkup.push(
            `
            <section class="fishing-skills__section">
                <h2 class="rich-block__title">${escapeHtml(title)}</h2>
                <div class="wiki-rich-table wiki-rich-table--skills">
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                <th>Название</th>
                                <th>Описание</th>
                                <th>Тип</th>
                                <th>Статистика</th>
                                <th>MP</th>
                                <th>Цена</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsMarkup.join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `.trim()
        );
    });

    blocks.push({
        id: 'fishing-skills-tables',
        type: 'html',
        title: 'Таблица скиллов',
        html: `
            <div class="fishing-skills__legend">
                <span class="skill-stats__line"><span class="skill-stats__icon skill-stats__icon--cast"></span><span>Применение навыка в секундах</span></span>
                <span class="skill-stats__line"><span class="skill-stats__icon skill-stats__icon--reuse"></span><span>Перезарядка навыка в секундах</span></span>
            </div>
            <div class="fishing-skills__tables">
                ${tablesMarkup.join('')}
            </div>
        `.trim(),
    });

    return blocks;
};

const buildMonstersSectionGroups = (database) => {
    const overviewEntries = [
        'monsters-overview',
        'raid-monsters',
        'catacomb-monsters',
        'pagan-temple-monsters',
        'instance-monsters',
        'misc-epic-overview',
    ].filter((id) => database.articles[id]);

    const detailEntries = Object.keys(database.articles)
        .filter((id) => database.articles[id]?.section === 'monsters' && !overviewEntries.includes(id))
        .sort((left, right) =>
            String(database.articles[left].title || '').localeCompare(String(database.articles[right].title || ''), 'en')
        );

    const buckets = [
        { id: 'a-f', label: 'Монстры A - F', description: 'Обычные и special-монстры по алфавиту от A до F.', entries: [] },
        { id: 'g-l', label: 'Монстры G - L', description: 'Монстры и мобы по алфавиту от G до L.', entries: [] },
        { id: 'm-r', label: 'Монстры M - R', description: 'Монстры и мобы по алфавиту от M до R.', entries: [] },
        { id: 's-z', label: 'Монстры S - Z', description: 'Монстры и мобы по алфавиту от S до Z.', entries: [] },
    ];

    const resolveBucket = (title) => {
        const letter = String(title || '')
            .trim()
            .charAt(0)
            .toUpperCase();
        if (!letter || letter < 'G') {
            return buckets[0];
        }
        if (letter < 'M') {
            return buckets[1];
        }
        if (letter < 'S') {
            return buckets[2];
        }
        return buckets[3];
    };

    detailEntries.forEach((id) => {
        const article = database.articles[id];
        const bucket = resolveBucket(article.title);
        bucket.entries.push(id);
        article.group = bucket.id;
    });

    ['monsters-overview', 'raid-monsters', 'catacomb-monsters', 'pagan-temple-monsters', 'instance-monsters', 'misc-epic-overview'].forEach(
        (id) => {
            if (database.articles[id]) {
                database.articles[id].group = 'overview';
            }
        }
    );

    database.sections.monsters.title = 'Монстры';
    database.sections.monsters.description = 'Обычные монстры, рейдовые и эпические боссы, катакомбы, Pagan Temple и instance-контент.';
    database.sections.monsters.stats = [
        {
            label: 'Материалов',
            value: String(Object.keys(database.articles).filter((id) => database.articles[id]?.section === 'monsters').length),
        },
        { label: 'Групп', value: '5' },
        { label: 'Детальных страниц', value: String(detailEntries.length) },
    ];
    database.sections.monsters.groups = [
        {
            id: 'overview',
            label: 'Обзор и подборки',
            description: 'Общий бестиарий, рейдовые боссы, эпик-боссы и спец-локации.',
            entries: overviewEntries,
            order: 0,
        },
        ...buckets.map((bucket, index) => ({
            id: bucket.id,
            label: bucket.label,
            description: bucket.description,
            entries: bucket.entries,
            order: index + 1,
        })),
    ];
};

const restoreEpicBossTabs = (database) => {
    const questsSection = database.sections.quests;
    if (!questsSection) {
        return;
    }

    if (database.articles['misc-epic-overview']) {
        database.articles['epic-bosses-overview'] = {
            ...database.articles['misc-epic-overview'],
            id: 'epic-bosses-overview',
            section: 'quests',
            group: 'epic-bosses',
            title: 'Эпик боссы Lineage 2 - Полный гайд',
            summary: 'Обзор эпик-боссов: Queen Ant, Core, Orfen, Zaken, Baium, Antharas, Valakas, Frintezza и Freya.',
            order: 9988,
        };
    }

    ['baium-entry', 'antharas-entry', 'valakas-entry', 'frintezza-entry', 'freya-entry'].forEach((id) => {
        if (database.articles[id]) {
            database.articles[id].group = 'epic-bosses';
        }
    });

    ['pailaka-devils-legacy', 'pailaka-injured-dragon', 'pailaka-song-fire'].forEach((id) => {
        if (database.articles[id]) {
            database.articles[id].group = 'pailaka';
        }
    });

    questsSection.groups = [
        {
            id: 'profession-1',
            label: 'Первая профессия',
            description: 'Квесты и цепочки для первой профессии.',
            entries: ['quest-profession-first'],
            order: 0,
        },
        {
            id: 'profession-2',
            label: 'Вторая профессия',
            description: 'Квесты и цепочки для второй профессии.',
            entries: ['quest-profession-second'],
            order: 1,
        },
        {
            id: 'profession-3',
            label: 'Третья профессия',
            description: 'Квесты и цепочки для третьей профессии.',
            entries: ['quest-profession-third'],
            order: 2,
        },
        {
            id: 'profession-4',
            label: 'Четвертая профессия',
            description: 'Квесты и цепочки для четвертой профессии.',
            entries: ['quest-profession-fourth'],
            order: 3,
        },
        {
            id: 'epic-bosses',
            label: 'Эпик боссы',
            description: 'Проходы, входные квесты и обзор по Baium, Antharas, Valakas, Frintezza и Freya.',
            entries: ['epic-bosses-overview', 'baium-entry', 'antharas-entry', 'valakas-entry', 'frintezza-entry', 'freya-entry'].filter(
                (id) => database.articles[id]
            ),
            order: 4,
        },
        {
            id: 'pailaka',
            label: 'Пайлака',
            description: 'Три полноценные Пайлаки с маршрутами, наградами и картами.',
            entries: ['pailaka-devils-legacy', 'pailaka-injured-dragon', 'pailaka-song-fire'].filter((id) => database.articles[id]),
            order: 5,
        },
        {
            id: 'pets',
            label: 'Питомцы и маунты',
            description: 'Волк, baby-питомцы, дракончик и ездовой дракон.',
            entries: [
                'quest-wolf-collar',
                'quest-baby-cougar',
                'quest-baby-kookabura',
                'quest-baby-buffalo',
                'quest-dragonflute',
                'quest-dragon-bugle',
            ].filter((id) => database.articles[id]),
            order: 6,
        },
        {
            id: 'service',
            label: 'Сервисные квесты',
            description: 'Soul crystal, отмыв PK, трансформации, саб-класс, noblesse и другие полезные цепочки.',
            entries:
                (questsSection.groups || []).find((group) => group.id === 'service')?.entries?.filter((id) => database.articles[id]) || [],
            order: 7,
        },
    ];
};

const updateWeaponHubArticles = async (database) => {
    const rows = await buildWeaponOverviewRows(database);
    const blocks = [
        {
            id: 'weapons-overview-table',
            type: 'table',
            title: 'Оружие',
            columns: [
                { key: 'category', label: 'Оружие' },
                { key: 's', label: 'S', align: 'center' },
                { key: 'a', label: 'A', align: 'center' },
                { key: 'b', label: 'B', align: 'center' },
                { key: 'c', label: 'C', align: 'center' },
                { key: 'd', label: 'D', align: 'center' },
                { key: 'ng', label: 'NG', align: 'center' },
            ],
            rows,
            compact: false,
        },
    ];

    if (database.articles['items-weapons']) {
        database.articles['items-weapons'].summary = 'Каталог оружия по типам и грейдам с локальными переходами на страницы предметов.';
        database.articles['items-weapons'].layout = 'catalog';
        database.articles['items-weapons'].blocks = blocks;
    }

    if (database.articles['weapons-overview']) {
        database.articles['weapons-overview'].summary = 'Каталог оружия по типам и грейдам с локальными переходами на страницы предметов.';
        database.articles['weapons-overview'].layout = 'catalog';
        database.articles['weapons-overview'].blocks = blocks;
    }
};

const updateFishingArticle = async (database) => {
    const article = database.articles['fishing-skills'];
    if (!article) {
        return;
    }

    article.summary = 'Полная таблица умений рыбалки по уровням: Fishing, Pumping, Reeling, Expertise и вспомогательные навыки.';
    article.layout = 'detail';
    article.blocks = await buildFishingSkillBlocks();
    article.related = ['archive-quests-item-2836-quest-for-fishing-shot', 'fishing-route'];
};

const writeCanonical = (database) => {
    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(normalized), 'utf8');
    writeCanonicalMeta(normalized);
    writeStaticData(normalized, 'refresh-l2int-weapons-fishing-monsters');

    return normalized;
};

const updateLocationsAndFarming = (database) => {
    const locations = database.sections.locations;
    if (!locations) {
        return;
    }

    locations.title = 'Локации';
    locations.description = 'Города, замки, фарм-зоны, катакомбы, некросполи и специальные локации Lineage 2 Interlude.';

    const farmingEntries = ['prime-farming-zones', 'locations-overview', 'world-map-locations'].filter((id) => database.articles[id]);

    const castleEntries = Object.keys(database.articles)
        .filter((id) => id.includes('castle') && database.articles[id]?.section === 'locations')
        .sort();

    const catacombEntries = Object.keys(database.articles)
        .filter((id) => id.includes('catacomb') && !id.includes('necropolis') && database.articles[id]?.section === 'locations')
        .sort();

    const necropolisEntries = Object.keys(database.articles)
        .filter((id) => id.includes('necropolis') && database.articles[id]?.section === 'locations')
        .sort();

    locations.groups = [
        {
            id: 'castles',
            label: 'Замки',
            description: 'Замки и осады, клановые территории.',
            entries: castleEntries,
            order: 0,
        },
        {
            id: 'catacombs',
            label: 'Катакомбы',
            description: 'Катакомбы для фарма и квестов.',
            entries: catacombEntries,
            order: 1,
        },
        {
            id: 'necropolis',
            label: 'Некрополи',
            description: 'Некрополи Seven Signs.',
            entries: necropolisEntries,
            order: 2,
        },
        {
            id: 'farming',
            label: 'Фарм-зоны',
            description: 'Лучшие зоны для прокачки и фарма по уровням.',
            entries: farmingEntries,
            order: 3,
        },
        {
            id: 'temples',
            label: 'Храмы и проходы',
            description: 'Pagan Temple, Imperial Tomb и специальные локации.',
            entries: ['pagan-temple-location', 'imperial-tomb-route'].filter((id) => database.articles[id]),
            order: 4,
        },
    ];

    Object.keys(database.articles).forEach((id) => {
        const article = database.articles[id];
        if (article.section !== 'locations') {
            return;
        }

        if (castleEntries.includes(id)) {
            article.group = 'castles';
        } else if (catacombEntries.includes(id)) {
            article.group = 'catacombs';
        } else if (necropolisEntries.includes(id)) {
            article.group = 'necropolis';
        } else if (farmingEntries.includes(id)) {
            article.group = 'farming';
        } else if (['pagan-temple-location', 'imperial-tomb-route'].includes(id)) {
            article.group = 'temples';
        }
    });
};

const main = async () => {
    const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));

    await updateWeaponHubArticles(database);
    await enrichWeaponCategoryArticles(database);
    await updateFishingArticle(database);
    buildMonstersSectionGroups(database);
    updateLocationsAndFarming(database);
    restoreEpicBossTabs(database);

    const normalized = writeCanonical(database);

    console.log(
        `[refresh] Updated weapons overview, ${weaponCategoryConfigs.length} weapon categories, fishing skills, monsters groups, locations/farming zones and epic boss tabs.`
    );
    console.log(`[refresh] Articles: ${Object.keys(normalized.articles || {}).length}`);
    console.log(`[refresh] Sections: ${Object.keys(normalized.sections || {}).length}`);
    console.log(`[refresh] Output: ${path.relative(process.cwd(), CANONICAL_PATH)}`);
};

main().catch((error) => {
    console.error(`[refresh] Failed: ${error.stack || error.message}`);
    process.exit(1);
});
