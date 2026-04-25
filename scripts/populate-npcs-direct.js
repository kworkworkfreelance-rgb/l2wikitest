const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, '../data/canonical/l2wiki-canonical.json');

// NPC data based on the catalog entries
const npcs = [
  {
    id: 'archive-npc-item-5431-edroc',
    title: 'Edroc (Эдрок)',
    level: 70,
    race: 'Humans',
    location: 'Hunters Village (Деревня Охотников)',
    description: 'Edroc is a valuable NPC located in Hunters Village. He provides important services for players including teleportation and information about the surrounding areas.',
    services: ['Teleportation', 'Location Information', 'Quest Support'],
    coordinates: { x: 540, y: 610 } // Approximate coordinates on the map
  },
  {
    id: 'archive-npc-item-5432-chamberlain',
    title: 'Chamberlain (Камергер)',
    level: 56,
    race: 'Humans',
    location: 'Bandit Stronghold',
    description: 'The Chamberlain is an important NPC in Bandit Stronghold who manages clan-related services and provides information about clan activities.',
    services: ['Clan Services', 'Castle Information', 'Quest Support'],
    coordinates: { x: 450, y: 500 }
  },
  {
    id: 'archive-npc-item-5433-wilford',
    title: 'Wilford (Вильфорд)',
    level: 70,
    race: 'Dwarves',
    location: 'Talking Island Village (Деревня Говорящего Острова)',
    description: 'Wilford is a dwarf NPC located in Talking Island Village. He specializes in crafting services and provides valuable assistance to new players.',
    services: ['Crafting', 'Item Enhancement', 'Quest Support'],
    coordinates: { x: 300, y: 400 }
  },
  {
    id: 'archive-npc-item-5434-airy',
    title: 'Airy (Эйри)',
    level: 70,
    race: 'Dwarves',
    location: 'Dwarven Village (Деревня Гномов)',
    description: 'Airy is a key NPC in Dwarven Village who provides teleportation services and information about dwarf-specific content.',
    services: ['Teleportation', 'Dwarf Information', 'Quest Support'],
    coordinates: { x: 350, y: 550 }
  }
];

function createNPCArticle(npc) {
  return {
    id: npc.id,
    section: 'npc',
    group: 'catalog',
    title: npc.title,
    summary: `${npc.title} - NPC Level ${npc.level} (${npc.race}) located in ${npc.location}`,
    eyebrow: 'NPC',
    meta: [],
    intro: [
      `<strong>${npc.title}</strong> is a level ${npc.level} ${npc.race} NPC located in ${npc.location}.`,
      npc.description,
      `Services: ${npc.services.join(', ')}`
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
      { label: 'Локация', value: npc.location }
    ],
    source: {
      url: '',
      path: '',
      snapshot: '',
      sourceType: 'manual'
    },
    aliases: [],
    blocks: [
      {
        id: `${npc.id}-block-1`,
        type: 'prose',
        title: 'Описание',
        paragraphs: [
          npc.description,
          `This NPC provides the following services: ${npc.services.join(', ')}.`
        ]
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
        `
      },
      {
        id: `${npc.id}-block-3`,
        type: 'table',
        title: 'Характеристики',
        columns: [
          { key: 'column-1', label: 'Параметр', align: '', width: '' },
          { key: 'column-2', label: 'Значение', align: '', width: '' }
        ],
        rows: [
          {
            id: 'row-1',
            title: '',
            href: '',
            cells: [
              { value: 'Уровень', href: '', html: '' },
              { value: npc.level.toString(), href: '', html: '' }
            ],
            meta: []
          },
          {
            id: 'row-2',
            title: '',
            href: '',
            cells: [
              { value: 'Раса', href: '', html: '' },
              { value: npc.race, href: '', html: '' }
            ],
            meta: []
          },
          {
            id: 'row-3',
            title: '',
            href: '',
            cells: [
              { value: 'Локация', href: '', html: '' },
              { value: npc.location, href: '', html: '' }
            ],
            meta: []
          }
        ]
      }
    ]
  };
}

async function main() {
  console.log('Reading canonical JSON...');
  const canonical = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf-8'));
  
  console.log('Adding NPC articles...');
  for (const npc of npcs) {
    const article = createNPCArticle(npc);
    canonical.articles[npc.id] = article;
    console.log(`✓ Added article: ${article.title}`);
  }
  
  console.log('Writing canonical JSON...');
  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2), 'utf-8');
  
  console.log('NPC article population complete!');
}

main().catch(console.error);
