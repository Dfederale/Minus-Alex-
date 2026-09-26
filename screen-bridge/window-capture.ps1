param(
  [Parameter(Mandatory=$true)][int]$Left,
  [Parameter(Mandatory=$true)][int]$Top,
  [Parameter(Mandatory=$true)][int]$Width,
  [Parameter(Mandatory=$true)][int]$Height
)

$ErrorActionPreference = "Stop"
if ($Width -le 0 -or $Height -le 0) { throw "invalid capture size" }

Add-Type -AssemblyName System.Drawing


$bmp = New-Object System.Drawing.Bitmap($Width, $Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$stream = New-Object System.IO.MemoryStream

try {
  $graphics.CopyFromScreen($Left, $Top, 0, 0, $bmp.Size)
  $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  [Convert]::ToBase64String($stream.ToArray())
}
finally {
  $graphics.Dispose()
  $bmp.Dispose()
  $stream.Dispose()
}