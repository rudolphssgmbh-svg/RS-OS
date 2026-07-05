#!/bin/bash

OUTPUT="/opt/rsos/knowledge/current/knowledge.json"

echo "Building knowledge.json..."

cat <<EOF > "$OUTPUT"
{
  "project": "RS OS",
  "generated_at": "$(date -Iseconds)",
  "runtime": {
    "registry": "http://localhost:8090",
    "control_plane": "http://85.190.98.31:8090/control"
  },
  "paths": {
    "registry_server": "/opt/rsos/registry-server",
    "node_agent": "/opt/rsos/node-agent",
    "runtime_api": "/opt/rsos/runtime-api"
  },
  "features": [
    "fleet-management",
    "runtime-metrics",
    "remote-commands",
    "rollbacks",
    "runtime-packages",
    "web-control-plane"
  ]
}
EOF

echo "knowledge.json updated."
