#!/bin/bash
set -u

REGISTRY="${RSOS_REGISTRY_URL:-http://127.0.0.1:8090}"
CHANNEL="${RSOS_AGENT_CHANNEL:-stable}"
AUTH_USER="${RSOS_REGISTRY_USER:-admin}"
AUTH_PASSWORD="${RSOS_REGISTRY_PASSWORD:-}"
AUTH="-u ${AUTH_USER}:${AUTH_PASSWORD}"

BASE_DIR="/opt/rsos"
LOG_FILE="$BASE_DIR/logs/runtime/node-agent.log"
WORKDIR="$BASE_DIR/node-agent/work"
EXTRACT_DIR="$WORKDIR/extracted"
RUNTIME_DIR="$BASE_DIR/runtime-api"
FRONTEND_DIR="$BASE_DIR/frontend"
STATE_DIR="$BASE_DIR/node-agent/state"
STATE_FILE="$BASE_DIR/node-agent/current-version.txt"
LAST_GOOD_FILE="$STATE_DIR/last-good-version.txt"
BACKUP_DIR="$BASE_DIR/backups/node-agent-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$(dirname "$LOG_FILE")" "$WORKDIR" "$EXTRACT_DIR" "$STATE_DIR"

log() {
  echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

docker_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

api_get() {
  curl -s $AUTH "$1"
}

api_post_json() {
  curl -s $AUTH -X POST "$1" \
    -H "Content-Type: application/json" \
    -d "$2"
}

if [ -z "$AUTH_PASSWORD" ]; then
  log "ERROR: RSOS_REGISTRY_PASSWORD is not set"
  exit 1
fi

HOSTNAME="$(hostname)"
CURRENT_VERSION="none"
LAST_GOOD_VERSION="none"

[ -f "$STATE_FILE" ] && CURRENT_VERSION="$(cat "$STATE_FILE")"
[ -f "$LAST_GOOD_FILE" ] && LAST_GOOD_VERSION="$(cat "$LAST_GOOD_FILE")"

log "RS OS Node Agent started"
log "Registry: $REGISTRY"
log "Channel: $CHANNEL"
log "Current version: $CURRENT_VERSION"

PACKAGES_RESPONSE="$(api_get "$REGISTRY/packages?channel=$CHANNEL")"
PACKAGE="$(echo "$PACKAGES_RESPONSE" | grep -o 'rsos-runtime[^"]*\.rspkg' | head -1 || true)"

if [ -z "$PACKAGE" ]; then
  log "No package available for channel $CHANNEL"
else
  VERIFY_RESULT="$(api_get "$REGISTRY/verify/$PACKAGE")"
  log "Verify result: $VERIFY_RESULT"

  PACKAGE_VERSION="$(echo "$PACKAGE" | sed 's/rsos-runtime-//' | sed 's/.rspkg//')"
  log "Registry version: $PACKAGE_VERSION"

  if [ "$CURRENT_VERSION" = "$PACKAGE_VERSION" ]; then
    log "Version already deployed. Skipping deploy."
  else
    log "New package detected but deploy flow is not enabled in this safe agent version"
  fi
fi

log "Sending heartbeat"
api_post_json "$REGISTRY/fleet/heartbeat" "{
  \"node_id\":\"$HOSTNAME\",
  \"hostname\":\"$HOSTNAME\",
  \"version\":\"$CURRENT_VERSION\",
  \"channel\":\"$CHANNEL\",
  \"health\":\"healthy\"
}" >/dev/null

CPU_LOAD="$(cat /proc/loadavg | awk '{print $1}')"
MEMORY_TOTAL="$(free -m | awk '/Mem:/ {print $2}')"
MEMORY_USED="$(free -m | awk '/Mem:/ {print $3}')"
DISK_USED="$(df / | awk 'NR==2 {print $5}' | tr -d '%')"
CONTAINERS_RUNNING="$(docker ps -q | wc -l)"
UPTIME_INFO="$(uptime -p)"

log "Sending metrics"
api_post_json "$REGISTRY/fleet/metrics" "{
  \"node_id\":\"$HOSTNAME\",
  \"hostname\":\"$HOSTNAME\",
  \"cpu_load\":\"$CPU_LOAD\",
  \"memory_used_mb\":\"$MEMORY_USED\",
  \"memory_total_mb\":\"$MEMORY_TOTAL\",
  \"disk_used_percent\":\"$DISK_USED\",
  \"containers_running\":\"$CONTAINERS_RUNNING\",
  \"uptime\":\"$UPTIME_INFO\"
}" >/dev/null

log "Polling fleet commands"
COMMANDS="$(api_get "$REGISTRY/fleet/commands/$HOSTNAME")"
COMMAND_ID="$(echo "$COMMANDS" | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"' || true)"
COMMAND_ACTION="$(echo "$COMMANDS" | grep -o '"action":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"' || true)"

if [ -n "$COMMAND_ACTION" ]; then
  log "Command received: $COMMAND_ACTION"
  RESULT="ignored"

  if [ "$COMMAND_ACTION" = "restart-runtime" ]; then
    COMPOSE_CMD="$(docker_compose_cmd)"
    if [ -n "$COMPOSE_CMD" ]; then
      cd "$BASE_DIR"
      $COMPOSE_CMD restart runtime-api
      RESULT="runtime_restarted"
    else
      RESULT="docker_compose_not_available"
    fi
  fi

  api_post_json "$REGISTRY/fleet/result" "{
    \"command_id\":\"$COMMAND_ID\",
    \"result\":\"$RESULT\"
  }" >/dev/null

  log "Command result: $RESULT"
fi

log "Sending checkin"
api_post_json "$REGISTRY/fleet/checkin" "{
  \"node_id\":\"$HOSTNAME\",
  \"hostname\":\"$HOSTNAME\",
  \"version\":\"$CURRENT_VERSION\",
  \"channel\":\"$CHANNEL\",
  \"health\":\"healthy\"
}" >/dev/null

log "RS OS Node Agent finished"
