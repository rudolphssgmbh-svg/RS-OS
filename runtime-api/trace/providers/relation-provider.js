async function getTraceRelations({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  const fields =
    mode === "compact"
      ? "relation_id, source_object_id, target_object_id, relation_type, created_at"
      : "*";

  const result = await db.query(`
    SELECT ${fields}
    FROM runtime_relations
    WHERE tenant_id = $1
      AND (
        source_object_id = $2
        OR target_object_id = $2
      )
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceRelations };
