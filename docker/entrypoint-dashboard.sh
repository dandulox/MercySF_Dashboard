#!/usr/bin/env sh
set -eu

CERTS_DIR="/app/certs"
# lib/{cliExec,cliUpdate,discoveryLogin,ptyManager}.js hard-code /opt/mercy/mercy-cli-linux-x64
# and cwd /opt/mercy with NO env override (unlike node-agent's equivalents) — the container's
# layout has to match that exactly instead, or every account-discovery/bot-start spawn fails
# with "CLI process exited before login completed" (pty.spawn silently can't find the binary).
CLI_PATH="/opt/mercy/mercy-cli-linux-x64"
# ELF e_machine (offset 18, 2-byte little-endian — low byte alone distinguishes the two
# architectures downloaded here) — catches a leftover binary for the wrong CPU baked into a
# volume from an older/different image (e.g. /opt/mercy migrated from an x64 host).
case "$(uname -m)" in
  x86_64|amd64) CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"; CLI_EXPECTED_MACHINE="3e" ;;
  aarch64|arm64) CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-arm64"; CLI_EXPECTED_MACHINE="b7" ;;
  *)
    echo "Unsupported CPU architecture for the Mercy SF CLI: $(uname -m) (supported: x86_64, aarch64/arm64)." >&2
    exit 1
    ;;
esac
cli_arch_mismatches() {
  machine_byte="$(od -An -tx1 -j 18 -N 1 "$CLI_PATH" 2>/dev/null | tr -d ' ')"
  [ "$machine_byte" != "$CLI_EXPECTED_MACHINE" ]
}

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
elif cli_arch_mismatches; then
  echo "==> Vorhandene CLI passt nicht zur CPU-Architektur ($(uname -m)) — lösche sie und lade die richtige Version neu"
  rm -f "$CLI_PATH"
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
fi

exec node server.js
