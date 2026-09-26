@echo off
setlocal
cd /d "%~dp0"
title DINS REFLEX Screen Bridge
node screen-bridge\server.mjs
pause
