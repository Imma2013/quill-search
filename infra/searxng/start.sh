#!/bin/sh
set -eu

/opt/searxng/.venv/bin/gunicorn --workers 2 --threads 4 --bind 127.0.0.1:8080 searx.webapp:app --chdir /opt/searxng &
searx_pid=$!

node /opt/quill/apps/api/src/server.js &
api_pid=$!

cleanup() {
  kill "$searx_pid" "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT
wait "$api_pid"
