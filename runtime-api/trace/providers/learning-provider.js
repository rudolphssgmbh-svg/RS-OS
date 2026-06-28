async function getTraceTrainingPlans({
  db,
  tenant_id,
  object_id
}) {
  const result = await db.query(`
    SELECT *
    FROM runtime_training_plans
    WHERE tenant_id = $1
      AND person_id = $2
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

async function getTraceLearningEvidence({
  db,
  tenant_id,
  object_id
}) {
  const result = await db.query(`
    SELECT *
    FROM runtime_learning_evidence
    WHERE tenant_id = $1
      AND person_id = $2
    ORDER BY created_at DESC
  `, [
    tenant_id,
    object_id
  ]);

  return result;
}

module.exports = {
  getTraceTrainingPlans,
  getTraceLearningEvidence
};
