$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceRoot = Join-Path $workspaceRoot 'reference\real-products'
$targetRoot = Join-Path $workspaceRoot 'public\products\real'
$targetWidth = 1200
$targetHeight = 1500

$products = @(
  @{
    Source = 'Screenshot 2026-08-17 045722.png'
    Slug = 'floral-drop-necklace'
    Views = @(
      @{ Name = 'hero.jpg'; X = 4; Y = 34; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 25; Y = 173; Width = 285; Height = 260 },
      @{ Name = 'editorial.jpg'; X = 31; Y = 108; Width = 275; Height = 323; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 045854.png'
    Slug = 'two-row-statement-ring'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 34; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 72; Y = 112; Width = 205; Height = 256 },
      @{ Name = 'editorial.jpg'; X = 44; Y = 80; Width = 250; Height = 313; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050321.png'
    Slug = 'pearl-floral-ear-climber'
    Views = @(
      @{ Name = 'hero.jpg'; X = 4; Y = 35; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 27; Y = 88; Width = 245; Height = 306 },
      @{ Name = 'editorial.jpg'; X = 16; Y = 65; Width = 270; Height = 338; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 045927.png'
    Slug = 'multicolour-oval-bracelet'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 43; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 54; Y = 190; Width = 230; Height = 238 },
      @{ Name = 'editorial.jpg'; X = 34; Y = 145; Width = 265; Height = 280; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 045959.png'
    Slug = 'oval-marquise-bracelet'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 36; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 77; Y = 155; Width = 215; Height = 269 },
      @{ Name = 'editorial.jpg'; X = 48; Y = 115; Width = 260; Height = 313; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050015.png'
    Slug = 'heritage-jhumka-earrings'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 38; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 14; Y = 48; Width = 300; Height = 350 },
      @{ Name = 'editorial.jpg'; X = 17; Y = 52; Width = 295; Height = 356; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050030.png'
    Slug = 'pear-drop-statement-necklace'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 35; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 18; Y = 125; Width = 300; Height = 300 },
      @{ Name = 'editorial.jpg'; X = 17; Y = 100; Width = 300; Height = 333; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050053.png'
    Slug = 'solitaire-fan-earring'
    Views = @(
      @{ Name = 'hero.jpg'; X = 54; Y = 78; Width = 235; Height = 294 },
      @{ Name = 'detail-01.jpg'; X = 92; Y = 112; Width = 190; Height = 238 },
      @{ Name = 'editorial.jpg'; X = 68; Y = 88; Width = 215; Height = 269; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050135.png'
    Slug = 'cascading-chandelier-earring'
    Views = @(
      @{ Name = 'hero.jpg'; X = 5; Y = 37; Width = 310; Height = 388 },
      @{ Name = 'detail-01.jpg'; X = 70; Y = 67; Width = 210; Height = 330 },
      @{ Name = 'editorial.jpg'; X = 48; Y = 55; Width = 250; Height = 350; Inset = $true }
    )
  },
  @{
    Source = 'Screenshot 2026-08-17 050235.png'
    Slug = 'toggle-pendant-necklace'
    Views = @(
      @{ Name = 'hero.jpg'; X = 29; Y = 35; Width = 280; Height = 350 },
      @{ Name = 'detail-01.jpg'; X = 67; Y = 155; Width = 210; Height = 263 },
      @{ Name = 'editorial.jpg'; X = 45; Y = 78; Width = 250; Height = 330; Inset = $true }
    )
  }
)

function Get-NormalizedCrop {
  param(
    [System.Drawing.Image] $Image,
    [hashtable] $View
  )

  $x = [double]$View.X
  $y = [double]$View.Y
  $width = [double]$View.Width
  $height = [double]$View.Height
  $targetRatio = $targetWidth / $targetHeight
  $currentRatio = $width / $height

  if ($currentRatio -gt $targetRatio) {
    $newWidth = $height * $targetRatio
    $x += ($width - $newWidth) / 2
    $width = $newWidth
  }
  else {
    $newHeight = $width / $targetRatio
    $y += ($height - $newHeight) / 2
    $height = $newHeight
  }

  $x = [Math]::Max(0, [Math]::Min($x, $Image.Width - 1))
  $y = [Math]::Max(0, [Math]::Min($y, $Image.Height - 1))
  $width = [Math]::Min($width, $Image.Width - $x)
  $height = [Math]::Min($height, $Image.Height - $y)

  return New-Object System.Drawing.RectangleF(
    [single]$x,
    [single]$y,
    [single]$width,
    [single]$height
  )
}

function Save-Jpeg {
  param(
    [System.Drawing.Bitmap] $Bitmap,
    [string] $Path
  )

  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } |
    Select-Object -First 1
  $qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
  $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    $qualityEncoder,
    [long]92
  )

  try {
    $Bitmap.Save($Path, $jpegCodec, $encoderParameters)
  }
  finally {
    $encoderParameters.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

foreach ($product in $products) {
  $sourcePath = Join-Path $sourceRoot $product.Source
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing real-product source: $sourcePath"
  }

  $productDirectory = Join-Path $targetRoot $product.Slug
  New-Item -ItemType Directory -Force -Path $productDirectory | Out-Null
  $sourceImage = [System.Drawing.Bitmap]::FromFile($sourcePath)

  try {
    foreach ($view in $product.Views) {
      $canvas = New-Object System.Drawing.Bitmap(
        $targetWidth,
        $targetHeight,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
      )

      try {
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([System.Drawing.Color]::FromArgb(246, 240, 235))
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

          $sourceRectangle = Get-NormalizedCrop -Image $sourceImage -View $view
          if ($view.Inset) {
            $destinationRectangle = New-Object System.Drawing.RectangleF(
              [single]90,
              [single]112,
              [single]1020,
              [single]1275
            )
          }
          else {
            $destinationRectangle = New-Object System.Drawing.RectangleF(
              [single]0,
              [single]0,
              [single]$targetWidth,
              [single]$targetHeight
            )
          }

          $graphics.DrawImage(
            $sourceImage,
            $destinationRectangle,
            $sourceRectangle,
            [System.Drawing.GraphicsUnit]::Pixel
          )
        }
        finally {
          $graphics.Dispose()
        }

        Save-Jpeg -Bitmap $canvas -Path (Join-Path $productDirectory $view.Name)
      }
      finally {
        $canvas.Dispose()
      }
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}

Write-Output "Prepared $($products.Count) faithful real-product galleries in $targetRoot"
