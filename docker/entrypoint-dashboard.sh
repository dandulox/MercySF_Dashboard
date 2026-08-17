#!/usr/bin/env sh
set -eu

CERTS_DIR="/app/certs"
# lib/{cliExec,cliUpdate,discoveryLogin,ptyManager}.js hard-code /opt/mercy/mercy-cli-linux-x64
# and cwd /opt/mercy with NO env override (unlike node-agent's equivalents) — the container's
# layout has to match that exactly instead, or every account-discovery/bot-start spawn fails
# with "CLI process exited before login completed" (pty.spawn silently can't find the binary).
CLI_PATH="/opt/mercy/mercy-cli-linux-x64"
CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"

if [ ! -f "$CERTS_DIR/cert.pem" ] || [ ! -f "$CERTS_DIR/key.pem" ]; then
  echo "==> Selbstsigniertes TLS-Zertifikat erzeugen"
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=mercy" >/dev/null 2>&1
fi

mkdir -p /opt/mercy
if [ ! -f "$CLI_PATH" ]; then
  echo "==> Mercy-SF-CLI herunterladen"
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
fi

exec node server.js
