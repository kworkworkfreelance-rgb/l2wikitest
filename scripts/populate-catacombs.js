const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, '../data/canonical/l2wiki-canonical.json');

// Catacombs and Necropolises data
const catacombs = [
    {
        id: 'catacomb-heretic',
        title: 'Катакомбы Еретиков',
        level: '30 - 40',
        location: 'Город Дион / Земля Казненных',
        description:
            'Катакомбы Еретиков — это подземное подземелье, расположенное недалеко от города Дион. Оно предназначено для игроков 30-40 уровней и содержит различных монстров-нежить. Эти катакомбы являются частью системы Печати Познания.',
        seal: 'Печать Познания',
        npc: 'Кузнец',
        coordinates: { x: 200, y: 350 },
        monsters: ['Нежить', 'Скелеты', 'Зомби', 'Призраки'],
    },
    {
        id: 'catacomb-branded',
        title: 'Катакомбы Отлучённых',
        level: '40 - 51',
        location: 'Город Гиран / Гавань Гирана',
        description:
            'Катакомбы Отлучённых расположены недалеко от Гирана и подходят для игроков 40-51 уровней. Здесь обитают сложные противники-нежить и ценная добыча. Кузнец в этих катакомбах предлагает услуги крафта.',
        seal: 'Печать Познания',
        npc: 'Кузнец',
        coordinates: { x: 550, y: 450 },
        monsters: ['Нежить', 'Тёмные Эльфы', 'Духи', 'Тени'],
    },
    {
        id: 'catacomb-apostate',
        title: 'Катакомбы Отступников',
        level: '50 - 60',
        location: 'Город Орен / Долина Ящеров',
        description:
            'Катакомбы Отступников — это подземелье высокого уровня недалеко от Оренa, предназначенное для игроков 50-60 уровней. Здесь обитают мощные монстры-нежить, и это ключевая локация для события Печати Познания.',
        seal: 'Печать Познания',
        npc: 'Кузнец',
        coordinates: { x: 650, y: 300 },
        monsters: ['Нежить высокого уровня', 'Тёмные Рыцари', 'Некроманты', 'Призраки'],
    },
];

const necropolises = [
    {
        id: 'necropolis-sacrifice',
        title: 'Жертвенный Некрополь',
        level: '20 - 30',
        location: 'Деревня Глудин / Поселение Ящеров Лангк',
        description:
            'Жертвенный Некрополь — это подземелье начального уровня, подходящее для игроков 20-30 уровней. Расположен недалеко от Деревни Глудин, содержит базовых монстров-нежить и является частью системы Печати Жадности.',
        seal: 'Печать Жадности',
        npc: 'Торговец',
        coordinates: { x: 150, y: 250 },
        monsters: ['Скелеты', 'Зомби', 'Призраки', 'Нежить низкого уровня'],
    },
    {
        id: 'necropolis-pilgrim',
        title: 'Некрополь Пилигримов',
        level: '32 - 40',
        location: 'Город Дион / Лагерь Партизан',
        description:
            'Некрополь Пилигримов — это подземелье среднего уровня недалеко от Диона, предназначенное для игроков 32-40 уровней. Здесь обитают монстры-нежить средней сложности, и он является частью события Печати Жадности.',
        seal: 'Печать Жадности',
        npc: 'Торговец',
        coordinates: { x: 220, y: 380 },
        monsters: ['Нежить-воины', 'Призраки', 'Фантомы', 'Упыри'],
    },
];

