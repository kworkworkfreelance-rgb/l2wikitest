#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'canonical', 'l2wiki-canonical.json');
const ASSET_DIR = path.join(ROOT, 'assets', 'img', 'archive');

const readDatabase = () => JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
const writeDatabase = (db) => fs.writeFileSync(CANONICAL_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const normalize = (value = '') =>
    String(value)
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9а-яё]+/gi, '');

const assetFiles = fs.existsSync(ASSET_DIR) ? fs.readdirSync(ASSET_DIR) : [];

const iconOverrides = {
    aggression: 'quest-aggression-f4406565222b.jpg',
    'aura of hate': 'quest-aura-of-hate-231bf86f1eea.jpg',
    'holy blessing': 'quest-holy-blessing-8b11f306fd4b.jpg',
    'holy strike': 'quest-holy-strike-4f2a39af4f65.jpg',
    'holy armor': 'quest-holy-armor-45ff7baf64a9.jpg',
    'holy blade': 'quest-holy-blade-5f36226de221.jpg',
    'holy weapon': 'quest-holy-weapon-874bec50775d.jpg',
    'attack aura': 'quest-attack-aura-be32c3820c22.jpg',
    'defense aura': 'quest-defense-aura-8395102e19a7.jpg',
    'skill mastery': 'quest-skill-mastery-3026370b29f7.jpg',
    'focus skill mastery': 'quest-focus-skill-mastery-da0b42aab412.jpg',
    spoil: 'quest-spoil-aa30c8d42052.jpg',
    'spoil crush': 'quest-spoil-crush-8f810fda9ef6.jpg',
    'common craft': 'quest-common-craft-a83f455c7068.jpg',
    'expand dwarven craft': 'quest-expand-dwarven-craft-1c0531a0eb72.jpg',
    'expand common craft': 'quest-expand-common-craft-1e3de3b24526.jpg',
};

const findSkillIcon = (label = '') => {
    const normalized = normalize(label);
    const direct = iconOverrides[String(label || '').toLowerCase()];

    if (direct && assetFiles.includes(direct)) {
        return `/assets/img/archive/${direct}`;
    }

    const matches = assetFiles
        .filter((file) => normalize(file).includes(normalized) || normalized.includes(normalize(file)))
        .sort((left, right) => left.length - right.length);

    return matches[0] ? `/assets/img/archive/${matches[0]}` : '/assets/img/archive/quest-skill0000-0-d26db032a400.png';
};

const isSkillHeaderRow = (row = {}) => {
    const labels = (row.cells || []).map((cell) => String(cell.value || '').trim());
    return labels[1] === 'Название' && labels[2] === 'Описание' && labels[3] === 'Тип';
};

const isSkillTable = (block = {}) => block.type === 'table' && /^\d+$/.test(String(block.title || '').trim()) && (block.rows || []).length >= 2;

const formatSkillNameCell = (value = '') => {
    const text = String(value || '').trim();
    const parts = text.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2) {
        return escapeHtml(text);
    }

    const russian = parts[0].replace(/^\(|\)$/g, '');
    const english = parts.slice(1).join(' / ');

    return `
        <span class="skill-name">
            ${russian ? `<span class="skill-name__ru">${escapeHtml(russian)}</span>` : ''}
            <strong class="skill-name__en">${escapeHtml(english)}</strong>
        </span>
    `;
};

const formatSkillStats = (value = '') => {
    const cleaned = String(value || '')
        .replace(/Применение навыка.*$/i, '')
        .replace(/Перезарядка навыка.*$/i, '')
        .replace(/Дистанция.*$/i, '')
        .trim();
    const parts = cleaned.split('/').map((part) => part.trim()).filter(Boolean);
    const labels = ['cast', 'reuse', 'range'];

    return `
        <div class="skill-stats">
            ${parts
                .map(
                    (part, index) => `
                        <span class="skill-stats__line">
                            <span class="skill-stats__icon skill-stats__icon--${labels[index] || 'misc'}" aria-hidden="true"></span>
                            <span>${escapeHtml(part)}</span>
                        </span>
                    `
                )
                .join('')}
        </div>
    `;
};

const enhanceSkillTables = (db) => {
    for (const article of Object.values(db.articles || {})) {
        if (article.section !== 'skills') {
            continue;
        }

        for (const block of article.blocks || []) {
            if (!isSkillTable(block)) {
                continue;
            }

            if (block.rows.length && isSkillHeaderRow(block.rows[0])) {
                const headerCells = block.rows[0].cells;
                block.columns = headerCells.map((cell, index) => ({
                    key: `column-${index + 1}`,
                    label: String(cell.value || '').trim() || '',
                    align: '',
                    width: '',
                }));
                block.rows = block.rows.slice(1);
            }

            block.columns = [
                { key: 'icon', label: '', align: 'center', width: '56px' },
                { key: 'name', label: 'Название', align: '', width: '22%' },
                { key: 'description', label: 'Описание', align: '', width: '' },
                { key: 'type', label: 'Тип', align: '', width: '10%' },
                { key: 'stats', label: 'Статистика', align: '', width: '12%' },
                { key: 'mp', label: 'MP', align: 'center', width: '5%' },
                { key: 'hp', label: 'HP', align: 'center', width: '5%' },
                { key: 'sp', label: 'SP', align: 'center', width: '7%' },
            ];

            block.rows.forEach((row) => {
                const skillKey = String(row.cells?.[0]?.value || '').trim();
                const iconSrc = findSkillIcon(skillKey);
                row.href = '';

                if (row.cells[0]) {
                    row.cells[0].href = '';
                    row.cells[0].html = `<img class="wiki-skill-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(skillKey || 'Skill')}" loading="lazy" />`;
                }

                if (row.cells[1]) {
                    row.cells[1].href = '';
                    row.cells[1].html = formatSkillNameCell(row.cells[1].value);
                }

                if (row.cells[2]) {
                    row.cells[2].href = '';
                }

                if (row.cells[3]) {
                    row.cells[3].href = '';
                }

                if (row.cells[4]) {
                    row.cells[4].href = '';
                    row.cells[4].html = formatSkillStats(row.cells[4].value);
                }

                for (let index = 5; index < row.cells.length; index += 1) {
                    row.cells[index].href = '';
                }
            });
        }
    }
};

const main = () => {
    const db = readDatabase();
    enhanceSkillTables(db);
    writeDatabase(db);
    console.log('Skill tables enhanced with icons and local formatting.');
};

main();
