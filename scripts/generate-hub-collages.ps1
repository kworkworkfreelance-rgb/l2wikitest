Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root 'assets\img\generated'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Get-SourceImage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source
    )

    if ([string]::IsNullOrWhiteSpace($Source)) {
        return $null
    }

    $bytes = $null

    if ($Source -match '^https?://') {
        $client = New-Object System.Net.WebClient
        try {
            $bytes = $client.DownloadData($Source)
        } finally {
            $client.Dispose()
        }
    } else {
        $localPath = if ([System.IO.Path]::IsPathRooted($Source)) { $Source } else { Join-Path $root $Source.TrimStart('/').Replace('/', '\') }

        if (-not (Test-Path -LiteralPath $localPath)) {
            return $null
        }

        $bytes = [System.IO.File]::ReadAllBytes($localPath)
    }

    $stream = New-Object System.IO.MemoryStream(,$bytes)
    $image = [System.Drawing.Image]::FromStream($stream)

    try {
        return New-Object System.Drawing.Bitmap $image
    } finally {
        $image.Dispose()
        $stream.Dispose()
    }
}

function Draw-ContainImage {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Graphics]$Graphics,
        [Parameter(Mandatory = $true)]
        [System.Drawing.Image]$Image,
        [Parameter(Mandatory = $true)]
        [System.Drawing.RectangleF]$Rect
    )

    $ratio = [Math]::Min($Rect.Width / $Image.Width, $Rect.Height / $Image.Height)
    $width = $Image.Width * $ratio
    $height = $Image.Height * $ratio
    $x = $Rect.X + (($Rect.Width - $width) / 2)
    $y = $Rect.Y + (($Rect.Height - $height) / 2)

    $Graphics.DrawImage($Image, $x, $y, $width, $height)
}

function New-HubCollage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$OutputName,
        [Parameter(Mandatory = $true)]
        [string[]]$Sources,
        [Parameter(Mandatory = $true)]
        [string]$AccentHex
    )

    $width = 1200
    $height = 630
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(11, 18, 35))

    $accent = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)
    $gradientRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $gradientRect,
        [System.Drawing.Color]::FromArgb(18, 28, 48),
        [System.Drawing.Color]::FromArgb($accent.R, $accent.G, $accent.B),
        35.0
    )
    $graphics.FillRectangle($gradient, $gradientRect)

    $overlayBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 7, 12, 24))
    $graphics.FillRectangle($overlayBrush, 0, 0, $width, $height)

    $tiles = @(
        [System.Drawing.RectangleF]::new(70, 70, 270, 210),
        [System.Drawing.RectangleF]::new(360, 40, 320, 250),
        [System.Drawing.RectangleF]::new(710, 70, 210, 210),
        [System.Drawing.RectangleF]::new(950, 55, 180, 235),
        [System.Drawing.RectangleF]::new(120, 330, 250, 210),
        [System.Drawing.RectangleF]::new(420, 340, 300, 200),
        [System.Drawing.RectangleF]::new(760, 320, 320, 220)
    )

    $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
    $framePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 2)
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 0, 0, 0))

    for ($i = 0; $i -lt [Math]::Min($tiles.Count, $Sources.Count); $i++) {
        $image = Get-SourceImage -Source $Sources[$i]
        if ($null -eq $image) {
            continue
        }

        try {
            $tile = $tiles[$i]
            $shadowRect = [System.Drawing.RectangleF]::new($tile.X + 8, $tile.Y + 10, $tile.Width, $tile.Height)
            $graphics.FillRectangle($shadowBrush, $shadowRect)
            $graphics.FillRectangle($cardBrush, $tile)
            $graphics.DrawRectangle($framePen, $tile.X, $tile.Y, $tile.Width, $tile.Height)

            $inner = [System.Drawing.RectangleF]::new($tile.X + 16, $tile.Y + 16, $tile.Width - 32, $tile.Height - 32)
            Draw-ContainImage -Graphics $graphics -Image $image -Rect $inner
        } finally {
            $image.Dispose()
        }
    }

    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 255, 255, 255), 3)
    $graphics.DrawLine($linePen, 70, 575, 1130, 575)

    $outputPath = Join-Path $outputDir $OutputName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $gradient.Dispose()
    $overlayBrush.Dispose()
    $cardBrush.Dispose()
    $framePen.Dispose()
    $shadowBrush.Dispose()
    $linePen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Output $outputPath
}

$generated = @()
$generated += New-HubCollage -OutputName 'hub-items-weapons-collage.png' -AccentHex '#1d4ed8' -Sources @(
    'https://l2int.ru/images/armor_weapon/weapon/NG/sword/Short_Sword.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/D/sword/Saber.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/NG/bow/Baguette_s_Bow.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/NG/rapier/Baguette_s_Rapier.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/NG/club/Baguette_s_Mace.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/NG/book/buffalo_horn.jpg',
    'https://l2int.ru/images/armor_weapon/weapon/NG/pole/Baguette_s_Spear.jpg'
)
$generated += New-HubCollage -OutputName 'hub-items-armor-collage.png' -AccentHex '#0f766e' -Sources @(
    'https://l2int.ru/images/armor_weapon/armor/NG/heavy/Piece_Bone_Breastplate.jpg',
    'https://l2int.ru/images/armor_weapon/armor/B/heavy/up/Avadon_Breastplate.jpg',
    'https://l2int.ru/images/armor_weapon/armor/NG/robe/tunic/Apprentice_s_Tunic.jpg',
    'https://l2int.ru/images/armor_weapon/armor/C/light/Theca_Leather_Armor.jpg',
    'https://l2int.ru/images/armor_weapon/armor/NG/boots/Apprentices_Shoes.jpg',
    'https://l2int.ru/images/armor_weapon/armor/NG/gloves/Short_Gloves.jpg',
    'https://l2int.ru/images/armor_weapon/armor/NG/Cloth_Cap.jpg'
)
$generated += New-HubCollage -OutputName 'hub-items-accessories-collage.png' -AccentHex '#7c3aed' -Sources @(
    'https://l2int.ru/images/jewellery/ring/ng/Magic_Ring.jpg',
    'https://l2int.ru/images/jewellery/ring/c/Aquastone_Ring.jpg',
    'https://l2int.ru/images/jewellery/earring/ng/Apprentices_Earring.jpg',
    'https://l2int.ru/images/jewellery/earring/c/Moonstone_Earring.jpg',
    'https://l2int.ru/images/jewellery/necklace/ng/Magic_Necklace.jpg',
    'https://l2int.ru/images/jewellery/necklace/c/Aquastone_Necklace.jpg'
)

$generated | ForEach-Object { Write-Output "generated: $_" }
