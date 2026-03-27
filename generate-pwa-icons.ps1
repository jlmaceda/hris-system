param(
  [string]$publicDir = (Join-Path $PSScriptRoot "public")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $publicDir)) {
  throw "Public directory not found: $publicDir"
}

Add-Type -AssemblyName System.Drawing

function New-IconPng {
  param(
    [int]$size,
    [string]$fileName,
    [string]$text
  )

  $path = Join-Path $publicDir $fileName
  if (Test-Path -Path $path) {
    Remove-Item -Path $path -Force
  }

  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)

  $theme = [System.Drawing.Color]::FromArgb(34, 197, 94)
  $g.Clear($theme)

  $fontSize = [int]([Math]::Max(12, [Math]::Round($size / 3.2)))
  $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $g.DrawString($text, $font, $brush, $rect, $sf)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
}

New-IconPng -size 192 -fileName "icon-192.png" -text "HRIS"
New-IconPng -size 512 -fileName "icon-512.png" -text "HRIS"
New-IconPng -size 180 -fileName "apple-touch-icon.png" -text "HRIS"

Write-Host "Generated: icon-192.png, icon-512.png, apple-touch-icon.png in $publicDir"

