#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json

# Dynasty weapons - все предметы с иконками l2central.info
DYNASTY_WEAPONS = [
    # Swords
    {'id': 'weapon-dynasty-sword', 'name': 'Dynasty Sword', 'ru': 'Меч Династии', 'group': 'swords', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png'},
    {'id': 'weapon-dynasty-blade', 'name': 'Dynasty Blade', 'ru': 'Клинок Династии', 'group': 'swords', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png'},
    # Daggers  
    {'id': 'weapon-dynasty-knife', 'name': 'Dynasty Knife', 'ru': 'Нож Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png'},
    {'id': 'weapon-dynasty-dual-daggers', 'name': 'Dynasty Dual Daggers', 'ru': 'Парные Кинжалы Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png'},
    # Bows
    {'id': 'weapon-dynasty-bow', 'name': 'Dynasty Bow', 'ru': 'Лук Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png'},
    {'id': 'weapon-dynasty-crossbow', 'name': 'Dynasty Crossbow', 'ru': 'Арбалет Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png'},
    # Two-handed
    {'id': 'weapon-dynasty-great-sword', 'name': 'Dynasty Great Sword', 'ru': 'Двуручный Меч Династии', 'group': 'two-handed', 'patk': 485, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png'},
    # Blunt/Staff
    {'id': 'weapon-dynasty-staff', 'name': 'Dynasty Staff', 'ru': 'Посох Династии', 'group': 'blunt', 'patk': 323, 'matk': 244, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png'},
    {'id': 'weapon-dynasty-mace', 'name': 'Dynasty Mace', 'ru': 'Булава Династии', 'group': 'blunt', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png'},
    # Duals
    {'id': 'weapon-dynasty-dual-swords', 'name': 'Dynasty Dual Swords', 'ru': 'Парные Мечи Династии', 'group': 'duals', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png'},
    # Two-handed blunts
    {'id': 'weapon-dynasty-two-handed-staff', 'name': 'Dynasty Two-Handed Staff', 'ru': 'Двуручный Посох Династии', 'group': 'two-handed-blunts', 'patk': 388, 'matk': 292, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png'},
    # Fists
    {'id': 'weapon-dynasty-fist', 'name': 'Dynasty Fist', 'ru': 'Кастет Династии', 'group': 'fists', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png'},
    # Pole
    {'id': 'weapon-dynasty-pike', 'name': 'Dynasty Pike', 'ru': 'Пика Династии', 'group': 'pole', 'patk': 389, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png'},
    # Rapier
    {'id': 'weapon-dynasty-rapier', 'name': 'Dynasty Rapier', 'ru': 'Рапира Династии', 'group': 'rapier', 'patk': 405, 'matk': 161, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png'},
    # Magic books
    {'id': 'weapon-dynasty-magic-book', 'name': 'Dynasty Magic Book', 'ru': 'Магическая Книга Династии', 'group': 'magic-books', 'patk': 242, 'matk': 244, 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png'},
]

def main():
    db_path = 'data/canonical/l2wiki-canonical.json'
    
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    weapons = data['sections']['weapons']
    added = 0
    
    for item in DYNASTY_WEAPONS:
        # Add article
        if item['id'] not in data['articles']:
            data['articles'][item['id']] = {
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
                'blocks': [],
                'heroImage': item['icon'],
                'icon': item['icon'],
            }
            added += 1
            print(f"Added: {item['name']}")
        
        # Add to group entries
        group = next((g for g in weapons['groups'] if g['id'] == item['group']), None)
        if group and item['id'] not in group['entries']:
            group['entries'].append(item['id'])
            print(f"  -> Added to group: {item['group']}")
    
    # Save
    data['updatedAt'] = '2026-04-26T12:00:00.000Z'
    
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal added: {added} Dynasty weapons")
    print(f"Total articles: {len(data['articles'])}")

if __name__ == '__main__':
    main()
