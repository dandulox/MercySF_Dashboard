#!/usr/bin/env bash
#
# Mercy SF Dashboard — One-Shot-Installer
#
# Vollständiges Dashboard (inkl. lokaler CLI, sf-api-Bridge) auf einem frischen Debian/Ubuntu-
# Server (als root):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
#
# Nur den schlanken Node-Agent installieren (steuert Accounts auf diesem Server fern über ein
# zentrales Dashboard, siehe "Nodes"-Seite dort — kein eigenes Web-UI, kein sf-api-Build):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --node
#
# Von einem bestimmten Branch installieren/testen (z. B. einem Feature-Branch vor dem Merge nach
# main) — MERCY_BRANCH steuert, welcher Branch geklont/ausgecheckt wird, das install.sh selbst
# muss trotzdem von genau diesem Branch geladen werden:
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/nodetest/install.sh | MERCY_BRANCH=nodetest bash -s -- --node
#
# Deinstallation (entfernt ALLES, inkl. gespeicherter Zugangsdaten und Statistik-Historie):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
#
# Idempotent: mehrfaches Ausführen aktualisiert nur Code + Dependencies, bestehende
# Account-Daten (/opt/mercy/dashboard/data bzw. /opt/mercy/dashboard/node-agent/data),
# Zertifikate (/opt/mercy/certs) und die installierte CLI (/opt/mercy/mercy-cli-linux-x64)
# werden nicht angetastet, sofern schon vorhanden.

set -euo pipefail

REPO_URL="https://github.com/dandulox/MercySF_Dashboard.git"
BRANCH="${MERCY_BRANCH:-main}"
INSTALL_DIR="/opt/mercy"
DASHBOARD_DIR="$INSTALL_DIR/dashboard"
NODE_AGENT_DIR="$DASHBOARD_DIR/node-agent"
CERTS_DIR="$INSTALL_DIR/certs"
CLI_PATH="$INSTALL_DIR/mercy-cli-linux-x64"
CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"

NODE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --node) NODE_ONLY=true ;;
  esac
done

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Bitte als root ausführen (z. B. via sudo)." >&2
  exit 1
fi

if [[ "${1:-}" == "--uninstall" ]]; then
  log "Mercy SF entfernen (Dashboard und/oder Node-Agent — entfernt ALLES: Code, Dienste, Zertifikate, CLI, gespeicherte Zugangsdaten, Statistik-Historie)"
  systemctl stop mercy-dashboard mercy-sfapi-bridge mercy-node-agent 2>/dev/null || true
  systemctl disable mercy-dashboard mercy-sfapi-bridge mercy-node-agent 2>/dev/null || true
  rm -f /etc/systemd/system/mercy-dashboard.service /etc/systemd/system/mercy-sfapi-bridge.service /etc/systemd/system/mercy-node-agent.service
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  log "Fertig — $INSTALL_DIR und alle systemd-Dienste vollständig entfernt."
  exit 0
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
  log "Bestehende Installation gefunden — aktualisiere Code (Branch: $BRANCH)"
  git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DASHBOARD_DIR" checkout "$BRANCH"
  git -C "$DASHBOARD_DIR" reset --hard "origin/$BRANCH"
else
  log "Repository klonen nach $DASHBOARD_DIR (Branch: $BRANCH)"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DASHBOARD_DIR"
fi

if [[ ! -f "$CLI_PATH" ]]; then
  log "Mercy-SF-CLI herunterladen"
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
else
  log "CLI bereits vorhanden ($CLI_PATH) — überspringe Download (Updates laufen über das Dashboard/den Node-Agent selbst)"
fi

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
  log "Selbstsigniertes TLS-Zertifikat erzeugen"
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=mercy" >/dev/null 2>&1
else
  log "TLS-Zertifikat bereits vorhanden — überspringe Erzeugung"
fi

