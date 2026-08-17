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
  if [[ -d "$DASHBOARD_DIR" ]]; then
    (cd "$DASHBOARD_DIR" && docker compose down -v 2>/dev/null || true)
  fi
  rm -rf "$INSTALL_DIR"
  log "Fertig — $INSTALL_DIR, alle systemd-Dienste und ein evtl. laufender Docker-Stack vollständig entfernt."
  exit 0
fi

# --- Docker-Installationszweig ------------------------------------------------------------
# Alternative zur nativen systemd-Installation unten: Dashboard, sf-api-Bridge (im selben
# Network-Namespace, siehe docker-compose.yml — lib/characterClassDetector.js ruft die Bridge
# hart codiert über 127.0.0.1:4001 auf) und optional zusätzliche Node-Container laufen als
# Docker-Container statt als systemd-Dienste. Nodes werden über scripts/docker-link-node.js
# automatisch erzeugt und gepairt (kein manuelles IP/Code-Eintippen im Dashboard nötig).
install_docker_mode() {
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    # Offizielles Docker-apt-Repo statt des generischen get.docker.com-Installers — passt zum
    # Rest des Skripts, das ohnehin gezielt Debian/Ubuntu per apt bedient (siehe Header-Kommentar),
    # und installiert docker-compose-plugin gleich mit (Compose v2, kein Legacy-"docker-compose").
    log "Docker Engine + Compose Plugin über das offizielle apt-Repository installieren"
    . /etc/os-release
    case "$ID" in
      debian|ubuntu) DOCKER_APT_DISTRO="$ID" ;;
      *)
        echo "Nicht unterstützte Distribution für die automatische Docker-Installation: $ID (nur Debian/Ubuntu). Bitte Docker manuell installieren und erneut versuchen." >&2
        exit 1
        ;;
    esac
    apt-get install -y -qq ca-certificates gnupg >/dev/null
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$DOCKER_APT_DISTRO/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$DOCKER_APT_DISTRO $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    systemctl enable --now docker >/dev/null 2>&1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose Plugin fehlt trotz Installation — bitte manuell prüfen ('docker compose version')." >&2
    exit 1
  fi
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]]; then
    # scripts/docker-link-node.js läuft auf dem Host, nicht im Container — braucht daher eine
    # eigene Node-Runtime unabhängig vom Dashboard-Image.
    log "Node.js 20.x (NodeSource) installieren (für scripts/docker-link-node.js auf dem Host)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi

  read -rp "Anzahl zusätzlicher Node-Container [0]: " NODE_COUNT < /dev/tty
  NODE_COUNT="${NODE_COUNT:-0}"
  read -rp "Admin-Benutzername für das Dashboard: " DASH_USER < /dev/tty
  read -rsp "Admin-Passwort für das Dashboard: " DASH_PASSWORD < /dev/tty
  echo

  mkdir -p "$INSTALL_DIR"
  if [[ -d "$DASHBOARD_DIR/.git" ]]; then
    git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$DASHBOARD_DIR" checkout -B "$BRANCH" FETCH_HEAD
  else
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DASHBOARD_DIR"
  fi

  cd "$DASHBOARD_DIR"
  log "Docker-Images bauen und Dashboard + sf-api-Bridge starten"
  docker compose build
  docker compose up -d

  log "Warte auf Dashboard-Erreichbarkeit"
  for i in $(seq 1 30); do
    if curl -sk https://localhost:8080/api/status >/dev/null 2>&1; then break; fi
    sleep 1
  done

  log "Dashboard-Konto einrichten"
  node scripts/docker-link-node.js setup --url https://localhost:8080 --user "$DASH_USER" --password "$DASH_PASSWORD"

  if [[ "$NODE_COUNT" -gt 0 ]]; then
    docker build -f Dockerfile.node-agent -t mercy-node-agent:latest .
    # Compose leitet den Netzwerknamen standardmäßig aus dem (lowercased) Verzeichnisnamen des
    # Compose-Projekts ab — "${DASHBOARD_DIR##*/}" ist hier immer "dashboard" (siehe
    # DASHBOARD_DIR-Definition oben), ergibt also "dashboard_mercy-net".
    NODE_NETWORK="${DASHBOARD_DIR##*/}_mercy-net"
    for i in $(seq 1 "$NODE_COUNT"); do
      NODE_NAME="node-$i"
      log "Node-Container '$NODE_NAME' erzeugen und verlinken"
      node scripts/docker-link-node.js create \
        --url https://localhost:8080 --user "$DASH_USER" --password "$DASH_PASSWORD" \
        --name "$NODE_NAME" --network "$NODE_NETWORK" \
        --image mercy-node-agent:latest --volume "mercy_node_${NODE_NAME}_data"
    done
  fi

  log "Fertig! Dashboard läuft: https://localhost:8080 ($NODE_COUNT Node-Container verlinkt)"
}

INSTALL_MODE="native"
# --node ist ausschließlich für die native, schlanke Node-Agent-Installation gedacht (siehe
# NODE_ONLY-Block unten) — für den Docker-Weg gibt es stattdessen add-node.sh, daher hier keine
# Docker-Abfrage, wenn --node explizit angegeben wurde.
if [[ "$NODE_ONLY" == "false" ]] && { [[ -t 0 ]] || [[ -e /dev/tty ]]; }; then
  read -rp "Installationsart wählen — [n]ativ (systemd) oder [d]ocker? [n/d]: " ANSWER < /dev/tty
  if [[ "${ANSWER,,}" == "d" || "${ANSWER,,}" == "docker" ]]; then
    INSTALL_MODE="docker"
  fi
fi

if [[ "$INSTALL_MODE" == "docker" ]]; then
  install_docker_mode
  exit 0
fi

log "Pakete aktualisieren und Build-Abhängigkeiten installieren"
apt-get update -qq
apt-get install -y -qq curl git build-essential python3 openssl ca-certificates wireguard-tools resolvconf >/dev/null

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
  # --depth 1 clones sind implizit --single-branch: der ursprüngliche Fetch-Refspec kennt nur den
  # Branch, mit dem installiert wurde. "fetch origin $BRANCH" holt die Commits zwar in FETCH_HEAD,
  # legt aber keinen origin/$BRANCH-Tracking-Branch an — ein reines "checkout $BRANCH" bzw.
  # "reset --hard origin/$BRANCH" schlägt daher beim Wechsel auf einen anderen Branch fehl.
  # "checkout -B $BRANCH FETCH_HEAD" erstellt/setzt den lokalen Branch direkt aus FETCH_HEAD,
  # unabhängig davon, ob ein Remote-Tracking-Branch existiert.
  git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DASHBOARD_DIR" checkout -B "$BRANCH" FETCH_HEAD
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
