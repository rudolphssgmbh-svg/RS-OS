async function getTraceExecution({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  const fields =
    mode === "compact"
      ? "status, action AS execution_type, requested_by AS worker_id, created_at, completed_at"
      : "*";

  const result = await db.query(`
    SELECT ${fields}
    FROM runtime_execution_jobs
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceExecution };
