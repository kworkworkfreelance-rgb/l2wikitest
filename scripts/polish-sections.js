#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { writeStaticData } = require('../lib/canonical-store');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeCanonical = (database) => fs.writeFileSync(CANONICAL_PATH, JSON.stringify(database), 'utf8');

const proseBlock = (id, title, paragraphs) => ({
    id,
    type: 'prose',
    title,
    paragraphs,
});

const setStats = (section, items) => {
    section.stats = items.map(([label, value]) => ({
        label,
        value: String(value),
    }));
};

const updateSkillsSection = (database) => {
    const section = database.sections.skills;

    if (!section) {
        return;
    }

    const iconBase = '/assets/img/archive';

    section.description = 'Дерево классов, клановые и рыболовные умения, заточка и squad-навыки в структуре, близкой к l2int.';
    section.landingLayout = 'hub';
    section.landingBlocks = [
        proseBlock('skills-landing-intro', 'Что внутри раздела', [
            'Раздел собран по той же логике, что и на l2int: сначала дерево классов, затем отдельные страницы по клановым навыкам, рыбалке, заточке и squad-умениям.',
            'Через боковое меню и карточки ниже можно сразу перейти к нужной статье, а не искать ее внутри общей таблицы.',
        ]),
    ];
    section.landingSidebarFacts = [
        { label: 'Ключевых направлений', value: '5' },
        { label: 'Страниц внутри раздела', value: String(Object.values(database.articles).filter((article) => article.section === 'skills').length) },
        { label: 'Формат', value: 'Хабы, дерево классов и подробные статьи' },
    ];

    section.groups = [
        {
            id: 'class-tree',
            label: 'Дерево классов',
            description: 'Переходы между профессиями, ветки развития и страницы по классам.',
            landingArticleId: 'class-tree',
            iconSrc: `${iconBase}/quest-humanknight-664b9705e49e.gif`,
            order: 0,
        },
        {
            id: 'clan-skills',
            label: 'Клановые скиллы',
            description: 'Все по Clan Skills: уровни клана, книги, очки репутации и приоритеты прокачки.',
            landingArticleId: 'clan-skills',
            iconSrc: `${iconBase}/quest-clan-spirit-24de76d4cb28.png`,
            order: 1,
        },
        {
            id: 'fishing-skills',
            label: 'Умения рыбалки',
            description: 'Рыбалка, снасти, бафы и связанные скиллы без внешних переходов.',
            landingArticleId: 'fishing-skills',
            iconSrc: `${iconBase}/quest-fishing-8538996dfed4.jpg`,
            order: 2,
        },
        {
            id: 'enchanting-skills',
            label: 'Заточка скиллов',
            description: 'Маршруты заточки, варианты энчанта и базовые ориентиры по skill enchant.',
            landingArticleId: 'enchanting-skills',
            iconSrc: `${iconBase}/quest-scroll-of-enchant-weapon-s-fdd44e6be38a.jpg`,
            order: 3,
        },
        {
            id: 'squad-skills',
            label: 'Умения отрядов',
            description: 'Squad Skills и связанные PvE/PvP бонусы для группы и отряда.',
            landingArticleId: 'squad-skills',
            iconSrc: `${iconBase}/quest-skillraid-1b45617e9b38.jpg`,
            order: 4,
        },
    ];

    for (const article of Object.values(database.articles)) {
        if (article.section !== 'skills') {
            continue;
        }

        if (article.id === 'clan-skills') {
            article.group = 'clan-skills';
            continue;
        }

        if (article.id === 'fishing-skills') {
            article.group = 'fishing-skills';
            continue;
        }

        if (article.id === 'enchanting-skills') {
            article.group = 'enchanting-skills';
            continue;
        }

        if (article.id === 'squad-skills') {
            article.group = 'squad-skills';
            continue;
        }

        article.group = 'class-tree';
    }

    const count = Object.values(database.articles).filter((article) => article.section === 'skills').length;
    setStats(section, [
        ['Материалов', count],
        ['Групп', section.groups.length],
        ['Детальных страниц', count],
    ]);
};

