#!/bin/bash

TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
EXPORT_DIR="/opt/rsos/exports/$TIMESTAMP"

mkdir -p "$EXPORT_DIR"

echo "Creating RS OS snapshot..."

curl -s http://localhost:8090/fleet/status \
> "$EXPORT_DIR/fleet-status.json"

curl -s http://localhost:8090/fleet/metrics \
> "$EXPORT_DIR/runtime-metrics.json"

curl -s http://localhost:8090/fleet/commands \
> "$EXPORT_DIR/command-history.json"

curl -s http://localhost:8090/packages?channel=stable \
> "$EXPORT_DIR/packages.json"

cp /opt/rsos/knowledge/current/CHATGPT_HANDOFF.md \
"$EXPORT_DIR/CHATGPT_HANDOFF.md"

tar -czf "/opt/rsos/exports/rsos-snapshot-$TIMESTAMP.tar.gz" \
-C "/opt/rsos/exports" "$TIMESTAMP"

echo "Snapshot complete:"
echo "/opt/rsos/exports/rsos-snapshot-$TIMESTAMP.tar.gz"
