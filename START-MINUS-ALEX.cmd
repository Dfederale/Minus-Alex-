@echo off
setlocal EnableExtensions
title Minus Alex - One Click Starter
cd /d "%~dp0"
set "ROOT=%CD%"
set "UI=http://127.0.0.1:4174/"
set "BRIDGE=http://127.0.0.1:8790/health"
set "MCP=http://127.0.0.1:8787/mcp"
echo.
echo ========================================
echo     MINUS ALEX - ONE CLICK STARTER
echo ========================================
echo [PATH] "%ROOT%"
echo.

rem Find Node even if the Windows PATH has not refreshed yet.
call :find_node
if not defined NODE_EXE (
  echo [MISSING] Node.js / npm.
  where winget >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Windows Package Manager is unavailable.
    echo Install Node.js LTS from https://nodejs.org/en/download
    goto :fail
  )
  choice /C YN /N /M "Install Node.js LTS with winget now? [Y/N] "
  if errorlevel 2 goto :fail
  winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo [ERROR] Node.js installation did not finish successfully.
    goto :fail
  )
  call :find_node
  if not defined NODE_EXE (
    echo [INFO] Node.js installed, but Windows has not refreshed PATH.
    echo Close this window and run the starter again.
    goto :fail
  )
)
echo [OK] Node.js: "%NODE_EXE%"
echo [OK] npm: "%NPM_EXE%"

if not exist "package.json" (
  echo [ERROR] package.json missing. Put this starter in the repository root.
  goto :fail
)
if not exist "amazon-mcp\server.mjs" (
  echo [ERROR] amazon-mcp\server.mjs missing.
  goto :fail
)
if not exist "screen-bridge\server.mjs" (
  echo [ERROR] screen-bridge\server.mjs missing.
  goto :fail
)

rem Inspect known ports, but never kill unrelated processes.
rem Reuse a healthy UI / bridge and any existing MCP listener.
rem For a nonresponsive UI or bridge, clean only a Node process
rem whose command line explicitly includes this project path.
for %%P in (4174 8790) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$port=%%P; $root=$env:ROOT; $url=if($port -eq 4174){'http://127.0.0.1:4174/'}else{'http://127.0.0.1:8790/health'}; $healthy=$false; try{$r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; $healthy=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)}catch{}; if($healthy){Write-Host ('[OK] Existing service on '+$port);exit 0}; $owners=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach($o in $owners){$id=$o.OwningProcess;$proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction SilentlyContinue; if(-not $proc){continue};$cmd=[string]$proc.CommandLine;if($proc.Name -match '^(node|node\.exe)$' -and $cmd.Contains($root)){Write-Host ('[CLEAN] Unresponsive project Node PID '+$id+' on '+$port);Stop-Process -Id $id -Force -ErrorAction SilentlyContinue}else{Write-Host ('[INFO] Unrelated PID '+$id+' on '+$port+' left untouched')}}"
)

rem Install project packages only when absent. npm ci uses the lockfile.
if not exist "node_modules\vite\package.json" (
  echo [SETUP] Installing project dependencies...
  if not exist "package-lock.json" (
    echo [ERROR] package-lock.json missing; cannot run npm ci safely.
    goto :fail
  )
  call "%NPM_EXE%" ci
  if errorlevel 1 goto :fail
)
echo [OK] Project dependencies present.

