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

$Script:InstallStep = 0
$Script:InstallTotalSteps = 1

function Write-Banner {
  Write-Host ""
  Write-Host "  __  __                          ____  _____ " -ForegroundColor Cyan
  Write-Host " |  \/  | ___ _ __ ___ _   _     / ___||  ___|" -ForegroundColor Cyan
  Write-Host " | |\/| |/ _ \ '__/ __| | | |____\___ \| |_   " -ForegroundColor Cyan
  Write-Host " | |  | |  __/ | | (__| |_| |_____|__) |  _|  " -ForegroundColor Cyan
  Write-Host " |_|  |_|\___|_|  \___|\__, |    |____/|_|    " -ForegroundColor Cyan
  Write-Host "                       |___/                  " -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Dashboard Installer - built on the official Mercy SF CLI and sf-api by the-marenga." -ForegroundColor DarkGray
  Write-Host "  Thanks for using Mercy SF Dashboard! Special thanks to Sensei Issei." -ForegroundColor DarkGray
  Write-Host ""
}

function Write-ProgressStep($Message) {
  $Script:InstallStep++
  $pct = [int](($Script:InstallStep / $Script:InstallTotalSteps) * 100)
  Write-Progress -Activity "Mercy SF Dashboard Installer" -Status $Message -PercentComplete $pct
  Write-Host ""
  Write-Host ("==> [{0}%] ({1}/{2}) {3}" -f $pct, $Script:InstallStep, $Script:InstallTotalSteps, $Message) -ForegroundColor Cyan
}

function Write-Ok($Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

# Runs a long, noisy command (docker build/pull, ...) behind a spinner instead of letting
# hundreds of lines of layer hashes scroll past. Output goes to temp files: silent on success,
# dumped (last 40 lines) on failure so the actual error is still visible.
function Invoke-Quiet {
  # Note: the parameter is named $Arguments, not $Args — $Args is a reserved PowerShell
  # automatic variable (collects unbound positional arguments), and naming a parameter after it
  # silently breaks binding (Start-Process would receive an empty list even when callers pass
  # -Args explicitly).
  param([string]$Label, [string]$Exe, [string[]]$Arguments)
  $outFile = [System.IO.Path]::GetTempFileName()
  $errFile = [System.IO.Path]::GetTempFileName()
  $proc = Start-Process -FilePath $Exe -ArgumentList $Arguments -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  # Forces .NET to open the process handle with the access rights needed to read ExitCode later
  # — without this, $proc.ExitCode can come back blank even after HasExited is true (a known
  # Start-Process -PassThru quirk on Windows PowerShell 5.1).
  $proc.Handle | Out-Null
  $spin = @('|', '/', '-', '\')
  $i = 0
  while (-not $proc.HasExited) {
    Write-Host -NoNewline ("`r  {0} {1}   " -f $spin[$i % 4], $Label)
    $i++
    Start-Sleep -Milliseconds 150
  }
  if ($proc.ExitCode -eq 0) {
    Write-Host ("`r  [OK] {0}                                                        " -f $Label) -ForegroundColor Green
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
  } else {
    Write-Host ("`r  [FAIL] {0}                                                      " -f $Label) -ForegroundColor Red
    Write-Host "  --- last output ---" -ForegroundColor DarkGray
    Get-Content $errFile, $outFile -Tail 40 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
    throw "$Label failed (exit $($proc.ExitCode))"
  }
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
  if (Test-Docker) {
    # Node containers created via add-node.ps1 (or install.ps1's own node loop) never go through
    # docker-compose, so "compose down" above doesn't touch them — find them by the
    # "mercy.role=node" label (set in scripts/lib/dockerNode.js) instead and remove each one
    # plus its data volume.
    $nodeIds = docker ps -aq --filter "label=mercy.role=node"
    if ($nodeIds) {
      $removed = 0
      foreach ($cid in $nodeIds) {
        $name = (docker inspect --format '{{.Name}}' $cid) -replace '^/', ''
        docker rm -f $cid | Out-Null
        if ($name) {
          docker volume rm "mercy_node_${name}_data" 2>$null | Out-Null
          docker volume rm "mercy_node_${name}_cli" 2>$null | Out-Null
        }
        $removed++
      }
      Write-Ok "Removed $removed Docker node container(s) and their volumes"
    }
  }
  Write-Ok "Done — containers and volumes removed. Directory '$InstallDir' (code) is left in place; delete it manually if you want it gone too."
  exit 0
}

if (-not (Test-Docker)) {
  Write-Error "Docker Desktop is not running or not installed. Please start/install Docker Desktop and try again."
  exit 1
}

# Detect an existing installation so a second run updates it instead of re-prompting for
# node count/admin credentials — those are one-time setup steps, and re-running account setup
# against an account that already exists would just fail.
$IsExistingInstall = $false
if (Test-Path $InstallDir) {
  Push-Location $InstallDir
  $existingContainer = docker compose ps -q dashboard 2>$null
  Pop-Location
  if ($existingContainer) { $IsExistingInstall = $true }
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

if ($IsExistingInstall) {
  Write-Ok "Existing installation detected — updating instead of reinstalling."
  $Script:InstallStep = 0
  $Script:InstallTotalSteps = 3

  Write-ProgressStep "Rebuilding Docker images (dashboard + sf-api bridge)"
  Invoke-Quiet -Label "docker compose build — this can take a few minutes" -Exe "docker" -Arguments @('compose', 'build')

  Write-ProgressStep "Restarting dashboard + sf-api bridge containers"
  Invoke-Quiet -Label "docker compose up -d" -Exe "docker" -Arguments @('compose', 'up', '-d')

  Write-ProgressStep "Updating node containers"
  # Node containers keep their data volumes (incl. the node-agent's pairing token, see
  # docker-link-node.js's "update" subcommand) — no re-pairing needed after this.
  $nodeNames = docker ps -aq --filter "label=mercy.role=node" | ForEach-Object {
    (docker inspect --format '{{.Name}}' $_) -replace '^/', ''
  }
  if ($nodeNames) {
    Invoke-Quiet -Label "Building the node-agent image" -Exe "docker" -Arguments @('build', '-f', 'Dockerfile.node-agent', '-t', 'mercy-node-agent:latest', '.')
    $ProjectName = (Split-Path $InstallDir -Leaf).ToLower()
    $Network = "${ProjectName}_mercy-net"
    foreach ($nodeName in $nodeNames) {
      node scripts/docker-link-node.js update --name $nodeName --network $Network --image mercy-node-agent:latest --volume "mercy_node_${nodeName}_data" --cli-volume "mercy_node_${nodeName}_cli"
    }
    Write-Ok "Updated $($nodeNames.Count) node container(s)"
  } else {
    Write-Ok "No node containers to update"
  }

  Write-Progress -Activity "Mercy SF Dashboard Installer" -Completed
  $LanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress)
  if (-not $LanIp) { $LanIp = 'localhost' }
  Write-Host ""
  Write-Host "  Update complete" -ForegroundColor Green
  Write-Host "  Dashboard: https://${LanIp}:8080"
  Pop-Location
  exit 0
}

Start-Sleep -Seconds 5
$NodeCount = Read-Host "  How many extra node containers? [0]"
if ([string]::IsNullOrWhiteSpace($NodeCount)) { $NodeCount = 0 } else { $NodeCount = [int]$NodeCount }
$DashUser = Read-Host "  Dashboard admin username"
$DashPasswordSecure = Read-Host "  Dashboard admin password" -AsSecureString
$DashPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DashPasswordSecure))

