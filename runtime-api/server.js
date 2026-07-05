const crypto = require("crypto");
const fs = require("fs");
//require('dotenv').config();
const http = require("http");
const { handleRsos060SourcesRoutes } = require("./modules/rsos060/sources-routes");
const { handleRsos060EvidenceRoutes } = require("./modules/rsos060/evidence-routes");
const { handleRsos060WitnessObservationsRoutes } = require("./modules/rsos060/witness-observations-routes");
const { handleRsos060AssumptionsHypothesesRoutes } = require("./modules/rsos060/assumptions-hypotheses-routes");
const { handleRsos060VerificationsRoutes } = require("./modules/rsos060/verifications-routes");
const jwt = require("jsonwebtoken");
const { send } = require("./response/send");
const { createAuditHash } = require("./evidence/audit-hash");
const { verifyOperatorSignature, generateToken, verifyToken, requireRole } = require("./verification/auth");
const { readBody } = require("./ingress/body");
const { db } = require("./bootstrap/database");
const { initDb } = require("./bootstrap/init-db");
const { handleHealthRoute } = require("./routes/health/health-route");
const { handleAuthLoginRoute } = require("./routes/auth/login-route");
const { handleRuntimeEventsRoute } = require("./routes/events/runtime-events-route");
const { handleAuditChainVerifyRoute } = require("./routes/events/audit-chain-route");
const { handleListRuntimeObjectsRoute } = require("./routes/objects/list-objects-route");
const { handleCreateRuntimeObjectRoute } = require("./routes/objects/create-object-route");
const { handleRuntimeExecuteRoute } = require("./routes/runtime-execute-route");
const { handleFullTraceRoute } = require("./routes/trace/full-trace-route");
const { handleUnifiedTraceRoute } = require("./routes/trace/unified-trace-route");
const { handlePathRoute } = require("./routes/trace/path-route");
const { handleManagementDashboardRoute } = require("./routes/dashboard/management-dashboard-route");
const { handleRuntimeDashboardRoute } = require("./routes/dashboard/runtime-dashboard-route");
const { handleTenantDashboardListRoute } = require("./routes/dashboard/tenant-dashboard-list-route");
const { handleTenantDashboardDetailRoute } = require("./routes/dashboard/tenant-dashboard-detail-route");
const { handleRelationsGraphRoute } = require("./routes/relations/relations-graph-route");
const { handleKnowledgeRoute } = require("./routes/knowledge/knowledge-route");
const { handleScheduleRoute } = require("./routes/schedule/schedule-route");
const { handleWorkerRoute } = require("./routes/worker/worker-route");
const { handleRuntimeMetricsRoute } = require("./routes/metrics/runtime-metrics-route");
const { handleDeadLetterRoute } = require("./routes/dead-letter/dead-letter-route");
const { handleWorkflowStateRoute } = require("./routes/workflows/workflow-state-route");
const { handleDefenseIngressRoute } = require("./routes/defense/defense-ingress-route");
const { handleDefenseIngressReadRoute } = require("./routes/defense/defense-ingress-read-route");
const { handleDefenseShadowValidationsRoute } = require("./routes/defense/defense-shadow-validations-route");
const { handleDefenseQuarantineCoreRoute } = require("./routes/defense/defense-quarantine-core-route");
const { handleDefenseQuarantineReviewRoute } = require("./routes/defense/defense-quarantine-review-route");
const { handleDefenseQuarantineApproveRoute } = require("./routes/defense/defense-quarantine-approve-route");
const { handleDefenseQuarantineRejectRoute } = require("./routes/defense/defense-quarantine-reject-route");
const { handleDefenseSavepointsCoreRoute } = require("./routes/defense/defense-savepoints-core-route");
const { handleDefenseSavepointsReadRoute } = require("./routes/defense/defense-savepoints-read-route");
const { handleDefenseSavepointsRollbackRoute } = require("./routes/defense/defense-savepoints-rollback-route");
const { handleDefenseRecoveryRequestsCoreRoute } = require("./routes/defense/defense-recovery-requests-core-route");
const { handleDefenseRecoveryRequestsReviewRoute } = require("./routes/defense/defense-recovery-requests-review-route");
const { handleDefenseRecoveryRequestsApproveRoute } = require("./routes/defense/defense-recovery-requests-approve-route");
const { handleDefenseRecoveryRequestsRejectRoute } = require("./routes/defense/defense-recovery-requests-reject-route");
const { handleDefenseRecoveryRequestsExecuteRoute } = require("./routes/defense/defense-recovery-requests-execute-route");
const { handleDefenseRecoveryVerificationsCoreRoute } = require("./routes/defense/defense-recovery-verifications-core-route");
const { handleDefenseRecoveryVerificationsCloseRoute } = require("./routes/defense/defense-recovery-verifications-close-route");
const { handleDefenseAuditReportsCoreRoute } = require("./routes/defense/defense-audit-reports-core-route");
const { handleDefenseAuditReportsDetailRoute } = require("./routes/defense/defense-audit-reports-detail-route");
const { handleLearningDashboardRoute } = require("./routes/dashboard/learning-dashboard-route");
const { handleDefenseMetricsRoute } = require("./routes/defense/defense-metrics-route");
const { handleDefenseStateRoute } = require("./routes/defense/defense-state-route");
const { handleIncidentDashboardRoute } = require("./routes/incidents/incident-dashboard-route");
const { handleIncidentRegistryRoute } = require("./routes/incidents/incident-registry-route");
const { handleIncidentCoreRoute } = require("./routes/incidents/incident-core-route");
const { handleIncidentGovernanceRoute } = require("./routes/incidents/incident-governance-route");
const { handleReportRoute } = require("./routes/reports/report-route");
const { handleOutcomeRoute } = require("./routes/outcomes/outcome-route");
const { handleMeasurementRoute } = require("./routes/measurements/measurement-route");
const { handleVerificationCycleRoute } = require("./routes/verifications/verification-cycle-route");
const { handleFactRoute } = require("./routes/facts/fact-route");
const { handleUnknownRoute } = require("./routes/unknowns/unknown-route");
const { handleLearningCompetenceRoute } = require("./routes/learning/learning-competence-route");
const { handleEvidenceGovernanceRoute } = require("./routes/evidence/evidence-governance-route");
const { handleHeuristicsPatternRoute } = require("./routes/heuristics/heuristics-pattern-route");
const { handleGovernancePolicyRoute } = require("./routes/governance/governance-policy-route");
const { handleGovernanceEvaluateRoute } = require("./routes/governance/governance-evaluate-route");
const { handleOrchestrationRoute } = require("./routes/orchestrations/orchestration-route");
const { handleCommunicationRoute } = require("./routes/communications/communication-route");
const { handleTrainingLearningRoute } = require("./routes/training/training-learning-route");
const { handleTrainingGapGeneratorRoute } = require("./routes/training/training-gap-generator-route");
const { handleRecommendationGapGeneratorRoute } = require("./routes/recommendations/recommendation-gap-generator-route");
const { handleRecommendationRoute } = require("./routes/recommendations/recommendation-route");
const { handleTenantRuntimeRoute } = require("./routes/tenants/tenant-runtime-route");
const { handleTenantAdminRoute } = require("./routes/tenants/tenant-admin-route");
const { handleTenantAdminDetailRoute } = require("./routes/tenants/tenant-admin-detail-route");
const { handleTenantReadRoute } = require("./routes/tenants/tenant-read-route");
const { getTraceObject } = require("./trace/providers/object-provider");
const { getTraceRelations } = require("./trace/providers/relation-provider");
const { getTraceAudit } = require("./trace/providers/audit-provider");
const { getTraceGovernance } = require("./trace/providers/governance-provider");
const { getTraceExecution } = require("./trace/providers/execution-provider");
const { getTraceRecommendations } = require("./trace/providers/recommendation-provider");

