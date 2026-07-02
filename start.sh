#!/bin/bash
# OpenClaw Dashboard — one-click launcher
# Double-click this file or run: ./start.sh

cd "$(dirname "$0")"

PORT="${PORT:-3333}"

# Check if already running
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "OpenClaw Dashboard already running on port $PORT"
  open "http://localhost:$PORT"
  exit 0
fi

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build if needed
if [ ! -d .next ]; then
  echo "Building OpenClaw Dashboard..."
  npm run build
fi

echo "Starting OpenClaw Dashboard on http://localhost:$PORT"

# Start in background, open browser, and keep terminal alive
npm run start &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    echo "OpenClaw Dashboard is ready!"
    open "http://localhost:$PORT"
    break
  fi
  sleep 1
done

# Keep running — Ctrl+C to stop
wait $SERVER_PID
