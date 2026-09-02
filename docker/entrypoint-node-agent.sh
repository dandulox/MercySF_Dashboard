#!/usr/bin/env sh
set -eu

# node-agent/lib/{cliExec,cliUpdate,ptyManager}.js default to /opt/mercy/mercy-cli-linux-x64 and
# cwd /opt/mercy (same as a native install) unless MERCY_CLI_PATH/MERCY_CLI_CWD override them —
# keep the container's layout matching that default instead of overriding, since it's what the
# rest of the native-install-oriented code (and the CLI's own data dir, /opt/mercy/data) expects.
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
