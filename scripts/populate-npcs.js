const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// NPC data based on the catalog entries
const npcs = [
    {
        id: 'archive-npc-item-5431-edroc',
        title: 'Эдрок',
        level: 70,
        race: 'Люди',
        location: 'Деревня Охотников',
        description:
            'Эдрок — важный NPC, расположенный в Деревне Охотников. Он предоставляет важные услуги для игроков, включая телепортацию и информацию об окружающих районах.',
        services: ['Телепортация', 'Информация о локациях', 'Поддержка квестов'],
        coordinates: { x: 540, y: 610 }, // Приблизительные координаты на карте
    },
    {
        id: 'archive-npc-item-5432-chamberlain',
        title: 'Камергер',
        level: 56,
        race: 'Люди',
        location: 'Лагерь Разбойников',
        description:
            'Камергер — важный NPC в Лагере Разбойников, который управляет клановыми услугами и предоставляет информацию о клановой деятельности.',
        services: ['Клановые услуги', 'Информация о замках', 'Поддержка квестов'],
        coordinates: { x: 450, y: 500 },
    },
    {
        id: 'archive-npc-item-5433-wilford',
        title: 'Вильфорд',
        level: 70,
        race: 'Гномы',
        location: 'Деревня Говорящего Острова',
        description:
            'Вильфорд — NPC-гном, расположенный в Деревне Говорящего Острова. Он специализируется на услугах крафта и оказывает ценную помощь новым игрокам.',
        services: ['Крафт', 'Улучшение предметов', 'Поддержка квестов'],
        coordinates: { x: 300, y: 400 },
    },
    {
        id: 'archive-npc-item-5434-airy',
        title: 'Эйри',
        level: 70,
        race: 'Гномы',
        location: 'Деревня Гномов',
        description:
            'Эйри — ключевой NPC в Деревне Гномов, который предоставляет услуги телепортации и информацию о контенте, специфичном для гномов.',
        services: ['Телепортация', 'Информация для гномов', 'Поддержка квестов'],
        coordinates: { x: 350, y: 550 },
    },
];

async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
}

async function createNPCArticle(npc) {
    const article = {
        id: npc.id,
        section: 'npc',
        group: 'catalog',
        title: npc.title,
        summary: `${npc.title} - NPC ${npc.level} уровня (${npc.race}), расположен в ${npc.location}`,
        eyebrow: 'NPC',
        meta: [],
        intro: [
            `<strong>${npc.title}</strong> — это NPC ${npc.level} уровня расы ${npc.race}, расположенный в ${npc.location}.`,
            npc.description,
            `Услуги: ${npc.services.join(', ')}`,
        ],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        related: [],
        order: 0,
        layout: 'detail',
        sidebarFacts: [
            { label: 'Уровень', value: npc.level.toString() },
            { label: 'Раса', value: npc.race },
            { label: 'Локация', value: npc.location },
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
                id: `${npc.id}-block-1`,
                type: 'prose',
                title: 'Описание',
                paragraphs: [npc.description, `Этот NPC предоставляет следующие услуги: ${npc.services.join(', ')}.`],
            },
            {
                id: `${npc.id}-block-2`,
                type: 'html',
                title: 'Местонахождение',
                html: `
<div class="npc-map-container">
  <img src="/map.svg" alt="Map" class="npc-map-image" />
  <div class="npc-map-marker" style="left: ${npc.coordinates.x}px; top: ${npc.coordinates.y}px;">
    <div class="npc-map-tooltip">${npc.title}</div>
  </div>
  <div class="npc-map-legend">
    <div class="npc-map-legend-item">
      <div class="npc-map-legend-marker"></div>
      <span class="npc-map-legend-text">${npc.title} - ${npc.location}</span>
    </div>
  </div>
</div>
        `,
            },
            {
                id: `${npc.id}-block-3`,
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
                            { value: 'Уровень', href: '', html: '' },
                            { value: npc.level.toString(), href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-2',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Раса', href: '', html: '' },
                            { value: npc.race, href: '', html: '' },
                        ],
                        meta: [],
                    },
                    {
                        id: 'row-3',
                        title: '',
                        href: '',
                        cells: [
                            { value: 'Локация', href: '', html: '' },
                            { value: npc.location, href: '', html: '' },
                        ],
                        meta: [],
                    },
                ],
            },
        ],
    };

    try {
        await api(`/article/${encodeURIComponent(article.id)}`, {
            method: 'PUT',
            body: JSON.stringify(article),
        });
        console.log(`✓ Created article: ${article.title}`);
    } catch (error) {
        console.error(`✗ Failed to create article ${article.title}:`, error.message);
    }
}

async function main() {
    console.log('Starting NPC article population...');

    for (const npc of npcs) {
        await createNPCArticle(npc);
    }

    console.log('NPC article population complete!');
}

main().catch(console.error);