rem Resident: reuse healthy Ollama; clean only a stale project-local Ollama PID.
echo [AI] Checking Ollama on port 11434...
call :health "http://127.0.0.1:11434/api/tags"
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$root=$env:ROOT; $owners=Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue; foreach($o in $owners){$id=$o.OwningProcess; $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction SilentlyContinue; if(-not $proc){continue}; $exe=[string]$proc.ExecutablePath; if($proc.Name -ieq 'ollama.exe' -and $exe.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){Write-Host ('[AI] Clearing stale project Ollama PID '+$id); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue}else{Write-Host ('[AI] Port 11434 belongs to PID '+$id+'; leaving it alone')} }"
  call :port_free 11434
  if errorlevel 1 (
    echo [WARN] Port 11434 is occupied, but Ollama is not responding.
  ) else (
    set "OLLAMA_EXE="
    if exist "%ROOT%\Ollama\App\ollama.exe" set "OLLAMA_EXE=%ROOT%\Ollama\App\ollama.exe"
    if not defined OLLAMA_EXE if exist "%ROOT%\Ollama\ollama.exe" set "OLLAMA_EXE=%ROOT%\Ollama\ollama.exe"
    if not defined OLLAMA_EXE for /f "delims=" %%I in ('where ollama.exe 2^>nul') do if not defined OLLAMA_EXE set "OLLAMA_EXE=%%I"
    if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    if defined OLLAMA_EXE (
      echo [AI] Starting Ollama...
      start "Minus Alex Ollama" /min "%OLLAMA_EXE%" serve
    ) else (
      echo [WARN] Ollama executable not found. Install Ollama to enable the Resident.
    )
  )
)
call :wait "http://127.0.0.1:11434/api/tags" 30
if errorlevel 1 (
  echo [WARN] Ollama is not ready; Minus Alex can still start without AI.
) else (
  echo [AI] Ollama online.
  call :ensure_resident
  if errorlevel 1 (
    echo [WARN] Resident setup failed. Other services will still start.
  ) else (
    echo [AI] Warming qwen2.5:0.5b...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$body=@{model='qwen2.5:0.5b';prompt='';stream=$false;keep_alive='4h'}|ConvertTo-Json -Compress; try{$r=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180; if($r.done -eq $true){Write-Host '[OK] Resident warm and ready.';exit 0}else{Write-Host '[WARN] Unexpected warm-up response.';exit 1}}catch{Write-Host ('[WARN] Resident warm-up failed: '+$_.Exception.Message);exit 1}"
  )
)
call :health "%BRIDGE%"
if errorlevel 1 (
  echo [START] Screen Bridge...
  rem Prefer the existing registered task, if configured.
  schtasks /Query /TN "DINS REFLEX Screen Bridge" >nul 2>&1
  if not errorlevel 1 schtasks /Run /TN "DINS REFLEX Screen Bridge" >nul 2>&1
  call :wait "%BRIDGE%" 8
  if errorlevel 1 (
    call :port_free 8790
    if errorlevel 1 goto :occupied
    start "Minus Alex Screen Bridge" /D "%ROOT%" "%ComSpec%" /k ""%NODE_EXE%" "screen-bridge\server.mjs""
  )
)
call :wait "%BRIDGE%" 25
if errorlevel 1 (
  echo [ERROR] Screen Bridge did not become healthy.
  echo [HINT] Native bridge setup may be required; see INSTALL.md.
  goto :fail
)
echo [OK] Screen Bridge.

rem The MCP server uses 8787 in the published README.
rem Its /mcp endpoint may require POST; check TCP availability instead.
call :port_free 8787
if not errorlevel 1 (
  echo [START] Amazon MCP on 8787...
  start "Minus Alex MCP" /D "%ROOT%" "%ComSpec%" /k ""%NODE_EXE%" "amazon-mcp\server.mjs""
)
call :wait_port 8787 25
if errorlevel 1 (
  echo [ERROR] MCP did not listen on 8787.
  goto :fail
)
echo [OK] MCP port 8787.

call :health "%UI%"
if errorlevel 1 (
  call :port_free 4174
  if errorlevel 1 goto :occupied
  echo [START] Vite UI on 4174...
  start "Minus Alex UI" /D "%ROOT%" "%ComSpec%" /k ""%NPM_EXE%" run dev"
)
call :wait "%UI%" 30
if errorlevel 1 (
  echo [ERROR] UI did not become healthy on 4174.
  goto :fail
)
echo [OK] UI online.

echo.
echo [READY] Minus Alex services are responding.
echo [UI] %UI%
echo [MCP] %MCP%
echo [BRIDGE] %BRIDGE%
start "" "%UI%"
echo.
echo [INFO] Keep the service windows open while using Minus Alex.
exit /b 0