async function executeDefensePipeline(ingress_id) {
  const ingressResult = await db.query(`
    SELECT *
    FROM runtime_ingress_events
    WHERE ingress_id = $1
    LIMIT 1
  `, [ingress_id]);

  if (ingressResult.rows.length === 0) {
    return null;
  }

  const ingress = ingressResult.rows[0];
  const tenant_id = ingress.tenant_id;
  const risk_score = Number(ingress.risk_score || 10);
  const confidence_score = Number(ingress.confidence_score || 70);

  const pattern_result = { engine: "runtime_pattern_engine", status: "observed" };
  const heuristic_result = { engine: "runtime_heuristic_engine", status: "observed" };
  const cross_loop_result = { engine: "runtime_cross_loop_validation", status: "observed" };
  const governance_result = { engine: "runtime_governance_policy_engine", status: "observed" };

  let defense_decision = "allow";
  let defense_status = "allowed";
  let validation_status = "passed";
  let validation_decision = "approved_for_apply";

  if (risk_score >= 70 || confidence_score < 40) {
    defense_decision = "quarantine";
    defense_status = "quarantined";
    validation_status = "requires_quarantine";
    validation_decision = "requires_human_review";
  } else if (risk_score >= 30 || confidence_score < 70) {
    defense_decision = "shadow_validate";
    defense_status = "shadow_pending";
    validation_status = "passed_with_warnings";
    validation_decision = "requires_human_review";
  }

  await db.query(`
    UPDATE runtime_ingress_events
    SET defense_status = $2,
        defense_decision = $3,
        pattern_result = $4,
        heuristic_result = $5,
        governance_result = $6,
        cross_loop_result = $7
    WHERE ingress_id = $1
  `, [
    ingress_id,
    defense_status,
    defense_decision,
    JSON.stringify(pattern_result),
    JSON.stringify(heuristic_result),
    JSON.stringify(governance_result),
    JSON.stringify(cross_loop_result)
  ]);

  const shadowResult = await db.query(`
    INSERT INTO runtime_shadow_validations (
      tenant_id,
      ingress_id,
      object_id,
      object_type,
      proposed_action,
      current_state,
      proposed_state,
      validation_scope,
      validation_engine,
      pattern_result,
      heuristic_result,
      governance_result,
      cross_loop_result,
      timeline_result,
      validation_status,
      validation_decision,
      risk_score,
      confidence_score,
      findings,
      required_actions,
      completed_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      'runtime_write',
      'rsos-defense-autonomous-v1',
      $8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,now()
    )
    RETURNING *
  `, [
    tenant_id,
    ingress_id,
    ingress.target_object_id,
    ingress.target_object_type,
    ingress.target_action,
    JSON.stringify({}),
    JSON.stringify(ingress.payload || {}),
    JSON.stringify(pattern_result),
    JSON.stringify(heuristic_result),
    JSON.stringify(governance_result),
    JSON.stringify(cross_loop_result),
    JSON.stringify({ engine: "runtime_timeline", status: "observed" }),
    validation_status,
    validation_decision,
    risk_score,
    confidence_score,
    JSON.stringify(["Autonomous defense pipeline phase 1 executed"]),
    JSON.stringify(validation_decision === "requires_human_review" ? ["human_review"] : [])
  ]);

  let quarantine = null;

  if (defense_decision === "quarantine") {
    const quarantineResult = await db.query(`
      INSERT INTO runtime_quarantine_queue (
        tenant_id,
        ingress_id,
        quarantine_reason,
        severity,
        category,
        object_id,
        object_type,
        proposed_action,
        proposed_payload,
        detected_by,
        detection_details,
        required_approval_level
      )
      VALUES (
        $1,$2,'autonomous_defense_quarantine','high','runtime_defense',
        $3,$4,$5,$6,'rsos-defense-autonomous-v1',$7,'runtime_admin'
      )
      RETURNING *
    `, [
      tenant_id,
      ingress_id,
      ingress.target_object_id,
      ingress.target_object_type,
      ingress.target_action,
      JSON.stringify(ingress.payload || {}),
      JSON.stringify({ risk_score, confidence_score, defense_decision })
    ]);

    quarantine = quarantineResult.rows[0];

    await writeEvent({
      event_type: "runtime.defense.quarantine.created",
      object_id: ingress.target_object_id,
      message: `Autonomous quarantine created: ${quarantine.quarantine_id}`,
      tenant_id
    });
  }

  await db.query(`
    INSERT INTO runtime_defense_state (
      tenant_id,
      scope_type,
      scope_id,
      defense_mode,
      defense_level,
      last_ingress_id,
      last_quarantine_id,
      last_shadow_validation_id,
      open_quarantine_count,
      failed_validation_count,
      recent_rejection_count,
      current_risk_score,
      current_confidence_score,
      active_policy_flags,
      active_risk_flags,
      state_reason,
      updated_by
    )
    VALUES (
      $1,'tenant',$1,$2,$3,$4,$5,$6,
      (SELECT COUNT(*) FROM runtime_quarantine_queue WHERE tenant_id = $1 AND status = 'open'),
      (SELECT COUNT(*) FROM runtime_shadow_validations WHERE tenant_id = $1 AND validation_status IN ('failed','requires_quarantine')),
      (SELECT COUNT(*) FROM runtime_ingress_events WHERE tenant_id = $1 AND defense_decision IN ('reject','quarantine') AND created_at > now() - interval '24 hours'),
      $7,$8,$9,$10,$11,'rsos-defense-autonomous-v1'
    )
    ON CONFLICT (tenant_id, scope_type, scope_id)
    DO UPDATE SET
      defense_mode = EXCLUDED.defense_mode,
      defense_level = EXCLUDED.defense_level,
      last_ingress_id = EXCLUDED.last_ingress_id,
      last_quarantine_id = EXCLUDED.last_quarantine_id,
      last_shadow_validation_id = EXCLUDED.last_shadow_validation_id,
      open_quarantine_count = EXCLUDED.open_quarantine_count,
      failed_validation_count = EXCLUDED.failed_validation_count,
      recent_rejection_count = EXCLUDED.recent_rejection_count,
      current_risk_score = EXCLUDED.current_risk_score,
      current_confidence_score = EXCLUDED.current_confidence_score,
      active_policy_flags = EXCLUDED.active_policy_flags,
      active_risk_flags = EXCLUDED.active_risk_flags,
      state_reason = EXCLUDED.state_reason,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  `, [
    tenant_id,
    defense_decision === "quarantine" ? "quarantine_first" : "normal",
    defense_decision === "quarantine" ? "elevated" : "standard",
    ingress_id,
    quarantine ? quarantine.quarantine_id : null,
    shadowResult.rows[0].shadow_validation_id,
    risk_score,
    confidence_score,
    JSON.stringify([]),
    JSON.stringify(defense_decision === "quarantine" ? ["high_risk_ingress"] : []),
    `Autonomous defense decision: ${defense_decision}`
  ]);

  await writeEvent({
    event_type: "runtime.defense.pipeline.completed",
    object_id: ingress.target_object_id,
    message: `Autonomous defense pipeline completed: ${defense_decision}`,
    tenant_id
  });

  return {
    ingress_id,
    defense_decision,
    defense_status,
    shadow_validation: shadowResult.rows[0],
    quarantine
  };
}




