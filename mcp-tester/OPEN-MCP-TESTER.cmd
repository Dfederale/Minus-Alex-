@echo off
cd /d "%~dp0"
title Minus Alex MCP Tester
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not on PATH. Start Minus Alex normally and install Node.js if needed.
  pause
  exit /b 1
)
node "TEST-MCP.mjs"
echo.
pause
