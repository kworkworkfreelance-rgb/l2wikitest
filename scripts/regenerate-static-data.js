const fs = require('fs');
const path = require('path');

// Read content.js to extract articles
const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content.js');
let content = fs.readFileSync(contentPath, 'utf8');

// Extract the articles object by evaluating the script
const vm = require('vm');

// Create a minimal window object
const mockWindow = {
    L2WIKI_CONTENT: {
        articles: {},
        sections: {},
        knowledge: {}
    }
};

// Mock required functions
const mockContent = `
window = ${JSON.stringify(mockWindow)};

const createMeta = (items) => items.map(([label, value]) => ({ label, value }));

const createArticle = ({ id, section, group, title, summary, eyebrow, meta = [], intro = [], checklist = [], steps = [], rewards = [], tips = [], related = [], heroImage = null }) => ({
    id, section, group, title, summary, eyebrow, meta, intro, checklist, steps, rewards, tips, related, heroImage
});

const createProfessionArticle = ({ id, title, level, focus, reward, intro, steps, tips, related, heroImage }) => ({
    id, section: 'quests', group: 'profession', title, heroImage,
    summary: 'Профессия', eyebrow: 'Квесты',
    meta: createMeta([['Уровень', level], ['Фокус', focus], ['Награда', reward]]),
    intro, steps, tips, related
});

const createPetArticle = ({ id, title, item, zone, focus, intro, steps, tips, related, heroImage }) => ({
    id, section: 'quests', group: 'pets', title, heroImage,
    summary: 'Питомец', eyebrow: 'Питомцы',
    meta: createMeta([['Предмет', item], ['Зона', zone], ['Фокус', focus]]),
    intro, steps, tips, related
});

const createInstanceArticle = ({ id, title, type, entry, reward, intro, steps, tips, related, heroImage }) => ({
    id, section: 'quests', group: 'epic', title, heroImage,
    summary: 'Инстанс', eyebrow: type,
    meta: createMeta([['Вход', entry], ['Формат', type], ['Награда', reward]]),
    intro, steps, tips, related
});

const createEpicAccessGuide = ({ id, title, type, entry, reward, heroImage, intro, related }) => ({
    id, section: 'quests', group: 'epic', title, heroImage,
    summary: 'Эпик-доступ', eyebrow: type,
    meta: createMeta([['Вход', entry], ['Формат', type], ['Награда', reward]]),
    intro, related: related || []
});

const createUtilityQuestArticle = ({ id, title, group, summary, meta, intro, checklist, steps, rewards, tips, related, heroImage }) => ({
    id, section: 'quests', group, title, heroImage, summary, meta, intro, checklist, steps, rewards, tips, related
});

const createKnowledgeArticle = ({ id, section, group, title, summary, eyebrow, meta, intro, checklist, steps, rewards, tips, related, heroImage }) => ({
    id, section, group, title, summary, eyebrow, meta, intro, checklist, steps, rewards, tips, related, heroImage
});

const articles = {};
window.L2WIKI_CONTENT.articles = articles;
`;

// Execute content.js
try {
    vm.createContext(mockWindow);
    vm.runInContext(mockContent + '\n' + content, mockWindow);
} catch (e) {
    console.error('Error executing content:', e.message);
    process.exit(1);
}

// Generate static-data.js
const staticDataPath = path.join(__dirname, '..', 'assets', 'js', 'static-data.js');
const staticData = `window.L2WIKI_SEED_DATA=${JSON.stringify(mockWindow.L2WIKI_CONTENT)};
window.L2WIKI_SEED_SOURCE={"source":"regenerated","generatedAt":"${new Date().toISOString()}","articles":${Object.keys(mockWindow.L2WIKI_CONTENT.articles).length},"sections":${Object.keys(mockWindow.L2WIKI_CONTENT.sections || {}).length}};`;

fs.writeFileSync(staticDataPath, staticData, 'utf8');

console.log('✅ static-data.js regenerated!');
console.log(`Articles: ${Object.keys(mockWindow.L2WIKI_CONTENT.articles).length}`);
console.log(`File: ${staticDataPath}`);

// Verify Pailaka articles
const pailaka1 = mockWindow.L2WIKI_CONTENT.articles['pailaka-song-fire'];
const pailaka2 = mockWindow.L2WIKI_CONTENT.articles['pailaka-devils-legacy'];
const pailaka3 = mockWindow.L2WIKI_CONTENT.articles['pailaka-injured-dragon'];

if (pailaka1) {
    console.log('\n✅ Pailaka 1:');
    console.log('  - heroImage:', pailaka1.heroImage);
    console.log('  - intro lines:', pailaka1.intro.length);
    console.log('  - has steps:', !!pailaka1.steps);
}

if (pailaka2) {
    console.log('\n✅ Pailaka 2:');
    console.log('  - heroImage:', pailaka2.heroImage);
    console.log('  - intro lines:', pailaka2.intro.length);
    console.log('  - has steps:', !!pailaka2.steps);
}

if (pailaka3) {
    console.log('\n✅ Pailaka 3:');
    console.log('  - heroImage:', pailaka3.heroImage);
    console.log('  - intro lines:', pailaka3.intro.length);
    console.log('  - has steps:', !!pailaka3.steps);
}
