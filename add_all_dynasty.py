import json

with open('data/canonical/l2wiki-canonical.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Before: {len(data['articles'])} articles")

DYNASTY_WEAPONS = [
    {'id': 'weapon-dynasty-blade', 'name': 'Dynasty Blade', 'ru': 'Клинок Династии', 'group': 'swords', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png'},
    {'id': 'weapon-dynasty-knife', 'name': 'Dynasty Knife', 'ru': 'Нож Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png'},
    {'id': 'weapon-dynasty-dual-daggers', 'name': 'Dynasty Dual Daggers', 'ru': 'Парные Кинжалы Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png'},
    {'id': 'weapon-dynasty-bow', 'name': 'Dynasty Bow', 'ru': 'Лук Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png'},
    {'id': 'weapon-dynasty-crossbow', 'name': 'Dynasty Crossbow', 'ru': 'Арбалет Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png'},
    {'id': 'weapon-dynasty-great-sword', 'name': 'Dynasty Great Sword', 'ru': 'Двуручный Меч Династии', 'group': 'two-handed', 'patk': 485, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png'},
    {'id': 'weapon-dynasty-staff', 'name': 'Dynasty Staff', 'ru': 'Посох Династии', 'group': 'blunt', 'patk': 323, 'matk': 244, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png'},
    {'id': 'weapon-dynasty-mace', 'name': 'Dynasty Mace', 'ru': 'Булава Династии', 'group': 'blunt', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png'},
    {'id': 'weapon-dynasty-dual-swords', 'name': 'Dynasty Dual Swords', 'ru': 'Парные Мечи Династии', 'group': 'duals', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png'},
    {'id': 'weapon-dynasty-two-handed-staff', 'name': 'Dynasty Two-Handed Staff', 'ru': 'Двуручный Посох Династии', 'group': 'two-handed-blunts', 'patk': 388, 'matk': 292, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png'},
    {'id': 'weapon-dynasty-fist', 'name': 'Dynasty Fist', 'ru': 'Кастет Династии', 'group': 'fists', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png'},
    {'id': 'weapon-dynasty-pike', 'name': 'Dynasty Pike', 'ru': 'Пика Династии', 'group': 'pole', 'patk': 389, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png'},
    {'id': 'weapon-dynasty-rapier', 'name': 'Dynasty Rapier', 'ru': 'Рапира Династии', 'group': 'rapier', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png'},
    {'id': 'weapon-dynasty-magic-book', 'name': 'Dynasty Magic Book', 'ru': 'Магическая Книга Династии', 'group': 'magic-books', 'patk': 242, 'matk': 244, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png'},
]

added = 0
weapons = data['sections']['weapons']

for item in DYNASTY_WEAPONS:
    if item['id'] in data['articles']:
        continue
        
    article = {
        'id': item['id'],
        'section': 'weapons',
        'group': item['group'],
        'title': item['name'],
        'summary': f"{item['ru']} — S-Grade оружие серии Dynasty",
        'eyebrow': 'S-Grade Weapon',
        'meta': [
            {'label': 'Физ. Атака', 'value': str(item['patk'])},
            {'label': 'Маг. Атака', 'value': str(item['matk'])},
            {'label': 'Грейд', 'value': 'S'},
        ],
        'intro': [f"{item['name']} ({item['ru']}) — мощное оружие S-Grade серии Dynasty."],
        'related': [],
        'order': 100,
        'layout': 'article',
        'source': 'dynasty',
        'icon': item['icon'],
        'heroImage': item['icon'],
        'blocks': []
    }
    
    data['articles'][item['id']] = article
    
    # Add to group
    for g in weapons['groups']:
        if g['id'] == item['group']:
            if item['id'] not in g['entries']:
                g['entries'].append(item['id'])
    
    added += 1
    print(f"Added: {item['name']}")

print(f"\nAdded {added} Dynasty weapons")
print(f"After: {len(data['articles'])} articles")

with open('data/canonical/l2wiki-canonical.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Saved!')
