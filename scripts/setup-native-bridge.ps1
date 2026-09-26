$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$server = Join-Path $projectRoot "screen-bridge\server.mjs"

if (-not (Test-Path -LiteralPath $server)) {
    throw "Screen Bridge server not found: $server"
}

$action = New-ScheduledTaskAction `
    -Execute $node `
    -Argument ('"' + $server + '"') `
    -WorkingDirectory $projectRoot

$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal `
    -UserId $user `
    -LogonType Interactive `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName "DINS REFLEX Screen Bridge" `
    -Action $action `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Write-Host "[OK] Registered DINS REFLEX Screen Bridge as an elevated on-demand task."
