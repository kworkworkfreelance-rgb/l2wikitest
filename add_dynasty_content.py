#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add full content for Dynasty weapons with tables and images"""

import json

# Dynasty weapon data with stats
DYNASTY_WEAPONS = [
    {'id': 'weapon-dynasty-sword', 'name': 'Dynasty Sword', 'ru': 'Меч Династии', 'group': 'swords', 'patk': 405, 'matk': 161, 'weight': 1520, 'sps': 3972, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Меч', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png'},
    {'id': 'weapon-dynasty-blade', 'name': 'Dynasty Blade', 'ru': 'Клинок Династии', 'group': 'swords', 'patk': 405, 'matk': 161, 'weight': 1520, 'sps': 3972, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Клинок', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png'},
    {'id': 'weapon-dynasty-knife', 'name': 'Dynasty Knife', 'ru': 'Нож Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'weight': 1340, 'sps': 3972, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Кинжал', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png'},
    {'id': 'weapon-dynasty-dual-daggers', 'name': 'Dynasty Dual Daggers', 'ru': 'Парные Кинжалы Династии', 'group': 'daggers', 'patk': 405, 'matk': 161, 'weight': 2050, 'sps': 3972, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Кинжал', 'icon': 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png'},
    {'id': 'weapon-dynasty-bow', 'name': 'Dynasty Bow', 'ru': 'Лук Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'weight': 1740, 'sps': 4824, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Лук', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png'},
    {'id': 'weapon-dynasty-crossbow', 'name': 'Dynasty Crossbow', 'ru': 'Арбалет Династии', 'group': 'bows', 'patk': 723, 'matk': 161, 'weight': 1700, 'sps': 4824, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Арбалет', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png'},
    {'id': 'weapon-dynasty-great-sword', 'name': 'Dynasty Great Sword', 'ru': 'Двуручный Меч Династии', 'group': 'two-handed', 'patk': 485, 'matk': 161, 'weight': 2120, 'sps': 4776, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Меч', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png'},
    {'id': 'weapon-dynasty-staff', 'name': 'Dynasty Staff', 'ru': 'Посох Династии', 'group': 'blunt', 'patk': 323, 'matk': 244, 'weight': 1620, 'sps': 4776, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Посох', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png'},
    {'id': 'weapon-dynasty-mace', 'name': 'Dynasty Mace', 'ru': 'Булава Династии', 'group': 'blunt', 'patk': 405, 'matk': 161, 'weight': 1740, 'sps': 3972, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Булава', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png'},
    {'id': 'weapon-dynasty-dual-swords', 'name': 'Dynasty Dual Swords', 'ru': 'Парные Мечи Династии', 'group': 'duals', 'patk': 405, 'matk': 161, 'weight': 2210, 'sps': 3972, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Меч', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png'},
    {'id': 'weapon-dynasty-two-handed-staff', 'name': 'Dynasty Two-Handed Staff', 'ru': 'Двуручный Посох Династии', 'group': 'two-handed-blunts', 'patk': 388, 'matk': 292, 'weight': 1620, 'sps': 4776, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Посох', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png'},
    {'id': 'weapon-dynasty-fist', 'name': 'Dynasty Fist', 'ru': 'Кастет Династии', 'group': 'fists', 'patk': 405, 'matk': 161, 'weight': 1400, 'sps': 3972, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Кастет', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png'},
    {'id': 'weapon-dynasty-pike', 'name': 'Dynasty Pike', 'ru': 'Пика Династии', 'group': 'pole', 'patk': 389, 'matk': 161, 'weight': 2100, 'sps': 4776, 'grade': 'S', 'hands': 'Двуручный', 'type': 'Копьё', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png'},
    {'id': 'weapon-dynasty-rapier', 'name': 'Dynasty Rapier', 'ru': 'Рапира Династии', 'group': 'rapier', 'patk': 405, 'matk': 161, 'weight': 1250, 'sps': 3972, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Рапира', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png'},
    {'id': 'weapon-dynasty-magic-book', 'name': 'Dynasty Magic Book', 'ru': 'Магическая Книга Династии', 'group': 'magic-books', 'patk': 242, 'matk': 244, 'weight': 920, 'sps': 4776, 'grade': 'S', 'hands': 'Одноручный', 'type': 'Книга', 'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png'},
]

def create_weapon_row_html(item):
    """Create HTML for weapon table row with image"""
    return f'''<span class="weapon-table__item">
            <img class="wiki-item-thumb" src="{item['icon']}" alt="{item['name']} {item['ru']}" loading="lazy" />
            <span class="wiki-item-link">
                <span class="wiki-item-link__en">{item['name']}</span>
                <span class="wiki-item-link__ru">{item['ru']}</span>
            </span>
        </span>'''

def create_grade_html(grade):
    """Create grade badge HTML"""
    return f'<span class="weapon-grade"><img class="weapon-grade__icon" src="https://l2int.ru/images/all/Rang_{grade}.gif" alt="{grade}-Grade" loading="lazy" /><span>{grade}-Grade</span></span>'

def main():
    db_path = 'data/canonical/l2wiki-canonical.json'
    
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    weapons_section = data['sections']['weapons']
    added = 0
    
    for item in DYNASTY_WEAPONS:
        # Create or update article
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
                    {'label': 'Грейд', 'value': item['grade']},
                ],
                'intro': [
                    f"{item['name']} ({item['ru']}) — мощное оружие S-Grade серии Dynasty.",
                    f"Особенность: Дает возможность получить одно из следующих особых свойств: Фокусировка, Здоровье или Легкость."
                ],
                'related': [],
                'order': 100,
                'layout': 'article',
                'source': 'dynasty',
                'icon': item['icon'],
                'heroImage': item['icon'],
            }
        
        article = data['articles'][item['id']]
        
        # Add table block with weapon stats
        table_block = {
            'id': f"{item['id']}-stats",
            'type': 'table',
            'title': 'Характеристики',
            'columns': [
                {'key': 'name', 'label': 'Название'},
                {'key': 'patk', 'label': 'Ф. Атк.'},
                {'key': 'matk', 'label': 'М. Атк.'},
                {'key': 'grade', 'label': 'Ранг'},
                {'key': 'hands', 'label': 'Тип'},
            ],
            'rows': [
                {
                    'id': f"{item['id']}-row",
                    'cells': [
                        {'html': create_weapon_row_html(item)},
                        {'value': str(item['patk'])},
                        {'value': str(item['matk'])},
                        {'html': create_grade_html(item['grade'])},
                        {'value': f"{item['hands']} {item['type']}"},
                    ]
                }
            ],
            'compact': False
        }
        
        # Add SA info block
        sa_block = {
            'id': f"{item['id']}-sa",
            'type': 'list',
            'title': 'Вставка SA',
            'items': [
                f"{item['name']} [Фокусировка] - Focus",
                f"{item['name']} [Здоровье] - Health",
                f"{item['name']} [Легкость] - Light",
            ]
        }
        
        # Add craft info block
        craft_block = {
            'id': f"{item['id']}-craft",
            'type': 'paragraph',
            'content': f"<strong>Крафт:</strong> Рецепт - {item['name']} (60%) — 1 шт.<br>Требуется: Часть оружия — 18 шт., Самоцвет: Ранг S — 46 шт., Кристалл: Ранг S — 305 шт., Синтетический Кокс — 693 шт., Обломок Оружия — 9144 шт.<br>Шанс успешного крафта: 60%"
        }
        
        # Set blocks
        article['blocks'] = [table_block, sa_block, craft_block]
        
        # Add to group entries
        group = next((g for g in weapons_section['groups'] if g['id'] == item['group']), None)
        if group and item['id'] not in group['entries']:
            group['entries'].append(item['id'])
        
        added += 1
        print(f"Added content: {item['name']}")
    
    # Save
    data['updatedAt'] = '2026-04-27T12:00:00.000Z'
    
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal Dynasty weapons with content: {added}")
    print(f"Total articles in database: {len(data['articles'])}")

if __name__ == '__main__':
    main()
