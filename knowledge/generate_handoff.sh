#!/bin/bash

OUTPUT="/opt/rsos/knowledge/current/CHATGPT_HANDOFF.md"

TIMESTAMP=$(date -Iseconds)

FLEET=$(curl -s -u admin:RSOS-2026-SECURE \
http://localhost:8090/fleet/status)

METRICS=$(curl -s -u admin:RSOS-2026-SECURE \
http://localhost:8090/fleet/metrics)

PACKAGES=$(curl -s -u admin:RSOS-2026-SECURE \
http://localhost:8090/packages?channel=stable)

cat <<EOF > "$OUTPUT"
# RS OS CHATGPT HANDOFF

Generated:
$TIMESTAMP

==================================================

PROJECT:
RS OS (Rudolph Services Operating System)

GOAL:
Distributed runtime, deployment and fleet platform.

==================================================

CURRENT RUNTIME

Registry:
http://85.190.98.31:8090

Control Plane:
http://85.190.98.31:8090/control

Runtime API:
https://api.rudolph-buchhaltung.de/health

==================================================

SERVER PATHS

Registry Server:
    /opt/rsos/registry-server

Registry Main:
    /opt/rsos/registry-server/server.js

Control Plane:
    /opt/rsos/registry-server/control.html

Node Agent:
    /opt/rsos/node-agent/agent.sh

Runtime API:
    /opt/rsos/runtime-api

Knowledge:
    /opt/rsos/knowledge

==================================================

IMPLEMENTED FEATURES

- Signed runtime packages
- Package verification
- Stable deployment channel
- Runtime registry
- Fleet check-ins
- Heartbeats
- Offline detection
- Runtime metrics
- Rollbacks
- Remote commands
- Web Control Plane
- USB Portable Control Plane
- Knowledge snapshots
- Changelog system
- AI handoff exports

==================================================

ACTIVE APIs

GET  /health
GET  /packages
GET  /packages?channel=stable
POST /upload
POST /upload/signature
GET  /download/:package
GET  /verify/:package

POST /fleet/checkin
POST /fleet/heartbeat
GET  /fleet/status

POST /fleet/metrics
GET  /fleet/metrics

POST /fleet/command
GET  /fleet/commands
GET  /fleet/commands/:node

POST /fleet/result

GET  /control

==================================================

CURRENT PACKAGES

$PACKAGES

==================================================

CURRENT FLEET STATUS

$FLEET

==================================================

CURRENT METRICS

$METRICS

==================================================

WORKING STYLE

- preserve working architecture
- additive changes preferred
- keep APIs stable
- keep filesystem paths stable
- explain exact insertion points
- avoid unnecessary rewrites
- maintain compatibility

==================================================

NEXT PLANNED FEATURES

- Event timeline
- Alerts
- Deployment progress
- Runtime logs viewer
- Node authentication
- Role-based access
- Live metrics streaming
- AI diagnostics
- Cluster orchestration

EOF

echo "CHATGPT_HANDOFF.md updated:"
echo "$OUTPUT"
