#!/usr/bin/env bash
#
# Mercy SF Dashboard — One-Shot Installer
#
# Full dashboard (incl. local CLI, sf-api bridge) on a fresh Debian/Ubuntu server (as root):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
#
# Slim node-agent only (remote-controls accounts on this server from a central dashboard, see the
# "Nodes" page there — no web UI of its own, no sf-api build):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --node
#
# Install/test from a specific branch (e.g. a feature branch before merging to main) —
# MERCY_BRANCH controls which branch is cloned/checked out; install.sh itself must still be
# fetched from that exact branch:
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/nodetest/install.sh | MERCY_BRANCH=nodetest bash -s -- --node
#
# Uninstall (removes EVERYTHING, incl. saved credentials and stats history):
#   curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
#
# Idempotent: running it again only updates code + dependencies — existing account data
# (/opt/mercy/dashboard/data resp. /opt/mercy/dashboard/node-agent/data), certificates
# (/opt/mercy/certs), and the installed CLI (/opt/mercy/mercy-cli-linux-x64) are left untouched
# if already present.

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

BOLD='\033[1m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
DIM='\033[2m'
RESET='\033[0m'

log()  { echo -e "\n${CYAN}==>${RESET} ${BOLD}$*${RESET}"; }
step() { echo -e "  ${DIM}-${RESET} $*"; }
warn() { echo -e "${YELLOW}!!${RESET} $*"; }
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
die()  { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }

# Simple per-step progress bar: call progress "label" once per major step, after setting
# STEP=0 and TOTAL_STEPS=<n> for the current install path. This isn't an animated/redrawn bar —
# just a running "[n/N]" indicator printed once per step, the same way tools like Homebrew do it.
STEP=0
TOTAL_STEPS=1
progress() {
  STEP=$((STEP + 1))
  local pct=$(( STEP * 100 / TOTAL_STEPS ))
  local filled=$(( pct / 5 ))
  local empty=$(( 20 - filled ))
  local bar
  bar="$(printf '%*s' "$filled" '' | tr ' ' '#')$(printf '%*s' "$empty" '' | tr ' ' '-')"
  echo -e "\n${CYAN}[${bar}] ${pct}%${RESET} ${DIM}(${STEP}/${TOTAL_STEPS})${RESET} ${BOLD}$*${RESET}"
}

# Runs a long, noisy command (docker build/pull, npm install, cargo build, ...) in the
# background behind a spinner instead of letting hundreds of lines of layer hashes/compiler
# output scroll past. Full output is captured to a temp file: silent on success, dumped
# (last 40 lines) on failure so the actual error is still visible.
run_step() {
  local label="$1"; shift
  local logfile
  logfile="$(mktemp)"
  "$@" >"$logfile" 2>&1 &
  local pid=$!
  local frames='|/-\'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  %s %s" "${frames:$((i % 4)):1}" "$label"
    i=$((i + 1))
    sleep 0.15
  done
  if wait "$pid"; then
    printf "\r  ${GREEN}✓${RESET} %s\n" "$label"
    rm -f "$logfile"
  else
    local status=$?
    printf "\r  ${RED}✗${RESET} %s\n" "$label"
    echo -e "  ${DIM}--- last output ---${RESET}"
    tail -n 40 "$logfile" | sed 's/^/  /'
    rm -f "$logfile"
    die "'$label' failed — see output above."
  fi
}

banner() {
  echo -e "${BOLD}${CYAN}"
  echo '  __  __                          ____  _____ '
  echo ' |  \/  | ___ _ __ ___ _   _     / ___||  ___|'
  echo ' | |\/| |/ _ \ '"'"'__/ __| | | |____\___ \| |_   '
  echo ' | |  | |  __/ | | (__| |_| |_____|__) |  _|  '
  echo ' |_|  |_|\___|_|  \___|\__, |    |____/|_|    '
  echo '                       |___/                  '
  echo -e "${RESET}"
  echo -e "  ${DIM}Dashboard Installer — built on the official Mercy SF CLI and sf-api by the-marenga.${RESET}"
  echo -e "  ${DIM}Thanks for using Mercy SF Dashboard! Special thanks to Sensei Issei.${RESET}"
  echo
}

if [[ "$(id -u)" -ne 0 ]]; then
  die "Please run as root (e.g. via sudo)."
fi

banner

