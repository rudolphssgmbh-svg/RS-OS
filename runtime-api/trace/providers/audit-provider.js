async function getTraceAudit({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  if (mode === "compact") {
    return db.query(`
      SELECT COUNT(*)::int AS event_count
      FROM runtime_events
      WHERE tenant_id = $1
        AND object_id = $2
    `, [
      tenant_id,
      object_id
    ]);
  }

  return db.query(`
    SELECT *
    FROM runtime_events
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at ASC
  `, [
    tenant_id,
    object_id
  ]);
}

module.exports = { getTraceAudit };
