@echo off
chcp 65001 >nul
title Arena Live OS - Kurulum
cd /d "%~dp0"
color 0B

echo.
echo  ============================================================
echo    ARENA LIVE OS - Windows Kurulum Sihirbazi
echo    TikTok LIVE ajans isletim sistemi + 7/24 sandik radarı
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] Node.js bulunamadi.
  echo      https://nodejs.org adresinden Node.js 22 LTS kurun ve
  echo      bu dosyayi yeniden calistirin.
  echo.
  start "" "https://nodejs.org/tr/download"
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [i] Node.js %NODE_VERSION% bulundu.
echo.
echo  Sihirbaz: veritabani, .env, bagimliliklar, build ve masaustu kisayolu.
echo  Devam etmek icin bir tusa basin (iptal: Ctrl+C)...
pause >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\install-windows.ps1"
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo.
  echo  [!] Kurulum tamamlanamadi (kod: %EXITCODE%).
  echo      Ayrintili rehber: docs\WINDOWS-KURULUM.md
  pause
  exit /b %EXITCODE%
)

echo.
echo  [OK] Kurulum tamam. Masaustundeki "Arena Live OS" kisayolunu kullanin.
echo       Panel: http://localhost:3000
pause
