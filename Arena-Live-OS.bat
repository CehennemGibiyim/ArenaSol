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

echo  [4/4] Panel + tarama arka planda baslatiliyor...
rem Panel gozcusu: panel cokse bile 20 sn icinde yeniden acilir ve tarama surer.
start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "scripts\start-panel.ps1" -KeepAlive
start "Arena Agent - 7/24 tarama" /min cmd /c "agent\baslat.bat"

rem Panel hazir olunca tarayici acilir.
powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 45; $i++) { try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:3000/api/health').StatusCode -eq 200) { Start-Process 'http://localhost:3000'; break } } catch { }; Start-Sleep -Seconds 2 }"

echo.
echo  Panel ve tarama arka planda calisiyor: http://localhost:3000
echo  Panel kapatilsa bile gozcu yeniden acar. Durdurmak icin: Durdur.bat
timeout /t 6 >nul
exit /b 0
