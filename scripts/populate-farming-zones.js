#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeDatabase } = require('../lib/rich-content-schema');
const { CANONICAL_PATH, writeCanonicalMeta, writeStaticData } = require('../lib/canonical-store');

const farmingZones = [
    {
        id: 'farming-talking-island',
        title: 'Talking Island - Фарм 1-10 уровень',
        levelRange: '1-10',
        monsters: ['Гриб (Fungus)', 'Гоблин (Goblin)', 'Кошка (Keltir)'],
        description: 'Стартовая локация для новичков. Безопасный фарм на начальных уровнях.',
        races: ['Animals', 'Humanoids'],
    },
    {
        id: 'farming-gludin',
        title: 'Gludin Village - Фарм 10-15 уровень',
        levelRange: '10-15',
        monsters: ['Волк (Wolf)', 'Скелет (Skeleton)', 'Зомби (Zombie)'],
        description: 'Зоны вокруг деревни Gludin. Хороший фарм для первой профессии.',
        races: ['Animals', 'Undead'],
    },
    {
        id: 'farming-gludio',
        title: 'Gludio - Фарм 15-20 уровень',
        levelRange: '15-20',
        monsters: ['Imp', 'Goblin', 'Timber Wolf'],
        description: 'Окрестности Gludio. Много мобов для быстрого фарма.',
        races: ['Demons', 'Humanoids', 'Animals'],
    },
    {
        id: 'farming-ruins-despair',
        title: 'Ruins of Despair - Фарм 20-25 уровень',
        levelRange: '20-25',
        monsters: ['Skeleton', 'Zombie', 'Ghoul'],
        description: 'Популярная зона для фарма Undead. Good EXP/SP ratio.',
        races: ['Undead'],
    },
    {
        id: 'farming-elven-forest',
        title: 'Elven Forest - Фарм 20-25 уровень',
        levelRange: '20-25',
        monsters: ['Tree Spirit', 'Dryad', 'Unicorn'],
        description: 'Лесная зона с растениями и духами.',
        races: ['Plants', 'Spirits'],
    },
    {
        id: 'farming-dark-elven-forest',
        title: 'Dark Elven Forest - Фарм 25-30 уровень',
        levelRange: '25-30',
        monsters: ['Spider', 'Unicorn Dark', 'Dark Elf'],
        description: 'Темный лес с опасными мобами.',
        races: ['Bugs', 'Humanoids'],
    },
    {
        id: 'farming-sea-spores',
        title: 'Sea of Spores - Фарм 30-35 уровень',
        levelRange: '30-35',
        monsters: ['Fungus', 'Spore', 'Mushroom'],
        description: 'Зона с грибными мобами. Хороший фарм ресурсов.',
        races: ['Plants'],
    },
    {
        id: 'farming-cruma-tower-1',
        title: 'Cruma Tower 1-2 этаж - Фарм 35-45 уровень',
        levelRange: '35-45',
        monsters: ['Magic Eye', 'Gargoyle', 'Ol Mahum'],
        description: 'Первые этажи башни Cruma. Популяная зона для 2й профессии.',
        races: ['Magic Creatures', 'Giants'],
    },
    {
        id: 'farming-devastated-castle',
        title: 'Devastated Castle - Фарм 40-50 уровень',
        levelRange: '40-50',
        monsters: ['Ghost', 'Skeleton Warrior', 'Specter'],
        description: 'Разрушенный замок с сильными Undead мобами.',
        races: ['Undead'],
    },
    {
        id: 'farming-cruma-tower-2',
        title: 'Cruma Tower 3-4 этаж - Фарм 50-60 уровень',
        levelRange: '50-60',
        monsters: ['Breka Orc', 'Turek Orc', 'Ogre'],
        description: 'Верхние этажи башни. Высокий EXP.',
        races: ['Humanoids'],
    },
    {
        id: 'farming-tower-insolence',
        title: 'Tower of Insolence - Фарм 60-70 уровень',
        levelRange: '60-70',
        monsters: ['Dragon', 'Drake', 'Lizardman'],
        description: 'Башня с драконами. Входной квест требуется.',
        races: ['Dragons'],
    },
    {
        id: 'farming-catacombs',
        title: 'Катакомбы - Фарм 65-75 уровень',
        levelRange: '65-75',
        monsters: ['Dark Omen', 'Apostate', 'Witch'],
        description: '9 уровней катакомб. Отличный фарм для 3й профессии.',
        races: ['Undead', 'Demons'],
    },
    {
        id: 'farming-necropolis',
        title: 'Некрополи - Фарм 70-75 уровень',
        levelRange: '70-75',
        monsters: ['Sacrifice', 'Devotion', 'Martyrdom'],
        description: '8 некрополей Seven Signs. Высокий дроп Adena.',
        races: ['Undead'],
    },
    {
        id: 'farming-primeval-isle',
        title: 'Primeval Isle - Фарм 70-75 уровень',
        levelRange: '70-75',
        monsters: ['Stakato', 'Windsus', 'Golem'],
        description: 'Остров с динозаврами и големами.',
        races: ['Bugs', 'Beasts'],
    },
    {
        id: 'farming-stakato-nest',
        title: 'Stakato Nest - Фарм 75-80 уровень',
        levelRange: '75-80',
        monsters: ['Stakato Soldier', 'Stakato Drone', 'Stakato Queen'],
        description: 'Гнездо Stakato. Элитные мобы с хорошим дропом.',
        races: ['Bugs'],
    },
    {
        id: 'farming-valley-saints',
        title: 'Valley of Saints - Фарм 75-80 уровень',
        levelRange: '75-80',
        monsters: ['Sacred', 'Holy', 'Blessed mobs'],
        description: 'Долина святых. Высокий уровень, хороший фарм.',
        races: ['Angels', 'Spirits'],
    },
    {
        id: 'farming-ivory-tower',
        title: 'Ivory Tower - Фарм 76-80 уровень',
        levelRange: '76-80',
        monsters: ['Magic Golem', 'Elemental', 'Golem'],
        description: 'Башня магов. Magical мобы с высоким EXP.',
        races: ['Magic Creatures'],
    },
    {
        id: 'farming-mithril-mines',
        title: 'Mithril Mines - Фарм 70-76 уровень',
        levelRange: '70-76',
        monsters: ['Golem', 'Elemental', 'Mining mobs'],
        description: 'Шапы мифрила. Ресурсы + EXP.',
        races: ['Magic Creatures'],
    },
];

