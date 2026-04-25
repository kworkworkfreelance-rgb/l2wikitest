const { publishCanonical, readCanonical } = require('../lib/canonical-store');

const clone = (value) => JSON.parse(JSON.stringify(value));

const createMediaBlock = ({ id, title, src, alt, caption }) => ({
    id,
    type: 'media',
    title,
    items: [
        {
            src,
            alt,
            caption,
        },
    ],
});

const replaceQuestArticleFromArchive = (database, targetId, sourceId, overrides = {}) => {
    const target = database.articles[targetId];
    const source = database.articles[sourceId];

    if (!target) {
        throw new Error(`Target article "${targetId}" is missing.`);
    }

    if (!source) {
        throw new Error(`Source article "${sourceId}" is missing.`);
    }

    const merged = {
        ...target,
        title: overrides.title || source.title,
        summary: overrides.summary || source.summary,
        eyebrow: overrides.eyebrow || target.eyebrow || source.eyebrow || '',
        sidebarFacts: clone(source.sidebarFacts || []),
        intro: [],
        checklist: [],
        steps: [],
        rewards: [],
        tips: [],
        meta: [],
        source: clone(source.source || target.source || {}),
        blocks: clone(source.blocks || []),
    };

    if (Array.isArray(overrides.blocks)) {
        merged.blocks = clone(overrides.blocks);
    }

    if (Array.isArray(overrides.sidebarFacts)) {
        merged.sidebarFacts = clone(overrides.sidebarFacts);
    }

    if (Object.prototype.hasOwnProperty.call(overrides, 'heroImage')) {
        merged.heroImage = overrides.heroImage;
    }

    if (Object.prototype.hasOwnProperty.call(overrides, 'related')) {
        merged.related = clone(overrides.related || []);
    }

    database.articles[targetId] = merged;
};

