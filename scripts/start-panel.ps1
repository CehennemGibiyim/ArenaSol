# ---------------------------------------------------------------------------
# Arena Live OS — paneli her zaman ayakta tutar (Windows).
# Panel kapansa/çökse 20 sn içinde yeniden başlatır; tarama arka planda sürer.
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts\start-panel.ps1 [-KeepAlive]
# ---------------------------------------------------------------------------
param(
  [int]$Port = 3000,
  [switch]$KeepAlive
)

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

$url = "http://127.0.0.1:$Port"
$log = Join-Path $root "panel.log"
$pidFile = Join-Path $root "panel-supervisor.pid"

try { Set-Content -Path $pidFile -Value $PID -Encoding ASCII } catch { }

function Test-Panel {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 "$url/api/health"
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Stop-PanelProcess {
  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen
    foreach ($connection in $connections) {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}

function Start-Panel {
  if (-not (Test-Path (Join-Path $root "node_modules"))) { return $false }
  $command = "set PORT=$Port&& npm run start >> `"$log`" 2>&1"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -WorkingDirectory $root -WindowStyle Hidden | Out-Null
  return $true
}

function Wait-Panel([int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Panel) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

Write-Host "Arena panel gözcüsü: $url" -ForegroundColor Cyan
$opened = $false
$failures = 0

while ($true) {
  if (Test-Panel) {
    $failures = 0
    if (-not $opened) {
      Start-Process $url | Out-Null
      $opened = $true
    }
  } else {
    $failures++
    if ($failures -ge 2) {
      Write-Host "Panel yanıt vermiyor — yeniden başlatılıyor..." -ForegroundColor Yellow
      Stop-PanelProcess
      Start-Sleep -Seconds 2
      if (Start-Panel) { [void](Wait-Panel 90) }
      $failures = 0
    }
  }

  if (-not $KeepAlive) { break }
  Start-Sleep -Seconds 20
}