const buildFarmingZoneArticle = (zone) => {
    return {
        id: zone.id,
        section: 'locations',
        group: 'farming',
        title: zone.title,
        summary: `Фарм-зона ${zone.levelRange} уровень. ${zone.description}`,
        eyebrow: 'Фарм-зона',
        meta: [
            { label: 'Уровни', value: zone.levelRange },
            { label: 'Мобы', value: zone.monsters.length },
            { label: 'Расы', value: zone.races.join(', ') },
        ],
        layout: 'detail',
        blocks: [
            {
                id: `${zone.id}-overview`,
                type: 'prose',
                title: 'Обзор зоны',
                paragraphs: [
                    zone.description,
                    `Рекомендуемый уровень: ${zone.levelRange}. Основные монстры: ${zone.monsters.join(', ')}.`,
                ],
            },
            {
                id: `${zone.id}-monsters`,
                type: 'table',
                title: 'Монстры в зоне',
                columns: [
                    { key: 'monster', label: 'Монстр' },
                    { key: 'level', label: 'Уровень' },
                    { key: 'race', label: 'Раса' },
                    { key: 'aggro', label: 'Агрессия' },
                ],
                rows: zone.monsters.map((monster, i) => ({
                    id: `${zone.id}-monster-${i}`,
                    cells: [
                        { value: monster },
                        { value: zone.levelRange },
                        { value: zone.races[i % zone.races.length] },
                        { value: i % 3 === 0 ? 'Да' : 'Нет' },
                    ],
                })),
            },
            {
                id: `${zone.id}-tips`,
                type: 'callout',
                title: 'Советы по фарму',
                tone: 'info',
                items: [
                    `Подготовьте Gear для уровня ${zone.levelRange.split('-')[0]}+`,
                    'Возьмите с собой Soulshots/Spells',
                    'Группа 2-4 человека для эффективности',
                    'Следите за Aggro mobs',
                ],
            },
        ],
    };
};

const main = async () => {
    const database = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));

    console.log('[farming] Building farming zone articles...');

    farmingZones.forEach((zone) => {
        database.articles[zone.id] = buildFarmingZoneArticle(zone);
        console.log(`  ✓ ${zone.id}: ${zone.title}`);
    });

    // Update farming group entries
    const locationsSection = database.sections.locations;
    if (locationsSection) {
        const farmingGroup = locationsSection.groups?.find((g) => g.id === 'farming');
        if (farmingGroup) {
            farmingGroup.entries = farmingZones.map((z) => z.id);
            farmingGroup.description = `Фарм-зоны для всех уровней (${farmingZones.length} зон)`;
        }
    }

    const normalized = normalizeDatabase({
        ...database,
        updatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(normalized), 'utf8');
    writeCanonicalMeta(normalized);
    writeStaticData(normalized, 'populate-farming-zones');

    console.log(`\n[farming] Created ${farmingZones.length} farming zone articles`);
    console.log(`[farming] Articles: ${Object.keys(normalized.articles || {}).length}`);
    console.log(`[farming] Output: ${path.relative(process.cwd(), CANONICAL_PATH)}`);
};

main().catch((error) => {
    console.error(`[farming] Failed: ${error.stack || error.message}`);
    process.exit(1);
});
