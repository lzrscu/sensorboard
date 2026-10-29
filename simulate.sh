#!/bin/sh
# simulate.sh - pretends to be a sensor and posts a random temperature every 2 seconds.
# usage: ./simulate.sh [url]      (default: http://localhost:8000/ingest.php)

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
