#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { writeStaticData } = require('../lib/canonical-store');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');

const readDb = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDb = (db) => fs.writeFileSync(CANONICAL_PATH, JSON.stringify(db), 'utf8');

const toWordsTitle = (slug = '') =>
    String(slug)
        .split('-')
        .filter(Boolean)
        .map((part) => {
            if (part === 's') {
                return "'s";
            }
            if (part.length === 1) {
                return part.toUpperCase();
            }
            return part[0].toUpperCase() + part.slice(1);
        })
        .join(' ')
        .replace(/\s+'s\b/g, "'s")
        .trim();

const extractArticleId = (href = '') => {
    const match = String(href).match(/[?&]article=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
};

const replaceArticleId = (href = '', articleId = '') => {
    if (!articleId) {
        return href;
    }
    return String(href).replace(/([?&]article=)([^&#]+)/, `$1${encodeURIComponent(articleId)}`);
};

const ensureTableBlock = (article, blockId, title, columns) => {
    if (!Array.isArray(article.blocks)) {
        article.blocks = [];
    }
    let block = article.blocks.find((item) => item.id === blockId);
    if (!block) {
        block = {
            id: blockId,
            type: 'table',
            title,
            columns,
            rows: [],
        };
        article.blocks.push(block);
    }
    return block;
};

const getItemSuffix = (articleId = '') => {
    const match = String(articleId).match(/^(?:archive-)?[a-z]+-item-(\d+-.+)$/);
    return match ? match[1] : '';
};

const getNumericIdFromSuffix = (suffix = '') => {
    const match = String(suffix).match(/^(\d+)-/);
    return match ? match[1] : '';
};

const buildTypeSuffixMaps = (db) => {
    const maps = {
        monster: new Map(),
        npc: new Map(),
        armor: new Map(),
        jewelry: new Map(),
        resource: new Map(),
        weapon: new Map(),
        quests: new Map(),
    };

    Object.keys(db.articles).forEach((articleId) => {
        const match = String(articleId).match(/^(?:archive-)?([a-z]+)-item-(\d+-.+)$/);
        if (!match) {
            return;
        }
        const type = match[1];
        const suffix = match[2];
        if (!maps[type]) {
            maps[type] = new Map();
        }
        if (!maps[type].has(suffix)) {
            maps[type].set(suffix, articleId);
        }
    });

    return maps;
};

const updateSectionStats = (db, sectionId) => {
    const section = db.sections[sectionId];
    if (!section) {
        return;
    }
    const count = Object.values(db.articles).filter((article) => article.section === sectionId).length;
    section.stats = [
        { label: 'Материалов', value: String(count) },
        { label: 'Групп', value: String((section.groups || []).length) },
        { label: 'Детальных страниц', value: String(count) },
    ];
};

const ensureQuestProfessionLabels = (db) => {
    const labels = {
        'profession-1': 'Первая профессия',
        'profession-2': 'Вторая профессия',
        'profession-3': 'Третья профессия',
        'profession-4': 'Четвертая профессия',
    };
    (db.sections.quests?.groups || []).forEach((group) => {
        if (labels[group.id]) {
            group.label = labels[group.id];
        }
    });
};

const ensureSkillsOrder = (db) => {
    const skills = db.sections.skills;
    if (!skills) {
        return;
    }
    const orderMap = {
        'class-tree': 0,
        'fishing-skills': 1,
        'clan-skills': 2,
        'enchanting-skills': 3,
        'squad-skills': 4,
    };
    (skills.groups || []).forEach((group) => {
        if (Object.prototype.hasOwnProperty.call(orderMap, group.id)) {
            group.order = orderMap[group.id];
        }
    });
};

const ensureContactsPage = (db) => {
    const section = db.sections.misc;
    if (!section) {
        return;
    }

    if (!Array.isArray(section.groups)) {
        section.groups = [];
    }

    let contactsGroup = section.groups.find((group) => group.id === 'contacts');
    if (!contactsGroup) {
        contactsGroup = {
            id: 'contacts',
            label: 'Контакты',
            description: 'Страница для связи и рабочих контактов. Заполняется вручную через админ-панель.',
            entries: [],
            landingArticleId: 'contacts',
            iconSrc: '',
            order: 99,
        };
        section.groups.push(contactsGroup);
    } else {
        contactsGroup.label = 'Контакты';
        contactsGroup.description = 'Страница для связи и рабочих контактов. Заполняется вручную через админ-панель.';
        contactsGroup.landingArticleId = 'contacts';
    }

    const contactsArticle = {
        id: 'contacts',
        section: 'misc',
        group: 'contacts',
        title: 'Контакты',
        summary: 'Рабочая таблица для связи. Заполни поля в админ-панели под свои каналы и ответственных.',
        eyebrow: 'Контакты',
        meta: [
            { label: 'Статус', value: 'Редактируется вручную' },
            { label: 'Где менять', value: 'Админ-панель L2Wiki' },
        ],
        intro: [
            'Эта страница сделана как черновой шаблон. Заполни контакты, роли, ссылки и комментарии под свой проект.',
            'Структура специально оставлена простой, чтобы быстро адаптировать ее под клиентскую передачу.',
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: ['quest-profession-first', 'quest-profession-second', 'quest-profession-third', 'quest-profession-fourth'].filter(
            (id) => Boolean(db.articles[id])
        ),
        order: 0,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Формат', value: 'Таблица контактов' },
            { label: 'Редактирование', value: 'Через админ-панель' },
        ],
        source: {},
        aliases: ['contact', 'contacts-page', 'svyaz'],
        blocks: [
            {
                id: 'contacts-intro',
                type: 'prose',
                title: 'Связь с нами',
                paragraphs: [
                    'Ниже базовая таблица. Можно менять строки, добавлять новые каналы и дополнять комментарии прямо в админке.',
                ],
            },
            {
                id: 'contacts-table',
                type: 'table',
                title: 'Контакты и направления',
                columns: [
                    { key: 'direction', label: 'Направление' },
                    { key: 'person', label: 'Контакт' },
                    { key: 'channel', label: 'Канал связи' },
                    { key: 'note', label: 'Комментарий' },
                ],
                rows: [
                    {
                        id: 'contacts-row-1',
                        cells: [
                            { value: 'Первая профессия', html: '<span class="roman-pill">I</span> Первая профессия' },
                            { value: 'Заполни в админке' },
                            { value: 'Добавь ссылку/телеграм' },
                            { value: 'Черновой шаблон' },
                        ],
                    },
                    {
                        id: 'contacts-row-2',
                        cells: [
                            { value: 'Вторая профессия', html: '<span class="roman-pill">II</span> Вторая профессия' },
                            { value: 'Заполни в админке' },
                            { value: 'Добавь ссылку/телеграм' },
                            { value: 'Черновой шаблон' },
                        ],
                    },
                    {
                        id: 'contacts-row-3',
                        cells: [
                            { value: 'Третья профессия', html: '<span class="roman-pill">III</span> Третья профессия' },
                            { value: 'Заполни в админке' },
                            { value: 'Добавь ссылку/телеграм' },
                            { value: 'Черновой шаблон' },
                        ],
                    },
                    {
                        id: 'contacts-row-4',
                        cells: [
                            { value: 'Четвертая профессия', html: '<span class="roman-pill">IV</span> Четвертая профессия' },
                            { value: 'Заполни в админке' },
                            { value: 'Добавь ссылку/телеграм' },
                            { value: 'Черновой шаблон' },
                        ],
                    },
                ],
            },
        ],
    };

    db.articles.contacts = contactsArticle;
};

const main = () => {
    const db = readDb();
    const existing = new Set(Object.keys(db.articles));
    const typeMaps = buildTypeSuffixMaps(db);
    const placeholderRefs = new Map();
    const createdPlaceholders = new Set();

    const trackRef = (targetId, sourceArticleId) => {
        if (!sourceArticleId) {
            return;
        }
        if (!placeholderRefs.has(targetId)) {
            placeholderRefs.set(targetId, new Set());
        }
        placeholderRefs.get(targetId).add(sourceArticleId);
    };

    const ensureMonsterPlaceholder = (id, suffix) => {
        if (existing.has(id)) {
            return;
        }
        const slug = suffix.replace(/^\d+-/, '');
        const numericId = getNumericIdFromSuffix(suffix);
        const titleEn = toWordsTitle(slug) || 'Unknown Monster';
        db.articles[id] = {
            id,
            section: 'monsters',
            group: 'overview',
            title: `${titleEn} (монстр)`,
            summary: 'Черновая карточка монстра. Базовая страница создана автоматически, чтобы ссылка из дропа не вела в пустоту.',
            eyebrow: 'Монстры',
            meta: [
                { label: 'Статус', value: 'Черновик автогенерации' },
                { label: 'ID', value: numericId || '—' },
            ],
            intro: [],
            checklist: [],
            steps: [],
            rewards: [],
            tips: [],
            related: [],
            order: 9999,
            layout: 'detail',
            sidebarFacts: [
                { label: 'Источник', value: 'Автофикc ссылок дропа/спойла' },
                { label: 'Заполнение', value: 'Добавь данные в админ-панели' },
            ],
            source: {},
            aliases: [],
            blocks: [
                {
                    id: `${id}-draft`,
                    type: 'prose',
                    title: 'Карточка в работе',
                    paragraphs: [
                        'Страница создана автоматически, чтобы ссылка из таблиц дропа и спойла открывалась корректно.',
                        'Добавь характеристики, локации, дроп и дополнительную информацию через админ-панель.',
                    ],
                },
                {
                    id: `${id}-refs`,
                    type: 'table',
                    title: 'Где встречается ссылка',
                    columns: [
                        { key: 'source', label: 'Материал' },
                        { key: 'note', label: 'Примечание' },
                    ],
                    rows: [],
                },
            ],
        };
        existing.add(id);
        createdPlaceholders.add(id);
    };

    const ensureItemPlaceholder = (id, prefix, suffix) => {
        if (existing.has(id)) {
            return;
        }

        const groupMap = {
            resource: 'resources',
            armor: 'armor',
            jewelry: 'accessories',
        };
        const sectionGroup = groupMap[prefix] || 'catalog';
        const slug = suffix.replace(/^\d+-/, '');
        const numericId = getNumericIdFromSuffix(suffix);
        const titleEn = toWordsTitle(slug) || 'Unknown Item';

        db.articles[id] = {
            id,
            section: 'items',
            group: sectionGroup,
            title: `${titleEn} (предмет)`,
            summary: 'Черновая карточка предмета. Создана автоматически, чтобы переходы из таблиц работали без пустых страниц.',
            eyebrow: 'Предметы',
            meta: [
                { label: 'Статус', value: 'Черновик автогенерации' },
                { label: 'ID', value: numericId || '—' },
            ],
            intro: [],
            checklist: [],
            steps: [],
            rewards: [],
            tips: [],
            related: [],
            order: 9999,
            layout: 'detail',
            sidebarFacts: [
                { label: 'Источник', value: 'Автофикc ссылок раздела предметов' },
                { label: 'Заполнение', value: 'Добавь параметры через админ-панель' },
            ],
            source: {},
            aliases: [],
            blocks: [
                {
                    id: `${id}-draft`,
                    type: 'prose',
                    title: 'Карточка в работе',
                    paragraphs: [
                        'Эта страница создана автоматически, потому что на нее есть ссылка из таблиц дропа/крафта.',
                        'Заполни статы, крафт, дроп и дополнительные таблицы в админ-панели.',
                    ],
                },
                {
                    id: `${id}-refs`,
                    type: 'table',
                    title: 'Где встречается ссылка',
                    columns: [
                        { key: 'source', label: 'Материал' },
                        { key: 'note', label: 'Примечание' },
                    ],
                    rows: [],
                },
            ],
        };
        existing.add(id);
        createdPlaceholders.add(id);
    };

    const chooseBySuffix = (suffix, priorities) => {
        for (const type of priorities) {
            const map = typeMaps[type];
            if (map && map.has(suffix)) {
                return map.get(suffix);
            }
        }
        return '';
    };

    const resolveMissingTarget = (missingId, context) => {
        const match = String(missingId).match(/^([a-z]+)-item-(\d+-.+)$/);
        if (!match) {
            return '';
        }

        const prefix = match[1];
        const suffix = match[2];
        const blockTitle = String(context.blockTitle || '').toLowerCase();
        const isDropLike = /дроп|спойл|drop|spoil/.test(blockTitle) && context.cellIndex === 0;

        if (isDropLike) {
            const mapped = chooseBySuffix(suffix, ['monster', 'npc']);
            if (mapped) {
                return mapped;
            }
            const monsterId = `archive-monster-item-${suffix}`;
            ensureMonsterPlaceholder(monsterId, suffix);
            trackRef(monsterId, context.sourceArticleId);
            return monsterId;
        }

        const mappedBySameType = chooseBySuffix(suffix, [prefix]);
        if (mappedBySameType) {
            return mappedBySameType;
        }

        const mappedByFallback = chooseBySuffix(suffix, ['armor', 'jewelry', 'resource', 'weapon', 'monster', 'npc', 'quests']);
        if (mappedByFallback) {
            return mappedByFallback;
        }

        ensureItemPlaceholder(missingId, prefix, suffix);
        trackRef(missingId, context.sourceArticleId);
        return missingId;
    };

    let fixedLinks = 0;
    let createdMonsters = 0;
    let createdItems = 0;

    const processHref = (holder, key, context) => {
        const href = holder[key];
        const missingId = extractArticleId(href);
        if (!missingId || existing.has(missingId)) {
            return;
        }
        const targetId = resolveMissingTarget(missingId, context);
        if (!targetId) {
            return;
        }
        if (targetId !== missingId) {
            holder[key] = replaceArticleId(href, targetId);
        }
        if (existing.has(targetId)) {
            fixedLinks += 1;
        }
    };

    Object.values(db.articles).forEach((article) => {
        (article.blocks || []).forEach((block) => {
            (block.rows || []).forEach((row) => {
                processHref(row, 'href', {
                    sourceArticleId: article.id,
                    blockTitle: block.title || '',
                    cellIndex: -1,
                });
                (row.cells || []).forEach((cell, cellIndex) => {
                    processHref(cell, 'href', {
                        sourceArticleId: article.id,
                        blockTitle: block.title || '',
                        cellIndex,
                    });
                });
            });
        });
    });

    Object.values(db.sections).forEach((section) => {
        (section.catalogRows || []).forEach((row) => {
            processHref(row, 'href', {
                sourceArticleId: '',
                blockTitle: 'Каталог',
                cellIndex: -1,
            });
            (row.cells || []).forEach((cell, cellIndex) => {
                processHref(cell, 'href', {
                    sourceArticleId: '',
                    blockTitle: 'Каталог',
                    cellIndex,
                });
            });
        });
    });

    createdPlaceholders.forEach((id) => {
        if (id.startsWith('archive-monster-item-')) {
            createdMonsters += 1;
        } else {
            createdItems += 1;
        }
        const article = db.articles[id];
        const refs = Array.from(placeholderRefs.get(id) || []);
        const refsBlock = ensureTableBlock(article, `${id}-refs`, 'Где встречается ссылка', [
            { key: 'source', label: 'Материал' },
            { key: 'note', label: 'Примечание' },
        ]);
        refsBlock.rows = refs.slice(0, 40).map((sourceId, index) => ({
            id: `${id}-ref-${index + 1}`,
            cells: [
                {
                    value: db.articles[sourceId]?.title || sourceId,
                    href: `/pages/article.html?article=${sourceId}`,
                },
                {
                    value: 'Переход был восстановлен автоматически',
                },
            ],
        }));
    });

    ensureContactsPage(db);
    ensureQuestProfessionLabels(db);
    ensureSkillsOrder(db);

    const normalized = normalizeDatabase({
        ...db,
        version: 2,
        updatedAt: new Date().toISOString(),
    });

    updateSectionStats(normalized, 'items');
    updateSectionStats(normalized, 'monsters');
    updateSectionStats(normalized, 'npc');
    updateSectionStats(normalized, 'misc');

    writeDb(normalized);
    writeStaticData(normalized, 'fix-links-add-contacts');

    console.log(
        JSON.stringify(
            {
                fixedLinks,
                createdPlaceholders: createdPlaceholders.size,
                createdMonsters,
                createdItems,
                contactsCreated: Boolean(normalized.articles.contacts),
            },
            null,
            2
        )
    );
};

main();
