; ---------------------------------------------------------------------------
; Arena Live OS — NSIS kurulum paketi
; GitHub Actions (windows-release.yml) içinde derlenir. Kaynak ve çıktı
; klasörleri mutlak yol olarak /DAPPSTAGE ve /DOUTDIR ile geçilir; verilmezse
; betik klasörüne göre ..\release kullanılır.
; Çıktı: <OUTDIR>\ArenaLiveOS-Setup-<surum>.exe
; ---------------------------------------------------------------------------
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APPNAME "Arena Live OS"
!define COMPANY "Arena"
!define APPEXE "Arena-Live-OS.bat"

!ifndef VERSION
  !define VERSION "1.2.0"
!endif

; File komutu göreli yolları betik klasörüne göre çözer; bu yüzden yollar
; mutlak olarak verilir.
!ifndef APPSTAGE
  !define APPSTAGE "..\release\Arena-Live-OS"
!endif
!ifndef OUTDIR
  !define OUTDIR "..\release"
!endif

Name "${APPNAME} ${VERSION}"
; Yolları betik dosyasına göre çöz: makensis farklı bir çalışma dizininden çağrılabilir.
OutFile "${OUTDIR}\ArenaLiveOS-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Arena-Live-OS"
InstallDirRegKey HKCU "Software\ArenaLiveOS" "InstallDir"
RequestExecutionLevel user
Unicode true
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${COMPANY}"
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Arena Live OS'u şimdi başlat"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Turkish"

Section "Arena Live OS" SecMain
  SetOutPath "$INSTDIR"
  File /r "${APPSTAGE}\*.*"

  WriteRegStr HKCU "Software\ArenaLiveOS" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArenaLiveOS" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArenaLiveOS" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArenaLiveOS" "Publisher" "${COMPANY}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArenaLiveOS" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$DESKTOP\Arena Live OS.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\${APPEXE}" 0
  CreateDirectory "$SMPROGRAMS\Arena Live OS"
  CreateShortcut "$SMPROGRAMS\Arena Live OS\Arena Live OS.lnk" "$INSTDIR\${APPEXE}"
  CreateShortcut "$SMPROGRAMS\Arena Live OS\Kurulum Sihirbazi.lnk" "$INSTDIR\KURULUM.bat"
  CreateShortcut "$SMPROGRAMS\Arena Live OS\Durdur.lnk" "$INSTDIR\Durdur.bat"
  CreateShortcut "$SMPROGRAMS\Arena Live OS\Kaldir.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Arena Live OS.lnk"
  RMDir /r "$SMPROGRAMS\Arena Live OS"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArenaLiveOS"
  DeleteRegKey HKCU "Software\ArenaLiveOS"
SectionEnd
