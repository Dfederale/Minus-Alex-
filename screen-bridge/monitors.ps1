$code = 'using System;using System.Runtime.InteropServices;public static class DinsDpi{[DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);}'
Add-Type -TypeDefinition $code -ErrorAction Stop
[void][DinsDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))

Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop

$items = @(
    [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
        [ordered]@{
            name    = $_.DeviceName
            left    = $_.Bounds.Left
            top     = $_.Bounds.Top
            width   = $_.Bounds.Width
            height  = $_.Bounds.Height
            primary = $_.Primary
        }
    }
)

@{ monitors = $items } | ConvertTo-Json -Depth 4 -Compress
