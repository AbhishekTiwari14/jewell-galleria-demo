$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetRoot = Join-Path $workspaceRoot 'public\products\demo'
$targetWidth = 1200
$targetHeight = 1500

$products = @(
  @{
    Slug = 'wave-station-ring'
    Views = @(
      @{ Name = 'hero.jpg'; X = 0; Y = 1; Width = 1122; Height = 1400 },
      @{ Name = 'detail-01.jpg'; X = 165; Y = 430; Width = 790; Height = 760 },
      @{ Name = 'detail-02.jpg'; X = 275; Y = 545; Width = 570; Height = 520 },
      @{ Name = 'editorial.jpg'; X = 92; Y = 300; Width = 938; Height = 970; Inset = $true }
    )
  },
  @{
    Slug = 'asymmetric-stone-huggies'
    Views = @(
      @{ Name = 'hero.jpg'; X = 0; Y = 1; Width = 1122; Height = 1400 },
      @{ Name = 'detail-01.jpg'; X = 125; Y = 360; Width = 870; Height = 800 },
      @{ Name = 'detail-02.jpg'; X = 205; Y = 440; Width = 425; Height = 540 },
      @{ Name = 'editorial.jpg'; X = 75; Y = 260; Width = 972; Height = 1040; Inset = $true }
    )
  },
  @{
    Slug = 'seven-station-anklet'
    Views = @(
      @{ Name = 'hero.jpg'; X = 0; Y = 1; Width = 1122; Height = 1400 },
      @{ Name = 'detail-01.jpg'; X = 95; Y = 245; Width = 930; Height = 1050 },
      @{ Name = 'detail-02.jpg'; X = 310; Y = 770; Width = 510; Height = 480 },
      @{ Name = 'editorial.jpg'; X = 55; Y = 175; Width = 1012; Height = 1160; Inset = $true }
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
  $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality,
    [long]92
  )

  try {
    $Bitmap.Save($Path, $jpegCodec, $encoderParameters)
  }
  finally {
    $encoderParameters.Dispose()
  }
}

foreach ($product in $products) {
  $productDirectory = Join-Path $targetRoot $product.Slug
  $sourcePath = Join-Path $productDirectory '_source.png'
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing generated demo source: $sourcePath"
  }

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

Write-Output "Prepared $($products.Count) fictional demo-product galleries in $targetRoot"