function createCatacombArticle(catacomb) {
    return {
        id: catacomb.id,
        section: 'locations',
        group: 'necropolis',
        title: catacomb.title,
        summary: `${catacomb.title} - Подземелье для ${catacomb.level} уровней, расположено в ${catacomb.location}`,
        eyebrow: 'Катакомбы',
        meta: [],
        intro: [
            `<strong>${catacomb.title}</strong> — это подземелье, предназначенное для игроков ${catacomb.level} уровней.`,
            catacomb.description,
            `Эти катакомбы являются частью системы ${catacomb.seal}.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [],
        order: 0,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Уровень', value: catacomb.level },
            { label: 'Локация', value: catacomb.location },
            { label: 'Печать', value: catacomb.seal },
            { label: 'NPC', value: catacomb.npc },
        ],
        source: {
            url: '',
            path: '',
            snapshot: '',
            sourceType: 'manual',
        },
        aliases: [],
        blocks: [
            {
                id: `${catacomb.id}-block-1`,
                type: 'prose',
                title: 'Описание',
                paragraphs: [
                    catacomb.description,
                    `Эти катакомбы являются частью системы ${catacomb.seal}.`,
                    `NPC ${catacomb.npc} в этих катакомбах предоставляет различные услуги игрокам.`,
                ],
            },
            {
                id: `${catacomb.id}-block-2`,
                type: 'html',
                title: 'Местонахождение',
                html: `
<div class="npc-map-container">
  <img src="/map.svg" alt="Map" class="npc-map-image" />
  <div class="npc-map-marker" style="left: ${catacomb.coordinates.x}px; top: ${catacomb.coordinates.y}px;">
    <div class="npc-map-tooltip">${catacomb.title}</div>
  </div>
  <div class="npc-map-legend">
    <div class="npc-map-legend-item">
      <div class="npc-map-legend-marker"></div>
      <span class="npc-map-legend-text">${catacomb.title} - ${catacomb.location}</span>
    </div>
  </div>
</div>
        `,
            },
            {
                id: `${catacomb.id}-block-3`,
                type: 'table',
                title: 'Характеристики',
                columns: [
                    { key: 'column-1', label: 'Параметр', align: '', width: '' },
                    { key: 'column-2', label: 'Значение', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Уровень монстров', href: '', html: '' },
                            { value: catacomb.level, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-2',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Локация', href: '', html: '' },
                            { value: catacomb.location, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-3',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Печать', href: '', html: '' },
                            { value: catacomb.seal, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-4',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'NPC', href: '', html: '' },
                            { value: catacomb.npc, href: '', html: '' },
                        ],
                        meta: [],
                    },
                ],
            },
            {
                id: `${catacomb.id}-block-4`,
                type: 'table',
                title: 'Монстры',
                columns: [{ key: 'column-1', label: 'Тип монстров', align: '', width: '' }],
                rows: catacomb.monsters.map((monster, index) => ({
                    id: `row-${index + 1}`,
                    title: '',
                    href: '',
                    cells: [{ value: monster, href: '', html: '' }],
                    meta: [],
                })),
            },
        ],
    };
}

function createNecropolisArticle(necropolis) {
    return {
        id: necropolis.id,
        section: 'locations',
        group: 'necropolis',
        title: necropolis.title,
        summary: `${necropolis.title} - Подземелье для ${necropolis.level} уровней, расположено в ${necropolis.location}`,
        eyebrow: 'Некрополи',
        meta: [],
        intro: [
            `<strong>${necropolis.title}</strong> — это подземелье, предназначенное для игроков ${necropolis.level} уровней.`,
            necropolis.description,
            `Этот некрополь является частью системы ${necropolis.seal}.`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [],
        order: 0,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Уровень', value: necropolis.level },
            { label: 'Локация', value: necropolis.location },
            { label: 'Печать', value: necropolis.seal },
            { label: 'NPC', value: necropolis.npc },
        ],
        source: {
            url: '',
            path: '',
            snapshot: '',
            sourceType: 'manual',
        },
        aliases: [],
        blocks: [
            {
                id: `${necropolis.id}-block-1`,
                type: 'prose',
                title: 'Описание',
                paragraphs: [
                    necropolis.description,
                    `Этот некрополь является частью системы ${necropolis.seal}.`,
                    `NPC ${necropolis.npc} в этом некрополе предоставляет различные услуги игрокам.`,
                ],
            },
            {
                id: `${necropolis.id}-block-2`,
                type: 'html',
                title: 'Местонахождение',
                html: `
<div class="npc-map-container">
  <img src="/map.svg" alt="Map" class="npc-map-image" />
  <div class="npc-map-marker" style="left: ${necropolis.coordinates.x}px; top: ${necropolis.coordinates.y}px;">
    <div class="npc-map-tooltip">${necropolis.title}</div>
  </div>
  <div class="npc-map-legend">
    <div class="npc-map-legend-item">
      <div class="npc-map-legend-marker"></div>
      <span class="npc-map-legend-text">${necropolis.title} - ${necropolis.location}</span>
    </div>
  </div>
</div>
        `,
            },
            {
                id: `${necropolis.id}-block-3`,
                type: 'table',
                title: 'Характеристики',
                columns: [
                    { key: 'column-1', label: 'Параметр', align: '', width: '' },
                    { key: 'column-2', label: 'Значение', align: '', width: '' },
                ],
                rows: [
                    {
                        id: 'row-1',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Уровень монстров', href: '', html: '' },
                            { value: necropolis.level, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-2',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Локация', href: '', html: '' },
                            { value: necropolis.location, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-3',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Печать', href: '', html: '' },
                            { value: necropolis.seal, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-4',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'NPC', href: '', html: '' },
                            { value: necropolis.npc, href: '', html: '' },
                        ],
                        meta: [],
                    },
                ],
            },
            {
                id: `${necropolis.id}-block-4`,
                type: 'table',
                title: 'Монстры',
                columns: [{ key: 'column-1', label: 'Тип монстров', align: '', width: '' }],
                rows: necropolis.monsters.map((monster, index) => ({
                    id: `row-${index + 1}`,
                    title: '',
                    href: '',
                    cells: [{ value: monster, href: '', html: '' }],
                    meta: [],
                })),
            },
        ],
    };
}

async function main() {
    console.log('Reading canonical JSON...');
    const canonical = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf-8'));

    console.log('Adding Catacomb articles...');
    for (const catacomb of catacombs) {
        const article = createCatacombArticle(catacomb);
        canonical.articles[catacomb.id] = article;
        console.log(`✓ Added article: ${article.title}`);
    }

    console.log('Adding Necropolis articles...');
    for (const necropolis of necropolises) {
        const article = createNecropolisArticle(necropolis);
        canonical.articles[necropolis.id] = article;
        console.log(`✓ Added article: ${article.title}`);
    }

    console.log('Writing canonical JSON...');
    fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2), 'utf-8');

    console.log('Catacombs and Necropolises article population complete!');
}

main().catch(console.error);
