@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title DINS REFLEX Amazon 2026

set "REFLEX_URL=http://127.0.0.1:4174/"
set "SCREEN_BRIDGE_URL=http://127.0.0.1:8790/health"
set "OLLAMA_URL=http://127.0.0.1:11434"
set "OLLAMA_MODEL=qwen2.5:0.5b"
set "OLLAMA_MODELS=%~dp0Ollama\models"
set "OLLAMA_EXE="

if not exist "%OLLAMA_MODELS%" mkdir "%OLLAMA_MODELS%" >nul 2>&1

rem Prefer an Ollama runtime kept INSIDE this project. Fall back to the
rem normal Windows install only until the project-local runtime is added.
if exist "%~dp0Ollama\App\ollama.exe" set "OLLAMA_EXE=%~dp0Ollama\App\ollama.exe"
if not defined OLLAMA_EXE if exist "%~dp0Ollama\ollama.exe" set "OLLAMA_EXE=%~dp0Ollama\ollama.exe"

echo.
echo ================================================
echo   DINS REFLEX Amazon 2026
echo ================================================
echo.

rem ------------------------------------------------
rem Resident warm start.
rem Models live only inside this project folder:
rem   %OLLAMA_MODELS%
rem ------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\reflex-presence.ps1"

echo [AI] Checking local Resident engine...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%OLLAMA_URL%/api/tags' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    if not defined OLLAMA_EXE (
        echo [WARN] Ollama executable not found. REFLEX will still start.
    ) else (
        echo [AI] Starting Ollama...
        start "DINS REFLEX Ollama" /min "%OLLAMA_EXE%" serve
        echo [AI] Waiting for Ollama on 127.0.0.1:11434...
        powershell -NoProfile -Command "$ok=$false; 1..40 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -Uri '%OLLAMA_URL%/api/tags' -TimeoutSec 1 | Out-Null; $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if($ok){exit 0}else{exit 1}" >nul 2>&1
    )
)

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%OLLAMA_URL%/api/tags' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Resident engine is offline. REFLEX will still start.
) else (
    echo [AI] Ollama online.
    echo [AI] Warming Resident %OLLAMA_MODEL%...
    curl.exe -sS --max-time 120 -H "Content-Type: application/json" "%OLLAMA_URL%/api/generate" -d "{\"model\":\"%OLLAMA_MODEL%\",\"prompt\":\"\",\"stream\":false,\"keep_alive\":\"4h\"}" > "%TEMP%\dins_reflex_resident_warmup.json"
    if errorlevel 1 (
        echo [WARN] Resident warm-up did not complete. REFLEX will still start.
    ) else (
        findstr /i /c:"\"done\":true" "%TEMP%\dins_reflex_resident_warmup.json" >nul 2>&1
        if errorlevel 1 (
            echo [WARN] Resident returned an unexpected warm-up response.
        ) else (
            echo [OK] Resident warm and held for 4 hours.
        )
    )
)

rem Start the registered localhost native bridge if needed.
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%SCREEN_BRIDGE_URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [START] Launching Screen Bridge on port 8790...
    schtasks /Run /TN "DINS REFLEX Screen Bridge" >nul 2>&1
) else (
    echo [OK] Screen Bridge already running.
)

rem Check whether REFLEX is already running.
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%REFLEX_URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if not errorlevel 1 (
    echo [OK] REFLEX is already running.
    echo [OPEN] %REFLEX_URL%
    start "" "%REFLEX_URL%"
    exit /b 0
)

echo [START] REFLEX is not running.
echo [START] Launching Vite on port 4174...
echo.

start "DINS REFLEX Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo [WAIT] Waiting for REFLEX...

powershell -NoProfile -Command "$ok=$false; 1..30 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -Uri '%REFLEX_URL%' -TimeoutSec 1 | Out-Null; $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if($ok){exit 0}else{exit 1}" >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] REFLEX did not start on %REFLEX_URL%
    echo Check the DINS REFLEX Server window.
    pause
    exit /b 1
)

echo.
echo [OK] REFLEX is ready.
echo [OPEN] %REFLEX_URL%

start "" "%REFLEX_URL%"

endlocal
exit /b 0
