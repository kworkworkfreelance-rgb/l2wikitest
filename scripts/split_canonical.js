#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_DIR = path.join(ROOT, 'data', 'canonical');
const INPUT = path.join(CANONICAL_DIR, 'l2wiki-canonical.json');
const OUT1 = path.join(CANONICAL_DIR, 'l2wiki-canonical-1.json');
const OUT2 = path.join(CANONICAL_DIR, 'l2wiki-canonical-2.json');

function exitWith(err) {
    console.error(err);
    process.exit(1);
}

if (!fs.existsSync(INPUT)) {
    exitWith(`Input file not found: ${INPUT}`);
}

console.log('Reading', INPUT);
let raw;
try {
    raw = fs.readFileSync(INPUT, 'utf8');
} catch (err) {
    exitWith(err);
}

let data;
try {
    data = JSON.parse(raw);
} catch (err) {
    exitWith('Failed to parse JSON: ' + err.message);
}

function writePart(pathname, obj) {
    fs.writeFileSync(pathname, JSON.stringify(obj, null, 2), 'utf8');
    const stats = fs.statSync(pathname);
    console.log(`Wrote ${pathname} (${(stats.size / (1024*1024)).toFixed(2)} MB)`);
}

// If top-level is array, split array in half
if (Array.isArray(data)) {
    const mid = Math.ceil(data.length / 2);
    const a = data.slice(0, mid);
    const b = data.slice(mid);
    writePart(OUT1, a);
    writePart(OUT2, b);
    console.log('Split top-level array into two files.');
    process.exit(0);
}

if (data && typeof data === 'object') {
    // Find the heaviest top-level object (most keys), prefer splitting that
    const entries = Object.entries(data).map(([k, v]) => ({ key: k, size: v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : 0 }));
    entries.sort((a, b) => b.size - a.size);
    const heaviest = entries[0];

    if (heaviest && heaviest.size > 1) {
        const heavyKey = heaviest.key;
        const heavyObj = data[heavyKey] || {};
        const heavyKeys = Object.keys(heavyObj);
        const mid = Math.ceil(heavyKeys.length / 2);

        const part1 = { ...data, [heavyKey]: {} };
        const part2 = { ...data, [heavyKey]: {} };

        heavyKeys.forEach((k, idx) => {
            if (idx < mid) part1[heavyKey][k] = heavyObj[k];
            else part2[heavyKey][k] = heavyObj[k];
        });

        // Ensure other keys are copied by value (shallow copy is fine for metadata)
        for (const k of Object.keys(data)) {
            if (k === heavyKey) continue;
            part1[k] = data[k];
            part2[k] = data[k];
        }

        writePart(OUT1, part1);
        writePart(OUT2, part2);
        console.log(`Split heavy key '${heavyKey}' across two files.`);
        process.exit(0);
    }

    // Fallback: split top-level keys roughly in half
    const keys = Object.keys(data);
    const mid = Math.ceil(keys.length / 2);
    const part1 = {};
    const part2 = {};

    keys.forEach((k, idx) => {
        if (idx < mid) part1[k] = data[k];
        else part2[k] = data[k];
    });

    writePart(OUT1, part1);
    writePart(OUT2, part2);
    console.log('Split top-level object keys into two files (fallback).');
    process.exit(0);
}

exitWith('Unexpected data structure in canonical JSON');