if [[ "${1:-}" == "--uninstall" ]]; then
  log "Removing Mercy SF (dashboard and/or node agent — removes EVERYTHING: code, services, certificates, CLI, saved credentials, stats history, Docker containers/volumes)"
  systemctl stop mercy-dashboard mercy-sfapi-bridge mercy-node-agent 2>/dev/null || true
  systemctl disable mercy-dashboard mercy-sfapi-bridge mercy-node-agent 2>/dev/null || true
  rm -f /etc/systemd/system/mercy-dashboard.service /etc/systemd/system/mercy-sfapi-bridge.service /etc/systemd/system/mercy-node-agent.service
  systemctl daemon-reload
  if [[ -d "$DASHBOARD_DIR" ]]; then
    (cd "$DASHBOARD_DIR" && docker compose down -v 2>/dev/null || true)
  fi
  if command -v docker >/dev/null 2>&1; then
    # Node containers created via add-node.sh (or install.sh's own node loop) never go through
    # docker-compose, so "compose down" above doesn't touch them — find them by the
    # "mercy.role=node" label (set in scripts/lib/dockerNode.js) instead and remove each one
    # plus its data volume.
    NODE_CONTAINER_IDS="$(docker ps -aq --filter 'label=mercy.role=node' 2>/dev/null || true)"
    if [[ -n "$NODE_CONTAINER_IDS" ]]; then
      NODE_COUNT_REMOVED=0
      for cid in $NODE_CONTAINER_IDS; do
        NAME="$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##')"
        docker rm -f "$cid" >/dev/null 2>&1 || true
        if [[ -n "$NAME" ]]; then
          docker volume rm "mercy_node_${NAME}_data" >/dev/null 2>&1 || true
          docker volume rm "mercy_node_${NAME}_cli" >/dev/null 2>&1 || true
        fi
        NODE_COUNT_REMOVED=$((NODE_COUNT_REMOVED + 1))
      done
      ok "Removed $NODE_COUNT_REMOVED Docker node container(s) and their volumes"
    fi
  fi
  rm -rf "$INSTALL_DIR"
  ok "Done — $INSTALL_DIR, all systemd services, and any running Docker stack (dashboard, sf-api bridge, node containers) have been fully removed."
  exit 0
fi