async function writeEvent({
  event_type,
  object_id = null,
  message = "",
  tenant_id = null
}) {

  const previousEvent = await db.query(`
    SELECT audit_hash
    FROM runtime_events
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const previous_hash =
    previousEvent.rows.length > 0
      ? previousEvent.rows[0].audit_hash
      : null;

  const audit_hash = createAuditHash({
    event_type,
    object_id,
    message,
    previous_hash,
    tenant_id
  });

  const event_id =
    "evt-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 8);

  await db.query(`
    INSERT INTO runtime_events
    (
      event_id,
      event_type,
      object_id,
      message,
      audit_hash,
      previous_hash,
      tenant_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [
    event_id,
    event_type,
    object_id,
    message,
    audit_hash,
    previous_hash,
    tenant_id
  ]);

  return {
    event_id,
    audit_hash
  };
}

// function verifyOperatorSignature(operatorFile, signatureFile) {
// 
//   const operatorData = fs.readFileSync(operatorFile);
//   const signature = fs.readFileSync(signatureFile);
// 
//   const verify = crypto.createVerify("SHA256");
// 
//   verify.update(operatorData);
//   verify.end();
// 
//   return verify.verify(ROOT_PUBLIC_KEY, signature);
// }








async function generateRecommendationsForObject({
  tenant_id,
  object_id,
  requested_by
}) {

  const objectResult = await db.query(`
    SELECT object_id, object_type, state, priority, risk_score
    FROM runtime_objects
    WHERE tenant_id = $1
      AND object_id = $2
    LIMIT 1
  `, [tenant_id, object_id]);

  if (objectResult.rows.length === 0) {
    return {
      found: false,
      object_id,
      generated_count: 0,
      skipped_duplicate_count: 0,
      recommendations: [],
      skipped_duplicates: []
    };
  }

  const object = objectResult.rows[0];

  const actionsResult = await db.query(`
    SELECT *
    FROM runtime_actions
    WHERE tenant_id = $1
      AND object_id = $2
      AND status NOT IN ('completed', 'cancelled', 'rejected')
    ORDER BY created_at DESC
  `, [tenant_id, object_id]);

  const governanceResult = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [tenant_id, object_id]);

  const latestGovernance = governanceResult.rows[0] || null;

  let latestApproval = null;

  if (latestGovernance) {
    const approvalResult = await db.query(`
      SELECT *
      FROM runtime_governance_approvals
      WHERE tenant_id = $1
        AND decision_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [tenant_id, latestGovernance.decision_id]);

    latestApproval = approvalResult.rows[0] || null;
  }

  const rulesResult = await db.query(`
    SELECT
      rule_id,
      rule_name,
      condition_definition,
      recommendation_definition,
      success_count,
      failure_count,
      feedback_count,
      confidence_score,
      last_feedback_at
    FROM runtime_recommendation_rules
    WHERE tenant_id = $1
      AND enabled = true
    ORDER BY rule_id ASC
  `, [
    tenant_id
  ]);

  const recommendations = [];

  const riskScore = Number(object.risk_score || 0);

  const highOpenActions = actionsResult.rows.filter(action =>
    action.priority === "high" || action.priority === "critical"
  );

  const governanceReviewWithoutApproval =
    latestGovernance &&
    latestGovernance.governance_status === "review_required" &&
    !latestApproval
      ? true
      : false;

  const competencyResult = await db.query(`
    SELECT
      COUNT(*)::int AS competency_count,
      COALESCE(MAX(gap), 0)::int AS max_gap
    FROM runtime_competencies
    WHERE tenant_id = $1
      AND person_id = $2
  `, [
    tenant_id,
    object_id
  ]);

  const competencyGap =
    competencyResult.rows.length > 0
      ? Number(competencyResult.rows[0].max_gap || 0)
      : 0;

  const context = {
    risk_score: riskScore,
    open_high_actions: highOpenActions.length,
    governance_review_without_approval: governanceReviewWithoutApproval,
    competency_gap: competencyGap
  };

  function evaluateRecommendationRule(condition, context) {
    const field = condition.field;
    const operator = condition.operator;
    const expected = condition.value;
    const actual = context[field];

    if (actual === undefined) {
      return false;
    }

    if (operator === ">=") return Number(actual) >= Number(expected);
    if (operator === ">") return Number(actual) > Number(expected);
    if (operator === "<=") return Number(actual) <= Number(expected);
    if (operator === "<") return Number(actual) < Number(expected);
    if (operator === "=") return actual === expected;
    if (operator === "!=") return actual !== expected;

    return false;
  }

  function mapPriorityToScore(priority) {
    if (priority === "critical") return 100;
    if (priority === "high") return 80;
    if (priority === "normal") return 60;
    if (priority === "low") return 40;
    return 60;
  }

  function mapScoreToPriority(score) {
    if (score >= 90) return "critical";
    if (score >= 70) return "high";
    if (score >= 45) return "normal";
    return "low";
  }

  function calculateRecommendationConfidence(rule, definition, context) {
    const factors = [];

    let confidenceScore = Number(rule.confidence_score || 70);
    factors.push("learned_rule_confidence_score");

    const successCount = Number(rule.success_count || 0);
    const failureCount = Number(rule.failure_count || 0);
    const feedbackCount = Number(rule.feedback_count || 0);

    if (definition.confidence_score !== undefined) {
      confidenceScore = Math.round((confidenceScore * 0.7) + (Number(definition.confidence_score) * 0.3));
      factors.push("definition_confidence_score");
    }

    if (successCount > 0) {
      factors.push("historical_rule_success");
    }

    if (failureCount > 0) {
      factors.push("historical_rule_failure");
    }

    if (feedbackCount > 0) {
      factors.push("historical_rule_feedback");
    }

    if (context.risk_score >= 70) {
      confidenceScore += 10;
      factors.push("high_risk_score");
    }

    if (context.open_high_actions > 0) {
      confidenceScore += 10;
      factors.push("open_high_priority_actions");
    }

    if (context.governance_review_without_approval === true) {
      confidenceScore += 10;
      factors.push("governance_review_without_approval");
    }

    if (context.competency_gap > 0) {
      confidenceScore += 5;
      factors.push("competency_gap_detected");
    }

    confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

    let confidenceLevel = "medium";
    if (confidenceScore >= 85) confidenceLevel = "high";
    if (confidenceScore < 50) confidenceLevel = "low";

    return {
      confidence_score: confidenceScore,
      confidence_level: confidenceLevel,
      confidence_factors: factors,
      learned_rule_confidence_score: Number(rule.confidence_score || 70),
      rule_success_count: successCount,
      rule_failure_count: failureCount,
      rule_feedback_count: feedbackCount,
      rule_last_feedback_at: rule.last_feedback_at || null
    };
  }

  for (const rule of rulesResult.rows) {
    const condition = rule.condition_definition || {};
    const definition = rule.recommendation_definition || {};

    if (!evaluateRecommendationRule(condition, context)) {
      continue;
    }

    const recommendation_type = definition.recommendation_type;
    const base_priority = definition.priority || "normal";

    const confidence = calculateRecommendationConfidence(rule, definition, context);
    const basePriorityScore = mapPriorityToScore(base_priority);
    const effectivePriorityScore = Math.round((basePriorityScore * 0.7) + (confidence.confidence_score * 0.3));
    const effective_priority = mapScoreToPriority(effectivePriorityScore);

    let reason = `Rule matched: ${rule.rule_name}`;
    let evidence = {
      rule_id: rule.rule_id,
      rule_name: rule.rule_name,
      condition,
      context,
      confidence_score: confidence.confidence_score,
      confidence_level: confidence.confidence_level,
      confidence_factors: confidence.confidence_factors,
      learned_rule_confidence_score: confidence.learned_rule_confidence_score,
      rule_success_count: confidence.rule_success_count,
      rule_failure_count: confidence.rule_failure_count,
      rule_feedback_count: confidence.rule_feedback_count,
      rule_last_feedback_at: confidence.rule_last_feedback_at,
      base_priority,
      effective_priority,
      effective_priority_score: effectivePriorityScore
    };

    if (recommendation_type === "RECHECK_GOVERNANCE") {
      reason = `Object risk score is ${riskScore}; governance should be reviewed.`;
      evidence = {
        ...evidence,
        risk_score: riskScore,
        runtime_type: object.object_type,
        state: object.state
      };
    }

    if (recommendation_type === "CLOSE_OPEN_ACTIONS") {
      reason = `${highOpenActions.length} high priority open action(s) should be resolved.`;
      evidence = {
        ...evidence,
        open_action_count: actionsResult.rows.length,
        high_open_action_count: highOpenActions.length
      };
    }

    if (recommendation_type === "REQUEST_APPROVAL") {
      reason = "Latest governance decision requires review and has no approval.";
      evidence = {
        ...evidence,
        decision_id: latestGovernance ? latestGovernance.decision_id : null,
        governance_status: latestGovernance ? latestGovernance.governance_status : null,
        reason_codes: latestGovernance ? latestGovernance.reason_codes : null
      };
    }

    if (recommendation_type === "TRAINING_REQUIRED") {
      reason = `Competency gap detected; training or micro-learning should be planned.`;
      evidence = {
        ...evidence,
        competency_gap: competencyGap,
        person_id: object_id
      };
    }

    recommendations.push({
      recommendation_type,
      priority: effective_priority,
      base_priority,
      confidence_score: confidence.confidence_score,
      confidence_level: confidence.confidence_level,
      confidence_factors: confidence.confidence_factors,
      effective_priority,
      effective_priority_score: effectivePriorityScore,
      reason,
      evidence
    });
  }

  const inserted = [];
  const skipped_duplicates = [];

  for (const recommendation of recommendations) {

    const existingResult = await db.query(`
      SELECT recommendation_id
      FROM runtime_recommendations
      WHERE tenant_id = $1
        AND object_id = $2
        AND recommendation_type = $3
        AND status = 'open'
      LIMIT 1
    `, [
      tenant_id,
      object_id,
      recommendation.recommendation_type
    ]);

    if (existingResult.rows.length > 0) {
      skipped_duplicates.push({
        recommendation_type: recommendation.recommendation_type,
        existing_recommendation_id: existingResult.rows[0].recommendation_id
      });
      continue;
    }

    const recommendation_id =
      "rec-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

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
      recommendation.recommendation_type,
      recommendation.priority,
      recommendation.reason,
      JSON.stringify(recommendation.evidence || {}),
      requested_by || "runtime_admin"
    ]);

    inserted.push({
      recommendation_id,
      object_id,
      status: "open",
      ...recommendation
    });
  }

  await writeEvent({
    tenant_id,
    object_id,
    event_type: "runtime.recommendations.generated",
    message: `Generated ${inserted.length} runtime recommendation(s)`
  });

  return {
    found: true,
    object_id,
    tenant_id,
    generated_count: inserted.length,
    skipped_duplicate_count: skipped_duplicates.length,
    recommendations: inserted,
    skipped_duplicates
  };
}


const server = http.createServer(async (req, res) => {

  const path = req.url.split("?")[0];

  if (req.method === "OPTIONS") {

    res.writeHead(204, {
      "Access-Control-Allow-Origin": "https://app.rudolph-buchhaltung.de",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    return res.end();
  }

  try {

    // HEALTH

    if (req.method === "GET" && path === "/health") {
      return handleHealthRoute(req, res, send);
    }

    // AUTH LOGIN

    if (req.method === "POST" && path === "/auth/login") {
      return handleAuthLoginRoute({
        req,
        res,
        db,
        send,
        readBody,
        verifyOperatorSignature,
        generateToken
      });
    }

    // CREATE OBJECT


    const handledIncidentCoreRoute = await handleIncidentCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledIncidentCoreRoute) {
      return;
    }


    const handledIncidentGovernanceRoute = await handleIncidentGovernanceRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledIncidentGovernanceRoute) {
      return;
    }


    const handledIncidentDashboardRoute = await handleIncidentDashboardRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledIncidentDashboardRoute) {
      return;
    }


    const handledIncidentRegistryRoute = await handleIncidentRegistryRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledIncidentRegistryRoute) {
      return;
    }





    const rsos060EvidenceHandled = await handleRsos060EvidenceRoutes({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      createAuditHash,
      send
    });

    if (rsos060EvidenceHandled !== false) {
      return rsos060EvidenceHandled;
    }

    const handledReportRoute = await handleReportRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      createAuditHash,
      send
    });

    if (handledReportRoute) {
      return;
    }

    const handledOutcomeRoute = await handleOutcomeRoute({
      req,
      res,
      path,
      db,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledOutcomeRoute) {
      return;
    }

    const handledMeasurementRoute = await handleMeasurementRoute({
      req,
      res,
      path,
      db,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledMeasurementRoute) {
      return;
    }

    const rsos060WitnessObservationsHandled = await handleRsos060WitnessObservationsRoutes({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (rsos060WitnessObservationsHandled !== false) {
      return rsos060WitnessObservationsHandled;
    }


    const rsos060AssumptionsHypothesesHandled = await handleRsos060AssumptionsHypothesesRoutes({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (rsos060AssumptionsHypothesesHandled !== false) {
      return rsos060AssumptionsHypothesesHandled;
    }


    const rsos060VerificationsHandled = await handleRsos060VerificationsRoutes({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (rsos060VerificationsHandled !== false) {
      return rsos060VerificationsHandled;
    }

    const handledVerificationCycleRoute = await handleVerificationCycleRoute({
      req,
      res,
      path,
      db,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledVerificationCycleRoute) {
      return;
    }


    const handledFactRoute = await handleFactRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledFactRoute) {
      return;
    }


    const handledUnknownRoute = await handleUnknownRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledUnknownRoute) {
      return;
    }


    const rsos060SourcesHandled = await handleRsos060SourcesRoutes({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (rsos060SourcesHandled !== false) {
      return rsos060SourcesHandled;
    }

    const handledEvidenceGovernanceRoute = await handleEvidenceGovernanceRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledEvidenceGovernanceRoute) {
      return;
    }

    const handledHeuristicsPatternRoute = await handleHeuristicsPatternRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledHeuristicsPatternRoute) {
      return;
    }


    const handledGovernancePolicyRoute = await handleGovernancePolicyRoute({
      req,
      res,
      path,
      db,
      crypto,
      verifyToken,
      readBody,
      writeEvent,
      send
    });

    if (handledGovernancePolicyRoute) {
      return;
    }

    const handledRuntimeExecuteRoute = await handleRuntimeExecuteRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledRuntimeExecuteRoute) {
      return;
    }

    if (req.method === "POST" && path === "/runtime/objects") {
      return handleCreateRuntimeObjectRoute({
        req,
        res,
        db,
        send,
        readBody,
        requireRole,
        writeEvent
      });
    }

    // EXECUTION LAYER

    // GET OBJECTS

    if (req.method === "GET" && path === "/runtime/objects") {
      return handleListRuntimeObjectsRoute({
        req,
        res,
        db,
        send,
        requireRole
      });
    }

    // GET EVENTS

    if (req.method === "GET" && path === "/runtime/events") {
      return handleRuntimeEventsRoute({
        req,
        res,
        db,
        send,
        requireRole
      });
    }

    // VERIFY AUDIT HASH CHAIN

    if (req.method === "GET" && path === "/audit/chain/verify") {
      return handleAuditChainVerifyRoute({
        req,
        res,
        db,
        send,
        requireRole
      });
    }

    const handledTrainingLearningRoute = await handleTrainingLearningRoute({
      req,
      res,
      path,
      db,
      requireRole,
      readBody,
      writeEvent,
      send
    });

    if (handledTrainingLearningRoute) {
      return;
    }

    const handledRecommendationRoute = await handleRecommendationRoute({
      req,
      res,
      path,
      db,
      requireRole,
      readBody,
      writeEvent,
      send,
      generateRecommendationsForObject
    });

    if (handledRecommendationRoute) {
      return;
    }

    // GET FULL OBJECT TRACE

    if (await handleFullTraceRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    })) {
      return;
    }


    const handledUnifiedTraceRoute = await handleUnifiedTraceRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      getTraceObject,
      getTraceAudit,
      getTraceGovernance,
      getTraceExecution,
      getTraceRelations,
      getTraceRecommendations
    });

    if (handledUnifiedTraceRoute) {
      return;
    }

    const handledPathRoute = await handlePathRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledPathRoute) {
      return;
    }

    const handledRelationsGraphRoute = await handleRelationsGraphRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledRelationsGraphRoute) {
      return;
    }

    const handledTenantRuntimeRoute = await handleTenantRuntimeRoute({
      req,
      res,
      path,
      db,
      requireRole,
      readBody,
      writeEvent,
      send
    });

    if (handledTenantRuntimeRoute) {
      return;
    }

    const handledTrainingGapGeneratorRoute = await handleTrainingGapGeneratorRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      writeEvent
    });

    if (handledTrainingGapGeneratorRoute) {
      return;
    }


    const handledLearningDashboardRoute = await handleLearningDashboardRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledLearningDashboardRoute) {
      return;
    }


    const handledRecommendationGapGeneratorRoute = await handleRecommendationGapGeneratorRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      writeEvent
    });

    if (handledRecommendationGapGeneratorRoute) {
      return;
    }


    const handledKnowledgeRoute = await handleKnowledgeRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledKnowledgeRoute) {
      return;
    }

    const handledTenantAdminRoute = await handleTenantAdminRoute({
      req,
      res,
      path,
      db,
      requireRole,
      readBody,
      writeEvent,
      send
    });

    if (handledTenantAdminRoute) {
      return;
    }

    const handledTenantDashboardListRoute = await handleTenantDashboardListRoute({
      req,
      res,
      path,
      db
    });

    if (handledTenantDashboardListRoute) {
      return;
    }


    const handledTenantDashboardDetailRoute = await handleTenantDashboardDetailRoute({
      req,
      res,
      path,
      db,
      send
    });

    if (handledTenantDashboardDetailRoute) {
      return;
    }


    const handledTenantReadRoute = await handleTenantReadRoute({
      req,
      res,
      path,
      db,
      requireRole,
      send
    });

    if (handledTenantReadRoute) {
      return;
    }

    // DASHBOARD


    const handledManagementDashboardRoute = await handleManagementDashboardRoute({
      req,
      res,
      path,
      db,
      send
    });

    if (handledManagementDashboardRoute) {
      return;
    }


    const handledRuntimeDashboardRoute = await handleRuntimeDashboardRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledRuntimeDashboardRoute) {
      return;
    }



    const handledGovernanceEvaluateRoute = await handleGovernanceEvaluateRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledGovernanceEvaluateRoute) {
      return;
    }


    const handledScheduleRoute = await handleScheduleRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledScheduleRoute) {
      return;
    }




    const handledWorkerRoute = await handleWorkerRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      writeEvent,
      generateRecommendationsForObject
    });

    if (handledWorkerRoute) {
      return;
    }


    const handledRuntimeMetricsRoute = await handleRuntimeMetricsRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledRuntimeMetricsRoute) {
      return;
    }


    const handledDeadLetterRoute = await handleDeadLetterRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDeadLetterRoute) {
      return;
    }


    const handledWorkflowStateRoute = await handleWorkflowStateRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledWorkflowStateRoute) {
      return;
    }

    const handledDefenseIngressRoute = await handleDefenseIngressRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent,
      executeDefensePipeline
    });

    if (handledDefenseIngressRoute) {
      return;
    }


    const handledDefenseIngressReadRoute = await handleDefenseIngressReadRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledDefenseIngressReadRoute) {
      return;
    }


    const handledDefenseShadowValidationsRoute = await handleDefenseShadowValidationsRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseShadowValidationsRoute) {
      return;
    }


    const handledDefenseQuarantineCoreRoute = await handleDefenseQuarantineCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseQuarantineCoreRoute) {
      return;
    }


    const handledDefenseQuarantineReviewRoute = await handleDefenseQuarantineReviewRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseQuarantineReviewRoute) {
      return;
    }


    const handledDefenseQuarantineApproveRoute = await handleDefenseQuarantineApproveRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseQuarantineApproveRoute) {
      return;
    }


    const handledDefenseQuarantineRejectRoute = await handleDefenseQuarantineRejectRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseQuarantineRejectRoute) {
      return;
    }


    const handledDefenseSavepointsCoreRoute = await handleDefenseSavepointsCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseSavepointsCoreRoute) {
      return;
    }


    const handledDefenseSavepointsReadRoute = await handleDefenseSavepointsReadRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledDefenseSavepointsReadRoute) {
      return;
    }


    const handledDefenseSavepointsRollbackRoute = await handleDefenseSavepointsRollbackRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseSavepointsRollbackRoute) {
      return;
    }

    const handledDefenseRecoveryRequestsCoreRoute = await handleDefenseRecoveryRequestsCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryRequestsCoreRoute) {
      return;
    }

    const handledDefenseRecoveryRequestsReviewRoute = await handleDefenseRecoveryRequestsReviewRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryRequestsReviewRoute) {
      return;
    }

    const handledDefenseRecoveryRequestsApproveRoute = await handleDefenseRecoveryRequestsApproveRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryRequestsApproveRoute) {
      return;
    }

    const handledDefenseRecoveryRequestsRejectRoute = await handleDefenseRecoveryRequestsRejectRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryRequestsRejectRoute) {
      return;
    }

    const handledDefenseRecoveryRequestsExecuteRoute = await handleDefenseRecoveryRequestsExecuteRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryRequestsExecuteRoute) {
      return;
    }

    const handledDefenseRecoveryVerificationsCoreRoute = await handleDefenseRecoveryVerificationsCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryVerificationsCoreRoute) {
      return;
    }

    const handledDefenseRecoveryVerificationsCloseRoute = await handleDefenseRecoveryVerificationsCloseRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseRecoveryVerificationsCloseRoute) {
      return;
    }

    // RSOS-066B RUNTIME DEFENSE LAYER

    const handledDefenseMetricsRoute = await handleDefenseMetricsRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseMetricsRoute) {
      return;
    }

    const handledDefenseAuditReportsCoreRoute = await handleDefenseAuditReportsCoreRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseAuditReportsCoreRoute) {
      return;
    }

    const handledDefenseAuditReportsDetailRoute = await handleDefenseAuditReportsDetailRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole
    });

    if (handledDefenseAuditReportsDetailRoute) {
      return;
    }

    const handledDefenseStateRoute = await handleDefenseStateRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledDefenseStateRoute) {
      return;
    }


    const handledLearningCompetenceRoute = await handleLearningCompetenceRoute({
      req,
      res,
      path,
      db,
      send,
      requireRole,
      readBody,
      writeEvent
    });

    if (handledLearningCompetenceRoute) {
      return;
    }

  } catch (err) {
    console.error(err);

    return send(res, 500, {
      error: "runtime_error",
      message: err.message
    });
  }
});

initDb(db)
  .then(() => {



    server.listen(8080, () => {

      console.log(
        "RS OS Runtime active on port 8080"
      );
    });
  })
  .catch(err => {

    console.error(
      "Database init failed:",
      err
    );

    process.exit(1);
  });
