const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content.js');
let content = fs.readFileSync(contentPath, 'utf8');

// Fix double commas
content = content.replace(/,\s*,/g, ',');

// Add heroImage to pet articles if not present
const pets = [
    { id: 'quest-wolf-collar', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-wolf-collar.png' },
    { id: 'quest-baby-buffalo', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-baby-buffalo.png' },
    { id: 'quest-baby-kookabura', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-baby-kookabura.png' },
    { id: 'quest-baby-cougar', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-baby-cougar.png' },
    { id: 'quest-dragonflute', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-dragonflute.png' },
    { id: 'quest-dragon-bugle', hero: '/assets/img/quest-heroes/quest-guide-hero-quest-dragon-bugle.png' }
];

pets.forEach(pet => {
    const pattern = new RegExp(`('${pet.id}':\\s*createPetArticle\\(\\{[\\s\\S]*?focus:\\s*'[^']+',)`);
    const match = content.match(pattern);
    
    if (match && !match[0].includes('heroImage')) {
        content = content.replace(
            pattern,
            `$1\n        heroImage: '${pet.hero}',`
        );
        console.log(`✓ Added heroImage to ${pet.id}`);
    }
});

fs.writeFileSync(contentPath, content, 'utf8');
console.log('\n✅ Fixed syntax errors and added hero images!');
