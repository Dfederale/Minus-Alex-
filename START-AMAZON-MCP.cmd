@echo off
setlocal
cd /d "%~dp0"
title DINS REFLEX Amazon MCP
node amazon-mcp\server.mjs
pause
