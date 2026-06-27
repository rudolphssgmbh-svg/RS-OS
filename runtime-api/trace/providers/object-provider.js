async function getTraceObject({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  const fields =
    mode === "compact"
      ? "object_id, runtime_type, state, priority, risk_score, created_at"
      : "*";

  const result = await db.query(`
    SELECT ${fields}
    FROM runtime_objects
    WHERE tenant_id = $1
      AND object_id = $2
    LIMIT 1
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceObject };
