#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add Dynasty weapons to L2Wiki database"""

import json
import os

# Dynasty weapons data with images from linedia.ru pattern
# Image URL pattern: https://linedia.ru/w/images/... or use l2central.info

DYNASTY_WEAPONS = {
    'swords': [
        {'name': 'Dynasty Sword', 'ru': 'Меч Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png'},
        {'name': 'Dynasty Blade', 'ru': 'Клинок Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png'},
    ],
    'daggers': [
        {'name': 'Dynasty Knife', 'ru': 'Нож Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png'},
        {'name': 'Dynasty Dual Daggers', 'ru': 'Парные Кинжалы Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png'},
    ],
    'bows': [
        {'name': 'Dynasty Bow', 'ru': 'Лук Династии', 'patk': 723, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png'},
        {'name': 'Dynasty Crossbow', 'ru': 'Арбалет Династии', 'patk': 723, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png'},
    ],
    'two-handed': [
        {'name': 'Dynasty Great Sword', 'ru': 'Двуручный Меч Династии', 'patk': 485, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png'},
    ],
    'blunt': [
        {'name': 'Dynasty Staff', 'ru': 'Посох Династии', 'patk': 323, 'matk': 244, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png'},
        {'name': 'Dynasty Mace', 'ru': 'Булава Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png'},
    ],
    'duals': [
        {'name': 'Dynasty Dual Swords', 'ru': 'Парные Мечи Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png'},
    ],
    'two-handed-blunts': [
        {'name': 'Dynasty Two-Handed Staff', 'ru': 'Двуручный Посох Династии', 'patk': 388, 'matk': 292, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png'},
    ],
    'fists': [
        {'name': 'Dynasty Fist', 'ru': 'Кастет Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png'},
    ],
    'pole': [
        {'name': 'Dynasty Pike', 'ru': 'Пика Династии', 'patk': 389, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png'},
    ],
    'rapier': [
        {'name': 'Dynasty Rapier', 'ru': 'Рапира Династии', 'patk': 405, 'matk': 161, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png'},
    ],
    'magic-books': [
        {'name': 'Dynasty Magic Book', 'ru': 'Магическая Книга Династии', 'patk': 242, 'matk': 244, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png'},
    ],
}

# Dynasty armor
DYNASTY_ARMOR = {
    'heavy': [
        {'name': 'Dynasty Breastplate', 'ru': 'Кираса Династии', 'pdef': 293, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_breastplate_i00.png'},
        {'name': 'Dynasty Gaiters', 'ru': 'Набедренники Династии', 'pdef': 183, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gaiters_i00.png'},
        {'name': 'Dynasty Gauntlets', 'ru': 'Рукавицы Династии', 'pdef': 117, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gauntlets_i00.png'},
        {'name': 'Dynasty Boots', 'ru': 'Сапоги Династии', 'pdef': 117, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_boots_i00.png'},
        {'name': 'Dynasty Helmet', 'ru': 'Шлем Династии', 'pdef': 146, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_helmet_i00.png'},
    ],
    'light': [
        {'name': 'Dynasty Leather Armor', 'ru': 'Кожаный Доспех Династии', 'pdef': 220, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_vest_i00.png'},
        {'name': 'Dynasty Leather Leggings', 'ru': 'Кожаные Поножи Династии', 'pdef': 137, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_leggings_i00.png'},
        {'name': 'Dynasty Leather Gloves', 'ru': 'Кожаные Перчатки Династии', 'pdef': 88, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_gloves_i00.png'},
        {'name': 'Dynasty Leather Boots', 'ru': 'Кожаные Сапоги Династии', 'pdef': 88, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_leather_boots_i00.png'},
    ],
    'robe': [
        {'name': 'Dynasty Tunic', 'ru': 'Туника Династии', 'pdef': 147, 'mdef': 20, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_tunic_i00.png'},
        {'name': 'Dynasty Hose', 'ru': 'Штаны Династии', 'pdef': 92, 'mdef': 12, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_hose_i00.png'},
        {'name': 'Dynasty Gloves', 'ru': 'Перчатки Династии', 'pdef': 59, 'mdef': 8, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_gloves_i00.png'},
        {'name': 'Dynasty Shoes', 'ru': 'Башмаки Династии', 'pdef': 59, 'mdef': 8, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/armor_dynasty_shoes_i00.png'},
    ],
}

# Dynasty jewelry
DYNASTY_JEWELRY = [
    {'name': 'Dynasty Necklace', 'ru': 'Ожерелье Династии', 'mdef': 66, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_necklace_i00.png'},
    {'name': 'Dynasty Earring', 'ru': 'Серьга Династии', 'mdef': 50, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_earring_i00.png'},
    {'name': 'Dynasty Ring', 'ru': 'Кольцо Династии', 'mdef': 37, 'grade': 'S', 'icon': 'https://l2central.info/classic/img/items/accessary_dynasty_ring_i00.png'},
]

def create_weapon_cell_html(item):
    """Create HTML for weapon table cell with image"""
    return f'''<span class="weapon-table__item">
            <img class="wiki-item-thumb" src="{item['icon']}" alt="{item['name']} {item['ru']}" loading="lazy" />
            <span class="wiki-item-link">
                <span class="wiki-item-link__en">{item['name']}</span>
                <span class="wiki-item-link__ru">{item['ru']}</span>
            </span>
        </span>'''

def create_armor_cell_html(item):
    """Create HTML for armor table cell with image"""
    return f'''<span class="armor-table__item">
            <img class="wiki-item-thumb" src="{item['icon']}" alt="{item['name']} {item['ru']}" loading="lazy" />
            <span class="wiki-item-link">
                <span class="wiki-item-link__en">{item['name']}</span>
                <span class="wiki-item-link__ru">{item['ru']}</span>
            </span>
        </span>'''

def create_grade_cell_html(grade):
    """Create HTML for grade cell"""
    grade_icons = {
        'S': 'https://l2int.ru/images/all/Rang_S.gif',
        'A': 'https://l2int.ru/images/all/Rang_A.gif',
        'B': 'https://l2int.ru/images/all/Rang_B.gif',
    }
    icon = grade_icons.get(grade, 'https://l2int.ru/images/all/Rang_S.gif')
    return f'<span class="weapon-grade"><img class="weapon-grade__icon" src="{icon}" alt="{grade}-Grade" loading="lazy" /><span>{grade}-Grade</span></span>'

def main():
    db_path = 'data/canonical/l2wiki-canonical.json'
    
    # Load database
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    weapons_section = data['sections']['weapons']
    
    # Add Dynasty weapons to each group
    for group_id, weapons in DYNASTY_WEAPONS.items():
        group = next((g for g in weapons_section['groups'] if g['id'] == group_id), None)
        if not group:
            print(f"Group {group_id} not found")
            continue
        
        # Find or create S-Grade table block
        s_grade_block = None
        for block in data['articles'].get(group.get('landingArticleId', ''), {}).get('blocks', []):
            if block.get('type') == 'table' and 'S' in str(block.get('title', '')):
                s_grade_block = block
                break
        
        # If no S-Grade table, add rows to existing tables or create Dynasty section
        for weapon in weapons:
            article_id = f"weapon-dynasty-{weapon['name'].lower().replace(' ', '-')}"
            
            # Create weapon article if not exists
            if article_id not in data['articles']:
                data['articles'][article_id] = {
                    'id': article_id,
                    'section': 'weapons',
                    'group': group_id,
                    'title': weapon['name'],
                    'summary': f"{weapon['ru']} — S-Grade оружие серии Dynasty",
                    'eyebrow': f"{weapon['grade']}-Grade Weapon",
                    'meta': [
                        {'label': 'Физ. Атака', 'value': str(weapon['patk'])},
                        {'label': 'Маг. Атака', 'value': str(weapon['matk'])},
                        {'label': 'Грейд', 'value': weapon['grade']},
                    ],
                    'intro': [f"{weapon['name']} ({weapon['ru']}) — мощное оружие S-Grade серии Dynasty."],
                    'related': [],
                    'order': 100,
                    'layout': 'article',
                    'source': 'dynasty-addition',
                    'blocks': [],
                    'heroImage': weapon['icon'],
                    'icon': weapon['icon'],
                }
            
            # Add to group entries if not present
            if article_id not in group['entries']:
                group['entries'].append(article_id)
                print(f"Added {weapon['name']} to {group_id}")
    
    # Save updated database
    data['updatedAt'] = '2026-04-26T00:00:00.000Z'
    
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nDatabase updated: {len(DYNASTY_WEAPONS)} weapon categories processed")

if __name__ == '__main__':
    main()
