#!/usr/bin/env sh
set -eu

# node-agent/lib/{cliExec,cliUpdate,ptyManager}.js default to /opt/mercy/mercy-cli-linux-x64 and
# cwd /opt/mercy (same as a native install) unless MERCY_CLI_PATH/MERCY_CLI_CWD override them —
# keep the container's layout matching that default instead of overriding, since it's what the
# rest of the native-install-oriented code (and the CLI's own data dir, /opt/mercy/data) expects.
CLI_PATH="/opt/mercy/mercy-cli-linux-x64"
CLI_DOWNLOAD_URL="https://mercysf.app/downloads/mercy-cli-linux-x64"

mkdir -p /opt/mercy
if [ ! -f "$CLI_PATH" ]; then
  echo "==> Mercy-SF-CLI herunterladen"
  curl -fsSL -o "$CLI_PATH" "$CLI_DOWNLOAD_URL"
  chmod +x "$CLI_PATH"
fi

exec node server.js
