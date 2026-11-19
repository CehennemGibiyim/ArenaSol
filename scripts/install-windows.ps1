# ---------------------------------------------------------------------------
# Arena Live OS — Windows kurulum sihirbazı
# KURULUM.bat tarafından çağrılır. Yönetici yetkisi gerekmez.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    [OK] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    [!] $text" -ForegroundColor Yellow }

Write-Host @"
------------------------------------------------------------
  ARENA LIVE OS - KURULUM
  Klasor: $root
------------------------------------------------------------
"@ -ForegroundColor Magenta

# 1) Node.js ---------------------------------------------------------------
Write-Step "Node.js kontrol ediliyor"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Warn "Node.js bulunamadı. https://nodejs.org adresinden 22 LTS kurun."
  Start-Process "https://nodejs.org/tr/download"
  exit 1
}
$nodeVersion = (& node -v).Trim()
$major = [int](($nodeVersion -replace '^v', '') -split '\.')[0]
if ($major -lt 20) {
  Write-Warn "Node.js $nodeVersion çok eski. 20 veya üzeri gerekir."
  exit 1
}
Write-Ok "Node.js $nodeVersion"

# 2) .env ------------------------------------------------------------------
Write-Step ".env yapılandırması"
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Ok ".env oluşturuldu"
  $dbUrl = Read-Host "PostgreSQL bağlantı adresi [Enter = varsayılan: postgresql://postgres:postgres@127.0.0.1:5432/app_db]"
  if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    $dbUrl = "postgresql://postgres:postgres@127.0.0.1:5432/app_db"
  }
  (Get-Content ".env") -replace '^DATABASE_URL=.*', "DATABASE_URL=$dbUrl" | Set-Content ".env" -Encoding UTF8
} else {
  Write-Ok ".env korunuyor (mevcut ayarlar ezilmedi)"
}

$envLine = Get-Content ".env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $envLine -or $envLine -match 'SIFRE') {
  Write-Warn "DATABASE_URL hâlâ örnek değerde. notepad .env ile düzenleyin."
}

# 3) Bağımlılıklar ---------------------------------------------------------
Write-Step "Bağımlılıklar kuruluyor (npm ci)"
if (Test-Path "package-lock.json") { & npm ci } else { & npm install }
if ($LASTEXITCODE -ne 0) { Write-Warn "npm kurulumu başarısız"; exit 1 }
Write-Ok "Bağımlılıklar hazır"

# 4) Veritabanı şeması -----------------------------------------------------
Write-Step "Veritabanı şeması uygulanıyor (drizzle-kit push)"
& npx drizzle-kit push
if ($LASTEXITCODE -ne 0) {
  Write-Warn "Şema uygulanamadı. PostgreSQL çalışıyor mu? (Get-Service postgresql*)"
  Write-Warn "Düzeltip 'npx drizzle-kit push' komutunu tekrar çalıştırabilirsiniz."
} else {
  Write-Ok "Şema hazır"
}

# 5) Production build ------------------------------------------------------
Write-Step "Production build alınıyor"
& npm run build
if ($LASTEXITCODE -ne 0) { Write-Warn "Build başarısız"; exit 1 }
Write-Ok "Build tamam"

# 6) Agent manifest -----------------------------------------------
Write-Step "Agent güncelleme manifesti hazırlanıyor"
& node scripts/build-agent-manifest.mjs 2>$null

# 7) Masaüstü kısayolu -----------------------------------------------------
Write-Step "Masaüstü kısayolu"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Arena Live OS.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = Join-Path $root "Arena-Live-OS.bat"
$sc.WorkingDirectory = $root
$sc.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,14"
$sc.Description = "Arena Live OS — TikTok LIVE paneli + 7/24 sandık radarı"
$sc.Save()
Write-Ok "Kısayol: $shortcutPath"

Write-Host @"

------------------------------------------------------------
  KURULUM TAMAMLANDI
  Panel      : http://localhost:3000
  Başlat     : Arena-Live-OS.bat (masaüstü kısayolu)
  Durdur     : Durdur.bat
  Güncelleme : her açılışta GitHub'dan otomatik kontrol
  Yardım     : http://localhost:3000/yardim
------------------------------------------------------------
"@ -ForegroundColor Green

exit 0
