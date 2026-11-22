@echo off
chcp 65001 >nul
title Arena Live OS - Durdur
cd /d "%~dp0"

echo Arena Live OS durduruluyor...

rem Panel gozcusu (start-panel.ps1) kendini yeniden baslatmasin diye once o kapatilir.
if exist panel-supervisor.pid (
  set /p SUPERVISOR_PID=<panel-supervisor.pid
  if defined SUPERVISOR_PID taskkill /F /PID %SUPERVISOR_PID% >nul 2>nul
  del /q panel-supervisor.pid >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=2" %%p in ('tasklist /FI "WINDOWTITLE eq Arena Agent*" /FO LIST ^| findstr /i "PID:"') do (
  taskkill /F /PID %%p >nul 2>nul
)
for /f "tokens=2" %%p in ('tasklist /FI "WINDOWTITLE eq Arena Live OS - Panel*" /FO LIST ^| findstr /i "PID:"') do (
  taskkill /F /PID %%p >nul 2>nul
)
echo Panel, gozcu ve agent durduruldu.
echo Yeniden baslatmak icin: Arena-Live-OS.bat veya Arena-Panel.bat
timeout /t 3 >nul
