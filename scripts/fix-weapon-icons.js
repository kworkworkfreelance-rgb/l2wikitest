const fs = require('fs');
const path = require('path');

const wikiPath = path.join(__dirname, '..', 'assets', 'js', 'wiki.js');
let content = fs.readFileSync(wikiPath, 'utf8');

// Replace broken CDN URLs with inline SVG data URIs
const icons = {
    'Мечи': '#8B4513',
    'Двуручные мечи': '#6B3A2A',
    'Луки': '#556B2F',
    'Кинжалы': '#2F4F4F',
    'Дуалы': '#8B0000',
    'Дубинки': '#A0522D',
    'Двуручные дубинки': '#654321',
    'Кастеты': '#CD853F',
    'Алебарды': '#2E8B57',
    'Рапиры': '#4682B4',
    'Арбалеты': '#B22222',
    'Магические книги': '#4B0082',
};

for (const [name, color] of Object.entries(icons)) {
    const oldUrl = `weapon_${name.toLowerCase().replace(/\s+/g, '_')}_i00.png`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='4' fill='${encodeURIComponent(color)}'/><text x='16' y='22' text-anchor='middle' font-size='18' fill='white'>⚔</text></svg>`;
    const dataUri = `data:image/svg+xml;charset=UTF-8,${svg}`;
    
    // Find and replace the URL for this weapon type
    const urlPattern = new RegExp(`weapon_\\w+_i00\\.png`, 'g');
    // We'll replace by finding the line with the weapon name and updating the URL
    const linePattern = new RegExp(`('${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*)'[^']+'`, 'g');
    content = content.replace(linePattern, `$1'${dataUri}'`);
}

fs.writeFileSync(wikiPath, content, 'utf8');
console.log('✅ Weapon icons updated with inline SVG!');
