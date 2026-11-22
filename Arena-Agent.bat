@echo off
chcp 65001 >nul
title Arena Agent (GitHub guncelleme + 7/24 tarama + sandik acma asistani)
cd /d "%~dp0"
color 0B

echo [1/3] GitHub kutuphanesindeki degisiklikler kontrol ediliyor...
node agent\update.mjs
if exist agent\arena-agent.mjs.pending (
  echo       Yeni agent indirildi - simdi devreye aliniyor.
  move /Y agent\arena-agent.mjs.pending agent\arena-agent.mjs >nul
)
if exist agent\update.mjs.pending (
  echo       Yeni updater bir sonraki acilista uygulanacak.
)

echo [2/3] Yerel hizli durum: http://localhost:4780
echo [3/3] Agent baslatiliyor (3 sn veri yenileme, sandık açma)...

:run
node agent\arena-agent.mjs
echo.
echo [!] Agent kapandi. 10 sn sonra yeniden baslatiliyor... (durdurmak icin Durdur.bat)
timeout /t 10 >nul
goto run
