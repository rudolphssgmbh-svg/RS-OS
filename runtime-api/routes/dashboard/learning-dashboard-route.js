async function handleLearningDashboardRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path === "/runtime/learning/dashboard") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor",
      "governance"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const competencySummary = await db.query(`
      SELECT
        COUNT(*)::int AS competencies,
        COUNT(*) FILTER (WHERE gap > 0)::int AS open_gaps,
        COUNT(*) FILTER (WHERE gap >= 3)::int AS critical_gaps,
        COALESCE(SUM(gap),0)::int AS total_gap
      FROM runtime_competencies
      WHERE tenant_id = $1
    `,[tenant_id]);

    const trainingSummary = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='planned')::int AS planned,
        COUNT(*) FILTER (WHERE status='completed')::int AS completed
      FROM runtime_training_plans
      WHERE tenant_id = $1
    `,[tenant_id]);

    const evidenceSummary = await db.query(`
      SELECT
        COUNT(*)::int AS evidence_count,
        COALESCE(SUM(gap_before-gap_after),0)::int AS total_gap_reduction,
        COUNT(*) FILTER (WHERE effectiveness='positive')::int AS positive_count
      FROM runtime_learning_evidence
      WHERE tenant_id = $1
    `,[tenant_id]);

    const evidence = evidenceSummary.rows[0];

    const effectiveness_score =
      evidence.evidence_count > 0
        ? Math.round(
            (evidence.positive_count / evidence.evidence_count) * 100
          )
        : 0;

    return send(res,200,{
      tenant_id,
      competencies: competencySummary.rows[0].competencies,
      open_gaps: competencySummary.rows[0].open_gaps,
      critical_gaps: competencySummary.rows[0].critical_gaps,
      total_gap: competencySummary.rows[0].total_gap,
      training_plans_planned: trainingSummary.rows[0].planned,
      training_plans_completed: trainingSummary.rows[0].completed,
      learning_evidence_count: evidence.evidence_count,
      total_gap_reduction: evidence.total_gap_reduction,
      effectiveness_score
    });
  }

  if (req.method === "GET" && path === "/runtime/learning/runtime-dashboard") {
    const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
    if (!auth.allowed) return send(res, auth.code, auth.response);

    const urlObj = new URL(req.url, "http://localhost");

    const tenant_id =
      urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
        ? urlObj.searchParams.get("tenant_id")
        : auth.user.tenant_id;

    const learningResult = await db.query(`
      SELECT
        COUNT(*)::int AS learning_states,
        COALESCE(AVG(progress_percent),0)::numeric(5,2) AS avg_progress,
        COALESCE(AVG(confidence_score),0)::numeric(5,2) AS avg_learning_confidence,
        COUNT(*) FILTER (WHERE learning_stage = 'INTEREST')::int AS interest_count,
        COUNT(*) FILTER (WHERE learning_stage = 'PERCEPTION')::int AS perception_count,
        COUNT(*) FILTER (WHERE learning_stage = 'ORIENTATION')::int AS orientation_count,
        COUNT(*) FILTER (WHERE learning_stage = 'UNDERSTANDING')::int AS understanding_count,
        COUNT(*) FILTER (WHERE learning_stage = 'APPLICATION')::int AS application_count,
        COUNT(*) FILTER (WHERE learning_stage = 'VERIFICATION')::int AS verification_count,
        COUNT(*) FILTER (WHERE learning_stage = 'COMPETENCE')::int AS competence_count
      FROM runtime_learning_states
      WHERE tenant_id = $1
    `, [tenant_id]);

    const competenceResult = await db.query(`
      SELECT
        COUNT(*)::int AS competence_states,
        COALESCE(AVG(competence_level),0)::numeric(5,2) AS avg_competence_level,
        COALESCE(AVG(confidence_score),0)::numeric(5,2) AS avg_competence_confidence,
        COUNT(*) FILTER (WHERE verified = true)::int AS verified_competencies
      FROM runtime_competence_states
      WHERE tenant_id = $1
    `, [tenant_id]);

    const gapResult = await db.query(`
      SELECT
        COUNT(*)::int AS competence_gaps,
        COALESCE(AVG(gap_score),0)::numeric(5,2) AS avg_gap_score,
        COUNT(*) FILTER (WHERE gap_score >= 3)::int AS critical_gaps
      FROM runtime_competence_gaps
      WHERE tenant_id = $1
    `, [tenant_id]);

    const assessmentResult = await db.query(`
      SELECT
        COUNT(*)::int AS assessments,
        COUNT(*) FILTER (WHERE assessment_type = 'KNOWLEDGE_TEST')::int AS knowledge_tests,
        COUNT(*) FILTER (WHERE assessment_type = 'PRACTICAL')::int AS practical_assessments,
        COUNT(*) FILTER (WHERE assessment_type = 'OBSERVATION')::int AS observation_assessments
      FROM runtime_assessments
      WHERE tenant_id = $1
    `, [tenant_id]);

    const attemptResult = await db.query(`
      SELECT
        COUNT(*)::int AS assessment_attempts,
        COUNT(*) FILTER (WHERE result = 'PASSED')::int AS passed_attempts,
        COUNT(*) FILTER (WHERE result = 'FAILED')::int AS failed_attempts,
        COUNT(*) FILTER (WHERE verified = true)::int AS verified_attempts,
        COALESCE(AVG(score),0)::numeric(5,2) AS avg_score
      FROM runtime_assessment_attempts
      WHERE tenant_id = $1
    `, [tenant_id]);

    const recommendationResult = await db.query(`
      SELECT
        COUNT(*)::int AS total_recommendations,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_recommendations,
        COUNT(*) FILTER (WHERE status <> 'OPEN')::int AS closed_recommendations,
        COALESCE(AVG(confidence_score),0)::numeric(5,2) AS avg_recommendation_confidence
      FROM runtime_learning_recommendations
      WHERE tenant_id = $1
    `, [tenant_id]);

    return send(res, 200, {
      tenant_id,
      learning: learningResult.rows[0],
      competence: competenceResult.rows[0],
      gaps: gapResult.rows[0],
      assessments: assessmentResult.rows[0],
      attempts: attemptResult.rows[0],
      recommendations: recommendationResult.rows[0]
    });
  }

  return false;
}

module.exports = {
  handleLearningDashboardRoute
};
