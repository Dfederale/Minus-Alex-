param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y
)

$source = @"
using System;
using System.Runtime.InteropServices;
public static class DinsMouse {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

Add-Type -TypeDefinition $source -ErrorAction Stop
if (-not [DinsMouse]::SetCursorPos($X, $Y)) {
  throw "SetCursorPos failed."
}
Start-Sleep -Milliseconds 45
[DinsMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 55
[DinsMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Write-Output "clicked $X,$Y"
