async function handleTrainingGapGeneratorRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  writeEvent
}) {
  if (req.method !== "POST" || path !== "/runtime/training-plans/generate-from-gaps") {
    return false;
  }

  const auth = requireRole(req, [
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const tenant_id = auth.user.tenant_id;

  const gapResult = await db.query(`
    SELECT
      person_id,
      competency_name,
      gap
    FROM runtime_competencies
    WHERE tenant_id = $1
      AND gap >= 3
    ORDER BY gap DESC
  `, [tenant_id]);

  const durationMap = {
    "Sachkunde §34a": 2400,
    "Unterrichtung §34a": 240,
    "Brandschutzhelfer": 240,
    "Erste Hilfe": 480,
    "AEVO": 1920,
    "GSSK": 3200,
    "FSS": 2400,
    "Meister Schutz und Sicherheit": 12000
  };

  const createdPlans = [];

  for (const row of gapResult.rows) {
    const training_plan_id =
      "tp-" + Date.now() + "-" +
      Math.random().toString(36).substring(2, 8);

    const duration =
      durationMap[row.competency_name] || 480;

    await db.query(`
      INSERT INTO runtime_training_plans (
        training_plan_id,
        tenant_id,
        person_id,
        competency_name,
        training_type,
        estimated_duration_minutes,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      training_plan_id,
      tenant_id,
      row.person_id,
      row.competency_name,
      "gap_closure",
      duration,
      "planned",
      auth.user.operator_id
    ]);

    createdPlans.push({
      training_plan_id,
      person_id: row.person_id,
      competency_name: row.competency_name,
      gap: row.gap,
      estimated_duration_minutes: duration
    });
  }

  await writeEvent({
    event_type: "runtime.training_plans.generated",
    tenant_id,
    message:
      "Generated " +
      createdPlans.length +
      " training plans"
  });

  send(res, 200, {
    tenant_id,
    generated: createdPlans.length,
    training_plans: createdPlans
  });

  return true;
}

module.exports = {
  handleTrainingGapGeneratorRoute
};