$Script:InstallStep = 0
$Script:InstallTotalSteps = 5 + $NodeCount

Write-ProgressStep "Building Docker images (dashboard + sf-api bridge)"
Invoke-Quiet -Label "docker compose build — this can take a few minutes" -Exe "docker" -Arguments @('compose', 'build')

Write-ProgressStep "Starting dashboard + sf-api bridge containers"
Invoke-Quiet -Label "docker compose up -d" -Exe "docker" -Arguments @('compose', 'up', '-d')

Write-ProgressStep "Waiting for the dashboard to become reachable"
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

Write-ProgressStep "Setting up the dashboard account"
node scripts/docker-link-node.js setup --url $DashboardUrl --user $DashUser --password $DashPassword

if ($NodeCount -gt 0) {
  Invoke-Quiet -Label "Building the node-agent image" -Exe "docker" -Arguments @('build', '-f', 'Dockerfile.node-agent', '-t', 'mercy-node-agent:latest', '.')
  # Compose derives the network name from the (lowercased) compose project directory name by
  # default — with $InstallDir = ...\Mercy\dashboard that's always "dashboard".
  $ProjectName = (Split-Path $InstallDir -Leaf).ToLower()
  $Network = "${ProjectName}_mercy-net"
  for ($i = 1; $i -le $NodeCount; $i++) {
    $NodeName = "node-$i"
    Write-ProgressStep "Creating and linking node container '$NodeName'"
    node scripts/docker-link-node.js create --url $DashboardUrl --user $DashUser --password $DashPassword --name $NodeName --network $Network --image mercy-node-agent:latest --volume "mercy_node_${NodeName}_data" --cli-volume "mercy_node_${NodeName}_cli"
  }
}

Write-Progress -Activity "Mercy SF Dashboard Installer" -Completed
# Shown so the dashboard is reachable from other devices on the LAN too, not just this machine
# — matches install.sh, which shows the server's real IP instead of "localhost" for the same
# reason. Falls back to localhost if no non-loopback IPv4 address is found.
$LanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $LanIp) { $LanIp = 'localhost' }
Write-Host ""
Write-Host "  Installation complete" -ForegroundColor Green
Write-Host "  Dashboard: https://${LanIp}:8080"
Write-Host "  Node containers linked: $NodeCount"
Write-Host "  Add more later: .\add-node.ps1 -Name <name>"
Pop-Location
