import json

with open('data/canonical/l2wiki-canonical.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Before: {len(data['articles'])} articles")

# Add Dynasty Sword
article = {
    'id': 'weapon-dynasty-sword',
    'section': 'weapons',
    'group': 'swords',
    'title': 'Dynasty Sword',
    'summary': 'Меч Династии — S-Grade оружие серии Dynasty',
    'eyebrow': 'S-Grade Weapon',
    'meta': [
        {'label': 'Физ. Атака', 'value': '405'},
        {'label': 'Маг. Атака', 'value': '161'},
        {'label': 'Грейд', 'value': 'S'},
    ],
    'intro': ['Меч Династии (Dynasty Sword) — мощное оружие S-Grade серии Dynasty.'],
    'related': [],
    'order': 100,
    'layout': 'article',
    'source': 'dynasty',
    'icon': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png',
    'heroImage': 'https://l2central.info/classic/img/items/weapon_dynasty_sword_i00.png',
    'blocks': []
}

data['articles']['weapon-dynasty-sword'] = article

# Add to swords group
weapons = data['sections']['weapons']
for g in weapons['groups']:
    if g['id'] == 'swords':
        if 'weapon-dynasty-sword' not in g['entries']:
            g['entries'].append('weapon-dynasty-sword')
            print('Added to swords group')

print(f"After: {len(data['articles'])} articles")

with open('data/canonical/l2wiki-canonical.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Saved!')
