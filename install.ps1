#Requires -Version 5.1
param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/dandulox/MercySF_Dashboard.git"
$InstallDir = Join-Path $env:LOCALAPPDATA "Mercy\dashboard"
$DashboardUrl = "https://localhost:8080"

# -SkipCertificateCheck (Invoke-RestMethod) existiert erst ab PowerShell 6 — dieses Skript zielt
# auf Windows PowerShell 5.1 (Standard unter Windows), das self-signed Zertifikat des Dashboards
# braucht daher einen eigenen, prozessweiten Zertifikats-Bypass.
if ($PSVersionTable.PSVersion.Major -lt 6) {
  add-type @"
    using System.Net;
    using System.Security.Cryptography.X509Certificates;
    public class TrustAllCertsPolicy : ICertificatePolicy {
      public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
    }
"@
  [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
}

function Invoke-DashboardRest {
  param([string]$Uri, [int]$TimeoutSec = 5)
  if ($PSVersionTable.PSVersion.Major -lt 6) {
    Invoke-RestMethod -Uri $Uri -TimeoutSec $TimeoutSec
  } else {
    Invoke-RestMethod -Uri $Uri -SkipCertificateCheck -TimeoutSec $TimeoutSec
  }
}

function Test-Docker {
  try {
    docker info | Out-Null
    return $true
  } catch {
    return $false
  }
}

if ($Uninstall) {
  if (Test-Path $InstallDir) {
    Push-Location $InstallDir
    docker compose down -v
    Pop-Location
  }
  Write-Host "Fertig — Container und Volumes entfernt. Verzeichnis '$InstallDir' bleibt bestehen (Code), kann manuell gelöscht werden."
  exit 0
}

if (-not (Test-Docker)) {
  Write-Error "Docker Desktop läuft nicht oder ist nicht installiert. Bitte Docker Desktop starten/installieren und erneut versuchen."
  exit 1
}

if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  git clone --depth 1 $RepoUrl $InstallDir
} else {
  Push-Location $InstallDir
  git fetch --depth 1 origin main
  git checkout -B main FETCH_HEAD
  Pop-Location
}

Push-Location $InstallDir

$NodeCount = Read-Host "Anzahl zusätzlicher Node-Container [0]"
if ([string]::IsNullOrWhiteSpace($NodeCount)) { $NodeCount = 0 } else { $NodeCount = [int]$NodeCount }
$DashUser = Read-Host "Admin-Benutzername für das Dashboard"
$DashPasswordSecure = Read-Host "Admin-Passwort für das Dashboard" -AsSecureString
$DashPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DashPasswordSecure))

Write-Host "==> Docker-Images bauen und Dashboard + sf-api-Bridge starten"
docker compose build
docker compose up -d

Write-Host "==> Warte auf Dashboard-Erreichbarkeit"
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-DashboardRest -Uri "$DashboardUrl/api/status" -TimeoutSec 2 | Out-Null
    break
  } catch {
    # /api/status verlangt eine Session und antwortet ohne eine mit HTTP 401 — Invoke-RestMethod
    # wirft dafür eine Exception, obwohl der Server bereits erreichbar ist. Ein vorhandenes
    # $_.Exception.Response beweist genau das (eine echte HTTP-Antwort kam an), nur ein reiner
    # Verbindungsfehler (Server noch nicht hoch) hat keine Response — dafür weiter pollen.
    if ($_.Exception.Response) { break }
    Start-Sleep -Seconds 1
  }
}

Write-Host "==> Dashboard-Konto einrichten"
node scripts/docker-link-node.js setup --url $DashboardUrl --user $DashUser --password $DashPassword

if ($NodeCount -gt 0) {
  docker build -f Dockerfile.node-agent -t mercy-node-agent:latest .
  # Compose leitet den Netzwerknamen standardmäßig aus dem (lowercased) Verzeichnisnamen des
  # Compose-Projekts ab — bei $InstallDir = ...\Mercy\dashboard ist das immer "dashboard".
  $ProjectName = (Split-Path $InstallDir -Leaf).ToLower()
  $Network = "${ProjectName}_mercy-net"
  for ($i = 1; $i -le $NodeCount; $i++) {
    $NodeName = "node-$i"
    Write-Host "==> Node-Container '$NodeName' erzeugen und verlinken"
    node scripts/docker-link-node.js create --url $DashboardUrl --user $DashUser --password $DashPassword --name $NodeName --network $Network --image mercy-node-agent:latest --volume "mercy_node_${NodeName}_data"
  }
}

Write-Host "==> Fertig! Dashboard läuft: $DashboardUrl ($NodeCount Node-Container verlinkt)"
Pop-Location
