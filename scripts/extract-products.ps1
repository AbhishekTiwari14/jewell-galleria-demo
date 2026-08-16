$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$catalogueRoot = Join-Path $workspaceRoot 'reference\catalogue'
$productRoot = Join-Path $workspaceRoot 'public\products'
$brandRoot = Join-Path $workspaceRoot 'public\brand'

$crops = @(
  @{ Source = 'Screenshot 2026-08-13 065518.png'; Slug = 'lime-shells-corset-kurti'; X = 50; Y = 63; Width = 320; Height = 393 },
  @{ Source = 'Screenshot 2026-08-13 065551.png'; Slug = 'green-heart-corset-kurti'; X = 41; Y = 59; Width = 320; Height = 399 },
  @{ Source = 'Screenshot 2026-08-13 065711.png'; Slug = 'purple-shell-kurti'; X = 49; Y = 63; Width = 320; Height = 398 },
  @{ Source = 'Screenshot 2026-08-13 065741.png'; Slug = 'beige-off-shoulder-one-piece'; X = 49; Y = 58; Width = 320; Height = 399 },
  @{ Source = 'Screenshot 2026-08-13 065802.png'; Slug = 'white-one-shoulder-piece'; X = 48; Y = 65; Width = 320; Height = 400 },
  @{ Source = 'Screenshot 2026-08-13 065825.png'; Slug = 'brown-off-shoulder-dress'; X = 44; Y = 60; Width = 320; Height = 397 },
  @{ Source = 'Screenshot 2026-08-13 065851.png'; Slug = 'catalogue-item-065851'; X = 26; Y = 42; Width = 584; Height = 465 },
  @{ Source = 'Screenshot 2026-08-13 065916.png'; Slug = 'lace-trimmed-top'; X = 87; Y = 58; Width = 257; Height = 388 },
  @{ Source = 'Screenshot 2026-08-13 065953.png'; Slug = 'waist-coat'; X = 69; Y = 58; Width = 275; Height = 389 },
  @{ Source = 'Screenshot 2026-08-13 070014.png'; Slug = 'brown-ombre-top'; X = 46; Y = 63; Width = 320; Height = 400 },
  @{ Source = 'Screenshot 2026-08-13 070038.png'; Slug = 'red-ombre-top'; X = 39; Y = 65; Width = 291; Height = 389 }
)

New-Item -ItemType Directory -Force -Path $productRoot, $brandRoot | Out-Null

foreach ($crop in $crops) {
  $sourcePath = Join-Path $catalogueRoot $crop.Source
  $targetDirectory = Join-Path $productRoot $crop.Slug
  $targetPath = Join-Path $targetDirectory 'primary.png'

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing catalogue source: $sourcePath"
  }

  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null

  $sourceImage = [System.Drawing.Bitmap]::FromFile($sourcePath)

  try {
    $rectangle = New-Object System.Drawing.Rectangle(
      $crop.X,
      $crop.Y,
      $crop.Width,
      $crop.Height
    )

    if (
      $rectangle.Left -lt 0 -or
      $rectangle.Top -lt 0 -or
      $rectangle.Right -gt $sourceImage.Width -or
      $rectangle.Bottom -gt $sourceImage.Height
    ) {
      throw "Crop rectangle exceeds source bounds: $($crop.Source)"
    }

    $croppedImage = $sourceImage.Clone(
      $rectangle,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    try {
      $croppedImage.Save(
        $targetPath,
        [System.Drawing.Imaging.ImageFormat]::Png
      )
    }
    finally {
      $croppedImage.Dispose()
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}

$logoSource = Join-Path $workspaceRoot 'reference\logo\720495539_18132893431505122_1423123597357766146_n.jpg'
$logoTarget = Join-Path $brandRoot 'ovia-logo.jpg'
Copy-Item -LiteralPath $logoSource -Destination $logoTarget -Force

Write-Output "Created $($crops.Count) product crops and copied the authoritative logo."
