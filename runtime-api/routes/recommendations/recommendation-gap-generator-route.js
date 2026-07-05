async function handleRecommendationGapGeneratorRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  writeEvent
}) {
  if (
    req.method !== "POST" ||
    path !== "/runtime/recommendations/generate-from-gaps"
  ) {
    return false;
  }

  const auth = requireRole(req, [
    "runtime_admin",
    "governance"
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
      required_level,
      actual_level,
      gap
    FROM runtime_competencies
    WHERE tenant_id = $1
      AND gap >= 3
    ORDER BY gap DESC, competency_name ASC
  `, [tenant_id]);

  const inserted = [];
  const skipped_duplicates = [];

  for (const gap of gapResult.rows) {

    const recommendation_type = "TRAINING_REQUIRED";
    const object_id = gap.person_id;
    const priority = gap.gap >= 5 ? "high" : "normal";

    const existingResult = await db.query(`
      SELECT recommendation_id
      FROM runtime_recommendations
      WHERE tenant_id = $1
        AND object_id = $2
        AND recommendation_type = $3
        AND status = 'open'
        AND evidence->>'competency_name' = $4
      LIMIT 1
    `, [
      tenant_id,
      object_id,
      recommendation_type,
      gap.competency_name
    ]);

    if (existingResult.rows.length > 0) {
      skipped_duplicates.push({
        person_id: object_id,
        competency_name: gap.competency_name,
        existing_recommendation_id:
          existingResult.rows[0].recommendation_id
      });
      continue;
    }

    const recommendation_id =
      "rec-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8);

    const evidence = {
      source: "competency_gap",
      person_id: gap.person_id,
      competency_name: gap.competency_name,
      required_level: gap.required_level,
      actual_level: gap.actual_level,
      gap: gap.gap
    };

    await db.query(`
      INSERT INTO runtime_recommendations (
        recommendation_id,
        tenant_id,
        object_id,
        recommendation_type,
        priority,
        status,
        reason,
        evidence,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8)
    `, [
      recommendation_id,
      tenant_id,
      object_id,
      recommendation_type,
      priority,
      "Competency gap detected; training should be planned.",
      JSON.stringify(evidence),
      auth.user.operator_id ||
      auth.user.username ||
      "runtime_admin"
    ]);

    inserted.push({
      recommendation_id,
      person_id: object_id,
      competency_name: gap.competency_name,
      recommendation_type,
      priority,
      gap: gap.gap
    });
  }

  await writeEvent({
    event_type:
      "runtime.recommendations.generated_from_competency_gaps",
    tenant_id,
    message:
      "Generated " +
      inserted.length +
      " competency gap recommendations"
  });

  send(res, 200, {
    tenant_id,
    generated: inserted.length,
    skipped_duplicates: skipped_duplicates.length,
    recommendations: inserted,
    duplicates: skipped_duplicates
  });

  return true;
}

module.exports = {
  handleRecommendationGapGeneratorRoute
};