const createBaiumArticle = (existingArticle) => ({
    ...existingArticle,
    title: 'An Arrogant Search (Самонадеянный поиск)',
    summary: 'Прохождение квеста An Arrogant Search (Самонадеянный поиск) и получение Blooded Fabric для прохода к Baium.',
    eyebrow: existingArticle.eyebrow || 'Эпик-доступ',
    meta: [],
    intro: [],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    heroImage: null,
    sidebarFacts: [
        { label: 'Уровень', value: '60 - 75' },
        { label: 'Тип', value: 'Повторяемый квест Выполняется в одного' },
        { label: 'Требования', value: 'Нет требований' },
        { label: 'Стартовый NPC', value: 'Magister Hanellin / (Магистр Ханелин)' },
        { label: 'Стартовая локация', value: 'Aden Territory / (Земли Адена)' },
        { label: 'Добавлен в', value: 'Chronicle 2' },
        { label: 'Удален в', value: '-' },
    ],
    blocks: [
        {
            id: 'quest-guide',
            type: 'questGuide',
            overviewParagraphs: [
                'Для этого квеста нужна цепочка Hanellin и предмет Blooded Fabric, без которого нельзя пройти к Baium через Angelic Vortex.',
            ],
            prepItems: [
                { text: 'Проверьте рекомендуемый уровень персонажа перед стартом: 60 - 75.' },
                { text: 'Начните маршрут у NPC Magister Hanellin / (Магистр Ханелин) и не пропускайте стартовый диалог.' },
                { text: 'Для финального этапа подготовьте 5 Lesser Healing Potion и 5 Antidote.' },
            ],
            steps: [
                {
                    text: 'Поговорите с Hanellin (Ханелин) в гильдии Темных Эльфов в Town of Aden (Город Аден).',
                    html: 'Поговорите с <strong>Hanellin</strong> <span class="quest-muted">(Ханелин)</span> в гильдии Темных Эльфов в <strong>Town of Aden</strong> <span class="quest-muted">(Город Аден)</span>.',
                    npc: 'Hanellin',
                },
                {
                    text: 'Отправляйтесь в The Giant’s Cave и добудьте Titan’s Powerstone. После Gracia Epilogue можно добыть Shell of Monsters у Viturz в Giant’s Cave / Paliote в Forsaken Plains.',
                    html: 'Отправляйтесь в <strong>The Giant&rsquo;s Cave</strong> <span class="quest-muted">(Пещера Гигантов)</span> и убивайте <strong>Lesser Giant Mage</strong> <span class="quest-muted">[64 lvl]</span> и <strong>Lesser Giant Elder</strong> <span class="quest-muted">[65 lvl]</span>, пока не получите <strong>Titan&rsquo;s Powerstone</strong>. <span class="quest-muted">С обновления Gracia Epilogue вместо этого можно убивать</span> <strong>Viturz</strong> <span class="quest-muted">(Око Хаоса) [56 lvl]</span> в <strong>Paliote</strong> <span class="quest-muted">(Палиот)</span> и в <strong>Forsaken Plains</strong> <span class="quest-muted">(Забытые Равнины)</span>, пока не получите <strong>Shell of Monsters</strong> <span class="quest-muted">(Панцирь Демона)</span>.',
                },
                {
                    text: 'Поговорите с Hanellin и получите три письма.',
                    html: 'Поговорите с <strong>Hanellin</strong>, получите <img src="/assets/img/archive/quest-letter-white-e85f17a555f0.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Hanellin&rsquo;s 1st Letter</strong>, <img src="/assets/img/archive/quest-letter-white-dd9d43176776.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Hanellin&rsquo;s 2nd Letter</strong> и <img src="/assets/img/archive/quest-letter-white-ce06f3a6780d.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Hanellin&rsquo;s 3rd Letter</strong>.',
                },
                {
                    text: 'Поговорите с Claudia Athebalt у северного выхода из Aden.',
                    html: 'Поговорите с <strong>Claudia Athebalt</strong> <span class="quest-muted">(Клаудия Атебальт)</span>, она стоит снаружи северного выхода из города.',
                },
                {
                    text: 'Отправляйтесь в Cemetery, возьмите Holy Ark of Secrecy 2 и добудьте 2nd Key of Ark.',
                    html: 'Отправляйтесь в <strong>The Cemetery</strong> <span class="quest-muted">(Кладбище)</span>, к северо-востоку, недалеко от Гробницы Кабрио, будет сундук <strong>Holy Ark of Secrecy 2</strong> <span class="quest-muted">(II Священный Ковчег)</span>, поговорите с ним. Появится <strong>Ark Guardian Elberoth</strong> <span class="quest-muted">(Страж Эльберот) [60 lvl]</span>, убейте его и получите <img src="/assets/img/archive/quest-key-eb41f81f5a84.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>2nd Key of Ark</strong> <span class="quest-muted">(Ключ от Ковчега)</span>.',
                },
                {
                    text: 'Поговорите с Martien в Town of Giran.',
                    html: 'Отправляйтесь в <strong>Town of Giran</strong> <span class="quest-muted">(Город Гиран)</span>, от телепорта бегите в сторону Гильдии Воинов, не доходя до моста за последним домиком справа стоит <strong>Martien</strong> <span class="quest-muted">(Мартиен)</span>, поговорите с ним.',
                },
                {
                    text: 'Отправляйтесь в Tanor Canyon и добудьте 3rd Key of Ark.',
                    html: 'Отправляйтесь из города пешком в <strong>Tanor Canyon</strong> <span class="quest-muted">(Каньон Танор)</span>, на высокой горе найдите <strong>Holy Ark of Secrecy 3</strong> <span class="quest-muted">(III Священный Ковчег)</span>, поговорите с ним. Появится <strong>Ark Guardian Shadowfang</strong> <span class="quest-muted">(Страж Клык Теней) [60 lvl]</span>, убейте его и получите <img src="/assets/img/archive/quest-key-eb41f81f5a84.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>3rd Key of Ark</strong> <span class="quest-muted">(Ключ от Ковчега)</span>.',
                },
                {
                    text: 'Поговорите с Magister Harne в Dark Elven Village и добудьте 1st Key of Ark.',
                    html: 'Отправляйтесь к <strong>Magister Harne</strong> <span class="quest-muted">(Харн)</span> в храме <strong>Dark Elven Village</strong> <span class="quest-muted">(Деревня Темных Эльфов)</span>. В горах к югу от деревни найдите труп ангела и поговорите с ним. Появится <strong>Angel Killer</strong> <span class="quest-muted">(убийца Ангелов) [60 lvl]</span>, убейте его и получите <img src="/assets/img/archive/quest-key-eb41f81f5a84.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>1st Key of Ark</strong> <span class="quest-muted">(Ключ от Ковчега)</span>.',
                },
                {
                    text: 'Вернитесь к Hanellin и принесите 5 Lesser Healing Potion и 5 Antidote.',
                    html: 'Поговорите с <strong>Hanellin</strong> в гильдии Темных Эльфов в <strong>Town of Aden</strong>. Купите в магазине <img src="/assets/img/archive/quest-lesser-potion-red-f6ff948c1431.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Lesser Healing Potion</strong> <span class="quest-muted">(Зелье Исцеления)</span> и <img src="/assets/img/archive/quest-potion-green-937597dc8cf8.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Antidote</strong> <span class="quest-muted">(Противоядие)</span> по 5 шт. и отдайте их Hanellin.',
                },
                {
                    text: 'Hanellin задаст пару вопросов, после чего вы получите White Fabric.',
                    html: 'Hanellin задаст вам пару вопросов. После ответов получите <img src="/assets/img/archive/quest-piece-of-cloth-white-813cb284a1f5.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>White Fabric</strong> <span class="quest-muted">(Белая Ткань)</span>.',
                },
                {
                    text: 'После окраски ткани получите Blooded Fabric на Tower of Insolence 7F.',
                    html: 'Отправляйтесь в <strong>Tower of Insolence</strong> <span class="quest-muted">(Башня Дерзости)</span> на 7 этаж, желательно в пати с некром и бафом на скорость атаки. Вытяните <strong>Platinum Tribe Shaman</strong> <span class="quest-muted">(Шаман Платинового Клана)</span> или <strong>Platinum Tribe Overlord</strong> <span class="quest-muted">(Владыка Платинового Клана)</span> в безопасное место, повесьте на него паралич и бейте кулаками до тех пор пока не получите <img src="/assets/img/archive/quest-piece-of-cloth-red-c716fe416f8f.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Blooded Fabric</strong> <span class="quest-muted">(Окровавленная Ткань)</span>. <span class="quest-muted">Если делали вариант "Meet with Emperor", не говорите больше с Hanellin после получения Blooded Fabric, иначе она заберет ткань и квест придется начинать заново.</span>',
                },
            ],
            rewards: [
                {
                    text: 'Blooded Fabric (Окровавленная Ткань) необходима для прохода к Baium на 14 этаж Tower of Insolence через Angelic Vortex.',
                    html: '<img src="/assets/img/archive/quest-piece-of-cloth-red-c716fe416f8f.jpg" alt="" loading="lazy" class="quest-inline-icon"><strong>Blooded Fabric</strong> <span class="quest-muted">(Окровавленная Ткань)</span> необходима для прохода к <strong>Baium</strong> на 14 этаж <strong>Tower of Insolence</strong> <span class="quest-muted">(Башня Дерзости)</span> через <strong>Angelic Vortex</strong>.',
                    iconSrc: '/assets/img/archive/quest-piece-of-cloth-red-c716fe416f8f.jpg',
                    iconAlt: 'Blooded Fabric',
                },
            ],
            notes: [],
        },
    ],
});

