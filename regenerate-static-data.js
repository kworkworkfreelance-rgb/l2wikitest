#!/usr/bin/env node
// Regenerate static-data using canonical-store (supports split parts)

const { readCanonical, writeStaticData } = require('./lib/canonical-store');

console.log('[static-data] Regenerating static-data from canonical (supports split parts)...');
const canonical = readCanonical();
const outPath = writeStaticData(canonical, 'regenerate-static-data');
console.log(`[static-data] Wrote static-data to: ${outPath}`);
console.log('[static-data] Done!');
