#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/mercy"
DASHBOARD_DIR="$INSTALL_DIR/dashboard"
DASHBOARD_URL="${MERCY_DASHBOARD_URL:-https://localhost:8080}"
NETWORK="${MERCY_DOCKER_NETWORK:-dashboard_mercy-net}"

usage() {
  echo "Usage: $0 <node-name>          # neuen Node-Container erzeugen und verlinken"
  echo "       $0 --remove <node-name> # Node-Container entfernen und im Dashboard austragen"
  exit 1
}

[[ $# -ge 1 ]] || usage

read -rp "Dashboard-Admin-Benutzername: " DASH_USER < /dev/tty
read -rsp "Dashboard-Admin-Passwort: " DASH_PASSWORD < /dev/tty
echo

cd "$DASHBOARD_DIR"

if [[ "$1" == "--remove" ]]; then
  [[ $# -eq 2 ]] || usage
  NODE_NAME="$2"
  node scripts/docker-link-node.js remove \
    --url "$DASHBOARD_URL" --user "$DASH_USER" --password "$DASH_PASSWORD" \
    --name "$NODE_NAME" --volume "mercy_node_${NODE_NAME}_data"
  exit 0
fi

NODE_NAME="$1"
node scripts/docker-link-node.js create \
  --url "$DASHBOARD_URL" --user "$DASH_USER" --password "$DASH_PASSWORD" \
  --name "$NODE_NAME" --network "$NETWORK" \
  --image mercy-node-agent:latest --volume "mercy_node_${NODE_NAME}_data"
