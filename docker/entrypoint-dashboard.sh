#!/usr/bin/env sh
set -eu

CERTS_DIR="/app/certs"
CLI_PATH="/app/data/mercy-cli-linux-x64"
CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"

if [ ! -f "$CERTS_DIR/cert.pem" ] || [ ! -f "$CERTS_DIR/key.pem" ]; then
  echo "==> Selbstsigniertes TLS-Zertifikat erzeugen"
  mkdir -p "$CERTS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=mercy" >/dev/null 2>&1
fi

if [ ! -f "$CLI_PATH" ]; then
  echo "==> Mercy-SF-CLI herunterladen"
  mkdir -p /app/data
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
fi

exec node server.js
