#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const canonicalPath = path.join(__dirname, '..', 'data', 'canonical', 'l2wiki-canonical.json');
const metaPath = path.join(__dirname, '..', 'data', 'canonical', 'l2wiki-meta.json');

const database = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

const weaponHubIds = [
    'weapons-swords',
    'weapons-daggers',
    'weapons-bows',
    'weapons-two-handed',
    'weapons-blunt',
    'weapons-duals',
    'weapons-two-handed-blunt',
    'weapons-fists',
    'weapons-pole',
    'weapons-rapier',
    'weapons-magic-books',
];

weaponHubIds.forEach((articleId) => {
    const article = database.articles[articleId];

    if (!article || !Array.isArray(article.meta)) {
        return;
    }

    if (article.meta[0]) {
        article.meta[0].label = 'Грейды';
    }

    if (article.meta[1]) {
        article.meta[1].label = 'Предметов';
    }
});

const part1Id = 'archive-quests-item-3257-possessor-of-a-precious-soul-1';
const part2Id = 'archive-quests-item-3258-possessor-of-a-precious-soul-2';
const part3Id = 'archive-quests-item-3259-possessor-of-a-precious-soul-3';
const part4Id = 'archive-quests-item-3260-possessor-of-a-precious-soul-4';
const soulTestingId = 'archive-quests-item-3261-noblesse-soul-testing';

const noblesseArticle = database.articles['noblesse-quest'];

if (!noblesseArticle) {
    throw new Error('Missing article: noblesse-quest');
}

noblesseArticle.summary =
    'Маршрут Noblesse по структуре l2int: четыре части Possessor of a Precious Soul, ключевые NPC и быстрый переход к каждой части.';
