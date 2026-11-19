@echo off
chcp 65001 >nul
title Arena Live OS - Durdur
cd /d "%~dp0"

echo Arena Live OS durduruluyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=2" %%p in ('tasklist /FI "WINDOWTITLE eq Arena Agent*" /FO LIST ^| findstr /i "PID:"') do (
  taskkill /F /PID %%p >nul 2>nul
)
echo Panel ve agent durduruldu.
timeout /t 2 >nul
