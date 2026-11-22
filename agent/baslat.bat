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

:run
node agent/arena-agent.mjs
echo.
echo [!] Agent kapandi. 10 sn sonra yeniden baslatiliyor... (durdurmak icin Durdur.bat)
timeout /t 10 >nul
goto run
