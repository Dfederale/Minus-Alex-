$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root 'state'
$stateFile = Join-Path $stateDir 'reflex-presence.txt'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$cycleSeconds = 6 * 60 * 60
$last = 0
if (Test-Path -LiteralPath $stateFile) {
    [void][Int64]::TryParse((Get-Content -LiteralPath $stateFile -Raw).Trim(), [ref]$last)
}

if ($last -le 0 -or ($now - $last) -ge $cycleSeconds) {
    Set-Content -LiteralPath $stateFile -Value $now -Encoding ASCII
    Add-Type -AssemblyName System.Speech
    $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voice.Speak('Hello. REFLEX is now operational.')
    $voice.Dispose()
}
