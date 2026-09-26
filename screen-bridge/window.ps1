param(
  [int]$DelayMs = 4000,
  [long]$Hwnd = 0,
  [ValidateSet("query","hide","show")][string]$Action = "query"
)


$dpiCode = 'using System;using System.Runtime.InteropServices;public static class DinsWindowDpi{[DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);}'
Add-Type -TypeDefinition $dpiCode -ErrorAction Stop
[void][DinsWindowDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))

$code = @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class DinsWindow {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hWnd, int dwAttribute, out RECT rect, int cbAttribute);

    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
}
"@

Add-Type -TypeDefinition $code -ErrorAction Stop

if ($Action -eq "hide") {
    if ($Hwnd -eq 0) { throw "Hide requires HWND." }
    [void][DinsWindow]::ShowWindow([IntPtr]$Hwnd, 6)
    @{ok=$true} | ConvertTo-Json -Compress
    exit 0
}

if ($Action -eq "show") {
    if ($Hwnd -eq 0) { throw "Show requires HWND." }
    [void][DinsWindow]::ShowWindow([IntPtr]$Hwnd, 9)
    Start-Sleep -Milliseconds 100
    [void][DinsWindow]::SetForegroundWindow([IntPtr]$Hwnd)
    @{ok=$true} | ConvertTo-Json -Compress
    exit 0
}

if ($Hwnd -ne 0) {
    $h = [IntPtr]$Hwnd
} else {
    Start-Sleep -Milliseconds $DelayMs
    $h = [DinsWindow]::GetForegroundWindow()
}
if ($h -eq [IntPtr]::Zero) { throw "No foreground window." }

$r = New-Object DinsWindow+RECT
if (-not [DinsWindow]::GetWindowRect($h, [ref]$r)) { throw "GetWindowRect failed." }

$vr = New-Object DinsWindow+RECT
$cb = [Runtime.InteropServices.Marshal]::SizeOf([type][DinsWindow+RECT])
if ([DinsWindow]::DwmGetWindowAttribute($h, 9, [ref]$vr, $cb) -eq 0) {
    if (($vr.Right - $vr.Left) -gt 0 -and ($vr.Bottom - $vr.Top) -gt 0) { $r = $vr }
}

$m = [DinsWindow]::MonitorFromWindow($h, 2)
if ($m -eq [IntPtr]::Zero) { throw "MonitorFromWindow failed." }

$mi = New-Object DinsWindow+MONITORINFO
$mi.cbSize = [Runtime.InteropServices.Marshal]::SizeOf([type][DinsWindow+MONITORINFO])
if (-not [DinsWindow]::GetMonitorInfo($m, [ref]$mi)) { throw "GetMonitorInfo failed." }

if ([DinsWindow]::IsZoomed($h)) {
    $r.Left = $mi.rcMonitor.Left
    $r.Top = $mi.rcMonitor.Top
    $r.Right = $mi.rcMonitor.Right
    $r.Bottom = $mi.rcMonitor.Bottom
}

$title = New-Object System.Text.StringBuilder 512
[void][DinsWindow]::GetWindowText($h, $title, 512)

[uint32]$pidValue = 0
[void][DinsWindow]::GetWindowThreadProcessId($h, [ref]$pidValue)

[ordered]@{
    hwnd          = $h.ToInt64()
    pid           = $pidValue
    title         = $title.ToString()
    left          = $r.Left
    top           = $r.Top
    width         = $r.Right - $r.Left
    height        = $r.Bottom - $r.Top
    monitorLeft   = $mi.rcMonitor.Left
    monitorTop    = $mi.rcMonitor.Top
    monitorWidth  = $mi.rcMonitor.Right - $mi.rcMonitor.Left
    monitorHeight = $mi.rcMonitor.Bottom - $mi.rcMonitor.Top
} | ConvertTo-Json -Compress
