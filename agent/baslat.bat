@echo off
chcp 65001 >nul
title Arena Local Agent
cd /d "%~dp0.."
if not exist node_modules (
  echo Bagimliliklar kuruluyor...
  call npm ci
)
echo Panel adresi: %ARENA_PANEL_URL%
echo Arena Local Agent baslatiliyor...
node agent/arena-agent.mjs
pause
