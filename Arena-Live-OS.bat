@echo off
chcp 65001 >nul
title Arena Live OS
cd /d "%~dp0"
color 0B

echo.
echo  ============================================================
echo    ARENA LIVE OS baslatiliyor
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] Node.js bulunamadi. KURULUM.bat dosyasini calistirin.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  [1/4] Bagimliliklar kuruluyor (npm ci)...
  call npm ci
  if errorlevel 1 ( echo  [!] npm ci basarisiz. & pause & exit /b 1 )
)

if not exist .env (
  if exist .env.example copy .env.example .env >nul
  echo  [!] .env olusturuldu. DATABASE_URL degerini duzenleyin: notepad .env
)

echo  [2/4] GitHub kutuphanesindeki degisiklikler kontrol ediliyor...
node agent\update.mjs
if exist agent\update.mjs.pending (
  echo       Yeni updater indirildi - bir sonraki acilista otomatik uygulanacak.
)
if exist agent\arena-agent.mjs.pending (
  echo       Yeni agent indirildi - simdi devreye aliniyor.
  move /Y agent\arena-agent.mjs.pending agent\arena-agent.mjs >nul
)

if not exist .next (
  echo  [3/4] Production build aliniyor (ilk acilis 1-2 dk)...
  call npm run build
  if errorlevel 1 ( echo  [!] Build basarisiz. & pause & exit /b 1 )
)

echo  [4/4] Panel + otomatik tarayici baslatiliyor...
start "" http://localhost:3000
start "Arena Agent - 7/24 tarama" cmd /c "node agent\arena-agent.mjs"

set PORT=3000
call npm run start

echo.
echo  Panel kapandi. Agent penceresi arka planda calismaya devam ediyor.
pause
