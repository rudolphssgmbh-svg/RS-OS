async function getTraceRisks({
  db,
  tenant_id,
  object_id
}) {
  const result = await db.query(`
    SELECT *
    FROM runtime_risks
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceRisks };
