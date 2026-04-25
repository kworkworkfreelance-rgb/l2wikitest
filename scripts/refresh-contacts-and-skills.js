const { publishCanonical, readCanonical } = require('../lib/canonical-store');

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const skillNameCell = ({ ru, en, iconSrc = '' }) => {
    const content = `
        <span class="skill-name">
            ${
                iconSrc
                    ? `<img class="wiki-skill-icon" src="${iconSrc}" alt="${escapeHtml(en)}" loading="lazy" />`
                    : ''
            }
            ${ru ? `<span class="skill-name__ru">${escapeHtml(ru)}</span>` : ''}
            <strong class="skill-name__en">${escapeHtml(en)}</strong>
        </span>
    `;

    return {
        value: `${ru ? `${ru} / ` : ''}${en}`,
        html: content,
    };
};

const createContactsArticle = () => ({
    id: 'contacts',
    section: 'misc',
    group: 'contacts',
    title: 'Контакты',
    eyebrow: 'Контакты',
    summary: 'Свяжитесь с нами по вопросам контента, технических ошибок, сотрудничества и наполнения сайта.',
    order: 0,
    layout: 'contacts-page',
    aliases: ['contact', 'contacts-page', 'svyaz'],
    meta: [],
    intro: [],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    related: [],
    sidebarFacts: [],
    blocks: [
        {
            id: 'contacts-intro',
            type: 'prose',
            title: 'Связь с нами',
            paragraphs: [
                'Выберите удобный канал и напишите нам, если нужно исправить материал, добавить информацию или обсудить сотрудничество по сайту.',
                'Страница специально переведена на отдельный конструктор в админ-панели, чтобы текст и карточки контактов можно было менять без правки шаблонов.',
            ],
        },
        {
            id: 'contacts-table',
            type: 'table',
            title: 'Каналы связи',
            columns: [
                { key: 'direction', label: 'Направление' },
                { key: 'person', label: 'Контакт' },
                { key: 'channel', label: 'Канал связи' },
                { key: 'note', label: 'Комментарий' },
            ],
            rows: [
                {
                    id: 'contacts-support-email',
                    cells: [
                        { value: 'Поддержка' },
                        { value: 'Администратор сайта' },
                        { value: 'contact@lwiki.su', href: 'mailto:contact@lwiki.su' },
                        { value: 'Ошибки в статьях, баги на сайте, вопросы по наполнению' },
                    ],
                },
                {
                    id: 'contacts-telegram',
                    cells: [
                        { value: 'Telegram' },
                        { value: 'L2Wiki Support' },
                        { value: 'https://t.me/lwiki_support', href: 'https://t.me/lwiki_support' },
                        { value: 'Быстрая связь по текущим вопросам и согласованиям' },
                    ],
                },
                {
                    id: 'contacts-cooperation',
                    cells: [
                        { value: 'Сотрудничество' },
                        { value: 'Команда сайта' },
                        { value: 'contact@lwiki.su', href: 'mailto:contact@lwiki.su?subject=L2Wiki%20Cooperation' },
                        { value: 'Предложения по рекламе, партнерствам и наполнению разделов' },
                    ],
                },
            ],
            compact: false,
        },
    ],
});
const createClanSkillsArticle = () => ({
    id: 'clan-skills',
    section: 'skills',
    group: 'clan-skills',
    title: 'Клановые скиллы (Clan Skills)',
    summary: 'Требования к изучению Clan Skills, ключевые Interlude-навыки и нужные ресурсы: Clan Reputation, A-grade яйца, Destruction Tombstone и Cradle of Creation.',
    eyebrow: 'Поддерживающие умения',
    meta: [
        { label: 'Тип', value: 'Пассивные клановые умения' },
        { label: 'Где учить', value: 'Через систему клана и соответствующих NPC' },
        { label: 'Ресурсы', value: 'Clan Reputation, яйца A-grade, Destruction Tombstone, Cradle of Creation' },
    ],
    intro: [],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    order: 9999,
    source: {
        url: 'https://l2int.ru/skills/clan-skills',
        sourceType: 'reference',
    },
    blocks: [
        {
            id: 'clan-skills-media',
            type: 'media',
            title: 'Клановые навыки',
            items: [
                {
                    src: '/assets/img/archive/quest-clan-spirit-24de76d4cb28.png',
                    alt: 'Clan Skills',
                    caption: 'Раздел собран по структуре оригинальной страницы Clan Skills на l2int.ru, но адаптирован под локальный дизайн сайта.',
                },
            ],
        },
        {
            id: 'clan-skills-overview',
            type: 'prose',
            title: 'Как работают Clan Skills',
            paragraphs: [
                'Клановые скиллы — это пассивные умения, которые действуют на членов клана в зависимости от их ранга. Чем выше уровень клана и чем стабильнее репутация, тем больше полезных бонусов можно открыть для состава.',
                'Для изучения нужны очки репутации клана и специальные ресурсы: A-grade яйца, Destruction Tombstone и отдельные редкие предметы вроде Cradle of Creation. Если репутация клана падает до -1 и ниже, новые навыки изучать уже нельзя.',
                'Cradle of Creation получается через Adventure Guildsman: за 3 Destruction Tombstone можно обменять Adventurer’s Box: Cradle of Creation и открыть его двойным кликом.',
            ],
        },
        {
            id: 'clan-skills-requirements',
            type: 'table',
            title: 'Что нужно для изучения',
            columns: [
                { key: 'fact', label: 'Параметр' },
                { key: 'value', label: 'Детали' },
            ],
            rows: [
                { id: 'clan-req-1', cells: [{ value: 'Основное условие' }, { value: 'Нужны Clan Reputation и требуемые предметы для конкретного умения' }] },
                { id: 'clan-req-2', cells: [{ value: 'A-grade ресурсы' }, { value: 'Egg of Earth, Angel’s Soul, Dragon’s Heart, False Nucleus of Life, Skull of the Dead' }] },
                { id: 'clan-req-3', cells: [{ value: 'Редкие предметы' }, { value: 'Destruction Tombstone и Cradle of Creation для части наиболее ценных навыков' }] },
                { id: 'clan-req-4', cells: [{ value: 'Ограничение по репутации' }, { value: 'При репутации клана -1 и ниже изучение новых Clan Skills блокируется' }] },
                { id: 'clan-req-5', cells: [{ value: 'Хроники' }, { value: 'На оригинальной базе l2int.ru таблицы разделены на Interlude и Gracia Final - High Five' }] },
            ],
            compact: false,
        },
        {
            id: 'clan-skills-interlude',
            type: 'table',
            title: 'Ключевые Clan Skills для Interlude',
            columns: [
                { key: 'level', label: 'Ур. клана' },
                { key: 'skill', label: 'Навык' },
                { key: 'effect', label: 'Эффект' },
                { key: 'items', label: 'Требуемый предмет' },
                { key: 'rep', label: 'Репутация' },
            ],
            rows: [
                { id: 'clan-1', cells: [{ value: '5' }, skillNameCell({ ru: 'Верховная власть клана Ур.1', en: 'Clan Imperium Lv.1', iconSrc: '/assets/img/archive/quest-clan-imperium-834d58768cd6.png' }), { value: 'Открывает командный канал. Доступно персонажам со званием не ниже Sage / Elder.' }, { value: 'Destruction Tombstone x1' }, { value: '0' }] },
                { id: 'clan-2', cells: [{ value: '5' }, skillNameCell({ ru: 'Кровь клана Ур.1', en: 'Clan Lifeblood Lv.1', iconSrc: '/assets/img/archive/quest-clan-lifeblood-20e2efa87f11.png' }), { value: 'Увеличивает восстановление HP на 3%. Доступно со звания Heir.' }, { value: 'Egg of Earth: A-Grade x10' }, { value: '1500' }] },
                { id: 'clan-3', cells: [{ value: '5' }, skillNameCell({ ru: 'Магическая защита клана Ур.1', en: 'Clan Magic Protection Lv.1', iconSrc: '/assets/img/archive/quest-clan-magic-protection-7180fa3004fd.png' }), { value: 'Повышает M.Def на 6%. Доступно со звания Heir.' }, { value: 'Angel’s Soul: A-Grade x10' }, { value: '1500' }] },
                { id: 'clan-4', cells: [{ value: '5' }, skillNameCell({ ru: 'Жизненная сила клана Ур.1', en: 'Clan Vitality Lv.1', iconSrc: '/assets/img/archive/quest-clan-vitality-0e092401be15.png' }), { value: 'Повышает максимальный HP на 3%. Доступно со звания Heir.' }, { value: 'Egg of Earth: A-Grade x10' }, { value: '1500' }] },
                { id: 'clan-5', cells: [{ value: '6' }, skillNameCell({ ru: 'Эгида клана Ур.1', en: 'Clan Aegis Lv.1', iconSrc: '/assets/img/archive/quest-clan-aegis-46545a1dae5c.png' }), { value: 'Повышает P.Def на 3%. Доступно со звания Knight.' }, { value: 'Egg of Earth: A-Grade x10' }, { value: '3000' }] },
                { id: 'clan-6', cells: [{ value: '6' }, skillNameCell({ ru: 'Могущество клана Ур.1', en: 'Clan Might Lv.1', iconSrc: '/assets/img/archive/quest-clan-might-82a6c34e97fd.png' }), { value: 'Повышает P.Atk на 3%. Доступно со звания Knight.' }, { value: 'Dragon’s Heart: A-Grade x10' }, { value: '3000' }] },
                { id: 'clan-7', cells: [{ value: '6' }, skillNameCell({ ru: 'Мораль клана Ур.1', en: 'Clan Morale Lv.1', iconSrc: '/assets/img/archive/quest-clan-morale-1392965d63df.png' }), { value: 'Увеличивает восстановление CP на 6%. Доступно со звания Elder.' }, { value: 'False Nucleus of Life: A-Grade x10' }, { value: '2600' }] },
                { id: 'clan-8', cells: [{ value: '6' }, skillNameCell({ ru: 'Усиление щита клана Ур.1', en: 'Clan Shield Boost Lv.1' }), { value: 'Повышает P.Def щита на 24%. Доступно со звания Baron.' }, { value: 'Dragon’s Heart: A-Grade x10' }, { value: '2100' }] },
                { id: 'clan-9', cells: [{ value: '6' }, skillNameCell({ ru: 'Духовность клана Ур.1', en: 'Clan Spirituality Lv.1' }), { value: 'Повышает максимальный CP на 6%. Доступно со звания Baron.' }, { value: 'False Nucleus of Life: A-Grade x10' }, { value: '2100' }] },
                { id: 'clan-10', cells: [{ value: '7' }, skillNameCell({ ru: 'Наведение клана Ур.1', en: 'Clan Guidance Lv.1', iconSrc: '/assets/img/archive/quest-clan-guidance-c8df9de94a90.png' }), { value: 'Повышает Accuracy на 1. Доступно со звания Baron.' }, { value: 'Skull of the Dead: A-Grade x10' }, { value: '5600' }] },
                { id: 'clan-11', cells: [{ value: '7' }, skillNameCell({ ru: 'Удача клана Ур.1', en: 'Clan Luck Lv.1', iconSrc: '/assets/img/archive/quest-clan-luck-e2549798da1f.png' }), { value: 'Снижает потерю опыта и шанс уронить вещь при смерти. Доступно со звания Heir.' }, { value: 'Cradle of Creation x1' }, { value: '6900' }] },
                { id: 'clan-12', cells: [{ value: '7' }, skillNameCell({ ru: 'Магическая защита клана Ур.2', en: 'Clan Magic Protection Lv.2', iconSrc: '/assets/img/archive/quest-clan-magic-protection-7180fa3004fd.png' }), { value: 'Повышает M.Def на 10%. Доступно со звания Heir.' }, { value: 'Angel’s Soul: A-Grade x10' }, { value: '6900' }] },
                { id: 'clan-13', cells: [{ value: '8' }, skillNameCell({ ru: 'Проворство клана Ур.1', en: 'Clan Agility Lv.1', iconSrc: '/assets/img/archive/quest-clan-agility-f1356cdfa6dd.png' }), { value: 'Повышает Evasion на 1. Доступно со звания Baron.' }, { value: 'Skull of the Dead: A-Grade x10' }, { value: '12000' }] },
                { id: 'clan-14', cells: [{ value: '8' }, skillNameCell({ ru: 'Чистота клана Ур.1', en: 'Clan Clarity Lv.1', iconSrc: '/assets/img/archive/quest-clan-clarity-94a5e12fcb26.png' }), { value: 'Увеличивает восстановление MP на 3%. Доступно со звания Viscount.' }, { value: 'Angel’s Soul: A-Grade x10' }, { value: '11700' }] },
                { id: 'clan-15', cells: [{ value: '8' }, skillNameCell({ ru: 'Марш клана Ур.1', en: 'Clan March Lv.1', iconSrc: '/assets/img/archive/quest-clan-march-9843a9188f3a.png' }), { value: 'Повышает скорость передвижения на 3. Доступно со звания Count.' }, { value: 'Cradle of Creation x1' }, { value: '11400' }] },
            ],
            compact: false,
        },
        {
            id: 'clan-skills-notes',
            type: 'callout',
            title: 'Практический приоритет',
            tone: 'info',
            items: [
                'Для стабильного PvE-пула обычно первыми ценят Clan Imperium, Clan Lifeblood, Clan Magic Protection, Clan Might и Clan Aegis.',
                'Если клан играет осады и массовый PvP, заметную пользу дают Clan Luck, Clan March и защитные резисты против контроля.',
                'Сначала держите репутацию клана в плюсе, а уже потом уходите в дорогие редкие навыки через Cradle of Creation.',
            ],
        },
    ],
});
const createSquadSkillsArticle = () => ({
    id: 'squad-skills',
    section: 'skills',
    group: 'squad-skills',
    title: 'Умения отрядов (Squad Skills)',
    summary: 'Таблица Squad Skills по уровням клана, требования Blood Oath / Blood Alliance и эффекты для кланового отряда.',
    eyebrow: 'Поддерживающие умения',
    meta: [
        { label: 'Тип', value: 'Пассивные squad skills' },
        { label: 'Где учить', value: 'Court Magician в замке или Support Unit Captain в крепости' },
        { label: 'Доступ', value: 'Только членам отряда клана, для которого навыки были изучены' },
    ],
    intro: [],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    order: 9999,
    source: {
        url: 'https://l2int.ru/skills/squad-skills',
        sourceType: 'reference',
    },
    blocks: [
        {
            id: 'squad-media',
            type: 'media',
            title: 'Squad Skills',
            items: [
                {
                    src: '/assets/img/archive/quest-skillraid-1b45617e9b38.jpg',
                    alt: 'Squad Skills',
                    caption: 'Умения отрядов работают как дополнительные пассивные бонусы для организованной клановой группы.',
                },
            ],
        },
        {
            id: 'squad-overview',
            type: 'prose',
            title: 'Как открыть умения отрядов',
            paragraphs: [
                'Умения подразделений можно изучать после захвата крепости или замка. Учатся они у Court Magician в замке либо у Support Unit Captain в крепости.',
                'Все Squad Skills пассивные и действуют только на членов отряда того клана, для которого они были изучены. Поэтому эти бонусы сильнее всего ощущаются в постоянных составах.',
                'По структуре оригинала навыки идут по уровню клана и делятся на Holy, Water, Dark, Earth, Fire и Wind ветки с постепенным усилением эффектов.',
            ],
        },
        {
            id: 'squad-skills-table',
            type: 'table',
            title: 'Таблица Squad Skills',
            columns: [
                { key: 'level', label: 'Ур. клана' },
                { key: 'skill', label: 'Навык' },
                { key: 'items', label: 'Требуемые предметы' },
                { key: 'rep', label: 'Репутация' },
                { key: 'effect', label: 'Эффект' },
            ],
            rows: [
                { id: 'squad-1', cells: [{ value: '7' }, skillNameCell({ ru: 'Отряд Света Ур.1', en: 'Holy Squad Lv.1' }), { value: 'Blood Oath x4' }, { value: '10,400' }, { value: 'Повышает силу лечения на 20.' }] },
                { id: 'squad-2', cells: [{ value: '7' }, skillNameCell({ ru: 'Отряд Воды Ур.1', en: 'Water Squad Lv.1' }), { value: 'Blood Oath x4' }, { value: '10,400' }, { value: 'P.Def +27.3.' }] },
                { id: 'squad-3', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Тьмы Ур.1', en: 'Dark Squad Lv.1' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'M.Atk +7.17.' }] },
                { id: 'squad-4', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Земли Ур.1', en: 'Earth Squad Lv.1' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'M.Def +17.' }] },
                { id: 'squad-5', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Огня Ур.1', en: 'Fire Squad Lv.1' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'P.Atk +17.3.' }] },
                { id: 'squad-6', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Света Ур.2', en: 'Holy Squad Lv.2' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'Сила лечения +20 и Max MP +30%.' }] },
                { id: 'squad-7', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Воды Ур.2', en: 'Water Squad Lv.2' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'P.Def +27.3 и M.Def +17.6.' }] },
                { id: 'squad-8', cells: [{ value: '8' }, skillNameCell({ ru: 'Отряд Ветра Ур.1', en: 'Wind Squad Lv.1' }), { value: 'Blood Oath x8' }, { value: '12,000' }, { value: 'Accuracy +2.' }] },
                { id: 'squad-9', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Тьмы Ур.2', en: 'Dark Squad Lv.2' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'M.Atk +19.32.' }] },
                { id: 'squad-10', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Земли Ур.2', en: 'Earth Squad Lv.2' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'M.Def +31.1.' }] },
                { id: 'squad-11', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Огня Ур.2', en: 'Fire Squad Lv.2' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'P.Atk +17.3 и шанс Crit +15.' }] },
                { id: 'squad-12', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Света Ур.3', en: 'Holy Squad Lv.3' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'Сила лечения +20, Max MP +30% и расход MP -5%.' }] },
                { id: 'squad-13', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Воды Ур.3', en: 'Water Squad Lv.3' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'P.Def +27.3, M.Def +17.6 и Shield Defense Rate +6%.' }] },
                { id: 'squad-14', cells: [{ value: '9' }, skillNameCell({ ru: 'Отряд Ветра Ур.2', en: 'Wind Squad Lv.2' }), { value: 'Blood Oath x11' }, { value: '17,400' }, { value: 'Accuracy +2 и Evasion +2.' }] },
                { id: 'squad-15', cells: [{ value: '10' }, skillNameCell({ ru: 'Отряд Тьмы Ур.3', en: 'Dark Squad Lv.3' }), { value: 'Blood Alliance x2' }, { value: '24,000' }, { value: 'M.Atk +19.32 и шанс магического крита +1%.' }] },
                { id: 'squad-16', cells: [{ value: '10' }, skillNameCell({ ru: 'Отряд Земли Ур.3', en: 'Earth Squad Lv.3' }), { value: 'Blood Alliance x2' }, { value: '24,000' }, { value: 'M.Def +44.' }] },
                { id: 'squad-17', cells: [{ value: '10' }, skillNameCell({ ru: 'Отряд Огня Ур.3', en: 'Fire Squad Lv.3' }), { value: 'Blood Alliance x2' }, { value: '24,000' }, { value: 'P.Atk +17.3, сила Crit +100 и шанс Crit +15.' }] },
                { id: 'squad-18', cells: [{ value: '10' }, skillNameCell({ ru: 'Отряд Ветра Ур.3', en: 'Wind Squad Lv.3' }), { value: 'Blood Alliance x2' }, { value: '24,000' }, { value: 'Accuracy +2, Evasion +2 и Speed +3.' }] },
            ],
            compact: false,
        },
        {
            id: 'squad-notes',
            type: 'callout',
            title: 'Что брать в первую очередь',
            tone: 'info',
            items: [
                'Для плотного PvE и массовых заходов чаще всего сначала берут Fire Squad, Water Squad и Wind Squad.',
                'Если отряд строится вокруг магов или healer-пула, особенно полезны Dark Squad, Earth Squad и Holy Squad.',
                'Blood Alliance стоит тратить уже после того, как базовые ветки реально работают в постоянном составе, а не ради галочки.',
            ],
        },
    ],
});

const createEnchantChanceRows = () => {
    const values = [
        ['+1', '82%', '92%', '97%'],
        ['+2', '80%', '90%', '95%'],
        ['+3', '78%', '88%', '93%'],
        ['+4', '40%', '82%', '92%'],
        ['+5', '30%', '80%', '90%'],
        ['+6', '20%', '78%', '88%'],
        ['+7', '14%', '40%', '82%'],
        ['+8', '10%', '30%', '80%'],
        ['+9', '6%', '20%', '78%'],
        ['+10', '2%', '14%', '40%'],
        ['+11', '2%', '10%', '30%'],
        ['+12', '2%', '6%', '20%'],
        ['+13', '1%', '2%', '14%'],
        ['+14', '1%', '2%', '10%'],
        ['+15', '1%', '2%', '6%'],
        ['+16', '1%', '1%', '2%'],
        ['+17', '1%', '1%', '2%'],
        ['+18', '1%', '1%', '2%'],
        ['+19', '1%', '1%', '1%'],
        ['+20', '1%', '1%', '1%'],
        ['+21', '1%', '1%', '1%'],
        ['+22', '1%', '1%', '1%'],
        ['+23', '1%', '1%', '1%'],
        ['+24', '0%', '1%', '1%'],
        ['+25', '0%', '1%', '1%'],
        ['+26', '0%', '0%', '1%'],
        ['+27', '0%', '0%', '1%'],
        ['+28', '0%', '0%', '1%'],
        ['+29', '0%', '0%', '1%'],
        ['+30', '0%', '0%', '0%'],
    ];

    return values.map((entry, index) => ({
        id: `chance-${index + 1}`,
        cells: [{ value: entry[0] }, { value: entry[1] }, { value: entry[2] }, { value: entry[3] }],
    }));
};
const createEnchantingArticle = () => ({
    id: 'enchanting-skills',
    section: 'skills',
    group: 'enchanting-skills',
    title: 'Заточка скиллов (Enchanting Skills)',
    summary: 'Требования, NPC, направления заточки, книги Giant’s Codex и таблица шанса заточки по уровням персонажа.',
    eyebrow: 'Усиление',
    meta: [
        { label: 'Требования', value: '3-я профессия, 76+ уровень, SP, Adena и Giant’s Codex' },
        { label: 'Хроники', value: 'Interlude - Gracia Final и Gracia Epilogue - High Five' },
        { label: 'Книги', value: 'Giant’s Codex, Mastery, Discipline, Oblivion' },
    ],
    intro: [],
    checklist: [],
    steps: [],
    rewards: [],
    tips: [],
    order: 9999,
    source: {
        url: 'https://l2int.ru/skills/enchanting-skills',
        sourceType: 'reference',
    },
    blocks: [
        {
            id: 'enchant-media',
            type: 'media',
            title: 'Заточка скиллов',
            items: [
                {
                    src: '/assets/img/archive/quest-codex-of-giant-cfa2d7768904.jpg',
                    alt: 'Giant’s Codex',
                    caption: 'Giant’s Codex и связанные книги — основа любой системы skill enchant.',
                },
            ],
        },
        {
            id: 'enchant-overview',
            type: 'prose',
            title: 'Базовые требования',
            paragraphs: [
                'Улучшать скиллы можно только после получения третьей профессии. Персонаж должен быть минимум 76 уровня, а для первой заточки с +0 до +1 нужна книга Giant’s Codex.',
                'Кроме книги, каждая попытка заточки требует достаточный запас SP и Adena. На 77 и 78 уровнях шанс успешной заточки становится выше; после 78 уровня базовый шанс уже не растет.',
                'В поздних хрониках заточка открывается через кнопку в нижней части панели навыков: можно выбрать сам скилл, посмотреть возможные пути улучшения и стоимость каждой ветки.',
            ],
        },
        {
            id: 'enchant-npcs',
            type: 'table',
            title: 'Где и у кого точить скиллы (Interlude - Gracia Final)',
            columns: [
                { key: 'class', label: 'Класс / раса' },
                { key: 'location', label: 'Локация' },
                { key: 'npc', label: 'NPC' },
            ],
            rows: [
                { id: 'enchant-1', cells: [{ value: 'Human воин' }, { value: 'Town of Aden / Hunters Village' }, { value: 'Master Aiken / Master Aren Athebaldt' }] },
                { id: 'enchant-2', cells: [{ value: 'Human маг' }, { value: 'Ivory Tower / Hardin`s Academy' }, { value: 'Magister Marina / Lich King Icarus' }] },
                { id: 'enchant-3', cells: [{ value: 'Human баффер' }, { value: 'Town of Oren' }, { value: 'Priest Vadin' }] },
                { id: 'enchant-4', cells: [{ value: 'Elf воин' }, { value: 'Town of Aden / Hunters Village' }, { value: 'Master Sinden / Master Stedmiel' }] },
                { id: 'enchant-5', cells: [{ value: 'Elf маг' }, { value: 'Ivory Tower' }, { value: 'Magister Joan' }] },
                { id: 'enchant-6', cells: [{ value: 'Elf баффер' }, { value: 'Town of Oren' }, { value: 'Priest Egnos' }] },
                { id: 'enchant-7', cells: [{ value: 'Dark Elf воин / маг / баффер' }, { value: 'Hardin`s Academy / Ivory Tower' }, { value: 'Master Galadrid / Magister Ladd / Magister Anastia' }] },
                { id: 'enchant-8', cells: [{ value: 'Dwarf spoil' }, { value: 'Rune Township' }, { value: 'Warehouse Keeper Hugin, Durin, Lunin, Daisy' }] },
                { id: 'enchant-9', cells: [{ value: 'Dwarf craft' }, { value: 'Rune Township' }, { value: 'Blacksmith Vincenz' }] },
                { id: 'enchant-10', cells: [{ value: 'Orc воин / маг' }, { value: 'Rune Township' }, { value: 'Prefect Tazki / Seer Mekara' }] },
                { id: 'enchant-11', cells: [{ value: 'Kamael' }, { value: 'Town of Aden' }, { value: 'Master Aiken' }] },
            ],
            compact: false,
        },
        {
            id: 'enchant-paths',
            type: 'table',
            title: 'Направления заточки',
            columns: [
                { key: 'path', label: 'Ветка' },
                { key: 'effect', label: 'Что дает' },
            ],
            rows: [
                { id: 'path-1', cells: [{ value: 'Chance' }, { value: 'Увеличивает шанс срабатывания умения.' }] },
                { id: 'path-2', cells: [{ value: 'Cost' }, { value: 'Снижает расход MP.' }] },
                { id: 'path-3', cells: [{ value: 'Power' }, { value: 'Усиливает основной эффект или силу навыка.' }] },
                { id: 'path-4', cells: [{ value: 'Recovery' }, { value: 'Уменьшает задержку перед повторным использованием.' }] },
                { id: 'path-5', cells: [{ value: 'Summon' }, { value: 'Повышает P.Atk призываемого существа.' }] },
                { id: 'path-6', cells: [{ value: 'Time' }, { value: 'Увеличивает продолжительность действия эффекта.' }] },
            ],
            compact: false,
        },
        {
            id: 'enchant-books',
            type: 'table',
            title: 'Типы Giant’s Codex',
            columns: [
                { key: 'type', label: 'Тип улучшения' },
                { key: 'items', label: 'Книга' },
                { key: 'effect', label: 'Описание' },
            ],
            rows: [
                { id: 'book-1', cells: [{ value: 'Обычное улучшение' }, { value: 'Giant’s Codex' }, { value: 'При неудаче умение возвращается в исходное состояние. Книга нужна только при переходе с +0 на +1.' }] },
                { id: 'book-2', cells: [{ value: 'Благое улучшение' }, { value: 'Giant’s Codex - Mastery' }, { value: 'При неудаче текущий уровень заточки сохраняется, но книга требуется на каждую попытку.' }] },
                { id: 'book-3', cells: [{ value: 'Модификация ветки' }, { value: 'Giant’s Codex - Discipline' }, { value: 'Меняет параметр заточки. Уровень может упасть на 1-3, но не ниже +1.' }] },
                { id: 'book-4', cells: [{ value: 'Понижение уровня' }, { value: 'Giant’s Codex - Oblivion' }, { value: 'Понижает текущий уровень заточки и возвращает затраченный SP.' }] },
            ],
            compact: false,
        },
        {
            id: 'enchant-chance',
            type: 'table',
            title: 'Шанс заточки по уровням (Interlude)',
            columns: [
                { key: 'level', label: 'Заточка' },
                { key: 'lv76', label: '76 уровень' },
                { key: 'lv77', label: '77 уровень' },
                { key: 'lv78', label: '78+ уровень' },
            ],
            rows: createEnchantChanceRows(),
            compact: false,
        },
        {
            id: 'enchant-notes',
            type: 'callout',
            title: 'Практические заметки',
            tone: 'info',
            items: [
                'На 77 и 78 уровнях шанс заметно выше, чем на 76, поэтому дорогие ветки логично оставлять хотя бы до 77+.',
                'Для повседневной заточки и безопасного прогресса чаще всего используют Mastery, а для смены ветки — Discipline.',
                'Если класс сильно зависит от конкретных ключевых скиллов, сначала точите те умения, которые работают в каждом бою, и только потом переходите к узким веткам.',
            ],
        },
    ],
});

const updateSkillsCatalog = (database) => {
    const section = database.sections?.skills;

    if (!section || !Array.isArray(section.catalogRows)) {
        return;
    }

    section.catalogRows = section.catalogRows.map((row) => {
        const href = row?.cells?.[0]?.href || '';

        if (href.includes('article=clan-skills')) {
            return {
                ...row,
                cells: [
                    row.cells[0],
                    { value: 'Поддерживающие умения' },
                    { value: 'Clan Skills: требования, ресурсы, Interlude-таблица и приоритет прокачки для клана.' },
                ],
            };
        }

        if (href.includes('article=squad-skills')) {
            return {
                ...row,
                cells: [
                    row.cells[0],
                    { value: 'Поддерживающие умения' },
                    { value: 'Squad Skills: Blood Oath, Blood Alliance и все основные бонусы для отряда по уровням клана.' },
                ],
            };
        }

        if (href.includes('article=enchanting-skills')) {
            return {
                ...row,
                cells: [
                    row.cells[0],
                    { value: 'Усиление' },
                    { value: 'Требования, NPC, ветки заточки, Giant’s Codex и таблица шанса skill enchant.' },
                ],
            };
        }

        return row;
    });
};

async function main() {
    const database = readCanonical();
    database.articles.contacts = createContactsArticle();
    database.articles['clan-skills'] = createClanSkillsArticle();
    database.articles['squad-skills'] = createSquadSkillsArticle();
    database.articles['enchanting-skills'] = createEnchantingArticle();
    updateSkillsCatalog(database);
    await publishCanonical(null, database, 'refresh-contacts-and-skills');
    console.log('[refresh-contacts-and-skills] contacts, clan-skills, squad-skills, enchanting-skills updated');
}

main().catch((error) => {
    console.error('[refresh-contacts-and-skills] failed', error);
    process.exitCode = 1;
});
