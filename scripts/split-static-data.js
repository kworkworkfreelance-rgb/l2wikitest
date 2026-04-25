#!/usr/bin/env node
// scripts/split-static-data.js
// Read backup `assets/js/static-data.orig.js`, extract the JSON assignment,
// base64-encode it, split into chunks and write chunk files under
// `assets/js/static-data-chunk-*.js`. Then overwrite
// `assets/js/static-data.js` with a small synchronous loader that
// document.write()-injects the chunk scripts and reconstructs the JSON.

const fs = require('fs');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const src = path.join(cwd, 'assets', 'js', 'static-data.js');
const backup = path.join(cwd, 'assets', 'js', 'static-data.orig.js');
const outDir = path.join(cwd, 'assets', 'js');

const chunkSizeMB = parseInt(process.argv[2] || '6', 10);
if (isNaN(chunkSizeMB) || chunkSizeMB <= 0) {
  console.error('Usage: node scripts/split-static-data.js <chunkSizeMB>');
  process.exit(1);
}

if (!fs.existsSync(backup)) {
  console.error('Backup not found:', backup);
  console.error('Please create a backup copy of static-data.js first:');
  console.error("  cp assets/js/static-data.js assets/js/static-data.orig.js");
  process.exit(1);
}

console.log('Reading backup:', backup);
const text = fs.readFileSync(backup, 'utf8');

// Find assignment key
const keyCandidates = ['window.L2WIKI_SEED_DATA', 'window.L2WIKI_SEED'];
let keyFound = null;
let posKey = -1;
for (const k of keyCandidates) {
  posKey = text.indexOf(k);
  if (posKey !== -1) { keyFound = k; break; }
}
if (!keyFound) {
  console.error('Could not find L2WIKI seed assignment in backup file.');
  process.exit(1);
}

const eqIndex = text.indexOf('=', posKey);
if (eqIndex === -1) { console.error('Could not find "=" after assignment key'); process.exit(1); }
let startIndex = eqIndex + 1;

// Try to locate the next top-level marker (seed source) to know end of JSON
const endMarker = 'window.L2WIKI_SEED_SOURCE';
let endIndex = text.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  // fallback: use last semicolon
  endIndex = text.lastIndexOf(';');
  if (endIndex <= startIndex) endIndex = text.length;
}

let jsonText = text.slice(startIndex, endIndex).trim();
if (jsonText.startsWith(';')) jsonText = jsonText.slice(1).trim();
if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1);

console.log('Extracted JSON length:', Buffer.byteLength(jsonText, 'utf8'));

const b64 = Buffer.from(jsonText, 'utf8').toString('base64');
const chunkSize = chunkSizeMB * 1024 * 1024;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}

console.log('Base64 length:', b64.length, 'chunks:', chunks.length, 'chunkSizeMB:', chunkSizeMB);

// Remove old chunk files to avoid stale files
const files = fs.readdirSync(outDir);
for (const f of files) {
  if (f.indexOf('static-data-chunk-') === 0 && f.endsWith('.js')) {
    try { fs.unlinkSync(path.join(outDir, f)); } catch(e) {}
  }
}

const chunkFilenames = [];
for (let i = 0; i < chunks.length; i++) {
  const fname = 'static-data-chunk-' + (i + 1) + '.js';
  const full = path.join(outDir, fname);
  const content = 'window.__L2WIKI_CHUNKS = window.__L2WIKI_CHUNKS || [];' + '\n' +
                'window.__L2WIKI_CHUNKS.push("' + chunks[i] + '");' + '\n';
  fs.writeFileSync(full, content, 'utf8');
  chunkFilenames.push('/assets/js/' + fname);
  console.log('Wrote chunk', fname, 'size', Buffer.byteLength(content, 'utf8'));
}

// Build loader content (template literal makes quoting easier)
const loaderContent = `/* Generated loader — loads ${chunks.length} static-data chunks synchronously */
(function(){
  'use strict';
  if (window.L2WIKI_SEED_DATA) return;
  window.__L2WIKI_CHUNKS = window.__L2WIKI_CHUNKS || [];
  ${chunkFilenames.map(f => `document.write('<script src="${f}"></' + 'script>');`).join('\n  ')}

  function decodeB64ToUtf8(b64){
    try{
      var bin = atob(b64);
      if (typeof TextDecoder !== 'undefined'){
        var arr = new Uint8Array(bin.length);
        for (var i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(arr);
      }
      // fallback for older browsers
      return decodeURIComponent(Array.prototype.map.call(bin, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    }catch(e){ return null; }
  }

  var b64 = (window.__L2WIKI_CHUNKS || []).join('');
  var jsonStr = decodeB64ToUtf8(b64);
  if (jsonStr){
    try{ window.L2WIKI_SEED_DATA = JSON.parse(jsonStr); } catch(e){ console.error('[static-data loader] JSON parse error', e); }
  } else {
    var s = document.createElement('script'); s.src = '/assets/js/data-loader.js'; document.head.appendChild(s);
  }
  if (window.L2WIKI_SEED_DATA) window.dispatchEvent(new CustomEvent('l2wiki:data-loaded',{detail: window.L2WIKI_SEED_DATA}));
  try { delete window.__L2WIKI_CHUNKS; } catch(_) {}
})();`;

fs.writeFileSync(src, loaderContent, 'utf8');
console.log('Wrote loader to', src);
console.log('Done.');
