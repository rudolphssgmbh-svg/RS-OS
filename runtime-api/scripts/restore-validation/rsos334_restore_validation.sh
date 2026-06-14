#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
RESTORE_DB="rsos_restore_validation_auto"
PROD_DB="rsos_runtime"
PG_CONTAINER="rsos-postgres"
PG_USER="rsos"
TENANT_ID="tenant-rudolph-admin"
GENERATED_BY="rsos334-scheduler@cloud-server-10526378"

if [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: backup file argument missing"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "RSOS-334 restore validation started"
echo "backup_file=$BACKUP_FILE"

sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS $RESTORE_DB;"
sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE $RESTORE_DB;"

cat "$BACKUP_FILE" | sudo docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" >/tmp/rsos334_restore_import.log 2>&1

PROD_EVENTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PROD_DB" -Atc "SELECT COUNT(*) FROM runtime_events;")
RESTORE_EVENTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -Atc "SELECT COUNT(*) FROM runtime_events;")

PROD_OBJECTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PROD_DB" -Atc "SELECT COUNT(*) FROM runtime_objects;")
RESTORE_OBJECTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -Atc "SELECT COUNT(*) FROM runtime_objects;")

PROD_TENANTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PROD_DB" -Atc "SELECT COUNT(*) FROM runtime_tenants;")
RESTORE_TENANTS=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -Atc "SELECT COUNT(*) FROM runtime_tenants;")

RESTORE_TABLES=$(sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'runtime_%';")
API_HEALTH=$(curl -s http://127.0.0.1:8080/health || true)

RESULT="FAILED"
if [ "$PROD_EVENTS" = "$RESTORE_EVENTS" ] && [ "$PROD_OBJECTS" = "$RESTORE_OBJECTS" ] && [ "$PROD_TENANTS" = "$RESTORE_TENANTS" ] && [ "$RESTORE_TABLES" = "66" ]; then
  RESULT="TRUSTED"
fi

sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PROD_DB" -c "INSERT INTO runtime_audit_reports (tenant_id, report_type, report_status, generated_by, report_data) VALUES ('$TENANT_ID', 'RSOS-334_AUTOMATED_RESTORE_VALIDATION', lower('$RESULT'), '$GENERATED_BY', jsonb_build_object('rsos_id','RSOS-334','backup_file','$BACKUP_FILE','restore_database','$RESTORE_DB','prod_events',$PROD_EVENTS,'restore_events',$RESTORE_EVENTS,'prod_objects',$PROD_OBJECTS,'restore_objects',$RESTORE_OBJECTS,'prod_tenants',$PROD_TENANTS,'restore_tenants',$RESTORE_TENANTS,'restore_tables',$RESTORE_TABLES,'runtime_api_health','$API_HEALTH','result','$RESULT')) RETURNING report_id, report_type, report_status, generated_at;"

sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS $RESTORE_DB;"

echo "RSOS-334 restore validation completed: $RESULT"