# --- Docker install path -------------------------------------------------------------------
# Alternative to the native systemd install below: dashboard, sf-api bridge (sharing the same
# network namespace, see docker-compose.yml — lib/characterClassDetector.js hard-codes calling
# the bridge over 127.0.0.1:4001), and optionally extra node containers all run as Docker
# containers instead of systemd services. Nodes get created and paired automatically through
# scripts/docker-link-node.js (no manual IP/code entry in the dashboard needed).
install_docker_mode() {
  echo
  read -rp "  How many extra node containers? [0]: " NODE_COUNT < /dev/tty
  NODE_COUNT="${NODE_COUNT:-0}"
  read -rp "  Dashboard admin username: " DASH_USER < /dev/tty
  read -rsp "  Dashboard admin password: " DASH_PASSWORD < /dev/tty
  echo

  STEP=0
  TOTAL_STEPS=$((6 + NODE_COUNT))

  progress "Checking Docker Engine + Compose plugin"
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    # Official Docker apt repo instead of the generic get.docker.com installer — matches the
    # rest of the script, which already targets Debian/Ubuntu specifically via apt (see header
    # comment), and installs docker-compose-plugin along with it (Compose v2, no legacy
    # "docker-compose").
    . /etc/os-release
    case "$ID" in
      debian|ubuntu) DOCKER_APT_DISTRO="$ID" ;;
      *)
        die "Unsupported distribution for automatic Docker installation: $ID (Debian/Ubuntu only). Please install Docker manually and try again."
        ;;
    esac
    run_step "Adding the Docker apt repository" bash -c "
      apt-get install -y -qq ca-certificates gnupg &&
      install -m 0755 -d /etc/apt/keyrings &&
      curl -fsSL https://download.docker.com/linux/$DOCKER_APT_DISTRO/gpg -o /etc/apt/keyrings/docker.asc &&
      chmod a+r /etc/apt/keyrings/docker.asc &&
      echo 'deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$DOCKER_APT_DISTRO $VERSION_CODENAME stable' > /etc/apt/sources.list.d/docker.list &&
      apt-get update -qq
    "
    run_step "Installing Docker Engine + Compose plugin" apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker >/dev/null 2>&1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "Compose plugin missing despite installation — please check manually ('docker compose version')."
  fi

  progress "Checking Node.js host runtime"
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]]; then
    # scripts/docker-link-node.js runs on the host, not in a container — needs its own Node
    # runtime independent of the dashboard image.
    run_step "Installing Node.js 20.x (NodeSource, for scripts/docker-link-node.js on the host)" \
      bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs"
  fi

  progress "Fetching the repository"
  mkdir -p "$INSTALL_DIR"
  if [[ -d "$DASHBOARD_DIR/.git" ]]; then
    git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$DASHBOARD_DIR" checkout -B "$BRANCH" FETCH_HEAD
  else
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DASHBOARD_DIR"
  fi
  cd "$DASHBOARD_DIR"

  progress "Building Docker images and starting dashboard + sf-api bridge"
  run_step "Building images (dashboard + sf-api bridge) — this can take a few minutes" docker compose build
  run_step "Starting containers" docker compose up -d

  progress "Waiting for the dashboard to become reachable"
  for i in $(seq 1 30); do
    if curl -sk https://localhost:8080/api/status >/dev/null 2>&1; then break; fi
    sleep 1
  done
  ok "Dashboard reachable"

  progress "Setting up the dashboard account"
  node scripts/docker-link-node.js setup --url https://localhost:8080 --user "$DASH_USER" --password "$DASH_PASSWORD"

  if [[ "$NODE_COUNT" -gt 0 ]]; then
    run_step "Building the node-agent image" docker build -f Dockerfile.node-agent -t mercy-node-agent:latest .
    # Compose derives the network name from the (lowercased) compose project directory name by
    # default — "${DASHBOARD_DIR##*/}" is always "dashboard" here (see the DASHBOARD_DIR
    # definition above), so this resolves to "dashboard_mercy-net".
    NODE_NETWORK="${DASHBOARD_DIR##*/}_mercy-net"
    for i in $(seq 1 "$NODE_COUNT"); do
      NODE_NAME="node-$i"
      progress "Creating and linking node container '$NODE_NAME'"
      node scripts/docker-link-node.js create \
        --url https://localhost:8080 --user "$DASH_USER" --password "$DASH_PASSWORD" \
        --name "$NODE_NAME" --network "$NODE_NETWORK" \
        --image mercy-node-agent:latest --volume "mercy_node_${NODE_NAME}_data" \
        --cli-volume "mercy_node_${NODE_NAME}_cli"
    done
  fi

  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo -e "\n${GREEN}${BOLD}✓ Installation complete${RESET}"
  echo -e "  Dashboard: ${BOLD}https://${IP:-<server-ip>}:8080${RESET}"
  echo "  Node containers linked: $NODE_COUNT"
  echo -e "  Add more later:  ${DIM}./add-node.sh <name>${RESET}"
}

# Lighter re-run for an already-existing Docker install: no account/node-count prompts (the
# account already exists — re-running the setup call would just 409). Pulls the latest code,
# rebuilds/restarts the dashboard + sf-api bridge, and also replaces every existing node
# container with one from a freshly built node-agent image — their data volumes (incl. the
# node-agent's pairing token, see docker-link-node.js's "update" subcommand) are left untouched,
# so no re-pairing is needed.
update_docker_mode() {
  STEP=0
  TOTAL_STEPS=3

  progress "Pulling the latest code (branch: $BRANCH)"
  git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DASHBOARD_DIR" checkout -B "$BRANCH" FETCH_HEAD
  cd "$DASHBOARD_DIR"

  progress "Rebuilding and restarting dashboard + sf-api bridge"
  run_step "Building images — this can take a few minutes" docker compose build
  run_step "Starting containers" docker compose up -d

  progress "Updating node containers"
  NODE_NAMES="$(docker ps -aq --filter 'label=mercy.role=node' 2>/dev/null | while read -r cid; do
    docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##'
  done)"
  if [[ -n "$NODE_NAMES" ]]; then
    run_step "Building the node-agent image" docker build -f Dockerfile.node-agent -t mercy-node-agent:latest .
    NODE_NETWORK="${DASHBOARD_DIR##*/}_mercy-net"
    NODE_COUNT_UPDATED=0
    while IFS= read -r NODE_NAME; do
      [[ -z "$NODE_NAME" ]] && continue
      node scripts/docker-link-node.js update \
        --name "$NODE_NAME" --network "$NODE_NETWORK" --image mercy-node-agent:latest \
        --volume "mercy_node_${NODE_NAME}_data" --cli-volume "mercy_node_${NODE_NAME}_cli"
      NODE_COUNT_UPDATED=$((NODE_COUNT_UPDATED + 1))
    done <<< "$NODE_NAMES"
    ok "Updated $NODE_COUNT_UPDATED node container(s)"
  else
    ok "No node containers to update"
  fi

  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo -e "\n${GREEN}${BOLD}✓ Update complete${RESET}"
  echo -e "  Dashboard: ${BOLD}https://${IP:-<server-ip>}:8080${RESET}"
}

