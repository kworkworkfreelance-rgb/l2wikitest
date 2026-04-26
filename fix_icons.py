#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix duplicate icons across all items"""

import json
import re

# Dynasty weapon icons from l2central.info (each weapon has unique icon)
DYNASTY_WEAPON_ICONS = {
    'weapon-dynasty-sword': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png',
    'weapon-dynasty-blade': 'https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png',
    'weapon-dynasty-knife': 'https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png',
    'weapon-dynasty-dual-daggers': 'https://l2central.info/classic/img/items/weapon_dual_daggers_dynasty_i00.png',
    'weapon-dynasty-bow': 'https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png',
    'weapon-dynasty-crossbow': 'https://l2central.info/classic/img/items/weapon_dynasty_crossbow_i00.png',
    'weapon-dynasty-great-sword': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_sword_i00.png',
    'weapon-dynasty-staff': 'https://l2central.info/classic/img/items/weapon_dynasty_staff_i00.png',
    'weapon-dynasty-mace': 'https://l2central.info/classic/img/items/weapon_dynasty_mace_i00.png',
    'weapon-dynasty-dual-swords': 'https://l2central.info/classic/img/items/weapon_dynasty_dual_sword_i00.png',
    'weapon-dynasty-two-handed-staff': 'https://l2central.info/classic/img/items/weapon_dynasty_two_hand_staff_i00.png',
    'weapon-dynasty-fist': 'https://l2central.info/classic/img/items/weapon_dynasty_fist_i00.png',
    'weapon-dynasty-pike': 'https://l2central.info/classic/img/items/weapon_dynasty_pike_i00.png',
    'weapon-dynasty-rapier': 'https://l2central.info/classic/img/items/weapon_dynasty_rapier_i00.png',
    'weapon-dynasty-magic-book': 'https://l2central.info/classic/img/items/weapon_dynasty_magic_book_i00.png',
}

# Dynasty armor icons
DYNASTY_ARMOR_ICONS = {
    'armor-dynasty-breastplate': 'https://l2central.info/classic/img/items/armor_dynasty_breastplate_i00.png',
    'armor-dynasty-gaiters': 'https://l2central.info/classic/img/items/armor_dynasty_gaiters_i00.png',
    'armor-dynasty-gauntlets': 'https://l2central.info/classic/img/items/armor_dynasty_gauntlets_i00.png',
    'armor-dynasty-boots': 'https://l2central.info/classic/img/items/armor_dynasty_boots_i00.png',
    'armor-dynasty-helmet': 'https://l2central.info/classic/img/items/armor_dynasty_helmet_i00.png',
    'armor-dynasty-leather-armor': 'https://l2central.info/classic/img/items/armor_dynasty_leather_vest_i00.png',
    'armor-dynasty-leather-leggings': 'https://l2central.info/classic/img/items/armor_dynasty_leather_leggings_i00.png',
    'armor-dynasty-leather-gloves': 'https://l2central.info/classic/img/items/armor_dynasty_leather_gloves_i00.png',
    'armor-dynasty-leather-boots': 'https://l2central.info/classic/img/items/armor_dynasty_leather_boots_i00.png',
    'armor-dynasty-tunic': 'https://l2central.info/classic/img/items/armor_dynasty_tunic_i00.png',
    'armor-dynasty-hose': 'https://l2central.info/classic/img/items/armor_dynasty_hose_i00.png',
    'armor-dynasty-gloves': 'https://l2central.info/classic/img/items/armor_dynasty_gloves_i00.png',
    'armor-dynasty-shoes': 'https://l2central.info/classic/img/items/armor_dynasty_shoes_i00.png',
    'armor-dynasty-shield': 'https://l2central.info/classic/img/items/armor_dynasty_shield_i00.png',
    'armor-dynasty-sigil': 'https://l2central.info/classic/img/items/armor_dynasty_sigil_i00.png',
}

# Dynasty jewelry icons
DYNASTY_JEWELRY_ICONS = {
    'jewelry-dynasty-necklace': 'https://l2central.info/classic/img/items/accessary_dynasty_necklace_i00.png',
    'jewelry-dynasty-earring': 'https://l2central.info/classic/img/items/accessary_dynasty_earring_i00.png',
    'jewelry-dynasty-ring': 'https://l2central.info/classic/img/items/accessary_dynasty_ring_i00.png',
}

def main():
    db_path = 'data/canonical/l2wiki-canonical.json'
    
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    fixed = 0
    
    # Fix Dynasty weapons
    for article_id, icon_url in DYNASTY_WEAPON_ICONS.items():
        if article_id in data['articles']:
            old_icon = data['articles'][article_id].get('icon', '')
            if old_icon != icon_url:
                data['articles'][article_id]['icon'] = icon_url
                data['articles'][article_id]['heroImage'] = icon_url
                fixed += 1
                print(f'Fixed: {article_id}')
    
    # Fix Dynasty armor
    for article_id, icon_url in DYNASTY_ARMOR_ICONS.items():
        if article_id in data['articles']:
            old_icon = data['articles'][article_id].get('icon', '')
            if old_icon != icon_url:
                data['articles'][article_id]['icon'] = icon_url
                data['articles'][article_id]['heroImage'] = icon_url
                fixed += 1
                print(f'Fixed: {article_id}')
    
    # Fix Dynasty jewelry
    for article_id, icon_url in DYNASTY_JEWELRY_ICONS.items():
        if article_id in data['articles']:
            old_icon = data['articles'][article_id].get('icon', '')
            if old_icon != icon_url:
                data['articles'][article_id]['icon'] = icon_url
                data['articles'][article_id]['heroImage'] = icon_url
                fixed += 1
                print(f'Fixed: {article_id}')
    
    # Save
    data['updatedAt'] = '2026-04-26T14:00:00.000Z'
    
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f'\nTotal fixed: {fixed} items')

if __name__ == '__main__':
    main()