const updateItemsSection = (database) => {
    const section = database.sections.items;

    if (!section) {
        return;
    }

    const iconBase = '/assets/img/archive';

    section.description = 'Каталог предметов, ресурсы, броня и бижутерия с локальными хабами и детальными страницами.';
    section.landingLayout = 'hub';
    section.landingBlocks = [
        proseBlock('items-landing-intro', 'Что внутри раздела', [
            'Раздел собран по модели l2int: обзор предметов, отдельные хабы по ресурсам, броне и бижутерии, а дальше уже локальные таблицы и item-страницы.',
            'Хабы ведут только на локальные страницы сайта, поэтому навигация больше не уводит пользователя на внешний ресурс.',
        ]),
    ];
    section.landingSidebarFacts = [
        { label: 'Категорий', value: '4' },
        { label: 'Страниц внутри раздела', value: String(Object.values(database.articles).filter((article) => article.section === 'items').length) },
        { label: 'Формат', value: 'Хабы, категории и item-страницы' },
    ];

    section.groups = [
        {
            id: 'catalog',
            label: 'Каталог предметов',
            description: 'Общий вход в предметный раздел: оружие, сервисы усиления и связанные системы.',
            landingArticleId: 'items-weapons',
            iconSrc: `${iconBase}/quest-scroll-of-enchant-weapon-a-8a37fe8d642d.jpg`,
            order: 0,
        },
        {
            id: 'resources',
            label: 'Ресурсы',
            description: 'Крафтовые материалы, economy-хабы и базовые страницы по ресурсам.',
            landingArticleId: 'items-resources',
            iconSrc: `${iconBase}/quest-scroll-gray-7b675e7fd3ec.jpg`,
            order: 1,
        },
        {
            id: 'armor',
            label: 'Броня',
            description: 'Тяжелая, легкая и магическая броня, перчатки, ботинки, шлемы и щиты.',
            landingArticleId: 'items-armor',
            iconSrc: `${iconBase}/quest-blessed-scroll-of-enchant-armor-a-c2d6c8752f62.jpg`,
            order: 2,
        },
        {
            id: 'accessories',
            label: 'Бижутерия',
            description: 'Кольца, серьги и ожерелья со всеми локальными категориями и предметами.',
            landingArticleId: 'items-accessories',
            iconSrc: `${iconBase}/quest-enchanted-ring-a3db7b37dce6.jpg`,
            order: 3,
        },
    ];

    for (const article of Object.values(database.articles)) {
        if (article.section !== 'items') {
            continue;
        }

        if (article.id === 'items-weapons') {
            article.group = 'catalog';
            continue;
        }

        if (article.id.startsWith('items-armor') || article.id.startsWith('armor-item-')) {
            article.group = 'armor';
            continue;
        }

        if (article.id.startsWith('items-accessories') || article.id.startsWith('items-jewelry') || article.id.startsWith('jewelry-item-')) {
            article.group = 'accessories';
            continue;
        }

        if (article.id.startsWith('items-resources') || article.id.startsWith('resource-item-')) {
            article.group = 'resources';
            continue;
        }

        article.group = 'catalog';
    }

    const count = Object.values(database.articles).filter((article) => article.section === 'items').length;
    setStats(section, [
        ['Материалов', count],
        ['Групп', section.groups.length],
        ['Детальных страниц', count],
    ]);
};

const main = () => {
    const source = readDatabase();
    updateSkillsSection(source);
    updateItemsSection(source);

    const normalized = normalizeDatabase({
        ...source,
        version: 2,
        updatedAt: new Date().toISOString(),
    });

    writeCanonical(normalized);
    writeStaticData(normalized, 'polish-sections');

    console.log(
        JSON.stringify(
            {
                updatedAt: normalized.updatedAt,
                skillsGroups: normalized.sections.skills.groups.map((group) => ({ id: group.id, entries: group.entries.length })),
                itemsGroups: normalized.sections.items.groups.map((group) => ({ id: group.id, entries: group.entries.length })),
            },
            null,
            2
        )
    );
};

main();