# Detect an existing installation so a second run updates it instead of re-prompting for
# native-vs-Docker and (in the Docker case) re-running one-time setup steps like account
# creation, which would just fail against an account that already exists.
EXISTING_MODE=""
if [[ -f /etc/systemd/system/mercy-dashboard.service || -f /etc/systemd/system/mercy-node-agent.service ]]; then
  EXISTING_MODE="native"
elif [[ -f "$DASHBOARD_DIR/docker-compose.yml" ]] && command -v docker >/dev/null 2>&1 \
  && [[ -n "$(cd "$DASHBOARD_DIR" && docker compose ps -q dashboard 2>/dev/null)" ]]; then
  EXISTING_MODE="docker"
fi

if [[ -n "$EXISTING_MODE" && "$NODE_ONLY" == "false" ]]; then
  ok "Existing $EXISTING_MODE installation detected — updating instead of reinstalling."
  if [[ "$EXISTING_MODE" == "docker" ]]; then
    update_docker_mode
    exit 0
  fi
  INSTALL_MODE="native"
else
  INSTALL_MODE="native"
  # --node is exclusively for the slim, native node-agent install (see the NODE_ONLY block
  # below) — the Docker path has add-node.sh for that instead, so skip the Docker prompt when
  # --node was explicitly given.
  if [[ "$NODE_ONLY" == "false" ]] && { [[ -t 0 ]] || [[ -e /dev/tty ]]; }; then
    sleep 5
    read -rp "  Installation type — [n]ative (systemd) or [d]ocker? [n/d]: " ANSWER < /dev/tty
    if [[ "${ANSWER,,}" == "d" || "${ANSWER,,}" == "docker" ]]; then
      INSTALL_MODE="docker"
    fi
  fi
fi

if [[ "$INSTALL_MODE" == "docker" ]]; then
  install_docker_mode
  exit 0
fi

if [[ "$NODE_ONLY" == "true" ]]; then TOTAL_STEPS=7; else TOTAL_STEPS=10; fi
STEP=0

progress "Updating packages and installing build dependencies"
run_step "apt-get update" apt-get update -qq
run_step "Installing build dependencies" apt-get install -y -qq curl git build-essential python3 openssl ca-certificates wireguard-tools resolvconf

progress "Checking Node.js"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]]; then
  run_step "Installing Node.js 20.x (NodeSource)" bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs"
else
  ok "Node.js already present ($(node -v)) — skipping install"
fi

mkdir -p "$INSTALL_DIR"

if [[ -d "$DASHBOARD_DIR/.git" ]]; then
  progress "Existing installation found — updating code (branch: $BRANCH)"
  # --depth 1 clones are implicitly --single-branch: the original fetch refspec only knows the
  # branch it was installed with. "fetch origin $BRANCH" does pull the commits into FETCH_HEAD,
  # but doesn't create an origin/$BRANCH tracking branch — a plain "checkout $BRANCH" or
  # "reset --hard origin/$BRANCH" therefore fails when switching to a different branch.
  # "checkout -B $BRANCH FETCH_HEAD" creates/sets the local branch directly from FETCH_HEAD,
  # regardless of whether a remote-tracking branch exists.
  git -C "$DASHBOARD_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DASHBOARD_DIR" checkout -B "$BRANCH" FETCH_HEAD
else
  progress "Cloning repository into $DASHBOARD_DIR (branch: $BRANCH)"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DASHBOARD_DIR"
fi

progress "Checking the Mercy SF CLI"
if [[ ! -f "$CLI_PATH" ]]; then
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
  ok "CLI downloaded"
