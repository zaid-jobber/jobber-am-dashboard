#!/bin/zsh
# Double-click to launch the AM Hub (starts the proxy + app, opens the browser).
cd "$(dirname "$0")"
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null
eval "$(fnm env)" 2>/dev/null

echo "Starting AM Hub…"

# Proxy (Gmail/Calendar/weather) in the background
( cd server && npm start ) &
PROXY_PID=$!

# Give the proxy a moment, then open the dashboard
sleep 2
open "http://localhost:5173"

# App (foreground — closing this window stops everything)
cd am-hub && pnpm dev

# Clean up the proxy when the app stops
kill $PROXY_PID 2>/dev/null