if [[ "$NODE_ONLY" == "true" ]]; then
  # --- Nur der schlanke Node-Agent: keine sf-api-Bridge, kein Rust, keine Vendor-Assets, kein
  # eigenes Web-UI. Steuerung läuft komplett vom zentralen Dashboard über die "Nodes"-Seite.
  log "npm-Abhängigkeiten für den Node-Agent installieren (kompiliert node-pty nativ — kann etwas dauern)"
  cd "$NODE_AGENT_DIR"
  npm install --omit=dev --no-audit --no-fund
  mkdir -p "$NODE_AGENT_DIR/data"

  log "systemd-Service für den Node-Agent einrichten"
  cp "$DASHBOARD_DIR/systemd/mercy-node-agent.service" /etc/systemd/system/mercy-node-agent.service
  systemctl daemon-reload
  systemctl enable mercy-node-agent >/dev/null 2>&1
  systemctl restart mercy-node-agent

  sleep 2
  if systemctl is-active --quiet mercy-node-agent; then
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    PAIRING_FILE="$NODE_AGENT_DIR/data/pairing.json"
    CODE=""
    for i in $(seq 1 10); do
      if [[ -f "$PAIRING_FILE" ]]; then
        CODE="$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$PAIRING_FILE')).code)}catch(e){}")"
        [[ -n "$CODE" ]] && break
      fi
      sleep 1
    done
    log "Fertig! Node-Agent läuft auf ${IP:-<server-ip>}:8090"
    if [[ -n "$CODE" ]]; then
      echo -e "\n    IP:     ${IP:-<server-ip>}"
      echo -e "    Port:   8090"
      echo -e "    Code:   $CODE   (15 Minuten gültig, danach automatisch erneuert)\n"
      echo "Im Dashboard unter 'Nodes' → 'Node pairen' eingeben. Ein neuer Code lässt sich jederzeit"
      echo "über 'journalctl -u mercy-node-agent -n 20 --no-pager' einsehen."
    else
      warn "Pairing-Code konnte nicht ausgelesen werden — prüfen mit: journalctl -u mercy-node-agent -n 30 --no-pager"
    fi
  else
    warn "Der Dienst ist nicht aktiv — Logs prüfen mit: journalctl -u mercy-node-agent -n 50 --no-pager"
    exit 1
  fi
  exit 0
fi

if ! command -v cargo >/dev/null 2>&1; then
  log "Rust/Cargo installieren (für die sf-api-Bridge)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >/dev/null 2>&1
else
  log "Rust/Cargo bereits vorhanden ($(cargo --version)) — überspringe Installation"
fi
# shellcheck disable=SC1090
source "$HOME/.cargo/env"

log "npm-Abhängigkeiten installieren (kompiliert node-pty nativ — kann etwas dauern)"
cd "$DASHBOARD_DIR"
npm install --omit=dev --no-audit --no-fund

log "Vendor-Assets bereitstellen (Chart.js, xterm.js)"
mkdir -p "$DASHBOARD_DIR/public/vendor"
cp "$DASHBOARD_DIR/node_modules/chart.js/dist/chart.umd.js" "$DASHBOARD_DIR/public/vendor/chart.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/lib/xterm.js" "$DASHBOARD_DIR/public/vendor/xterm.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/css/xterm.css" "$DASHBOARD_DIR/public/vendor/xterm.css"

mkdir -p "$DASHBOARD_DIR/data"

log "systemd-Service einrichten"
cp "$DASHBOARD_DIR/systemd/mercy-dashboard.service" /etc/systemd/system/mercy-dashboard.service
systemctl daemon-reload
systemctl enable mercy-dashboard >/dev/null 2>&1
systemctl restart mercy-dashboard

log "sf-api-Bridge bauen und als systemd-Dienst einrichten (Ausrüstungs-Abfragen, nur localhost)"
cd "$DASHBOARD_DIR/sfapi-bridge"
cargo build --release
cp "$DASHBOARD_DIR/systemd/mercy-sfapi-bridge.service" /etc/systemd/system/mercy-sfapi-bridge.service
systemctl daemon-reload
systemctl enable mercy-sfapi-bridge >/dev/null 2>&1
systemctl restart mercy-sfapi-bridge
cd "$DASHBOARD_DIR"

sleep 2
if systemctl is-active --quiet mercy-dashboard && systemctl is-active --quiet mercy-sfapi-bridge; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  log "Fertig! Dashboard läuft: https://${IP:-<server-ip>}:8080"
  echo "Weitere Server als Nodes anbinden: dort 'curl ... | bash -s -- --node' ausführen und den"
  echo "angezeigten Pairing-Code unter 'Nodes' in diesem Dashboard eingeben."
else
  warn "Ein Dienst ist nicht aktiv — Logs prüfen mit: journalctl -u mercy-dashboard -n 50 --no-pager / journalctl -u mercy-sfapi-bridge -n 50 --no-pager"
  exit 1
fi
