$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class DinsWindowList {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

$items = New-Object System.Collections.Generic.List[object]

$callback = [DinsWindowList+EnumWindowsProc]{
    param([IntPtr]$hWnd, [IntPtr]$lParam)

    if (-not [DinsWindowList]::IsWindowVisible($hWnd)) { return $true }
    if ([DinsWindowList]::IsIconic($hWnd)) { return $true }

    $length = [DinsWindowList]::GetWindowTextLength($hWnd)
    if ($length -le 0) { return $true }

    $text = New-Object System.Text.StringBuilder ($length + 1)
    [void][DinsWindowList]::GetWindowText($hWnd, $text, $text.Capacity)
    $title = $text.ToString().Trim()
    if (-not $title) { return $true }

    $rect = New-Object DinsWindowList+RECT
    if (-not [DinsWindowList]::GetWindowRect($hWnd, [ref]$rect)) { return $true }

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 80 -or $height -lt 60) { return $true }

    $items.Add([pscustomobject][ordered]@{
        hwnd   = [long]$hWnd
        title  = $title
        left   = [int]$rect.Left
        top    = [int]$rect.Top
        width  = [int]$width
        height = [int]$height
    })

    return $true
}

@{
    windows = @($items | Sort-Object title)
} | ConvertTo-Json -Depth 4 -Compress