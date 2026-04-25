/**
 * Скрипт для добавления кликабельных ссылок на квесты третьей профессии
 * и добавления подробной информации о квестах
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = path.join(__dirname, 'data', 'canonical', 'l2wiki-canonical.json');

// Маппинг названий квестов к их статьям в архиве
const QUEST_MAPPING = {
  // Люди
  "Saga of the Dreadnought / (Сага Полководца)": "archive-quests-item-3397-saga-of-the-dreadnought",
  "Saga of the Duelist / (Сага Дуэлиста)": "archive-quests-item-3401-saga-of-the-duelist",
  "Saga of the Phoenix Knight / (Сага Рыцаря Феникса)": "archive-quests-item-3417-saga-of-the-phoenix-knight",
  "Saga of the Hell Knight / (Сага Рыцаря Ада)": "archive-quests-item-3411-saga-of-the-hell-knight",
  "Saga of the Adventurer / (Сага Авантюриста)": "archive-quests-item-3408-saga-of-the-adventurer",
  "Saga of the Sagittarius / (Сага Снайпера)": "archive-quests-item-3388-saga-of-the-sagittarius",
  "Saga of the Archmage / (Сага Архимага)": "archive-quests-item-3399-saga-of-the-archmage",
  "Saga of the Soultaker / (Сага Пожирателя Душ)": "archive-quests-item-3404-saga-of-the-soultaker",
  "Saga of the Arcana Lord / (Сага Чернокнижника)": "archive-quests-item-3393-saga-of-the-arcana-lord",
  "Saga of the Cardinal / (Сага Кардинала)": "archive-quests-item-3412-saga-of-the-cardinal",
  "Saga of the Hierophant / (Сага Апостола)": "archive-quests-item-3384-saga-of-the-hierophant",
  
  // Эльфы
  "Saga of the Eva's Templar / (Сага Храмовника Евы)": "archive-quests-item-3389-saga-of-the-eva-s-templar",
  "Saga of the Sword Muse / (Сага Виртуоза)": "archive-quests-item-3392-saga-of-the-sword-muse",
  "Saga of the Wind Rider / (Сага Странника Ветра)": "archive-quests-item-3410-saga-of-the-wind-rider",
  "Saga of the Moonlight Sentinel / (Сага Стража Лунного Света)": "archive-quests-item-3396-saga-of-the-moonlight-sentinel",
  "Saga of the Mystic Muse / (Сага Магистра Магии)": "archive-quests-item-3409-saga-of-the-mystic-muse",
  "Saga of the Elemental Master / (Сага Мастера Стихий)": "archive-quests-item-3387-saga-of-the-elemental-master",
  "Saga of the Eva's Saint / (Сага Жреца Евы)": "archive-quests-item-3391-saga-of-the-eva-s",
  
  // Темные Эльфы
  "Saga of the Shillien Templar / (Сага Храмовника Шилен)": "archive-quests-item-3390-saga-of-the-shillien-templar",
  "Saga of the Spectral Dancer / (Сага Призрачного Танцора)": "archive-quests-item-3418-saga-of-the-spectral-dancer",
  "Saga of the Ghost Hunter / (Сага Призрачного Охотника)": "archive-quests-item-3416-saga-of-the-ghost-hunter",
  "Saga of the Ghost Sentinel / (Сага Стража Теней)": "archive-quests-item-3405-saga-of-the-ghost-sentinel",
  "Saga of the Storm Screamer / (Сага Повелителя Бури)": "archive-quests-item-3415-saga-of-the-storm-screamer",
  "Saga of the Spectral Master / (Сага Владыки Теней)": "archive-quests-item-3395-saga-of-the-spectral-master",
  "Saga of the Shillien Saint / (Сага Жреца Шилен)": "archive-quests-item-3398-saga-of-the-shillien-saint",
  
  // Гномы
  "Saga of the Fortune Seeker / (Сага Кладоискателя)": "archive-quests-item-3407-saga-of-the-fortune-seeker",
  "Saga of the Maestro / (Сага Мастера)": "archive-quests-item-3414-saga-of-the-maestro",
  
  // Орки
  "Saga of the Titan / (Сага Титана)": "archive-quests-item-3406-saga-of-the-titan",
  "Saga of the Grand Khavatari / (Сага Аватара)": "archive-quests-item-3413-saga-of-the-grand-khavatari",
  "Saga of the Dominator / (Сага Деспота)": "archive-quests-item-3385-saga-of-the-dominator",
  "Saga of the Doomcryer / (Сага Гласа Судьбы)": "archive-quests-item-3402-saga-of-the-doomcryer",
  
  // Камаэль
  "Saga of the Soul Hound / (Сага Инквизитора)": "archive-quests-item-3394-saga-of-the-soul-hound",
  "Saga of the Doombringer / (Сага Карателя)": "archive-quests-item-3386-saga-of-the-doombringer",
  "Saga of the Trickster / (Сага Диверсанта)": "archive-quests-item-3403-saga-of-the-trickster",
  "Law Enforcement / (Сила Закона)": "archive-quests-item-3419-law-enforcement"
};

// Маппинг NPC к их статьям (для кликабельности)
const NPC_MAPPING = {
  "Master Aiken (Мастер Айкен)": "npc-master-aiken",
  "Grand Master Sedrick (Великий Мастер Седрик)": "npc-grand-master-sedrick",
  "Dark Knight Mordred (Темный Рыцарь Мордред)": "npc-dark-knight-mordred",
  "Hunter Guild Member Black Cat (Гильдия Охотников Черная Кошка)": "npc-hunter-guild-black-cat",
  "Hunter Guild President Bernard (Глава Гильдии Охотников Бернард)": "npc-hunter-guild-bernard",
  "Grand Magister Valleria (Великий Магистр Валерия)": "npc-grand-magister-valleria",
  "Hardin (Хардин)": "npc-hardin",
  "Head Summoner Kinsley (Главный Призыватель Кинсли)": "npc-head-summoner-kinsley",
  "High Priest Hollint (Верховный Жрец Холлинт)": "npc-high-priest-hollint",
  "Master Sinden (Мастер Синден)": "npc-master-sinden",
  "Master Raien (Мастер Раен)": "npc-master-raien",
  "Grand Magister Arkenias (Великий Магистр Аркениас)": "npc-grand-magister-arkenias",
  "Master Galadrid (Мастер Галадрид)": "npc-master-galadrid",
  "Grand Magister Fairen (Великий Магистр Фэйрен)": "npc-grand-magist-fairen",
  "Magister Anastia (Магистр Анастия)": "npc-magister-anastia",
  "Chief Inspector Mond (Главный Инспектор Монд)": "npc-chief-inspector-mond",
  "Chief Golem Crafter Telson (Глава Создателей Големов Телсон)": "npc-chief-golem-crafter-telson",
  "Prefect Tazki (Префект Таски)": "npc-prefect-tazki",
  "Amulet Seller Hakran (Торговец Амулетами Хакран)": "npc-amulet-seller-hakran",
  "Grand Priest Rahorakti (Великий Провидец Рахоракти)": "npc-grand-priest-rahorakti",
  "Hierarch Kekropus (Тетрарх Кекропус)": "npc-hierarch-kekropus"
};

function addQuestLinks() {
  console.log('Чтение канонического файла...');
  const data = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
  
  const questSection = data.entries['quest-profession-third'];
  if (!questSection) {
    console.error('Секция quest-profession-third не найдена');
    return;
  }
  
  let questLinksAdded = 0;
  let questLinksSkipped = 0;
  let npcLinksAdded = 0;
  let npcLinksSkipped = 0;
  
  // Проходим по всем блокам (таблицам) в секции
  questSection.blocks.forEach(block => {
    if (block.type === 'table') {
      console.log(`Обработка таблицы: ${block.title}`);
      
      // Проходим по всем строкам таблицы
      block.rows.forEach(row => {
        // column-1 - изначальный класс (можно сделать кликабельным)
        const classCell = row.cells[0];
        
        // column-2 - название квеста
        const questCell = row.cells[1];
        if (questCell && QUEST_MAPPING[questCell.value]) {
          if (questCell.href === '') {
            questCell.href = `/pages/article.html?article=${QUEST_MAPPING[questCell.value]}`;
            questLinksAdded++;
            console.log(`  ✓ Добавлена ссылка на квест: ${questCell.value}`);
          } else {
            questLinksSkipped++;
          }
        }
        
        // column-3 - стартовый NPC
        const npcCell = row.cells[2];
        if (npcCell && NPC_MAPPING[npcCell.value]) {
          if (npcCell.href === '') {
            npcCell.href = `/pages/article.html?article=${NPC_MAPPING[npcCell.value]}`;
            npcLinksAdded++;
            console.log(`  ✓ Добавлена ссылка на NPC: ${npcCell.value}`);
          } else {
            npcLinksSkipped++;
          }
        }
        
        // column-4 - третья профессия (можно сделать кликабельным)
        const class3Cell = row.cells[3];
      });
    }
  });
  
  // Обновляем timestamp
  data.updatedAt = new Date().toISOString();
  
  // Создаем бэкап
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, 'data', 'backups', `${timestamp}-quest-links-backup.json`);
  if (!fs.existsSync(path.join(__dirname, 'data', 'backups'))) {
    fs.mkdirSync(path.join(__dirname, 'data', 'backups'), { recursive: true });
  }
  fs.copyFileSync(CANONICAL_PATH, backupPath);
  console.log(`\nБэкап создан: ${backupPath}`);
  
  // Сохраняем изменения
  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`\n=== Результат ===`);
  console.log(`Добавлено ссылок на квесты: ${questLinksAdded}`);
  console.log(`Пропущено квестов (уже есть): ${questLinksSkipped}`);
  console.log(`Добавлено ссылок на NPC: ${npcLinksAdded}`);
  console.log(`Пропущено NPC (уже есть): ${npcLinksSkipped}`);
  console.log(`Файл сохранен: ${CANONICAL_PATH}`);
}

addQuestLinks();
