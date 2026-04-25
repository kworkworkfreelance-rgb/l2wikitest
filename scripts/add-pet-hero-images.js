const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content.js');
let content = fs.readFileSync(contentPath, 'utf8');

// Функция для добавления heroImage к питомцам
function addHeroToPet(articleId, heroImagePath) {
    const articleStart = content.indexOf(`'${articleId}': create`);
    if (articleStart === -1) {
        console.log(`Article ${articleId} not found`);
        return false;
    }
    
    const articleBlockStart = content.substring(articleStart, articleStart + 2000);
    const heroImageMatch = articleBlockStart.match(/heroImage:/);
    
    if (heroImageMatch) {
        console.log(`Article ${articleId} already has heroImage`);
        return false;
    }
    
    // Add heroImage after meta
    content = content.replace(
        new RegExp(`('${articleId}': createPetArticle\\(\\{[\\s\\S]*?meta: createMeta\\(\\[[\\s\\S]*?\\]\\),)`),
        `$1\n        heroImage: '${heroImagePath}',`
    );
    
    console.log(`✓ Added heroImage to ${articleId}`);
    return true;
}

// Add heroImage to pet quests (keep steps format for pets)
addHeroToPet('quest-wolf-collar', '/assets/img/quest-heroes/quest-guide-hero-quest-wolf-collar.png');
addHeroToPet('quest-baby-buffalo', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-buffalo.png');
addHeroToPet('quest-baby-kookabura', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-kookabura.png');
addHeroToPet('quest-baby-cougar', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-cougar.png');
addHeroToPet('quest-dragonflute', '/assets/img/quest-heroes/quest-guide-hero-quest-dragonflute.png');
addHeroToPet('quest-dragon-bugle', '/assets/img/quest-heroes/quest-guide-hero-quest-dragon-bugle.png');

// Write back
fs.writeFileSync(contentPath, content, 'utf8');
console.log('\n✅ Pet articles updated with hero images!');
