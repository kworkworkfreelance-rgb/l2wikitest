const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content.js');
let content = fs.readFileSync(contentPath, 'utf8');

// Helper function to convert article from steps/tips format to continuous text format
function convertArticle(articleId, heroImagePath) {
    // Find the article block
    const articleStart = content.indexOf(`'${articleId}': create`);
    if (articleStart === -1) {
        console.log(`Article ${articleId} not found`);
        return false;
    }
    
    // Find the end of this article (next article or closing brace)
    const nextArticleStart = content.indexOf("}),\n    '", articleStart + articleId.length + 20);
    if (nextArticleStart === -1) {
        console.log(`Could not find end of article ${articleId}`);
        return false;
    }
    
    const articleEnd = content.indexOf("}),", nextArticleStart) + 4;
    const articleBlock = content.substring(articleStart, articleEnd);
    
    // Extract intro, steps, and tips
    const introMatch = articleBlock.match(/intro:\s*\[([\s\S]*?)\],/);
    const stepsMatch = articleBlock.match(/steps:\s*\[([\s\S]*?)\],/);
    const tipsMatch = articleBlock.match(/tips:\s*\[([\s\S]*?)\],/);
    
    if (!introMatch || !stepsMatch) {
        console.log(`Could not parse article ${articleId}`);
        return false;
    }
    
    // Combine all text into intro
    let combinedIntro = introMatch[1];
    if (stepsMatch) {
        combinedIntro += ',\n            ' + stepsMatch[1];
    }
    if (tipsMatch) {
        combinedIntro += ',\n            ' + tipsMatch[1];
    }
    
    // Create new article block
    let newArticleBlock = articleBlock;
    
    // Replace createInstanceArticle/createPetArticle with createEpicAccessGuide/createPetArticle
    if (articleId.includes('entry')) {
        newArticleBlock = newArticleBlock.replace(/createInstanceArticle/, 'createEpicAccessGuide');
    }
    
    // Add heroImage after reward
    if (heroImagePath) {
        newArticleBlock = newArticleBlock.replace(
            /(reward:\s*['"][^'"]*['"])/,
            `$1,\n        heroImage: '${heroImagePath}'`
        );
    }
    
    // Remove steps and tips arrays
    newArticleBlock = newArticleBlock.replace(/,\s*steps:\s*\[[\s\S]*?\],/g, '');
    newArticleBlock = newArticleBlock.replace(/,\s*tips:\s*\[[\s\S]*?\],/g, '');
    
    // Update intro with combined text
    newArticleBlock = newArticleBlock.replace(
        /intro:\s*\[[\s\S]*?\],/,
        `intro: [${combinedIntro}],`
    );
    
    // Replace in content
    content = content.replace(articleBlock, newArticleBlock);
    console.log(`✓ Updated ${articleId}`);
    return true;
}

// Epic bosses
convertArticle('freya-entry', '/assets/img/quest-heroes/quest-guide-hero-freya-entry.png');
convertArticle('antharas-entry', '/assets/img/quest-heroes/quest-guide-hero-antharas-entry.png');
convertArticle('valakas-entry', '/assets/img/quest-heroes/quest-guide-hero-valakas-entry.png');
convertArticle('baium-entry', '/assets/img/quest-heroes/quest-guide-hero-baium-entry.png');
convertArticle('frintezza-entry', '/assets/img/quest-heroes/quest-guide-hero-frintezza-entry.png');

// Pailaka instances
convertArticle('pailaka-song-fire', '/assets/img/quest-heroes/quest-guide-hero-pailaka-song-fire.png');
convertArticle('pailaka-devils-legacy', '/assets/img/quest-heroes/quest-guide-hero-pailaka-devils-legacy.png');
convertArticle('pailaka-injured-dragon', '/assets/img/quest-heroes/quest-guide-hero-pailaka-injured-dragon.png');

// Pet quests
convertArticle('quest-wolf-collar', '/assets/img/quest-heroes/quest-guide-hero-quest-wolf-collar.png');
convertArticle('quest-baby-buffalo', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-buffalo.png');
convertArticle('quest-baby-kookabura', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-kookabura.png');
convertArticle('quest-baby-cougar', '/assets/img/quest-heroes/quest-guide-hero-quest-baby-cougar.png');
convertArticle('quest-dragonflute', '/assets/img/quest-heroes/quest-guide-hero-quest-dragonflute.png');
convertArticle('quest-dragon-bugle', '/assets/img/quest-heroes/quest-guide-hero-quest-dragon-bugle.png');

// Write back
fs.writeFileSync(contentPath, content, 'utf8');
console.log('\n✅ All articles updated!');
