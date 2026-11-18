@echo off
chcp 65001 >nul
title Arena Agent (GitHub'dan otomatik guncelleme + canli veri)
cd /d "%~dp0"
echo [1/2] GitHub kutuphanesindeki degisiklikler kontrol ediliyor...
node agent\update.mjs
if exist agent\update.mjs.pending (
  echo Yeni updater indirildi - bir sonraki acilista otomatik uygulanacak.
)
echo [2/2] Agent baslatiliyor (uzaktan veri + anlik sandik bildirimi)...
node agent\arena-agent.mjs
pause
