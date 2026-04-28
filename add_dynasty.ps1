$jsonPath = 'data/canonical/l2wiki-canonical.json'
Write-Host "Loading JSON..."
$json = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
Write-Host "Articles before: $($json.articles.Count)"

$dynastyWeapons = @(
    @{id='weapon-dynasty-blade'; name='Dynasty Blade'; ru='Клинок Династии'; group='swords'; patk=405; matk=161; icon='https://l2central.info/classic/img/items/weapon_dynasty_blade_i00.png'},
    @{id='weapon-dynasty-knife'; name='Dynasty Knife'; ru='Нож Династии'; group='daggers'; patk=405; matk=161; icon='https://l2central.info/classic/img/items/weapon_dynasty_knife_i00.png'},
    @{id='weapon-dynasty-bow'; name='Dynasty Bow'; ru='Лук Династии'; group='bows'; patk=723; matk=161; icon='https://l2central.info/classic/img/items/weapon_dynasty_bow_i00.png'}
)

$added = 0
foreach ($item in $dynastyWeapons) {
    if ($json.articles.ContainsKey($item.id)) {
        Write-Host "Skipping $($item.id) - already exists"
        continue
    }
    
    $article = @{
        id = $item.id
        section = 'weapons'
        group = $item.group
        title = $item.name
        summary = "$($item.ru) — S-Grade оружие серии Dynasty"
        eyebrow = 'S-Grade Weapon'
        meta = @(
            @{label='Физ. Атака'; value=$item.patk.ToString()}
            @{label='Маг. Атака'; value=$item.matk.ToString()}
            @{label='Грейд'; value='S'}
        )
        intro = @("$($item.name) ($($item.ru)) — мощное оружие S-Grade серии Dynasty.")
        related = @()
        order = 100
        layout = 'article'
        source = 'dynasty'
        icon = $item.icon
        heroImage = $item.icon
        blocks = @()
    }
    
    $json.articles[$item.id] = $article
    
    # Add to group
    foreach ($g in $json.sections.weapons.groups) {
        if ($g.id -eq $item.group) {
            if ($g.entries -notcontains $item.id) {
                $g.entries += $item.id
            }
        }
    }
    
    $added++
    Write-Host "Added: $($item.name)"
}

Write-Host "Added $added Dynasty weapons"
Write-Host "Articles after: $($json.articles.Count)"

Write-Host "Saving..."
$json | ConvertTo-Json -Depth 10 | Set-Content $jsonPath -Encoding UTF8
Write-Host "Done!"
