#!/bin/sh
set -eu

python -m searx.webapp &
searx_pid=$!

node /opt/quill/apps/api/src/server.js &
api_pid=$!

cleanup() {
  kill "$searx_pid" "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT
wait "$api_pid"
