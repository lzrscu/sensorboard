#!/bin/sh
# simulate.sh - pretends to be a sensor and posts a random temperature every 2 seconds.
# Usage: ./simulate.sh [url]      (default: http://localhost:8000/ingest.php)
# Stop with Ctrl+C. The API key is read from config.php, so no secret lives in this script.

URL="${1:-http://localhost:8000/ingest.php}"
KEY=$(php -r '$c = require "config.php"; echo $c["api_key"];')

while true; do
    VALUE=$(awk 'BEGIN { srand(); printf "%.1f", 20 + rand() * 5 }')
    curl -s -X POST "$URL" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $KEY" \
        -d "{\"device_id\":\"sim-1\",\"sensor_type\":\"temperature\",\"value\":$VALUE}"
    echo
    sleep 2
done
