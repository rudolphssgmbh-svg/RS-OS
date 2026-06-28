async function getTraceRecommendations({
  db,
  tenant_id,
  object_id,
  mode = "full"
}) {
  const fields =
    mode === "compact"
      ? [
          "recommendation_id",
          "recommendation_type",
          "priority",
          "status",
          "reason",
          "created_at",
          "approved_by",
          "approved_at",
          "executed_job_id",
          "executed_at"
        ].join(", ")
      : "*";

  const result = await db.query(`
    SELECT ${fields}
    FROM runtime_recommendations
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = { getTraceRecommendations };
