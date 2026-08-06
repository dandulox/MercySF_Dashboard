#!/usr/bin/env bash
#
# Mercy SF Dashboard — One-Shot-Installer
#
# Nutzung auf einem frischen Debian/Ubuntu-Server (als root):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
#
# Idempotent: mehrfaches Ausführen aktualisiert nur Code + Dependencies, bestehende
# Account-Daten (/opt/mercy/dashboard/data), Zertifikate (/opt/mercy/certs) und die
# installierte CLI (/opt/mercy/mercy-cli-linux-x64) werden nicht angetastet, sofern
# schon vorhanden.

set -euo pipefail

REPO_URL="https://github.com/dandulox/MercySF_Dashboard.git"
INSTALL_DIR="/opt/mercy"
DASHBOARD_DIR="$INSTALL_DIR/dashboard"
CERTS_DIR="$INSTALL_DIR/certs"
CLI_PATH="$INSTALL_DIR/mercy-cli-linux-x64"
CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Bitte als root ausführen (z. B. via sudo)." >&2
  exit 1
fi

log "Pakete aktualisieren und Build-Abhängigkeiten installieren"
apt-get update -qq
apt-get install -y -qq curl git build-essential python3 openssl ca-certificates >/dev/null

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]]; then
  log "Node.js 20.x (NodeSource) installieren"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
else
  log "Node.js bereits vorhanden ($(node -v)) — überspringe Installation"
fi

mkdir -p "$INSTALL_DIR"

if [[ -d "$DASHBOARD_DIR/.git" ]]; then
  log "Bestehende Installation gefunden — aktualisiere Code (git pull)"
  git -C "$DASHBOARD_DIR" pull --ff-only
else
  log "Repository klonen nach $DASHBOARD_DIR"
  git clone --depth 1 "$REPO_URL" "$DASHBOARD_DIR"
fi

log "npm-Abhängigkeiten installieren (kompiliert node-pty nativ — kann etwas dauern)"
cd "$DASHBOARD_DIR"
npm install --omit=dev --no-audit --no-fund

log "Vendor-Assets bereitstellen (Chart.js, xterm.js)"
mkdir -p "$DASHBOARD_DIR/public/vendor"
cp "$DASHBOARD_DIR/node_modules/chart.js/dist/chart.umd.js" "$DASHBOARD_DIR/public/vendor/chart.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/lib/xterm.js" "$DASHBOARD_DIR/public/vendor/xterm.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/css/xterm.css" "$DASHBOARD_DIR/public/vendor/xterm.css"

mkdir -p "$DASHBOARD_DIR/data"

if [[ ! -f "$CLI_PATH" ]]; then
  log "Mercy-SF-CLI herunterladen"
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
else
  log "CLI bereits vorhanden ($CLI_PATH) — überspringe Download (Updates laufen über das Dashboard selbst, Bot-Engine-Kasten)"
fi

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
  log "Selbstsigniertes TLS-Zertifikat erzeugen"
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=mercy-dashboard" >/dev/null 2>&1
else
  log "TLS-Zertifikat bereits vorhanden — überspringe Erzeugung"
fi

log "systemd-Service einrichten"
cp "$DASHBOARD_DIR/systemd/mercy-dashboard.service" /etc/systemd/system/mercy-dashboard.service
systemctl daemon-reload
systemctl enable mercy-dashboard >/dev/null 2>&1
systemctl restart mercy-dashboard

sleep 2
if systemctl is-active --quiet mercy-dashboard; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  log "Fertig! Dashboard läuft: https://${IP:-<server-ip>}:8080"
else
  warn "Dienst ist nicht aktiv — Log prüfen mit: journalctl -u mercy-dashboard -n 50 --no-pager"
  exit 1
fi
