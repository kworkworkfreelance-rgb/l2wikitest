/**
 * Populate weapons section and fill empty groups with L2 Interlude data.
 * Run: node scripts/populate-weapons.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';
let sessionCookie = '';

const request = (method, path, body = null) =>
    new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (sessionCookie) {
            options.headers.Cookie = sessionCookie;
        }

        const req = http.request(options, (res) => {
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                const match = setCookie.find((c) => c.startsWith('l2wiki_admin_session='));
                if (match) {
                    sessionCookie = match.split(';')[0];
                }
            }

            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });

// ─── L2 INTERLUDE WEAPONS DATA ───

const weaponTypes = [
    { id: 'sword', label: 'Мечи', description: 'Одноручные мечи для воинов и рыцарей' },
    { id: 'bigsword', label: 'Двуручные мечи', description: 'Мощные двуручные мечи' },
    { id: 'blunt', label: 'Дубины', description: 'Одноручные дубины и молоты' },
    { id: 'bigblunt', label: 'Двуручные дубины', description: 'Тяжёлые двуручные дубины' },
    { id: 'dagger', label: 'Кинжалы', description: 'Лёгкие кинжалы для разбойников' },
    { id: 'bow', label: 'Луки', description: 'Дальний бой — луки для лучников' },
    { id: 'pole', label: 'Копья', description: 'Древковое оружие для массового боя' },
    { id: 'fist', label: 'Кастеты', description: 'Оружие для монахов и кулачных бойцов' },
    { id: 'dual', label: 'Парные мечи', description: 'Два меча одновременно' },
    { id: 'dualdagger', label: 'Парные кинжалы', description: 'Два кинжала одновременно' },
    { id: 'dualfist', label: 'Парные кастеты', description: 'Два кастета одновременно' },
    { id: 'rapier', label: 'Рапиры', description: 'Изящное оружие фехтовальщиков' },
    { id: 'ancient', label: 'Древние', description: 'Древние мечи и реликвии' },
    { id: 'crossbow', label: 'Арбалеты', description: 'Арбалеты для снайперов' },
    { id: 'rod', label: 'Удочки', description: 'Рыболовные снасти' },
    { id: 'pet', label: 'Оружие для питомцев', description: 'Оружие для питомцев и саммонов' },
    { id: 'etc', label: 'Прочее', description: 'Специальное и прочее оружие' },
];

// Key weapons per grade per type (representative L2 Interlude weapons)
const weaponsData = {
    sword: {
        noGrade: [{ name: 'Training Sword', patk: 8, matk: 6, soulCrystal: '-', sa: '-', grade: 'No Grade' }],
        dGrade: [
            { name: 'Bastard Sword', patk: 45, matk: 22, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Sword of Reflection', patk: 51, matk: 24, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Sword of Whisper', patk: 57, matk: 26, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: "Knight's Sword", patk: 66, matk: 28, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'Stormbringer', patk: 75, matk: 30, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Samurai Long Sword', patk: 86, matk: 34, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Sword of Delusion', patk: 94, matk: 36, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' },
            { name: 'Sword of Limit', patk: 94, matk: 36, soulCrystal: '1', sa: 'Guidance', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Sword of Nightmare', patk: 104, matk: 39, soulCrystal: '3', sa: 'Focus', grade: 'B-Grade' },
            { name: 'Sword of Damascus', patk: 122, matk: 44, soulCrystal: '7', sa: 'Focus / Critical Damage / Haste', grade: 'B-Grade' },
            { name: 'Keshanberk', patk: 122, matk: 44, soulCrystal: '7', sa: 'Guidance / Focus / Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Sword of Miracles', patk: 142, matk: 48, soulCrystal: '10', sa: 'Focus / Critical Damage / Haste', grade: 'A-Grade' },
            { name: "Dark Legion's Edge", patk: 142, matk: 48, soulCrystal: '10', sa: 'Focus / Critical Damage / Haste', grade: 'A-Grade' },
        ],
        sGrade: [
            { name: 'Heavens Divider', patk: 175, matk: 52, soulCrystal: '13', sa: 'Haste / Focus / Critical Damage', grade: 'S-Grade' },
            { name: 'Forgotten Blade', patk: 175, matk: 52, soulCrystal: '13', sa: 'Haste / Focus / Critical Damage', grade: 'S-Grade' },
        ],
    },
    bigsword: {
        dGrade: [
            { name: 'Claymore', patk: 50, matk: 22, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Flamberge', patk: 62, matk: 26, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'Stormbringer*2', patk: 87, matk: 30, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Great Sword', patk: 107, matk: 36, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Great Axe', patk: 119, matk: 39, soulCrystal: '3', sa: 'Focus', grade: 'B-Grade' },
            { name: 'Heavy Sword', patk: 140, matk: 44, soulCrystal: '7', sa: 'Focus / Critical Damage / Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Dragon Slayer', patk: 163, matk: 48, soulCrystal: '10', sa: 'Focus / Critical Damage / Haste', grade: 'A-Grade' },
        ],
        sGrade: [
            { name: 'Heavens Divider', patk: 175, matk: 52, soulCrystal: '13', sa: 'Haste / Focus / Critical Damage', grade: 'S-Grade' },
        ],
    },
    blunt: {
        dGrade: [
            { name: 'Mace', patk: 41, matk: 27, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Dwarven War Hammer', patk: 51, matk: 29, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'War Hammer', patk: 57, matk: 31, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'War Pick', patk: 75, matk: 36, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Dwarven War Hammer', patk: 86, matk: 39, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' },
            { name: 'Club of Nature', patk: 94, matk: 41, soulCrystal: '1', sa: 'Magic Focus', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Axe of Nirvana', patk: 107, matk: 44, soulCrystal: '3', sa: 'Focus', grade: 'B-Grade' },
            { name: "Deadman's Staff", patk: 107, matk: 57, soulCrystal: '3', sa: 'Magic Focus', grade: 'B-Grade' },
            { name: 'Art of Battle Axe', patk: 122, matk: 48, soulCrystal: '7', sa: 'Focus / Health / Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Meteor Shower', patk: 142, matk: 52, soulCrystal: '10', sa: 'Focus / Health / Haste', grade: 'A-Grade' },
            { name: 'Elysian', patk: 142, matk: 52, soulCrystal: '10', sa: 'Focus / Health / Haste', grade: 'A-Grade' },
        ],
        sGrade: [
            { name: 'Arcana Mace', patk: 175, matk: 57, soulCrystal: '13', sa: 'Acumen / MP Regeneration / Magic Focus', grade: 'S-Grade' },
        ],
    },
    bigblunt: {
        dGrade: [{ name: 'Morning Star', patk: 55, matk: 24, soulCrystal: '-', sa: '-', grade: 'D-Grade' }],
        cGrade: [
            { name: 'Big Hammer', patk: 87, matk: 30, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Scorpion', patk: 94, matk: 36, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: "Deadman's Glory", patk: 119, matk: 39, soulCrystal: '3', sa: 'Focus', grade: 'B-Grade' },
            { name: 'Dwarven Hammer', patk: 140, matk: 44, soulCrystal: '7', sa: 'Focus / Health / Haste', grade: 'B-Grade' },
        ],
        aGrade: [{ name: "Barakiel's Axe", patk: 163, matk: 48, soulCrystal: '10', sa: 'Focus / Health / Haste', grade: 'A-Grade' }],
        sGrade: [
            { name: 'Arcana Mace', patk: 175, matk: 57, soulCrystal: '13', sa: 'Acumen / MP Regeneration / Magic Focus', grade: 'S-Grade' },
        ],
    },
    dagger: {
        dGrade: [
            { name: 'Knife', patk: 11, matk: 10, soulCrystal: '-', sa: '-', grade: 'No Grade' },
            { name: 'Dagger of Mana', patk: 23, matk: 17, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Mystic Knife', patk: 27, matk: 19, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: "Conjurer's Knife", patk: 31, matk: 21, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'Stiletto', patk: 47, matk: 26, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' },
            { name: 'Dark Screamer', patk: 55, matk: 28, soulCrystal: '1', sa: 'Focus / Critical Damage', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Kris', patk: 64, matk: 32, soulCrystal: '7', sa: 'Focus / Backblow / Evasion', grade: 'B-Grade' },
            { name: 'Demon Dagger', patk: 68, matk: 34, soulCrystal: '7', sa: 'Focus / Backblow / Evasion', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Bloody Orchid', patk: 79, matk: 36, soulCrystal: '10', sa: 'Focus / Backblow / Evasion', grade: 'A-Grade' },
            { name: 'Soul Separator', patk: 79, matk: 36, soulCrystal: '10', sa: 'Focus / Backblow / Evasion', grade: 'A-Grade' },
        ],
        sGrade: [{ name: 'Angel Slayer', patk: 97, matk: 40, soulCrystal: '13', sa: 'Focus / Backblow / Evasion', grade: 'S-Grade' }],
    },
    bow: {
        dGrade: [
            { name: 'Short Bow', patk: 31, matk: 6, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Bow of Forest', patk: 39, matk: 7, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Composition Bow', patk: 45, matk: 8, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'Strengthen Bow', patk: 56, matk: 10, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Eminence Bow', patk: 72, matk: 12, soulCrystal: '1', sa: 'Guidance', grade: 'C-Grade' },
            { name: 'Crystallized Ice Bow', patk: 79, matk: 13, soulCrystal: '1', sa: 'Quick Recovery', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Bow of Inferno', patk: 96, matk: 15, soulCrystal: '7', sa: 'Focus / Quick Recovery / Cheap Shot', grade: 'B-Grade' },
            { name: 'Gust Bow', patk: 107, matk: 16, soulCrystal: '7', sa: 'Guidance / Quick Recovery / Cheap Shot', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Carnage Bow', patk: 124, matk: 18, soulCrystal: '10', sa: 'Focus / Quick Recovery / Cheap Shot', grade: 'A-Grade' },
            { name: 'Soul Bow', patk: 131, matk: 19, soulCrystal: '10', sa: 'Focus / Quick Recovery / Cheap Shot', grade: 'A-Grade' },
        ],
        sGrade: [
            { name: 'Draconic Bow', patk: 163, matk: 22, soulCrystal: '13', sa: 'Focus / Cheap Shot / Critical Slow', grade: 'S-Grade' },
        ],
    },
    pole: {
        dGrade: [
            { name: 'Spear', patk: 36, matk: 17, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
            { name: 'Trident', patk: 40, matk: 18, soulCrystal: '-', sa: '-', grade: 'D-Grade' },
        ],
        cGrade: [
            { name: 'Orcish Glaive', patk: 79, matk: 26, soulCrystal: '1', sa: 'Critical Stun', grade: 'C-Grade' },
            { name: 'Body Slasher', patk: 87, matk: 28, soulCrystal: '1', sa: 'Critical Stun', grade: 'C-Grade' },
        ],
        bGrade: [
            {
                name: 'Scorpion Spear',
                patk: 107,
                matk: 34,
                soulCrystal: '7',
                sa: 'Critical Stun / Long Blow / Wide Blow',
                grade: 'B-Grade',
            },
            {
                name: 'Orcish Poleaxe',
                patk: 119,
                matk: 36,
                soulCrystal: '7',
                sa: 'Critical Stun / Long Blow / Wide Blow',
                grade: 'B-Grade',
            },
        ],
        aGrade: [
            { name: 'Halberd', patk: 142, matk: 40, soulCrystal: '10', sa: 'Critical Stun / Long Blow / Wide Blow', grade: 'A-Grade' },
        ],
        sGrade: [
            {
                name: 'Dynasty Halberd',
                patk: 175,
                matk: 44,
                soulCrystal: '13',
                sa: 'Critical Stun / Long Blow / Wide Blow',
                grade: 'S-Grade',
            },
        ],
    },
    fist: {
        dGrade: [{ name: 'Viper Fang', patk: 38, matk: 17, soulCrystal: '-', sa: '-', grade: 'D-Grade' }],
        cGrade: [
            { name: 'Fist Blade', patk: 79, matk: 26, soulCrystal: '1', sa: 'Rsk. Haste', grade: 'C-Grade' },
            { name: 'Great Pata', patk: 87, matk: 28, soulCrystal: '1', sa: 'Rsk. Haste', grade: 'C-Grade' },
        ],
        bGrade: [
            { name: 'Arthro Nail', patk: 107, matk: 34, soulCrystal: '7', sa: 'Focus / Health / Rsk. Haste', grade: 'B-Grade' },
            { name: 'Bellion Cestus', patk: 119, matk: 36, soulCrystal: '7', sa: 'Focus / Health / Rsk. Haste', grade: 'B-Grade' },
        ],
        aGrade: [{ name: 'Blood Tornado', patk: 142, matk: 40, soulCrystal: '10', sa: 'Focus / Health / Rsk. Haste', grade: 'A-Grade' }],
        sGrade: [{ name: 'Dynasty Crusher', patk: 175, matk: 44, soulCrystal: '13', sa: 'Focus / Health / Rsk. Haste', grade: 'S-Grade' }],
    },
    dual: {
        dGrade: [{ name: 'Sword of Revolution*2', patk: 62, matk: 24, soulCrystal: '-', sa: '-', grade: 'D-Grade' }],
        cGrade: [
            { name: 'Stormbringer*Stormbringer', patk: 87, matk: 30, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
            { name: 'Samurai Long Sword*Samurai Long Sword', patk: 100, matk: 34, soulCrystal: '-', sa: '-', grade: 'C-Grade' },
        ],
        bGrade: [
            {
                name: 'Sword of Delusion*Sword of Delusion',
                patk: 119,
                matk: 39,
                soulCrystal: '7',
                sa: 'Focus / Health / Haste',
                grade: 'B-Grade',
            },
            { name: 'Keshanberk*Keshanberk', patk: 140, matk: 44, soulCrystal: '7', sa: 'Focus / Health / Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            {
                name: 'Sword of Miracles*Sword of Miracles',
                patk: 163,
                matk: 48,
                soulCrystal: '10',
                sa: 'Focus / Health / Haste',
                grade: 'A-Grade',
            },
            {
                name: "Dark Legion's Edge*Dark Legion's Edge",
                patk: 163,
                matk: 48,
                soulCrystal: '10',
                sa: 'Focus / Health / Haste',
                grade: 'A-Grade',
            },
        ],
        sGrade: [
            {
                name: 'Forgotten Blade*Forgotten Blade',
                patk: 204,
                matk: 52,
                soulCrystal: '13',
                sa: 'Focus / Health / Haste',
                grade: 'S-Grade',
            },
        ],
    },
    dualdagger: {
        bGrade: [{ name: 'Kris*Kris', patk: 79, matk: 32, soulCrystal: '7', sa: 'Focus / Backblow / Evasion', grade: 'B-Grade' }],
        aGrade: [
            {
                name: 'Bloody Orchid*Bloody Orchid',
                patk: 91,
                matk: 36,
                soulCrystal: '10',
                sa: 'Focus / Backblow / Evasion',
                grade: 'A-Grade',
            },
            {
                name: 'Soul Separator*Soul Separator',
                patk: 91,
                matk: 36,
                soulCrystal: '10',
                sa: 'Focus / Backblow / Evasion',
                grade: 'A-Grade',
            },
        ],
        sGrade: [
            {
                name: 'Angel Slayer*Angel Slayer',
                patk: 113,
                matk: 40,
                soulCrystal: '13',
                sa: 'Focus / Backblow / Evasion',
                grade: 'S-Grade',
            },
        ],
    },
    dualfist: {
        cGrade: [{ name: 'Fist Blade*Fist Blade', patk: 87, matk: 26, soulCrystal: '1', sa: 'Rsk. Haste', grade: 'C-Grade' }],
        bGrade: [
            { name: 'Arthro Nail*Arthro Nail', patk: 119, matk: 34, soulCrystal: '7', sa: 'Focus / Health / Rsk. Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            {
                name: 'Blood Tornado*Blood Tornado',
                patk: 142,
                matk: 40,
                soulCrystal: '10',
                sa: 'Focus / Health / Rsk. Haste',
                grade: 'A-Grade',
            },
        ],
        sGrade: [
            {
                name: 'Dynasty Crusher*Dynasty Crusher',
                patk: 175,
                matk: 44,
                soulCrystal: '13',
                sa: 'Focus / Health / Rsk. Haste',
                grade: 'S-Grade',
            },
        ],
    },
    rapier: {
        cGrade: [{ name: 'Crimson Sword', patk: 79, matk: 30, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' }],
        bGrade: [{ name: 'Grace Sword', patk: 107, matk: 39, soulCrystal: '7', sa: 'Focus / Critical Damage / Haste', grade: 'B-Grade' }],
        aGrade: [
            {
                name: 'Sword of Miracles (Rapier)',
                patk: 142,
                matk: 48,
                soulCrystal: '10',
                sa: 'Focus / Critical Damage / Haste',
                grade: 'A-Grade',
            },
        ],
        sGrade: [
            {
                name: 'Forgotten Blade (Rapier)',
                patk: 175,
                matk: 52,
                soulCrystal: '13',
                sa: 'Focus / Critical Damage / Haste',
                grade: 'S-Grade',
            },
        ],
    },
    ancient: {
        cGrade: [{ name: 'Ancient Sword', patk: 87, matk: 30, soulCrystal: '1', sa: 'Focus', grade: 'C-Grade' }],
        bGrade: [
            { name: 'Guardian Sword', patk: 119, matk: 39, soulCrystal: '7', sa: 'Focus / Critical Damage / Haste', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Infernal Sword', patk: 142, matk: 48, soulCrystal: '10', sa: 'Focus / Critical Damage / Haste', grade: 'A-Grade' },
        ],
        sGrade: [
            { name: 'Phantom Sword', patk: 175, matk: 52, soulCrystal: '13', sa: 'Focus / Critical Damage / Haste', grade: 'S-Grade' },
        ],
    },
    crossbow: {
        cGrade: [{ name: 'Light Crossbow', patk: 72, matk: 12, soulCrystal: '1', sa: 'Guidance', grade: 'C-Grade' }],
        bGrade: [
            { name: 'Heavy Crossbow', patk: 107, matk: 16, soulCrystal: '7', sa: 'Focus / Quick Recovery / Cheap Shot', grade: 'B-Grade' },
        ],
        aGrade: [
            { name: 'Siege Crossbow', patk: 124, matk: 18, soulCrystal: '10', sa: 'Focus / Quick Recovery / Cheap Shot', grade: 'A-Grade' },
        ],
        sGrade: [
            {
                name: 'Draconic Crossbow',
                patk: 163,
                matk: 22,
                soulCrystal: '13',
                sa: 'Focus / Cheap Shot / Critical Slow',
                grade: 'S-Grade',
            },
        ],
    },
    rod: {
        dGrade: [{ name: 'Fishing Rod', patk: 1, matk: 1, soulCrystal: '-', sa: '-', grade: 'No Grade' }],
    },
    pet: {
        cGrade: [{ name: 'Wolf Armor', patk: 30, matk: 10, soulCrystal: '-', sa: '-', grade: 'C-Grade' }],
    },
    etc: {
        dGrade: [{ name: 'Signal Cannon', patk: 12, matk: 8, soulCrystal: '-', sa: '-', grade: 'D-Grade' }],
    },
};

// ─── ADDITIONAL ITEMS DATA ───

const armorData = {
    heavy: {
        dGrade: [
            { name: 'Bronze Breastplate', patk: '-', pdef: 68, grade: 'D-Grade', type: 'Тяжёлая' },
            { name: 'Mithril Breastplate', patk: '-', pdef: 79, grade: 'D-Grade', type: 'Тяжёлая' },
        ],
        cGrade: [
            { name: 'Composite Armor', patk: '-', pdef: 94, grade: 'C-Grade', type: 'Тяжёлая' },
            { name: 'Theca Leather Armor', patk: '-', pdef: 101, grade: 'C-Grade', type: 'Тяжёлая' },
            { name: 'Plated Leather Armor', patk: '-', pdef: 101, grade: 'C-Grade', type: 'Тяжёлая' },
        ],
        bGrade: [
            { name: 'Doom Plate Armor', patk: '-', pdef: 125, grade: 'B-Grade', type: 'Тяжёлая' },
            { name: 'Blue Wolf Plate Armor', patk: '-', pdef: 136, grade: 'B-Grade', type: 'Тяжёлая' },
        ],
        aGrade: [
            { name: 'Dark Crystal Heavy Armor', patk: '-', pdef: 157, grade: 'A-Grade', type: 'Тяжёлая' },
            { name: 'Majestic Plate Armor', patk: '-', pdef: 157, grade: 'A-Grade', type: 'Тяжёлая' },
        ],
        sGrade: [{ name: 'Imperial Crusader Breastplate', patk: '-', pdef: 204, grade: 'S-Grade', type: 'Тяжёлая' }],
    },
    light: {
        dGrade: [
            { name: 'Hard Leather Shirt', patk: '-', pdef: 47, grade: 'D-Grade', type: 'Лёгкая' },
            { name: 'Mithril Shirt', patk: '-', pdef: 53, grade: 'D-Grade', type: 'Лёгкая' },
        ],
        cGrade: [
            { name: 'Manticore Skin Shirt', patk: '-', pdef: 68, grade: 'C-Grade', type: 'Лёгкая' },
            { name: 'Plated Leather Shirt', patk: '-', pdef: 68, grade: 'C-Grade', type: 'Лёгкая' },
        ],
        bGrade: [
            { name: 'Doom Leather Armor', patk: '-', pdef: 89, grade: 'B-Grade', type: 'Лёгкая' },
            { name: 'Blue Wolf Leather Armor', patk: '-', pdef: 97, grade: 'B-Grade', type: 'Лёгкая' },
        ],
        aGrade: [
            { name: 'Dark Crystal Light Armor', patk: '-', pdef: 112, grade: 'A-Grade', type: 'Лёгкая' },
            { name: 'Majestic Leather Armor', patk: '-', pdef: 112, grade: 'A-Grade', type: 'Лёгкая' },
        ],
        sGrade: [{ name: 'Draconic Leather Armor', patk: '-', pdef: 146, grade: 'S-Grade', type: 'Лёгкая' }],
    },
    robe: {
        dGrade: [
            { name: 'Cotton Tunic', patk: '-', pdef: 29, grade: 'D-Grade', type: 'Магическая' },
            { name: 'Mithril Tunic', patk: '-', pdef: 32, grade: 'D-Grade', type: 'Магическая' },
        ],
        cGrade: [
            { name: "Demon's Tunic", patk: '-', pdef: 44, grade: 'C-Grade', type: 'Магическая' },
            { name: 'Divine Tunic', patk: '-', pdef: 44, grade: 'C-Grade', type: 'Магическая' },
        ],
        bGrade: [
            { name: 'Doom Robe', patk: '-', pdef: 57, grade: 'B-Grade', type: 'Магическая' },
            { name: 'Blue Wolf Robe', patk: '-', pdef: 62, grade: 'B-Grade', type: 'Магическая' },
        ],
        aGrade: [
            { name: 'Dark Crystal Robe', patk: '-', pdef: 71, grade: 'A-Grade', type: 'Магическая' },
            { name: 'Majestic Robe', patk: '-', pdef: 71, grade: 'A-Grade', type: 'Магическая' },
        ],
        sGrade: [{ name: 'Major Arcana Robe', patk: '-', pdef: 92, grade: 'S-Grade', type: 'Магическая' }],
    },
};

const accessoriesData = [
    { name: 'Ring of Mana', grade: 'D-Grade', mdef: 22, bonus: '+21 MP' },
    { name: 'Necklace of Wisdom', grade: 'D-Grade', mdef: 32, bonus: '+4.2% Bleed Resist' },
    { name: 'Earring of Protection', grade: 'C-Grade', mdef: 36, bonus: '+4.2% Bleed Resist' },
    { name: 'Ring of Seal', grade: 'C-Grade', mdef: 24, bonus: '+10% Stun Resist' },
    { name: 'Necklace of Binding', grade: 'C-Grade', mdef: 36, bonus: '+4.2% Bleed Resist' },
    { name: 'Ring of Ages', grade: 'B-Grade', mdef: 30, bonus: '+40 CP' },
    { name: 'Necklace of Mermaid', grade: 'B-Grade', mdef: 44, bonus: '+4.2% Bleed Resist' },
    { name: 'Earring of Binding', grade: 'B-Grade', mdef: 44, bonus: '+4.2% Bleed Resist' },
    { name: 'Ring of Phoenix', grade: 'A-Grade', mdef: 36, bonus: '+40 CP' },
    { name: 'Necklace of Majestic', grade: 'A-Grade', mdef: 52, bonus: '+4.2% Bleed Resist' },
    { name: 'Earring of Majestic', grade: 'A-Grade', mdef: 52, bonus: '+4.2% Bleed Resist' },
    { name: 'Ring of Imperial', grade: 'S-Grade', mdef: 42, bonus: '+40 CP' },
    { name: 'Necklace of Imperial', grade: 'S-Grade', mdef: 61, bonus: '+4.2% Bleed Resist' },
    { name: 'Earring of Imperial', grade: 'S-Grade', mdef: 61, bonus: '+4.2% Bleed Resist' },
];

const questItemsData = [
    {
        id: 'qi-soul-crystal',
        title: 'Кристалл души (Soul Crystal)',
        summary: 'Специальный кристалл для добавления SA (Special Ability) к оружию',
        meta: [
            { label: 'Тип', value: 'Квестовый предмет' },
            { label: 'Макс. уровень', value: '16' },
            { label: 'Квест', value: 'Прокачка Кристалла души' },
        ],
    },
    {
        id: 'qi-wolf-collar',
        title: 'Волчий ошейник (Wolf Collar)',
        summary: 'Призыв питомца — молодого волка',
        meta: [
            { label: 'Тип', value: 'Питомец' },
            { label: 'Уровень', value: '15+' },
            { label: 'Квест', value: 'Квест на Волка' },
        ],
    },
    {
        id: 'qi-dragonflute',
        title: 'Флейта дракона (Dragonflute)',
        summary: 'Призыв детёныша дракона',
        meta: [
            { label: 'Тип', value: 'Питомец' },
            { label: 'Уровень', value: '35+' },
            { label: 'Квест', value: 'Квест на Дракончика' },
        ],
    },
    {
        id: 'qi-dragon-bugle',
        title: 'Рог дракона (Dragon Bugle)',
        summary: 'Призыв ездового дракона (Strider)',
        meta: [
            { label: 'Тип', value: 'Маунт' },
            { label: 'Уровень', value: '55+' },
            { label: 'Квест', value: 'Квест на Ездового Дракона' },
        ],
    },
    {
        id: 'qi-baby-buffalo',
        title: 'Бычок (Baby Buffalo)',
        summary: 'Призыв питомца — бычка',
        meta: [
            { label: 'Тип', value: 'Питомец' },
            { label: 'Уровень', value: '25+' },
            { label: 'Квест', value: 'Квест на Быка' },
        ],
    },
    {
        id: 'qi-baby-kookabura',
        title: 'Птица (Baby Kookabura)',
        summary: 'Призыв питомца — кукабурры',
        meta: [
            { label: 'Тип', value: 'Питомец' },
            { label: 'Уровень', value: '25+' },
            { label: 'Квест', value: 'Квест на Птицу' },
        ],
    },
    {
        id: 'qi-baby-cougar',
        title: 'Тигр (Baby Cougar)',
        summary: 'Призыв питомца — тигра',
        meta: [
            { label: 'Тип', value: 'Питомец' },
            { label: 'Уровень', value: '25+' },
            { label: 'Квест', value: 'Квест на Тигра' },
        ],
    },
    {
        id: 'qi-pagan-pass',
        title: 'Пропуск в Pagan Temple',
        summary: 'Ключ для входа в Pagan Temple',
        meta: [
            { label: 'Тип', value: 'Ключ' },
            { label: 'Локация', value: 'Pagan Temple' },
            { label: 'Квест', value: 'Квест на проход в Pagan Temple' },
        ],
    },
];

const servicesData = [
    {
        id: 'svc-mammon-shop',
        title: 'Магазин Маммона',
        summary: 'Обмен предметов между грейдами, покупка рецептов и ключевых материалов',
        meta: [
            { label: 'Тип', value: 'Сервис' },
            { label: 'NPC', value: 'Торговец Маммон' },
            { label: 'Расположение', value: 'Перемещается между городами' },
        ],
    },
    {
        id: 'svc-mammon-smith',
        title: 'Кузница Маммона',
        summary: 'Разблокировка СА, улучшение кристаллов души, снятие augmentation',
        meta: [
            { label: 'Тип', value: 'Сервис' },
            { label: 'NPC', value: 'Кузнец Маммона' },
            { label: 'Расположение', value: 'Перемещается между городами' },
        ],
    },
    {
        id: 'svc-augmentation',
        title: 'Аугментация оружия',
        summary: 'Добавление бонусов к оружию через Life Stones',
        meta: [
            { label: 'Тип', value: 'Система' },
            { label: 'NPC', value: 'Кузнец' },
            { label: 'Требуется', value: 'Life Stone + Gemstones' },
        ],
    },
    {
        id: 'svc-enchant',
        title: 'Заточка оружия и брони',
        summary: 'Улучшение оружия и брони свитками заточки',
        meta: [
            { label: 'Тип', value: 'Система' },
            { label: 'Макс.', value: '+20 (оружие), +16 (броня)' },
            { label: 'Шанс', value: 'Зависит от уровня и типа' },
        ],
    },
    {
        id: 'svc-soul-crystal',
        title: 'Прокачка Кристалла души',
        summary: 'Повышение уровня Soul Crystal для СА',
        meta: [
            { label: 'Тип', value: 'Система' },
            { label: 'Макс. уровень', value: '16' },
            { label: 'NPC', value: 'Кузнец Маммона' },
        ],
    },
    {
        id: 'svc-attribute',
        title: 'Атрибуты оружия и брони',
        summary: 'Добавление стихийного урона к оружию и защиты к броне',
        meta: [
            { label: 'Тип', value: 'Система' },
            { label: 'Стихии', value: 'Огонь, Вода, Ветер, Земля, Святость, Тьма' },
            { label: 'Макс. уровень', value: '150 (оружие), 300 (броня)' },
        ],
    },
    {
        id: 'svc-dyes',
        title: 'Символы (Татуировки)',
        summary: 'Изменение базовых характеристик персонажа через символы',
        meta: [
            { label: 'Тип', value: 'Система' },
            { label: 'NPC', value: 'Создатель Символов' },
            { label: 'Доступно', value: 'После 1-й профессии' },
        ],
    },
];

// ─── MAIN ───

async function main() {
    console.log('[Populate] Logging in...');
    await request('POST', '/api/admin/login', { username: 'admin', password: 'admin' });
    console.log('[Populate] Logged in.');

    // 1. Update items section with proper groups for weapons
    console.log('[Populate] Updating items section with weapon groups...');
    const itemsSection = {
        id: 'items',
        title: 'Предметы',
        description: 'Оружие, броня, аксессуары, квестовые предметы и сервисы Lineage 2 Interlude',
        order: 6,
        groups: [
            { id: 'catalog', label: 'Каталог предметов', description: 'Обзорные статьи по категориям', order: 0 },
            { id: 'weapons', label: 'Оружие', description: 'Все типы оружия по грейдам', order: 1 },
            { id: 'armor', label: 'Броня', description: 'Тяжёлая, лёгкая и магическая броня', order: 2 },
            { id: 'accessories', label: 'Аксессуары', description: 'Кольца, серьги, ожерелья', order: 3 },
            { id: 'quest-items', label: 'Квестовые предметы', description: 'Ключевые предметы из квестов', order: 4 },
            { id: 'services', label: 'Сервисы и системы', description: 'Маммон, аугментация, заточка и другие системы', order: 5 },
        ],
    };
    await request('PUT', `/api/section/items`, itemsSection);
    console.log('[Populate] Items section updated.');

    // 2. Create weapon type articles
    let weaponOrder = 0;
    for (const weaponType of weaponTypes) {
        const typeData = weaponsData[weaponType.id] || {};
        const allWeapons = [];
        for (const [grade, items] of Object.entries(typeData)) {
            for (const item of items) {
                allWeapons.push({ ...item, weaponType: weaponType.id });
            }
        }

        if (!allWeapons.length) continue;

        const columns = [
            { key: 'name', label: 'Название' },
            { key: 'grade', label: 'Грейд', align: 'center' },
            { key: 'patk', label: 'Физ. Атака', align: 'center' },
            { key: 'matk', label: 'Маг. Атака', align: 'center' },
            { key: 'soulCrystal', label: 'СА Кристалл', align: 'center' },
            { key: 'sa', label: 'Спец. Способность (СА)', align: 'center' },
        ];

        const rows = allWeapons.map((w, i) => ({
            id: `row-${i + 1}`,
            cells: [
                { value: w.name, href: `/pages/article.html?article=weapon-${weaponType.id}-${i + 1}` },
                { value: w.grade },
                { value: String(w.patk) },
                { value: String(w.matk) },
                { value: String(w.soulCrystal) },
                { value: String(w.sa) },
            ],
        }));

        const article = {
            id: `weapons-${weaponType.id}`,
            title: weaponType.label,
            section: 'items',
            group: 'weapons',
            eyebrow: 'ОРУЖИЕ',
            summary: weaponType.description,
            order: weaponOrder++,
            layout: 'catalog',
            meta: [
                { label: 'Тип', value: weaponType.label },
                { label: 'Категория', value: 'Оружие' },
                { label: 'Предметов', value: String(allWeapons.length) },
            ],
            blocks: [
                {
                    id: 'weapon-table',
                    type: 'table',
                    title: `${weaponType.label} — Полный список`,
                    columns,
                    rows,
                },
                {
                    id: 'weapon-info',
                    type: 'prose',
                    title: 'Информация',
                    paragraphs: [
                        `${weaponType.label} — одна из категорий оружия в Lineage 2 Interlude.`,
                        `В этом разделе представлены все ${weaponType.label.toLowerCase()} от No Grade до S-Grade с указанием характеристик.`,
                        `Special Ability (SA) — уникальная способность оружия, добавляемая через Кристалл души у Blacksmith of Mammon.`,
                    ],
                },
            ],
        };

        console.log(`[Populate] Creating weapon article: ${weaponType.label} (${allWeapons.length} weapons)`);
        try {
            await request('PUT', `/api/article/weapons-${weaponType.id}`, article);
        } catch (err) {
            console.error(`[Populate] Error creating ${weaponType.id}:`, err.message);
        }
    }

    // 3. Create armor articles
    console.log('[Populate] Creating armor articles...');
    let armorOrder = 0;
    for (const [armorType, armorItems] of Object.entries(armorData)) {
        const allItems = [];
        for (const [grade, items] of Object.entries(armorItems)) {
            for (const item of items) {
                allItems.push({ ...item, armorType });
            }
        }

        const columns = [
            { key: 'name', label: 'Название' },
            { key: 'grade', label: 'Грейд', align: 'center' },
            { key: 'pdef', label: 'P.Def', align: 'center' },
            { key: 'type', label: 'Тип', align: 'center' },
        ];

        const rows = allItems.map((w, i) => ({
            id: `row-${i + 1}`,
            cells: [{ value: w.name }, { value: w.grade }, { value: String(w.pdef) }, { value: w.type }],
        }));

        const typeLabel = armorType === 'heavy' ? 'Тяжёлая броня' : armorType === 'light' ? 'Лёгкая броня' : 'Магическая броня (Robe)';

        const article = {
            id: `armor-${armorType}`,
            title: typeLabel,
            section: 'items',
            group: 'armor',
            eyebrow: 'БРОНЯ',
            summary: `${typeLabel} Lineage 2 Interlude — полный список по грейдам`,
            order: armorOrder++,
            layout: 'catalog',
            meta: [
                { label: 'Тип', value: typeLabel },
                { label: 'Категория', value: 'Броня' },
                { label: 'Предметов', value: String(allItems.length) },
            ],
            blocks: [
                {
                    id: 'armor-table',
                    type: 'table',
                    title: `${typeLabel} — Полный список`,
                    columns,
                    rows,
                },
            ],
        };

        try {
            await request('PUT', `/api/article/armor-${armorType}`, article);
        } catch (err) {
            console.error(`[Populate] Error creating armor-${armorType}:`, err.message);
        }
    }

    // 4. Create accessories article
    console.log('[Populate] Creating accessories article...');
    {
        const columns = [
            { key: 'name', label: 'Название' },
            { key: 'grade', label: 'Грейд', align: 'center' },
            { key: 'mdef', label: 'M.Def', align: 'center' },
            { key: 'bonus', label: 'Бонус', align: 'center' },
        ];

        const rows = accessoriesData.map((w, i) => ({
            id: `row-${i + 1}`,
            cells: [{ value: w.name }, { value: w.grade }, { value: String(w.mdef) }, { value: w.bonus }],
        }));

        const article = {
            id: 'items-accessories-full',
            title: 'Аксессуары — Кольца, Серьги, Ожерелья',
            section: 'items',
            group: 'accessories',
            eyebrow: 'АКСЕССУАРЫ',
            summary: 'Полный список аксессуаров Lineage 2 Interlude по грейдам',
            order: 0,
            layout: 'catalog',
            meta: [
                { label: 'Тип', value: 'Аксессуары' },
                { label: 'Предметов', value: String(accessoriesData.length) },
            ],
            blocks: [
                {
                    id: 'accessories-table',
                    type: 'table',
                    title: 'Аксессуары — Полный список',
                    columns,
                    rows,
                },
            ],
        };

        try {
            await request('PUT', `/api/article/items-accessories-full`, article);
        } catch (err) {
            console.error(`[Populate] Error creating accessories:`, err.message);
        }
    }

    // 5. Create quest items articles
    console.log('[Populate] Creating quest items articles...');
    for (let i = 0; i < questItemsData.length; i++) {
        const qi = questItemsData[i];
        const article = {
            id: qi.id,
            title: qi.title,
            section: 'items',
            group: 'quest-items',
            eyebrow: 'КВЕСТОВЫЙ ПРЕДМЕТ',
            summary: qi.summary,
            order: i,
            meta: qi.meta,
            blocks: [
                {
                    id: 'item-info',
                    type: 'prose',
                    title: 'Информация о предмете',
                    paragraphs: [qi.summary],
                },
                {
                    id: 'item-meta',
                    type: 'list',
                    title: 'Характеристики',
                    style: 'unordered',
                    items: qi.meta.map((m) => `${m.label}: ${m.value}`),
                },
            ],
        };

        try {
            await request('PUT', `/api/article/${qi.id}`, article);
        } catch (err) {
            console.error(`[Populate] Error creating ${qi.id}:`, err.message);
        }
    }

    // 6. Create services articles
    console.log('[Populate] Creating services articles...');
    for (let i = 0; i < servicesData.length; i++) {
        const svc = servicesData[i];
        const article = {
            id: svc.id,
            title: svc.title,
            section: 'items',
            group: 'services',
            eyebrow: 'СЕРВИС',
            summary: svc.summary,
            order: i,
            meta: svc.meta,
            blocks: [
                {
                    id: 'service-info',
                    type: 'prose',
                    title: 'Описание',
                    paragraphs: [svc.summary],
                },
                {
                    id: 'service-meta',
                    type: 'list',
                    title: 'Характеристики',
                    style: 'unordered',
                    items: svc.meta.map((m) => `${m.label}: ${m.value}`),
                },
            ],
        };

        try {
            await request('PUT', `/api/article/${svc.id}`, article);
        } catch (err) {
            console.error(`[Populate] Error creating ${svc.id}:`, err.message);
        }
    }

    console.log('[Populate] Done! All weapons, armor, accessories, quest items and services populated.');
}

main().catch((err) => {
    console.error('[Populate] Fatal error:', err);
    process.exit(1);
});
