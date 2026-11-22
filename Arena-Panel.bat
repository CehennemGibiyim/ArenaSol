@echo off
chcp 65001 >nul
title Arena Live OS - Panel
cd /d "%~dp0"

echo Arena paneli kontrol ediliyor: http://localhost:3000
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-panel.ps1"
if errorlevel 1 (
  echo [!] Panel baslatilamadi. Once KURULUM.bat calistirin.
  pause
)
