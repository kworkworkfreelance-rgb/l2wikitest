#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add Dynasty armor and jewelry to L2Wiki database"""

import json

# Dynasty armor
DYNASTY_ARMOR = {
    'heavy': [
        {'name': 'Dynasty Breastplate', 'ru': 'Кираса Династии', 'pdef': 293, 'grade': 'S', 'slot': 'Chest', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_breastplate_i00.png'},
        {'name': 'Dynasty Gaiters', 'ru': 'Набедренники Династии', 'pdef': 183, 'grade': 'S', 'slot': 'Legs', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gaiters_i00.png'},
        {'name': 'Dynasty Gauntlets', 'ru': 'Рукавицы Династии', 'pdef': 117, 'grade': 'S', 'slot': 'Gloves', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gauntlets_i00.png'},
        {'name': 'Dynasty Boots', 'ru': 'Сапоги Династии', 'pdef': 117, 'grade': 'S', 'slot': 'Feet', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_boots_i00.png'},
        {'name': 'Dynasty Helmet', 'ru': 'Шлем Династии', 'pdef': 146, 'grade': 'S', 'slot': 'Head', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_helmet_i00.png'},
    ],
    'light': [
        {'name': 'Dynasty Leather Armor', 'ru': 'Кожаный Доспех Династии', 'pdef': 220, 'grade': 'S', 'slot': 'Chest', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_vest_i00.png'},
        {'name': 'Dynasty Leather Leggings', 'ru': 'Кожаные Поножи Династии', 'pdef': 137, 'grade': 'S', 'slot': 'Legs', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_leggings_i00.png'},
        {'name': 'Dynasty Leather Gloves', 'ru': 'Кожаные Перчатки Династии', 'pdef': 88, 'grade': 'S', 'slot': 'Gloves', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_gloves_i00.png'},
        {'name': 'Dynasty Leather Boots', 'ru': 'Кожаные Сапоги Династии', 'pdef': 88, 'grade': 'S', 'slot': 'Feet', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_boots_i00.png'},
    ],
    'robe': [
        {'name': 'Dynasty Tunic', 'ru': 'Туника Династии', 'pdef': 147, 'mdef': 20, 'grade': 'S', 'slot': 'Chest', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_tunic_i00.png'},
        {'name': 'Dynasty Hose', 'ru': 'Штаны Династии', 'pdef': 92, 'mdef': 12, 'grade': 'S', 'slot': 'Legs', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_hose_i00.png'},
        {'name': 'Dynasty Gloves', 'ru': 'Перчатки Династии', 'pdef': 59, 'mdef': 8, 'grade': 'S', 'slot': 'Gloves', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gloves_i00.png'},
        {'name': 'Dynasty Shoes', 'ru': 'Башмаки Династии', 'pdef': 59, 'mdef': 8, 'grade': 'S', 'slot': 'Feet', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_shoes_i00.png'},
    ],
    'shield': [
        {'name': 'Dynasty Shield', 'ru': 'Щит Династии', 'pdef': 329, 'grade': 'S', 'slot': 'Shield', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_shield_i00.png'},
    ],
    'sigil': [
        {'name': 'Dynasty Sigil', 'ru': 'Символ Династии', 'pdef': 146, 'grade': 'S', 'slot': 'Sigil', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_sigil_i00.png'},
    ],
}

# Dynasty jewelry
DYNASTY_JEWELRY = [
    {'name': 'Dynasty Necklace', 'ru': 'Ожерелье Династии', 'mdef': 66, 'grade': 'S', 'slot': 'Neck', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_necklace_i00.png'},
    {'name': 'Dynasty Earring', 'ru': 'Серьга Династии', 'mdef': 50, 'grade': 'S', 'slot': 'Earring', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_earring_i00.png'},
    {'name': 'Dynasty Ring', 'ru': 'Кольцо Династии', 'mdef': 37, 'grade': 'S', 'slot': 'Ring', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_ring_i00.png'},
]

def main():
    db_path = 'data/canonical/l2wiki-canonical.json'
    
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add armor section if not exists
    if 'armor' not in data['sections']:
        data['sections']['armor'] = {
            'id': 'armor',
            'title': 'Броня',
            'description': 'Броня и доспехи Lineage 2',
            'order': 5,
            'groups': []
        }
    
    armor_section = data['sections']['armor']
    
    # Ensure groups exist
    existing_group_ids = {g['id'] for g in armor_section.get('groups', [])}
    required_groups = ['heavy', 'light', 'robe', 'shield', 'sigil']
    
    for group_id in required_groups:
        if group_id not in existing_group_ids:
            armor_section.setdefault('groups', []).append({
                'id': group_id,
                'label': {
                    'heavy': 'Тяжелая броня',
                    'light': 'Легкая броня',
                    'robe': 'Магическая броня',
                    'shield': 'Щиты',
                    'sigil': 'Символы'
                }.get(group_id, group_id),
                'entries': []
            })
    
    # Add armor items
    for group_id, items in DYNASTY_ARMOR.items():
        group = next((g for g in armor_section['groups'] if g['id'] == group_id), None)
        if not group:
            continue
        
        for item in items:
            article_id = f"armor-dynasty-{item['name'].lower().replace(' ', '-')}"
            
            meta = [
                {'label': 'Физ. Защита', 'value': str(item['pdef'])},
                {'label': 'Грейд', 'value': item['grade']},
                {'label': 'Слот', 'value': item['slot']},
            ]
            if 'mdef' in item:
                meta.insert(1, {'label': 'Маг. Защита', 'value': str(item['mdef'])})
            
            if article_id not in data['articles']:
                data['articles'][article_id] = {
                    'id': article_id,
                    'section': 'armor',
                    'group': group_id,
                    'title': item['name'],
                    'summary': f"{item['ru']} — S-Grade броня серии Dynasty",
                    'eyebrow': f"{item['grade']}-Grade Armor",
                    'meta': meta,
                    'intro': [f"{item['name']} ({item['ru']}) — броня S-Grade серии Dynasty."],
                    'related': [],
                    'order': 100,
                    'layout': 'article',
                    'source': 'dynasty-addition',
                    'blocks': [],
                    'heroImage': item['icon'],
                    'icon': item['icon'],
                }
            
            if article_id not in group['entries']:
                group['entries'].append(article_id)
                print(f"Added armor: {item['name']} to {group_id}")
    
    # Add jewelry section if not exists
    if 'jewelry' not in data['sections']:
        data['sections']['jewelry'] = {
            'id': 'jewelry',
            'title': 'Бижутерия',
            'description': 'Кольца, серьги, ожерелья и прочая бижутерия Lineage 2',
            'order': 6,
            'groups': []
        }
    
    jewelry_section = data['sections']['jewelry']
    
    # Ensure jewelry groups exist
    if not any(g['id'] == 's-grade' for g in jewelry_section.get('groups', [])):
        jewelry_section.setdefault('groups', []).append({
            'id': 's-grade',
            'label': 'S-Grade бижутерия',
            'entries': []
        })
    
    s_grade_group = next((g for g in jewelry_section['groups'] if g['id'] == 's-grade'), None)
    
    for item in DYNASTY_JEWELRY:
        article_id = f"jewelry-dynasty-{item['name'].lower().replace(' ', '-')}"
        
        if article_id not in data['articles']:
            data['articles'][article_id] = {
                'id': article_id,
                'section': 'jewelry',
                'group': 's-grade',
                'title': item['name'],
                'summary': f"{item['ru']} — S-Grade бижутерия серии Dynasty",
                'eyebrow': f"{item['grade']}-Grade Jewelry",
                'meta': [
                    {'label': 'Маг. Защита', 'value': str(item['mdef'])},
                    {'label': 'Грейд', 'value': item['grade']},
                    {'label': 'Слот', 'value': item['slot']},
                ],
                'intro': [f"{item['name']} ({item['ru']}) — бижутерия S-Grade серии Dynasty."],
                'related': [],
                'order': 100,
                'layout': 'article',
                'source': 'dynasty-addition',
                'blocks': [],
                'heroImage': item['icon'],
                'icon': item['icon'],
            }
        
        if s_grade_group and article_id not in s_grade_group['entries']:
            s_grade_group['entries'].append(article_id)
            print(f"Added jewelry: {item['name']}")
    
    # Update database timestamp
    data['updatedAt'] = '2026-04-26T00:00:00.000Z'
    
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nAdded Dynasty armor and jewelry to database")

if __name__ == '__main__':
    main()
