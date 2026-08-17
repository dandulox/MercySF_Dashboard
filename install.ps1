#Requires -Version 5.1
param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/dandulox/MercySF_Dashboard.git"
$InstallDir = Join-Path $env:LOCALAPPDATA "Mercy\dashboard"
$DashboardUrl = "https://localhost:8080"

# -SkipCertificateCheck (Invoke-RestMethod) only exists from PowerShell 6 onward — this script
# targets Windows PowerShell 5.1 (the Windows default), so the dashboard's self-signed
# certificate needs its own process-wide certificate bypass instead.
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

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok($Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Banner {
  Write-Host ""
  Write-Host "  Mercy SF Dashboard - Installer" -ForegroundColor Cyan
  Write-Host "  -------------------------------" -ForegroundColor Cyan
  Write-Host ""
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

Write-Banner

if ($Uninstall) {
  if (Test-Path $InstallDir) {
    Push-Location $InstallDir
    docker compose down -v
    Pop-Location
  }
  Write-Ok "Done — containers and volumes removed. Directory '$InstallDir' (code) is left in place; delete it manually if you want it gone too."
  exit 0
}

if (-not (Test-Docker)) {
  Write-Error "Docker Desktop is not running or not installed. Please start/install Docker Desktop and try again."
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

$NodeCount = Read-Host "  How many extra node containers? [0]"
if ([string]::IsNullOrWhiteSpace($NodeCount)) { $NodeCount = 0 } else { $NodeCount = [int]$NodeCount }
$DashUser = Read-Host "  Dashboard admin username"
$DashPasswordSecure = Read-Host "  Dashboard admin password" -AsSecureString
$DashPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DashPasswordSecure))

Write-Step "Building Docker images and starting dashboard + sf-api bridge"
docker compose build
docker compose up -d

Write-Step "Waiting for the dashboard to become reachable"
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-DashboardRest -Uri "$DashboardUrl/api/status" -TimeoutSec 2 | Out-Null
    break
  } catch {
    # /api/status requires a session and responds with HTTP 401 without one — Invoke-RestMethod
    # throws for that even though the server is already reachable. A present
    # $_.Exception.Response proves exactly that (a real HTTP response came back); only a plain
    # connection failure (server not up yet) has no Response — keep polling for that case.
    if ($_.Exception.Response) { break }
    Start-Sleep -Seconds 1
  }
}
Write-Ok "Dashboard reachable"

Write-Step "Setting up the dashboard account"
node scripts/docker-link-node.js setup --url $DashboardUrl --user $DashUser --password $DashPassword

if ($NodeCount -gt 0) {
  docker build -f Dockerfile.node-agent -t mercy-node-agent:latest .
  # Compose derives the network name from the (lowercased) compose project directory name by
  # default — with $InstallDir = ...\Mercy\dashboard that's always "dashboard".
  $ProjectName = (Split-Path $InstallDir -Leaf).ToLower()
  $Network = "${ProjectName}_mercy-net"
  for ($i = 1; $i -le $NodeCount; $i++) {
    $NodeName = "node-$i"
    Write-Step "Creating and linking node container '$NodeName'"
    node scripts/docker-link-node.js create --url $DashboardUrl --user $DashUser --password $DashPassword --name $NodeName --network $Network --image mercy-node-agent:latest --volume "mercy_node_${NodeName}_data"
  }
}

Write-Host ""
Write-Host "  Installation complete" -ForegroundColor Green
Write-Host "  Dashboard: $DashboardUrl"
Write-Host "  Node containers linked: $NodeCount"
Write-Host "  Add more later: .\add-node.ps1 -Name <name>"
Pop-Location