else
  ok "CLI already present ($CLI_PATH) — skipping download (updates run through the dashboard/node agent itself)"
fi

progress "Checking the TLS certificate"
if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=mercy" >/dev/null 2>&1
  ok "Self-signed TLS certificate generated"
else
  ok "TLS certificate already present — skipping generation"
fi

if [[ "$NODE_ONLY" == "true" ]]; then
  # --- Slim node agent only: no sf-api bridge, no Rust, no vendor assets, no web UI of its own.
  # Control runs entirely from the central dashboard's "Nodes" page.
  progress "Installing npm dependencies for the node agent (compiles node-pty natively)"
  cd "$NODE_AGENT_DIR"
  run_step "npm install" npm install --omit=dev --no-audit --no-fund
  mkdir -p "$NODE_AGENT_DIR/data"

  progress "Setting up the node-agent systemd service"
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
    echo -e "\n${GREEN}${BOLD}✓ Done — node agent running on ${IP:-<server-ip>}:8090${RESET}"
    if [[ -n "$CODE" ]]; then
      echo -e "\n    IP:     ${IP:-<server-ip>}"
      echo -e "    Port:   8090"
      echo -e "    Code:   $CODE   (valid for 15 minutes, then auto-renewed)\n"
      echo "  Enter these in the dashboard under 'Nodes' → 'Pair a node'. A new code can be"
      echo "  retrieved anytime via 'journalctl -u mercy-node-agent -n 20 --no-pager'."
    else
      warn "Could not read the pairing code — check with: journalctl -u mercy-node-agent -n 30 --no-pager"
    fi
  else
    warn "The service is not active — check the logs with: journalctl -u mercy-node-agent -n 50 --no-pager"
    exit 1
  fi
  exit 0
fi

progress "Checking Rust/Cargo"
if ! command -v cargo >/dev/null 2>&1; then
  run_step "Installing Rust/Cargo (for the sf-api bridge)" bash -c "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
else
  ok "Rust/Cargo already present ($(cargo --version)) — skipping install"
fi
# shellcheck disable=SC1090
source "$HOME/.cargo/env"

progress "Installing npm dependencies (compiles node-pty natively)"
cd "$DASHBOARD_DIR"
run_step "npm install" npm install --omit=dev --no-audit --no-fund

progress "Deploying vendor assets (Chart.js, xterm.js)"
mkdir -p "$DASHBOARD_DIR/public/vendor"
cp "$DASHBOARD_DIR/node_modules/chart.js/dist/chart.umd.js" "$DASHBOARD_DIR/public/vendor/chart.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/lib/xterm.js" "$DASHBOARD_DIR/public/vendor/xterm.js"
cp "$DASHBOARD_DIR/node_modules/@xterm/xterm/css/xterm.css" "$DASHBOARD_DIR/public/vendor/xterm.css"

mkdir -p "$DASHBOARD_DIR/data"

progress "Setting up the dashboard systemd service"
cp "$DASHBOARD_DIR/systemd/mercy-dashboard.service" /etc/systemd/system/mercy-dashboard.service
systemctl daemon-reload
systemctl enable mercy-dashboard >/dev/null 2>&1
systemctl restart mercy-dashboard

progress "Building the sf-api bridge and setting it up as a systemd service (equipment lookups, localhost only)"
cd "$DASHBOARD_DIR/sfapi-bridge"
run_step "cargo build --release — this can take a few minutes" cargo build --release
cp "$DASHBOARD_DIR/systemd/mercy-sfapi-bridge.service" /etc/systemd/system/mercy-sfapi-bridge.service
systemctl daemon-reload
systemctl enable mercy-sfapi-bridge >/dev/null 2>&1
systemctl restart mercy-sfapi-bridge
cd "$DASHBOARD_DIR"

sleep 2
if systemctl is-active --quiet mercy-dashboard && systemctl is-active --quiet mercy-sfapi-bridge; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo -e "\n${GREEN}${BOLD}✓ Done — dashboard running at https://${IP:-<server-ip>}:8080${RESET}"
  echo "  Connect more servers as nodes: run 'curl ... | bash -s -- --node' there and enter the"
  echo "  displayed pairing code under 'Nodes' in this dashboard."
else
  warn "A service is not active — check the logs with: journalctl -u mercy-dashboard -n 50 --no-pager / journalctl -u mercy-sfapi-bridge -n 50 --no-pager"
  exit 1
fi
