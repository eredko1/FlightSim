#!/bin/bash
# Start a local server for Flight Sim (needed for service worker tile caching)
echo "Flight Sim starting at http://localhost:8080"
echo "Press Ctrl+C to stop"
cd "$(dirname "$0")"
python3 -m http.server 8080