:ensure_resident
rem The app expects this exact model name. Do not replace it with another model.
set "OLLAMA_CLI="
for /f "delims=" %%I in ('where ollama.exe 2^>nul') do if not defined OLLAMA_CLI set "OLLAMA_CLI=%%I"
if not defined OLLAMA_CLI if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_CLI=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined OLLAMA_CLI if exist "%ROOT%\Ollama\App\ollama.exe" set "OLLAMA_CLI=%ROOT%\Ollama\App\ollama.exe"
if not defined OLLAMA_CLI if exist "%ROOT%\Ollama\ollama.exe" set "OLLAMA_CLI=%ROOT%\Ollama\ollama.exe"
if not defined OLLAMA_CLI (
  echo [WARN] Ollama CLI not found.
  exit /b 1
)
"%OLLAMA_CLI%" show qwen2.5:0.5b >nul 2>&1
if not errorlevel 1 (
  echo [OK] Resident model already installed.
  exit /b 0
)
echo [AI] Required Resident qwen2.5:0.5b is missing.
rem Look for a bundled GGUF only inside the project Ollama folder.
set "GGUF_FILE="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$f=Get-ChildItem -LiteralPath $env:ROOT -Filter '*.gguf' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName.StartsWith((Join-Path $env:ROOT 'ollama') + '\',[StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1 -ExpandProperty FullName; if($f){Write-Output $f}"`) do if not defined GGUF_FILE set "GGUF_FILE=%%I"
if defined GGUF_FILE (
  echo [AI] Found local GGUF: "%GGUF_FILE%"
  set "MODELFILE_PATH=%TEMP%\minus-alex-resident-%RANDOM%.Modelfile"
  call :import_resident
  exit /b %errorlevel%
)
echo [AI] No local GGUF found in ollama folder. Downloading qwen2.5:0.5b...
"%OLLAMA_CLI%" pull qwen2.5:0.5b
if errorlevel 1 exit /b 1
"%OLLAMA_CLI%" show qwen2.5:0.5b >nul 2>&1
exit /b %errorlevel%

:import_resident
rem Use a temporary Modelfile so no application source files are modified.
>"%MODELFILE_PATH%" echo FROM "%GGUF_FILE%"
"%OLLAMA_CLI%" create qwen2.5:0.5b -f "%MODELFILE_PATH%"
set "IMPORT_RC=%errorlevel%"
del /q "%MODELFILE_PATH%" >nul 2>&1
if not "%IMPORT_RC%"=="0" exit /b 1
"%OLLAMA_CLI%" show qwen2.5:0.5b >nul 2>&1
exit /b %errorlevel%

:find_node
set "NODE_EXE="
set "NPM_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_EXE set "NPM_EXE=%%I"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  set "NPM_EXE=%ProgramFiles%\nodejs\npm.cmd"
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if not defined NODE_EXE if exist "%APPDATA%\npm\node.exe" (
  set "NODE_EXE=%APPDATA%\npm\node.exe"
  set "NPM_EXE=%APPDATA%\npm\npm.cmd"
  set "PATH=%APPDATA%\npm;%PATH%"
)
if not exist "%NPM_EXE%" set "NODE_EXE="
exit /b 0

:health
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 400){exit 0} else {exit 1} } catch {exit 1}" >nul 2>&1
exit /b %errorlevel%

:port_free
powershell -NoProfile -Command "if(Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue){exit 1}else{exit 0}" >nul 2>&1
exit /b %errorlevel%

:wait
set "WAIT_URL=%~1"
set /a "TRIES=%~2"
for /L %%I in (1,1,%TRIES%) do (
  call :health "%WAIT_URL%"
  if not errorlevel 1 exit /b 0
  timeout /t 1 /nobreak >nul
)
exit /b 1

:wait_port
set "CHECK_PORT=%~1"
set /a "TRIES=%~2"
for /L %%I in (1,1,%TRIES%) do (
  call :port_free %CHECK_PORT%
  if errorlevel 1 exit /b 0
  timeout /t 1 /nobreak >nul
)
exit /b 1

:occupied
echo [ERROR] A required port is occupied by another process.
echo [INFO] Nothing unrelated was terminated.
:fail
echo.
echo [STOP] Setup or startup needs attention. See messages above.
pause
exit /b 1
