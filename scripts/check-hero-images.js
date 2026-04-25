const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content.js');
const content = fs.readFileSync(contentPath, 'utf8');

// Check which articles have heroImage
const articles = [
    'freya-entry',
    'antharas-entry', 
    'valakas-entry',
    'baium-entry',
    'frintezza-entry',
    'pailaka-song-fire',
    'pailaka-devils-legacy',
    'pailaka-injured-dragon',
    'quest-wolf-collar',
    'quest-baby-buffalo',
    'quest-baby-kookabura',
    'quest-baby-cougar',
    'quest-dragonflute',
    'quest-dragon-bugle'
];

console.log('Checking heroImage in articles:\n');

articles.forEach(articleId => {
    const pattern = new RegExp(`'${articleId}':\\s*\\w+\\(\\{[\\s\\S]*?heroImage:\\s*'([^']+)'`, 'm');
    const match = content.match(pattern);
    
    if (match) {
        console.log(`✅ ${articleId}: ${match[1]}`);
    } else {
        console.log(`❌ ${articleId}: NO heroImage`);
    }
});
