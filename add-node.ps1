#Requires -Version 5.1
param(
  [Parameter(Mandatory=$true)][string]$Name,
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $env:LOCALAPPDATA "Mercy\dashboard"
$DashboardUrl = if ($env:MERCY_DASHBOARD_URL) { $env:MERCY_DASHBOARD_URL } else { "https://localhost:8080" }
$Network = if ($env:MERCY_DOCKER_NETWORK) { $env:MERCY_DOCKER_NETWORK } else { "dashboard_mercy-net" }

$DashUser = Read-Host "Dashboard-Admin-Benutzername"
$DashPasswordSecure = Read-Host "Dashboard-Admin-Passwort" -AsSecureString
$DashPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DashPasswordSecure))

Push-Location $InstallDir
if ($Remove) {
  node scripts/docker-link-node.js remove --url $DashboardUrl --user $DashUser --password $DashPassword --name $Name --volume "mercy_node_${Name}_data"
} else {
  node scripts/docker-link-node.js create --url $DashboardUrl --user $DashUser --password $DashPassword --name $Name --network $Network --image mercy-node-agent:latest --volume "mercy_node_${Name}_data"
}
Pop-Location