const addPailakaMaps = (database) => {
    const song = database.articles['pailaka-song-fire'];
    if (song) {
        song.blocks = (song.blocks || []).filter((block) => block.id !== 'pailaka-song-fire-map');
        song.blocks.push(
            createMediaBlock({
                id: 'pailaka-song-fire-map',
                title: 'Карта пайлаки',
                src: '/assets/img/maps/pailaka-song-of-ice-and-fire-map.gif',
                alt: 'Карта Пайлака - Песня льда и огня',
                caption: 'Схема красной и синей части инстанса с маршрутами, точками боссов и входом.',
            })
        );
    }

    const legacy = database.articles['pailaka-devils-legacy'];
    if (legacy) {
        legacy.blocks = (legacy.blocks || []).filter((block) => block.id !== 'pailaka-devils-legacy-map');
        legacy.blocks.push(
            createMediaBlock({
                id: 'pailaka-devils-legacy-map',
                title: 'Карта пайлаки',
                src: '/assets/img/maps/pailaka-devils-legacy-map.jpg',
                alt: 'Карта Пайлака - Наследие Дьявола',
                caption: 'Маршрут к Kams, Hikoro, Alkaso, Gerbera и Lematan. Звездой отмечен вход.',
            })
        );
    }
};

const main = async () => {
    const database = await readCanonical();

    replaceQuestArticleFromArchive(database, 'antharas-entry', 'archive-quests-item-3256-audience-with-the-land-dragon');
    replaceQuestArticleFromArchive(database, 'valakas-entry', 'archive-quests-item-3292-into-the-flame');
    replaceQuestArticleFromArchive(database, 'frintezza-entry', 'archive-quests-item-3349-last-imperial-prince');
    replaceQuestArticleFromArchive(database, 'freya-entry', 'archive-quests-item-3265-the-other-side-of-truth');
    replaceQuestArticleFromArchive(database, 'pailaka-song-fire', 'archive-quests-item-3250-pailaka-song-of-ice-and-fire');
    replaceQuestArticleFromArchive(database, 'pailaka-devils-legacy', 'archive-quests-item-3297-pailaka-devil-s-legacy');
    replaceQuestArticleFromArchive(database, 'pailaka-injured-dragon', 'archive-quests-item-3334-pailaka-injured-dragon');
    replaceQuestArticleFromArchive(database, 'quest-wolf-collar', 'archive-quests-item-2937-get-a-pet');
    replaceQuestArticleFromArchive(database, 'quest-baby-buffalo', 'archive-quests-item-3013-help-the-uncle');
    replaceQuestArticleFromArchive(database, 'quest-baby-kookabura', 'archive-quests-item-3008-help-the-son');
    replaceQuestArticleFromArchive(database, 'quest-baby-cougar', 'archive-quests-item-3015-help-the-sister');
    replaceQuestArticleFromArchive(database, 'quest-dragonflute', 'archive-quests-item-3035-little-wing');
    replaceQuestArticleFromArchive(database, 'quest-dragon-bugle', 'archive-quests-item-3129-little-wing-s-big-adventure');
    replaceQuestArticleFromArchive(database, 'wash-pk', 'archive-quests-item-2829-repent-your-sins');

    database.articles['baium-entry'] = createBaiumArticle(database.articles['baium-entry']);

    addPailakaMaps(database);

    await publishCanonical(null, database, 'refresh-main-quest-pages');
    console.log('main quest pages refreshed from archive sources');
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
