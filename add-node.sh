#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/mercy"
DASHBOARD_DIR="$INSTALL_DIR/dashboard"
DASHBOARD_URL="${MERCY_DASHBOARD_URL:-https://localhost:8080}"
NETWORK="${MERCY_DOCKER_NETWORK:-dashboard_mercy-net}"

CYAN='\033[1;36m'
GREEN='\033[1;32m'
BOLD='\033[1m'
RESET='\033[0m'

usage() {
  echo "Usage: $0 <node-name>          # create and link a new node container"
  echo "       $0 --remove <node-name> # remove a node container and unregister it"
  exit 1
}

[[ $# -ge 1 ]] || usage

echo -e "${CYAN}${BOLD}Mercy SF Dashboard — Node Container${RESET}"
read -rp "  Dashboard admin username: " DASH_USER < /dev/tty
read -rsp "  Dashboard admin password: " DASH_PASSWORD < /dev/tty
echo

cd "$DASHBOARD_DIR"

if [[ "$1" == "--remove" ]]; then
  [[ $# -eq 2 ]] || usage
  NODE_NAME="$2"
  node scripts/docker-link-node.js remove \
    --url "$DASHBOARD_URL" --user "$DASH_USER" --password "$DASH_PASSWORD" \
    --name "$NODE_NAME" --volume "mercy_node_${NODE_NAME}_data"
  echo -e "${GREEN}✓ Node '$NODE_NAME' removed and unregistered.${RESET}"
  exit 0
fi

NODE_NAME="$1"
node scripts/docker-link-node.js create \
  --url "$DASHBOARD_URL" --user "$DASH_USER" --password "$DASH_PASSWORD" \
  --name "$NODE_NAME" --network "$NETWORK" \
  --image mercy-node-agent:latest --volume "mercy_node_${NODE_NAME}_data"
echo -e "${GREEN}✓ Node '$NODE_NAME' created and linked.${RESET}"