noblesseArticle.meta = [
    { label: 'Формат', value: '4 части + сводный маршрут' },
    { label: 'Требование', value: 'Саб-класс и цепочка Caradine' },
    { label: 'Финал', value: 'Статус Noblesse' },
];
noblesseArticle.intro = [
    'Noblesse здесь собран не одной длинной стеной, а в той логике, в которой его обычно ищут игроки: подготовка, четыре части Possessor of a Precious Soul и быстрый переход к каждой из них.',
    'Сама длинная цепочка остаётся доступной в сводном виде ниже, но каждая часть теперь вынесена в отдельную страницу, как на l2int: так проще не теряться в маршруте и возвращаться ровно к нужному этапу.',
];
noblesseArticle.related = ['subclass-quest', part1Id, part2Id, part3Id, part4Id, soulTestingId];
noblesseArticle.blocks = [
    {
        id: 'noblesse-quest-overview',
        type: 'prose',
        title: 'Как устроен маршрут',
        paragraphs: [
            'Основное условие остаётся тем же: персонаж должен быть готов к пути после открытия саб-класса. С практической стороны Noblesse почти всегда выгодно идти сразу после subclass, пока маршрут по Aden, Rune, Goddard и Ivory Tower ещё не выпал из общего прогресса.',
            'Внутри сводного маршрута ниже мы оставили короткую дорожную карту, а сами части разложили по отдельным материалам. Это заметно удобнее и для обычного прохождения, и для правок через админ-панель.',
        ],
    },
    {
        id: 'noblesse-quest-parts',
        type: 'table',
        title: 'Четыре части цепочки',
        columns: [
            { key: 'part', label: 'Часть', width: '18%' },
            { key: 'focus', label: 'Что внутри' },
            { key: 'link', label: 'Страница', width: '26%' },
        ],
        rows: [
            {
                id: 'noblesse-part-1',
                cells: [
                    { value: 'Part 1' },
                    { value: 'Talien, Gabrielle, Gilmore, Beehive и первый длинный боевой этап.' },
                    { value: 'Открыть часть 1', href: `/pages/article.html?article=${part1Id}` },
                ],
            },
            {
                id: 'noblesse-part-2',
                cells: [
                    { value: 'Part 2' },
                    { value: 'Virgil, Rahorakti, Swamp of Screams и Crimson Moss для лечения девушки.' },
                    { value: 'Открыть часть 2', href: `/pages/article.html?article=${part2Id}` },
                ],
            },
            {
                id: 'noblesse-part-3',
                cells: [
                    { value: 'Part 3' },
                    { value: 'Caradine, Noel, Hellfire Oil, Lunaragent и ремесленная подготовка к финалу.' },
                    { value: 'Открыть часть 3', href: `/pages/article.html?article=${part3Id}` },
                ],
            },
            {
                id: 'noblesse-part-4',
                cells: [
                    { value: 'Part 4' },
                    { value: 'Ossian, финальный ритуал, Lady of the Lake и получение статуса Noblesse.' },
                    { value: 'Открыть часть 4', href: `/pages/article.html?article=${part4Id}` },
                ],
            },
        ],
        compact: true,
        pageSize: 10,
    },
    {
        id: 'noblesse-quest-prep-callout',
        type: 'callout',
        tone: 'info',
        title: 'Перед стартом',
        items: [
            'Держите под рукой маршрут после саб-класса: Noblesse почти всегда идёт сразу следом.',
            'Не распыляйте прогресс по частям: удобнее закрывать каждую отдельным заходом.',
            'Если сервер живёт по High Five / Interlude-логике, сверяйте названия NPC и предметов именно по части, а не по общему гайду.',
        ],
    },
    {
        id: 'quest-guide',
        type: 'questGuide',
        heroMedia: [
            {
                src: '/assets/img/icons/Квесты на дворянина (Noblesse).jpg',
                alt: 'Квесты на дворянина (Noblesse)',
                caption: 'Сводный маршрут Noblesse и быстрый переход по четырём частям.',
            },
        ],
        overviewParagraphs: [
            'Ниже оставлен короткий общий маршрут для ориентира. Если вы уже знаете, на каком этапе остановились, лучше сразу открывать нужную часть из таблицы выше.',
            'Такой формат разгружает страницу и избавляет от длинного бесконечного полотна: общий обзор остаётся, а детали каждой части живут на своей странице.',
        ],
        prepItems: [
            { text: 'Закройте prerequisite на саб-класс и держите под рукой связанный маршрут Fate’s Whisper / subclass.' },
            { text: 'Подготовьте телепорты в Aden, Giran, Heine, Rune, Goddard и Ivory Tower.' },
            { text: 'Если идёте с пати, договоритесь заранее о боевых этапах в Dragon Valley и Swamp of Screams.' },
            { text: 'Для ремесленной части проверьте заранее Hellfire Oil, Lunaragent и другие реагенты вашей хроники.' },
        ],
        steps: [
            {
                text: 'Part 1 стартует у Talien в Aden и проводит через Gabrielle, Gilmore и Beehive. Это первая длинная часть, где вы собираете основной квестовый фундамент и входите в маршрут Noblesse.',
                location: 'Aden / Giran / Beehive',
                npc: 'Talien',
            },
            {
                text: 'Part 2 смещает маршрут в сторону Virgil и Rahorakti. Ключевой боевой этап здесь связан со Swamp of Screams и добычей Crimson Moss.',
                location: 'Rune / Swamp of Screams',
                npc: 'Virgil / Rahorakti',
            },
            {
                text: 'Part 3 переходит к линии Caradine и Noel. Здесь обычно сильнее всего чувствуется подготовка по ресурсам и крафтовым реагентам, так что не затягивайте с проверкой материалов.',
                location: 'Goddard / Ivory Tower',
                npc: 'Caradine / Noel',
            },
            {
                text: 'Part 4 закрывает цепочку через Ossian и финальный ритуал у Lady of the Lake. После завершения диалога персонаж получает сам статус Noblesse.',
                location: 'Goddard / Lady of the Lake',
                npc: 'Ossian',
            },
            {
                text: 'Если вам нужен дополнительный контроль по финальному прогрессу, используйте соседний материал Soul Testing: он помогает сверить, всё ли в хронике закрывается именно тем способом, который нужен вашему серверу.',
                rewardPreview: 'Soul Testing',
            },
        ],
        rewards: [
            { text: 'Статус Noblesse' },
            { text: 'Доступ к связанному позднему контенту и ряду хроникальных механик' },
            { text: 'Чёткая разбивка маршрута по четырём отдельным страницам без бесконечной прокрутки' },
        ],
        relatedQuestIds: ['subclass-quest', part1Id, part2Id, part3Id, part4Id, soulTestingId],
    },
];

database.updatedAt = new Date().toISOString();

fs.writeFileSync(canonicalPath, JSON.stringify(database), 'utf8');
fs.writeFileSync(
    metaPath,
    JSON.stringify({
        version: Number(database.version) || 2,
        updatedAt: database.updatedAt,
        site: {
            name: database.site?.name || '',
            subtitle: database.site?.subtitle || '',
        },
        counts: {
            sections: Object.keys(database.sections || {}).length,
            articles: Object.keys(database.articles || {}).length,
        },
    }),
    'utf8'
);

console.log('Updated Noblesse article and repaired weapon hub labels.');
