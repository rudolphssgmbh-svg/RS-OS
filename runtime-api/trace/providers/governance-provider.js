async function getTraceGovernance({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  const fields =
    mode === "compact"
      ? "governance_status, created_at"
      : "*";

  const result = await db.query(`
    SELECT ${fields}
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY
        revision_number DESC,
        decision_id DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceGovernance };
