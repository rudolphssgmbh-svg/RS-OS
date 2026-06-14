#!/usr/bin/env bash
set -euo pipefail

OUT="/opt/rsos/dashboard/tenant/tenant-dashboard.txt"

{
  echo "RS OS Tenant Dashboard"
  echo
  echo "STATUS=GREEN"
  echo
  echo "GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "TENANT_OVERVIEW:"
  sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -P pager=off -c "
SELECT t.tenant_id,
       t.tenant_name,
       t.tenant_type,
       t.status,
       COUNT(DISTINCT o.object_id) AS objects,
       COUNT(DISTINCT e.event_id) AS events,
       COUNT(DISTINCT m.member_id) AS members
FROM runtime_tenants t
LEFT JOIN runtime_objects o ON o.tenant_id = t.tenant_id
LEFT JOIN runtime_events e ON e.tenant_id = t.tenant_id
LEFT JOIN runtime_tenant_members m ON m.tenant_id = t.tenant_id
GROUP BY t.tenant_id, t.tenant_name, t.tenant_type, t.status
ORDER BY t.tenant_name;
"
} > "$OUT"

cat "$OUT"
