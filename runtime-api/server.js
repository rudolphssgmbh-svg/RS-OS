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
const { handleFullTraceRoute } = require("./routes/trace/full-trace-route");
const { handleManagementDashboardRoute } = require("./routes/dashboard/management-dashboard-route");
const { handleRuntimeDashboardRoute } = require("./routes/dashboard/runtime-dashboard-route");
const { handleTenantDashboardListRoute } = require("./routes/dashboard/tenant-dashboard-list-route");
const { handleTenantDashboardDetailRoute } = require("./routes/dashboard/tenant-dashboard-detail-route");
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
const { handleOrchestrationRoute } = require("./routes/orchestrations/orchestration-route");
const { handleCommunicationRoute } = require("./routes/communications/communication-route");
const { handleTrainingLearningRoute } = require("./routes/training/training-learning-route");
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

    if (req.method === "POST" && path === "/runtime/governance-policies") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const policy_name = body.policy_name;
      const trust_level = body.trust_level;
      const min_trust_score = body.min_trust_score === undefined ? null : body.min_trust_score;
      const max_trust_score = body.max_trust_score === undefined ? null : body.max_trust_score;
      const governance_decision = body.governance_decision;
      const human_approval_required = body.human_approval_required === false ? false : true;
      const autonomous_execution_allowed = body.autonomous_execution_allowed === true ? true : false;
      const enabled = body.enabled === false ? false : true;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !policy_name || !trust_level || !governance_decision) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id, policy_name, trust_level and governance_decision required"
        });
      }

      const policy_id =
        "00000000-0000-4025-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_governance_policies (
          policy_id,
          tenant_id,
          policy_name,
          trust_level,
          min_trust_score,
          max_trust_score,
          governance_decision,
          human_approval_required,
          autonomous_execution_allowed,
          enabled,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        policy_id,
        tenant_id,
        policy_name,
        trust_level,
        min_trust_score,
        max_trust_score,
        governance_decision,
        human_approval_required,
        autonomous_execution_allowed,
        enabled,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: policy_id,
        event_type: "runtime.governance_policy.created",
        message: JSON.stringify({
          policy_id,
          policy_name,
          trust_level,
          min_trust_score,
          max_trust_score,
          governance_decision,
          human_approval_required,
          autonomous_execution_allowed,
          enabled
        })
      });

      return send(res, 201, {
        governance_policy: {
          policy_id,
          tenant_id,
          policy_name,
          trust_level,
          min_trust_score,
          max_trust_score,
          governance_decision,
          human_approval_required,
          autonomous_execution_allowed,
          enabled,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/governance-policies") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          policy_id,
          tenant_id,
          policy_name,
          trust_level,
          min_trust_score,
          max_trust_score,
          governance_decision,
          human_approval_required,
          autonomous_execution_allowed,
          enabled,
          created_at,
          created_by
        FROM runtime_governance_policies
        WHERE tenant_id = $1
        ORDER BY min_trust_score ASC, created_at ASC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        governance_policies: result.rows
      });
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
if (req.method === "POST" && path === "/runtime/execute") {

  const executeAuth = requireRole(req, [
    "runtime_admin"
  ]);

  if (!executeAuth.allowed) {
    return send(res, executeAuth.code, executeAuth.response);
  }

  const authUser = executeAuth.user;
  const tenant_id = authUser.tenant_id;

  const body = await readBody(req);

  const job_id = `job-${Date.now()}`;
  const object_id = body.object_id;
  const execution_type = body.execution_type || "runtime.execution";
  const payload = body.payload || {};
  const next_execution_type = body.next_execution_type || null;
  const workflow_id = body.workflow_id || job_id;
  const chain_position = Number(body.chain_position || 0);

  const dag = payload.dag || {};
  const edges = Array.isArray(dag.edges) ? dag.edges : [];

  const graph = {};

  for (const edge of edges) {
    const from = edge.from;
    const targets = Array.isArray(edge.to) ? edge.to : [edge.to];

    if (!from) {
      continue;
    }

    graph[from] = graph[from] || [];

    for (const target of targets) {
      if (target) {
        graph[from].push(target);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();

  function hasCycle(node) {
    if (visiting.has(node)) {
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);

    for (const next of graph[node] || []) {
      if (hasCycle(next)) {
        return true;
      }
    }

    visiting.delete(node);
    visited.add(node);

    return false;
  }

  for (const node of Object.keys(graph)) {
    if (hasCycle(node)) {
      return send(res, 400, {
        error: "dag_cycle_detected",
        node
      });
    }
  }

  if (!object_id) {
    return send(res, 400, {
      error: "missing_object_id"
    });
  }

  const latestGovernanceResult = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    tenant_id,
    object_id
  ]);

  const latestGovernanceDecision =
    latestGovernanceResult.rows[0] || null;

  if (!latestGovernanceDecision) {
    await writeEvent({
      event_type: "runtime.governance.gate.review_required",
      object_id,
      message: "Execution gate requires governance check before execution",
      tenant_id
    });

    return send(res, 403, {
      error: "governance_decision_required",
      gate_status: "review_required",
      object_id,
      tenant_id
    });
  }

  if (latestGovernanceDecision.governance_status === "blocked") {
    await writeEvent({
      event_type: "runtime.governance.gate.blocked",
      object_id,
      message: "Execution blocked by governance gate",
      tenant_id
    });

    return send(res, 403, {
      error: "execution_blocked_by_governance",
      gate_status: "blocked",
      governance_status: latestGovernanceDecision.governance_status,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id
    });
  }

  if (latestGovernanceDecision.governance_status === "review_required") {
    const approvalResult = await db.query(`
      SELECT *
      FROM runtime_governance_approvals
      WHERE tenant_id = $1
        AND decision_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [
      tenant_id,
      latestGovernanceDecision.decision_id
    ]);

    const approval = approvalResult.rows[0] || null;

    if (!approval) {
      await writeEvent({
        event_type: "runtime.governance.gate.review_required",
        object_id,
        message: "Execution requires review before governance gate allows execution",
        tenant_id
      });

      return send(res, 403, {
        error: "execution_requires_governance_review",
        gate_status: "review_required",
        governance_status: latestGovernanceDecision.governance_status,
        decision_id: latestGovernanceDecision.decision_id,
        object_id,
        tenant_id
      });
    }

    if (approval.approval_status === "rejected") {
      await writeEvent({
        event_type: "runtime.governance.gate.blocked",
        object_id,
        message: "Execution rejected by governance approval",
        tenant_id
      });

      return send(res, 403, {
        error: "execution_rejected_by_governance_approval",
        gate_status: "blocked",
        governance_status: latestGovernanceDecision.governance_status,
        approval_status: approval.approval_status,
        decision_id: latestGovernanceDecision.decision_id,
        approval_id: approval.approval_id,
        object_id,
        tenant_id
      });
    }

    if (approval.approval_status === "approved") {
      await writeEvent({
        event_type: "runtime.governance.gate.allowed",
        object_id,
        message: "Execution allowed by governance approval",
        tenant_id
      });
    }
  }

  await writeEvent({
    event_type: "runtime.governance.gate.allowed",
    object_id,
    message: "Execution allowed by governance gate",
    tenant_id
  });

  await db.query(`
    INSERT INTO runtime_execution_jobs
    (
      job_id,
      object_id,
      tenant_id,
      execution_type,
      status,
      payload,
      next_execution_type,
      workflow_id,
      chain_position
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [
    job_id,
    object_id,
    tenant_id,
    execution_type,
    "pending",
    JSON.stringify(payload),
    next_execution_type,
    workflow_id,
    chain_position
  ]);

  await writeEvent({
    event_type: "runtime.execution.started",
    object_id,
    message: `Execution started: ${execution_type}`,
    tenant_id
  });

  return send(res, 200, {
    execution_started: true,
    job_id,
    object_id,
    execution_type,
    tenant_id
  });
}
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

    // GET RUNTIME RECOMMENDATION RULES

    if (req.method === "GET" && path === "/runtime/recommendation-rules") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const result = await db.query(`
        SELECT
          rule_id,
          tenant_id,
          rule_name,
          enabled,
          condition_definition,
          recommendation_definition,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_recommendation_rules
        WHERE tenant_id = $1
        ORDER BY enabled DESC, rule_id ASC
      `, [
        auth.user.tenant_id
      ]);

      const enabled_count = result.rows.filter(rule => rule.enabled === true).length;

      return send(res, 200, {
        tenant_id: auth.user.tenant_id,
        rule_count: result.rows.length,
        enabled_count,
        rules: result.rows
      });
    }

    // GENERATE RUNTIME RECOMMENDATIONS BY OBJECT
    // RSOS-062A consolidated recommendation generator

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/generate/")) {

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

      const object_id = decodeURIComponent(
        path.replace("/runtime/recommendations/generate/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await generateRecommendationsForObject({
        tenant_id,
        object_id,
        requested_by: auth.user.operator_id || auth.user.username || "runtime_admin"
      });

      if (!result.found) {
        return send(res, 404, {
          error: "object_not_found",
          object_id
        });
      }

      return send(res, 200, result);
    }



    // RECORD RUNTIME RECOMMENDATION FEEDBACK
    // RSOS-062D recommendation outcome learning

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/feedback/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "governance",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/feedback/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const body = await readBody(req);
      const outcome = body.outcome || null;
      const feedback_reason = body.feedback_reason || null;
      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      if (!["success", "failure"].includes(outcome)) {
        return send(res, 400, {
          error: "validation_error",
          message: "outcome must be success or failure"
        });
      }

      const recommendationResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (recommendationResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = recommendationResult.rows[0];
      const evidence = recommendation.evidence || {};
      const rule_id = evidence.rule_id || null;

      if (!rule_id) {
        return send(res, 409, {
          error: "recommendation_has_no_rule_id",
          recommendation_id
        });
      }

      const ruleResult = await db.query(`
        SELECT
          rule_id,
          rule_name,
          success_count,
          failure_count,
          feedback_count,
          confidence_score
        FROM runtime_recommendation_rules
        WHERE tenant_id = $1
          AND rule_id = $2
        LIMIT 1
      `, [
        tenant_id,
        rule_id
      ]);

      if (ruleResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_rule_not_found",
          recommendation_id,
          rule_id
        });
      }

      const rule = ruleResult.rows[0];

      const success_count_before = Number(rule.success_count || 0);
      const failure_count_before = Number(rule.failure_count || 0);
      const feedback_count_before = Number(rule.feedback_count || 0);
      const confidence_score_before = Number(rule.confidence_score || 50);

      const success_count_after =
        outcome === "success"
          ? success_count_before + 1
          : success_count_before;

      const failure_count_after =
        outcome === "failure"
          ? failure_count_before + 1
          : failure_count_before;

      const feedback_count_after = feedback_count_before + 1;

      const total = success_count_after + failure_count_after;

      let confidence_score_after =
        total > 0
          ? (success_count_after / total) * 100
          : confidence_score_before;

      confidence_score_after =
        Math.max(0, Math.min(100, Math.round(confidence_score_after * 100) / 100));

      const updateRuleResult = await db.query(`
        UPDATE runtime_recommendation_rules
        SET
          success_count = $1,
          failure_count = $2,
          feedback_count = $3,
          confidence_score = $4,
          last_feedback_at = now(),
          updated_by = $5,
          updated_at = now()
        WHERE tenant_id = $6
          AND rule_id = $7
        RETURNING *
      `, [
        success_count_after,
        failure_count_after,
        feedback_count_after,
        confidence_score_after,
        created_by,
        tenant_id,
        rule_id
      ]);

      const updatedRule = updateRuleResult.rows[0];

      const updatedEvidence = {
        ...(recommendation.evidence || {}),
        latest_feedback: {
          outcome,
          feedback_reason,
          confidence_score_before,
          confidence_score_after,
          success_count_before,
          success_count_after,
          failure_count_before,
          failure_count_after,
          feedback_count_before,
          feedback_count_after,
          recorded_by: created_by,
          recorded_at: new Date().toISOString()
        }
      };

      const updateRecommendationResult = await db.query(`
        UPDATE runtime_recommendations
        SET
          evidence = $1
        WHERE tenant_id = $2
          AND recommendation_id = $3
        RETURNING *
      `, [
        JSON.stringify(updatedEvidence),
        tenant_id,
        recommendation_id
      ]);

      const updatedRecommendation = updateRecommendationResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: recommendation.object_id,
        event_type: "runtime.recommendation.feedback.recorded",
        message: JSON.stringify({
          recommendation_id,
          rule_id,
          outcome,
          confidence_score_before,
          confidence_score_after,
          success_count_before,
          success_count_after,
          failure_count_before,
          failure_count_after,
          feedback_count_before,
          feedback_count_after
        })
      });

      return send(res, 200, {
        feedback_recorded: true,
        recommendation_id,
        rule_id,
        outcome,
        confidence_score_before,
        confidence_score_after,
        rule: updatedRule,
        recommendation: updatedRecommendation
      });
    }

    // VERIFY RUNTIME RECOMMENDATION GATE
    // RSOS-062E Recommendation Verification Gate

    // GET LATEST RUNTIME RECOMMENDATION VERIFICATION GATE
    // RSOS-062E-F Recommendation Gate Read API

    if (req.method === "GET" && path.startsWith("/runtime/recommendations/gates/latest/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "governance",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/gates/latest/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const gateResult = await db.query(`
        SELECT *
        FROM runtime_recommendation_verification_gates
        WHERE tenant_id = $1::text
          AND recommendation_id = $2::text
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      return send(res, 200, {
        recommendation_id,
        latest_gate_found: gateResult.rows.length > 0,
        latest_gate: gateResult.rows[0] || null
      });
    }

    // GET RUNTIME RECOMMENDATION VERIFICATION GATE HISTORY
    // RSOS-062E-F Recommendation Gate Read API

    if (req.method === "GET" && path.startsWith("/runtime/recommendations/gates/history/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "governance",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/gates/history/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const gatesResult = await db.query(`
        SELECT *
        FROM runtime_recommendation_verification_gates
        WHERE tenant_id = $1::text
          AND recommendation_id = $2::text
        ORDER BY created_at DESC
        LIMIT 50
      `, [
        tenant_id,
        recommendation_id
      ]);

      return send(res, 200, {
        recommendation_id,
        count: gatesResult.rows.length,
        gates: gatesResult.rows
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/verify/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "governance",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/verify/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const recommendationResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (recommendationResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = recommendationResult.rows[0];

      const evidenceResult = await db.query(`
        SELECT evidence_id, source_id
        FROM runtime_evidence
        WHERE tenant_id = $1
          AND object_id = $2
      `, [
        tenant_id,
        recommendation.object_id
      ]);

      const assumptionResult = await db.query(`
        SELECT assumption_id
        FROM runtime_assumptions
        WHERE tenant_id = $1
          AND evidence_id = ANY($2::uuid[])
      `, [
        tenant_id,
        evidenceResult.rows.map(row => row.evidence_id)
      ]);

      const hypothesisResult = await db.query(`
        SELECT hypothesis_id
        FROM runtime_hypotheses
        WHERE tenant_id = $1
          AND assumption_id = ANY($2::uuid[])
      `, [
        tenant_id,
        assumptionResult.rows.map(row => row.assumption_id)
      ]);

      const verificationResult = await db.query(`
        SELECT verification_id
        FROM runtime_verifications
        WHERE tenant_id = $1
          AND hypothesis_id = ANY($2::uuid[])
      `, [
        tenant_id,
        hypothesisResult.rows.map(row => row.hypothesis_id)
      ]);

      const evidence_ids = evidenceResult.rows.map(row => row.evidence_id);
      const source_ids = [...new Set(evidenceResult.rows.map(row => row.source_id).filter(Boolean))];
      const assumption_ids = assumptionResult.rows.map(row => row.assumption_id);
      const hypothesis_ids = hypothesisResult.rows.map(row => row.hypothesis_id);
      const verification_ids = verificationResult.rows.map(row => row.verification_id);

      const evidence_count = evidence_ids.length;
      const source_count = source_ids.length;
      const assumption_count = assumption_ids.length;
      const hypothesis_count = hypothesis_ids.length;
      const verification_count = verification_ids.length;

      let gate_status = "pending";
      let gate_result = "pending";
      let gate_reason = "Recommendation verification gate created.";

      let evidence_result = "available";
      let source_result = "available";
      let verification_result = "available";
      let assumption_result = "documented";
      let hypothesis_result = "available";
      let unknown_result = "not_checked";
      let risk_result = "not_checked";
      let governance_result = "not_checked";

      if (evidence_count === 0) {
        gate_status = "needs_evidence";
        gate_result = "needs_evidence";
        gate_reason = "No runtime evidence found for recommendation object.";
        evidence_result = "missing";
        source_result = "not_checked";
        verification_result = "not_checked";
        assumption_result = "not_checked";
        hypothesis_result = "not_checked";
        unknown_result = "not_checked";
        risk_result = "not_checked";
        governance_result = "not_checked";
      } else if (source_count === 0) {
        gate_status = "needs_source_validation";
        gate_result = "needs_source_validation";
        gate_reason = "Runtime evidence exists but no linked source was found.";
        source_result = "missing";
      } else if (hypothesis_count === 0) {
        gate_status = "needs_verification";
        gate_result = "needs_verification";
        gate_reason = "Evidence exists but no hypothesis chain was found.";
        hypothesis_result = "missing";
      } else if (verification_count === 0) {
        gate_status = "needs_verification";
        gate_result = "needs_verification";
        gate_reason = "Hypothesis chain exists but no verification was found.";
        verification_result = "missing";
      } else {
        gate_status = "verified_with_risk";
        gate_result = "verified_with_risk";
        gate_reason = "Evidence, source, hypothesis and verification chain found. Residual risk and governance still require explicit review.";
        risk_result = "requires_review";
        governance_result = "requires_review";
      }

      const gate_id =
        "gate-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const gatePayload = {
        recommendation_id,
        recommendation_type: recommendation.recommendation_type,
        recommendation_status: recommendation.status,
        recommendation_priority: recommendation.priority,
        object_id: recommendation.object_id,
        checked_at: new Date().toISOString()
      };

      const insertResult = await db.query(`
        INSERT INTO runtime_recommendation_verification_gates (
          gate_id,
          tenant_id,
          recommendation_id,
          object_id,
          gate_status,
          gate_result,
          gate_reason,
          evidence_count,
          source_count,
          verification_count,
          unknown_count,
          assumption_count,
          hypothesis_count,
          risk_count,
          evidence_result,
          source_result,
          verification_result,
          unknown_result,
          assumption_result,
          hypothesis_result,
          risk_result,
          governance_result,
          evidence_ids,
          source_ids,
          verification_ids,
          assumption_ids,
          hypothesis_ids,
          gate_payload,
          created_by,
          decided_by,
          decided_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8::integer,$9::integer,$10::integer,$11::integer,$12::integer,$13::integer,$14::integer,
          $15::text,$16::text,$17::text,$18::text,$19::text,$20::text,$21::text,$22::text,
          $23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27::jsonb,
          $28::jsonb,$29::text,$30::text,now()
        )
        RETURNING *
      `, [
        gate_id,
        tenant_id,
        recommendation_id,
        recommendation.object_id,
        gate_status,
        gate_result,
        gate_reason,
        Number(evidence_count),
        Number(source_count),
        Number(verification_count),
        0,
        Number(assumption_count),
        Number(hypothesis_count),
        0,
        evidence_result,
        source_result,
        verification_result,
        unknown_result,
        assumption_result,
        hypothesis_result,
        risk_result,
        governance_result,
        JSON.stringify(evidence_ids),
        JSON.stringify(source_ids),
        JSON.stringify(verification_ids),
        JSON.stringify(assumption_ids),
        JSON.stringify(hypothesis_ids),
        JSON.stringify(gatePayload),
        created_by,
        created_by
      ]);

      const gateUpdateResult = await db.query(`
        WITH unknown_summary AS (
          SELECT COUNT(*)::integer AS unknown_count
          FROM runtime_unknowns
          WHERE tenant_id = $1
            AND related_object_id = $2
            AND COALESCE(status, 'open') <> 'closed'
        ),
        risk_summary AS (
          SELECT
            COUNT(*)::integer AS risk_count,
            COALESCE(MAX(risk_score), 0)::integer AS max_risk_score,
            COALESCE(MAX(probability), 0)::integer AS max_probability,
            COALESCE(MAX(damage), 0)::integer AS max_damage,
            COUNT(*) FILTER (WHERE risk_state = 'acute')::integer AS acute_risk_count
          FROM runtime_risks
          WHERE tenant_id = $1
            AND object_id = $2
        ),
        governance_summary AS (
          SELECT
            COUNT(*)::integer AS governance_decision_count,
            COALESCE(
              (
                SELECT governance_status
                FROM runtime_governance_decisions
                WHERE tenant_id = $1
                  AND object_id = $2
                ORDER BY created_at DESC
                LIMIT 1
              ),
              'not_checked'
            )::text AS latest_governance_status
        )
        UPDATE runtime_recommendation_verification_gates g
        SET
          unknown_count = u.unknown_count,
          risk_count = r.risk_count,
          unknown_result = CASE
            WHEN u.unknown_count > 0 THEN 'open_unknowns'
            ELSE 'clear'
          END,
          risk_result = CASE
            WHEN r.acute_risk_count > 0 THEN 'acute_risk'
            WHEN r.max_risk_score >= 25 THEN 'high_risk'
            WHEN r.risk_count > 0 THEN 'risk_present'
            ELSE 'clear'
          END,
          governance_result = CASE
            WHEN gs.latest_governance_status = 'not_checked' THEN 'not_checked'
            ELSE gs.latest_governance_status
          END,
          residual_risk = jsonb_build_object(
            'risk_count', r.risk_count,
            'max_risk_score', r.max_risk_score,
            'max_probability', r.max_probability,
            'max_damage', r.max_damage,
            'acute_risk_count', r.acute_risk_count,
            'governance_decision_count', gs.governance_decision_count,
            'latest_governance_status', gs.latest_governance_status,
            'updated_after_gate_insert', true,
            'updated_at', now()
          )
        FROM unknown_summary u, risk_summary r, governance_summary gs
        WHERE g.tenant_id = $1
          AND g.gate_id = $3
        RETURNING g.*
      `, [
        tenant_id,
        recommendation.object_id,
        gate_id
      ]);

      const updatedGate = gateUpdateResult.rows[0] || insertResult.rows[0];

      let final_gate_status = updatedGate.gate_status;
      let final_gate_result = updatedGate.gate_result;
      let final_gate_reason = updatedGate.gate_reason;

      if (updatedGate.governance_result === "rejected") {
        final_gate_status = "blocked";
        final_gate_result = "blocked_by_governance";
        final_gate_reason = "Recommendation blocked because latest governance decision rejected it.";
      } else if (updatedGate.risk_result === "acute_risk") {
        final_gate_status = "blocked";
        final_gate_result = "blocked_by_acute_risk";
        final_gate_reason = "Recommendation blocked because acute risk is present.";
      } else if (updatedGate.unknown_result === "open_unknowns") {
        final_gate_status = "review_required";
        final_gate_result = "review_required_unknowns";
        final_gate_reason = "Recommendation requires review because open unknowns exist.";
      } else if (updatedGate.risk_result === "high_risk") {
        final_gate_status = "review_required";
        final_gate_result = "review_required_high_risk";
        final_gate_reason = "Recommendation requires review because high residual risk exists.";
      } else if (
        updatedGate.evidence_result === "available" &&
        updatedGate.source_result === "available" &&
        updatedGate.hypothesis_result === "available" &&
        updatedGate.verification_result === "available" &&
        updatedGate.unknown_result === "clear" &&
        (updatedGate.risk_result === "clear" || updatedGate.risk_result === "risk_present") &&
        updatedGate.governance_result === "approved"
      ) {
        final_gate_status = "verified";
        final_gate_result = "verified";
        final_gate_reason = "Recommendation verified: evidence, source, hypothesis, verification, risk and governance checks passed.";
      }

      const finalGateResult = await db.query(`
        UPDATE runtime_recommendation_verification_gates
        SET
          gate_status = $1::text,
          gate_result = $2::text,
          gate_reason = $3::text,
          gate_payload = gate_payload || jsonb_build_object(
            'decision_engine_applied', true,
            'decision_engine_applied_at', now(),
            'previous_gate_status', $4::text,
            'previous_gate_result', $5::text
          )
        WHERE tenant_id = $6::text
          AND gate_id = $7::text
        RETURNING *
      `, [
        final_gate_status,
        final_gate_result,
        final_gate_reason,
        updatedGate.gate_status,
        updatedGate.gate_result,
        tenant_id,
        gate_id
      ]);

      const finalGate = finalGateResult.rows[0] || updatedGate;

      await writeEvent({
        tenant_id,
        object_id: recommendation.object_id,
        event_type: "runtime.recommendation.verification_gate.decision_applied",
        message: JSON.stringify({
          gate_id,
          recommendation_id,
          previous_gate_status: updatedGate.gate_status,
          previous_gate_result: updatedGate.gate_result,
          gate_status: finalGate.gate_status,
          gate_result: finalGate.gate_result,
          gate_reason: finalGate.gate_reason
        })
      });

      await writeEvent({
        tenant_id,
        object_id: recommendation.object_id,
        event_type: "runtime.recommendation.verification_gate.updated",
        message: JSON.stringify({
          gate_id,
          recommendation_id,
          unknown_count: finalGate.unknown_count,
          risk_count: finalGate.risk_count,
          unknown_result: finalGate.unknown_result,
          risk_result: finalGate.risk_result,
          governance_result: finalGate.governance_result
        })
      });

      await writeEvent({
        tenant_id,
        object_id: recommendation.object_id,
        event_type: "runtime.recommendation.verification_gate.created",
        message: JSON.stringify({
          gate_id,
          recommendation_id,
          gate_status,
          gate_result,
          gate_reason
        })
      });

      return send(res, 200, {
        verified: finalGate.gate_status === "verified",
        gate_created: true,
        gate: finalGate
      });
    }

    // EXECUTE APPROVED RUNTIME RECOMMENDATION

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/execute/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/execute/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const recommendationResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (recommendationResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = recommendationResult.rows[0];

      const latestGateResult = await db.query(`
        SELECT *
        FROM runtime_recommendation_verification_gates
        WHERE tenant_id = $1::text
          AND recommendation_id = $2::text
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      const latestGate = latestGateResult.rows[0] || null;

      if (!latestGate) {
        await writeEvent({
          tenant_id,
          object_id: recommendation.object_id,
          event_type: "runtime.recommendation.execution.blocked_by_missing_gate",
          message: JSON.stringify({
            recommendation_id,
            reason: "No verification gate found for recommendation."
          })
        });

        return send(res, 409, {
          error: "recommendation_execution_gate_missing",
          recommendation_id,
          message: "Recommendation execution blocked because no verification gate exists."
        });
      }

      if (latestGate.gate_status !== "verified") {
        await writeEvent({
          tenant_id,
          object_id: recommendation.object_id,
          event_type: "runtime.recommendation.execution.blocked_by_gate",
          message: JSON.stringify({
            recommendation_id,
            gate_id: latestGate.gate_id,
            gate_status: latestGate.gate_status,
            gate_result: latestGate.gate_result,
            gate_reason: latestGate.gate_reason
          })
        });

        return send(res, 409, {
          error: "recommendation_execution_gate_not_verified",
          recommendation_id,
          gate_id: latestGate.gate_id,
          gate_status: latestGate.gate_status,
          gate_result: latestGate.gate_result,
          gate_reason: latestGate.gate_reason,
          message: "Recommendation execution blocked because latest verification gate is not verified."
        });
      }

      if (recommendation.status !== "approved") {
        return send(res, 409, {
          error: "recommendation_not_approved",
          recommendation_id,
          current_status: recommendation.status
        });
      }

      const job_id =
        "job-" + Date.now();

      const execution_type =
        "recommendation." + recommendation.recommendation_type;

      const requested_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_execution_jobs (
          job_id,
          tenant_id,
          object_id,
          status,
          requested_by,
          execution_type,
          payload,
          available_at,
          priority,
          workflow_id,
          chain_position
        )
        VALUES ($1,$2,$3,'pending',$4,$5,$6,now(),$7,$8,0)
      `, [
        job_id,
        tenant_id,
        recommendation.object_id,
        requested_by,
        execution_type,
        JSON.stringify({
          recommendation_id,
          recommendation_type: recommendation.recommendation_type,
          reason: recommendation.reason,
          evidence: recommendation.evidence
        }),
        recommendation.priority === "critical" ? 10 : 100,
        job_id
      ]);

      const updateResult = await db.query(`
        UPDATE runtime_recommendations
        SET
          status = 'executed',
          executed_job_id = $1,
          executed_at = now()
        WHERE tenant_id = $2
          AND recommendation_id = $3
        RETURNING *
      `, [
        job_id,
        tenant_id,
        recommendation_id
      ]);

      const executedRecommendation = updateResult.rows[0];

      const createdTrainingPlans = [];

      if (executedRecommendation.recommendation_type === "TRAINING_REQUIRED") {
        const competencyResult = await db.query(`
          SELECT
            competency_id,
            competency_name,
            gap
          FROM runtime_competencies
          WHERE tenant_id = $1
            AND person_id = $2
            AND gap > 0
          ORDER BY gap DESC, competency_name ASC
        `, [
          tenant_id,
          executedRecommendation.object_id
        ]);

        for (const competency of competencyResult.rows) {
          const gap = Number(competency.gap || 0);

          let training_type = "MICRO_LEARNING";
          let estimated_duration_minutes = 15;

          if (gap === 2) {
            training_type = "MICRO_LEARNING";
            estimated_duration_minutes = 30;
          } else if (gap === 3) {
            training_type = "COACHING";
            estimated_duration_minutes = 60;
          } else if (gap >= 4) {
            training_type = "FORMAL_TRAINING";
            estimated_duration_minutes = 120;
          }

          const training_plan_id =
            "trn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

          await db.query(`
            INSERT INTO runtime_training_plans (
              training_plan_id,
              tenant_id,
              person_id,
              competency_name,
              recommendation_id,
              training_type,
              estimated_duration_minutes,
              status,
              created_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,'planned',$8)
          `, [
            training_plan_id,
            tenant_id,
            executedRecommendation.object_id,
            competency.competency_name,
            executedRecommendation.recommendation_id,
            training_type,
            estimated_duration_minutes,
            requested_by
          ]);

          createdTrainingPlans.push({
            training_plan_id,
            person_id: executedRecommendation.object_id,
            competency_name: competency.competency_name,
            gap,
            training_type,
            estimated_duration_minutes,
            status: "planned"
          });
        }
      }

      await writeEvent({
        tenant_id,
        object_id: executedRecommendation.object_id,
        event_type: "runtime.recommendation.executed",
        message: `Recommendation execution job created: ${execution_type}`
      });

      return send(res, 200, {
        executed: true,
        job_id,
        execution_type,
        training_plans_created: createdTrainingPlans.length,
        training_plans: createdTrainingPlans,
        recommendation: executedRecommendation
      });
    }

    // APPROVE RUNTIME RECOMMENDATION

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/approve/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/approve/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = existingResult.rows[0];

      if (recommendation.status !== "open") {
        return send(res, 409, {
          error: "recommendation_not_open",
          recommendation_id,
          current_status: recommendation.status
        });
      }

      const approved_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_recommendations
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = now()
        WHERE tenant_id = $2
          AND recommendation_id = $3
        RETURNING *
      `, [
        approved_by,
        tenant_id,
        recommendation_id
      ]);

      const approvedRecommendation = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: approvedRecommendation.object_id,
        event_type: "runtime.recommendation.approved",
        message: `Recommendation approved: ${approvedRecommendation.recommendation_type}`
      });

      return send(res, 200, {
        approved: true,
        recommendation: approvedRecommendation
      });
    }


    // GET RECOMMENDATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/recommendations/trace/")) {

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

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/trace/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const recommendationResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (recommendationResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = recommendationResult.rows[0];
      const evidence = recommendation.evidence || {};
      const rule_id = evidence.rule_id || null;

      let rule = null;

      if (rule_id) {
        const ruleResult = await db.query(`
          SELECT *
          FROM runtime_recommendation_rules
          WHERE tenant_id = $1
            AND rule_id = $2
          LIMIT 1
        `, [
          tenant_id,
          rule_id
        ]);

        rule = ruleResult.rows[0] || null;
      }

      const jobsResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          requested_by,
          worker_id,
          payload,
          created_at,
          started_at,
          completed_at,
          last_error
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND (
            job_id = $2
            OR object_id = $3
            OR payload::text LIKE $4
          )
        ORDER BY created_at DESC
      `, [
        tenant_id,
        recommendation.executed_job_id,
        recommendation.object_id,
        `%${recommendation_id}%`
      ]);

      const trainingPlansResult = await db.query(`
        SELECT
          training_plan_id,
          person_id,
          competency_name,
          recommendation_id,
          training_type,
          estimated_duration_minutes,
          status,
          created_by,
          created_at,
          approved_by,
          approved_at,
          completed_by,
          completed_at
        FROM runtime_training_plans
        WHERE tenant_id = $1
          AND (
            recommendation_id = $2
            OR person_id = $3
          )
        ORDER BY created_at DESC
      `, [
        tenant_id,
        recommendation_id,
        recommendation.object_id
      ]);

      const learningEvidenceResult = await db.query(`
        SELECT
          evidence_id,
          person_id,
          competency_name,
          training_plan_id,
          gap_before,
          gap_after,
          effectiveness,
          created_by,
          created_at
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        recommendation.object_id
      ]);

      const auditResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          audit_hash,
          previous_hash,
          created_at
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
          AND (
            event_type LIKE 'runtime.recommendation.%'
            OR event_type LIKE 'runtime.recommendations.%'
            OR event_type LIKE 'runtime.training.%'
            OR event_type LIKE 'runtime.learning.%'
            OR event_type LIKE 'runtime.orchestration.%'
          )
        ORDER BY created_at ASC
      `, [
        tenant_id,
        recommendation.object_id
      ]);

      return send(res, 200, {
        tenant_id,
        recommendation_id,
        object_id: recommendation.object_id,
        recommendation,
        source_rule: rule,
        execution_jobs: {
          job_count: jobsResult.rows.length,
          items: jobsResult.rows
        },
        training_plans: {
          training_plan_count: trainingPlansResult.rows.length,
          items: trainingPlansResult.rows
        },
        learning_evidence: {
          evidence_count: learningEvidenceResult.rows.length,
          items: learningEvidenceResult.rows
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // GET RUNTIME RECOMMENDATIONS BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/recommendations/")) {

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

      const object_id = decodeURIComponent(
        path.replace("/runtime/recommendations/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          recommendation_id,
          object_id,
          recommendation_type,
          priority,
          status,
          reason,
          evidence,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_job_id,
          executed_at
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const open_count = result.rows.filter(r => r.status === "open").length;
      const approved_count = result.rows.filter(r => r.status === "approved").length;
      const executed_count = result.rows.filter(r => r.status === "executed").length;
      const rejected_count = result.rows.filter(r => r.status === "rejected").length;

      return send(res, 200, {
        object_id,
        tenant_id,
        recommendation_count: result.rows.length,
        open_count,
        approved_count,
        executed_count,
        rejected_count,
        recommendations: result.rows
      });
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

    // GET UNIFIED OBJECT TRACE

    if (req.method === "GET" && path.startsWith("/runtime/trace/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/trace/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const objectResult = await getTraceObject({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const auditResult = await getTraceAudit({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const governanceResult = await getTraceGovernance({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const executionResult = await getTraceExecution({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const relationResult = await getTraceRelations({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const recommendationResult = await getTraceRecommendations({
        db,
        tenant_id: auth.user.tenant_id,
        object_id,
        mode: "compact"
      });

      const latestRecommendation =
        recommendationResult.rows.length > 0
          ? recommendationResult.rows[0]
          : null;

      const latestGovernance =
        governanceResult.rows.length > 0
          ? governanceResult.rows[0]
          : null;

      const latestExecution =
        executionResult.rows.length > 0
          ? executionResult.rows[0]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        exists_in_runtime_objects: objectResult.rows.length > 0,
        runtime_object: objectResult.rows[0] || null,
        audit: {
          event_count: auditResult.rows[0].event_count
        },
        governance: {
          decision_count: governanceResult.rows.length,
          latest_status: latestGovernance ? latestGovernance.governance_status : null,
          latest_created_at: latestGovernance ? latestGovernance.created_at : null
        },
        execution: {
          job_count: executionResult.rows.length,
          latest_status: latestExecution ? latestExecution.status : null,
          latest_execution_type: latestExecution ? latestExecution.execution_type : null,
          latest_worker_id: latestExecution ? latestExecution.worker_id : null
        },
        graph: {
          relation_count: relationResult.rows.length,
          relations: relationResult.rows
        },
        recommendations: {
          recommendation_count: recommendationResult.rows.length,
          open_count: recommendationResult.rows.filter(r => r.status === "open").length,
          approved_count: recommendationResult.rows.filter(r => r.status === "approved").length,
          executed_count: recommendationResult.rows.filter(r => r.status === "executed").length,
          rejected_count: recommendationResult.rows.filter(r => r.status === "rejected").length,
          latest_recommendation_type: latestRecommendation ? latestRecommendation.recommendation_type : null,
          latest_status: latestRecommendation ? latestRecommendation.status : null,
          latest_recommendation_id: latestRecommendation ? latestRecommendation.recommendation_id : null,
          recommendations: recommendationResult.rows
        }
      });
    }

    // GET EXECUTION PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/execution/path/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/execution/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          job_id,
          object_id,
          action,
          status,
          requested_by,
          result_message,
          execution_type,
          payload,
          worker_id,
          retry_count,
          last_error,
          failed_at,
          scheduled_for,
          available_at,
          started_at,
          completed_at,
          created_at,
          workflow_id,
          parent_job_id,
          next_execution_type,
          chain_position
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      const executions = result.rows;

      const latestExecution =
        executions.length > 0
          ? executions[executions.length - 1]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        job_count: executions.length,
        latest_status: latestExecution ? latestExecution.status : null,
        latest_execution_type: latestExecution ? latestExecution.execution_type : null,
        latest_worker_id: latestExecution ? latestExecution.worker_id : null,
        executions
      });
    }

    // GET GOVERNANCE PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/governance/path/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/governance/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const decisionsResult = await db.query(`
        SELECT
          decision_id,
          object_id,
          governance_status,
          reason_codes,
          risk_count,
          max_risk_score,
          acute_risk_count,
          open_action_count,
          high_open_action_count,
          graph_edge_count,
          audit_event_count,
          created_at
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      const decisionIds = decisionsResult.rows.map(d => d.decision_id);

      let approvals = [];

      if (decisionIds.length > 0) {
        const approvalsResult = await db.query(`
          SELECT
            approval_id,
            decision_id,
            object_id,
            approval_status,
            reason,
            requested_by,
            decided_by,
            created_at
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND decision_id = ANY($2)
          ORDER BY created_at ASC
        `, [
          auth.user.tenant_id,
          decisionIds
        ]);

        approvals = approvalsResult.rows;
      }

      const latestDecision =
        decisionsResult.rows.length > 0
          ? decisionsResult.rows[decisionsResult.rows.length - 1]
          : null;

      const latestApproval =
        approvals.length > 0
          ? approvals[approvals.length - 1]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        decision_count: decisionsResult.rows.length,
        approval_count: approvals.length,
        latest_status: latestDecision ? latestDecision.governance_status : null,
        latest_approval_status: latestApproval ? latestApproval.approval_status : null,
        decisions: decisionsResult.rows,
        approvals
      });
    }

    // GET AUDIT PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/audit/path/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/audit/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          audit_hash,
          previous_hash,
          created_at
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        event_count: result.rows.length,
        timeline: result.rows
      });
    }



    // CREATE RELATION

    if (req.method === "POST" && path === "/runtime/relations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const source_object_id = body.source_object_id;
      const target_object_id = body.target_object_id;
      const relation_type = body.relation_type;

      if (!source_object_id || !target_object_id || !relation_type) {
        return send(res, 400, {
          error: "missing_required_relation_fields"
        });
      }

      const relation_id =
        "rel-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      await db.query(`
        INSERT INTO runtime_relations (
          relation_id,
          tenant_id,
          source_object_id,
          target_object_id,
          relation_type
        )
        VALUES ($1,$2,$3,$4,$5)
      `, [
        relation_id,
        tenant_id,
        source_object_id,
        target_object_id,
        relation_type
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_object_id,
        event_type: "runtime.relation.created",
        message: `Relation created: ${source_object_id} ${relation_type} ${target_object_id}`
      });

      return send(res, 200, {
        created: true,
        relation: {
          relation_id,
          tenant_id,
          source_object_id,
          target_object_id,
          relation_type
        }
      });
    }


    // DELETE RELATION

    if (req.method === "DELETE" && path.startsWith("/runtime/relations/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const relation_id = decodeURIComponent(
        path.replace("/runtime/relations/", "")
      );

      if (!relation_id) {
        return send(res, 400, {
          error: "missing_relation_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND relation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        relation_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "relation_not_found",
          relation_id
        });
      }

      const relation = existingResult.rows[0];

      await db.query(`
        DELETE FROM runtime_relations
        WHERE tenant_id = $1
          AND relation_id = $2
      `, [
        tenant_id,
        relation_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: relation.source_object_id,
        event_type: "runtime.relation.deleted",
        message: `Relation deleted: ${relation.source_object_id} ${relation.relation_type} ${relation.target_object_id}`
      });

      return send(res, 200, {
        deleted: true,
        relation
      });
    }

    // GET RELATIONS

    if (req.method === "GET" && path === "/runtime/relations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [auth.user.tenant_id]);

      return send(res, 200, {
        count: result.rows.length,
        relations: result.rows
      });
    }

    // GET RELATIONS BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/relations/object/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/relations/object/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = $2
            OR target_object_id = $2
          )
        ORDER BY created_at DESC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      return send(res, 200, {
        object_id,
        count: result.rows.length,
        relations: result.rows
      });
    }


    // GET RUNTIME GRAPH DEPTH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/graph/depth/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const root_object_id = decodeURIComponent(
        path.replace("/runtime/graph/depth/", "")
      );

      if (!root_object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const max_depth = Math.min(
        Math.max(Number(urlObj.searchParams.get("depth") || 3), 1),
        5
      );

      const visited = new Set();
      const frontier = new Set([root_object_id]);
      const allNodeIds = new Set([root_object_id]);
      const edgeMap = new Map();

      for (let depth = 0; depth < max_depth; depth++) {

        const current = Array.from(frontier)
          .filter(id => !visited.has(id));

        if (current.length === 0) {
          break;
        }

        for (const id of current) {
          visited.add(id);
        }

        const relationsResult = await db.query(`
          SELECT *
          FROM runtime_relations
          WHERE tenant_id = $1
            AND (
              source_object_id = ANY($2)
              OR target_object_id = ANY($2)
            )
          ORDER BY created_at DESC
        `, [
          auth.user.tenant_id,
          current
        ]);

        frontier.clear();

        for (const relation of relationsResult.rows) {
          edgeMap.set(relation.relation_id, relation);

          if (!visited.has(relation.source_object_id)) {
            frontier.add(relation.source_object_id);
          }

          if (!visited.has(relation.target_object_id)) {
            frontier.add(relation.target_object_id);
          }

          allNodeIds.add(relation.source_object_id);
          allNodeIds.add(relation.target_object_id);
        }
      }

      const nodesResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = ANY($2)
      `, [
        auth.user.tenant_id,
        Array.from(allNodeIds)
      ]);

      const objectMap = new Map();

      for (const object of nodesResult.rows) {
        objectMap.set(object.object_id, object);
      }

      const nodes = Array.from(allNodeIds).map(id => {
        const object = objectMap.get(id);

        return {
          object_id: id,
          exists_in_runtime_objects: !!object,
          runtime_type: object ? object.runtime_type : null,
          state: object ? object.state : null,
          priority: object ? object.priority : null,
          risk_score: object ? object.risk_score : null,
          tenant_id: auth.user.tenant_id
        };
      });

      const edges = Array.from(edgeMap.values()).map(relation => ({
        relation_id: relation.relation_id,
        source_object_id: relation.source_object_id,
        target_object_id: relation.target_object_id,
        relation_type: relation.relation_type,
        tenant_id: relation.tenant_id,
        created_at: relation.created_at
      }));

      return send(res, 200, {
        root_object_id,
        max_depth,
        node_count: nodes.length,
        edge_count: edges.length,
        nodes,
        edges
      });
    }


    // GET RUNTIME GRAPH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/graph/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/graph/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const relationsResult = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = $2
            OR target_object_id = $2
          )
        ORDER BY created_at DESC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      const relations = relationsResult.rows;

      const nodeIds = new Set();
      nodeIds.add(object_id);

      for (const relation of relations) {
        nodeIds.add(relation.source_object_id);
        nodeIds.add(relation.target_object_id);
      }

      const nodesResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = ANY($2)
      `, [
        auth.user.tenant_id,
        Array.from(nodeIds)
      ]);

      const objectMap = new Map();

      for (const object of nodesResult.rows) {
        objectMap.set(object.object_id, object);
      }

      const nodes = Array.from(nodeIds).map(id => {
        const object = objectMap.get(id);

        return {
          object_id: id,
          object_type: object ? object.object_type : null,
          object_name: object ? object.object_name : null,
          exists_in_runtime_objects: !!object
        };
      });

      const edges = relations.map(relation => ({
        relation_id: relation.relation_id,
        from: relation.source_object_id,
        to: relation.target_object_id,
        relation_type: relation.relation_type,
        created_at: relation.created_at
      }));

      return send(res, 200, {
        root: object_id,
        tenant_id: auth.user.tenant_id,
        node_count: nodes.length,
        edge_count: edges.length,
        nodes,
        edges
      });
    }




    // CREATE RUNTIME TENANT

    if (req.method === "POST" && path === "/runtime/tenants") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = body.tenant_id;
      const tenant_name = body.tenant_name;
      const tenant_type = body.tenant_type || "business";
      const status = body.status || "active";
      const owner_name = body.owner_name || null;
      const owner_email = body.owner_email || null;

      if (!tenant_id || !tenant_name) {
        return send(res, 400, {
          error: "missing_required_tenant_fields",
          required: [
            "tenant_id",
            "tenant_name"
          ]
        });
      }

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const existingResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_already_exists",
          tenant_id
        });
      }

      const insertResult = await db.query(`
        INSERT INTO runtime_tenants (
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [
        tenant_id,
        tenant_name,
        tenant_type,
        status,
        owner_name,
        owner_email,
        created_by
      ]);

      const tenant = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant.tenant_id,
        event_type: "runtime.tenant.created",
        message: `Tenant created: ${tenant.tenant_name}`
      });

      return send(res, 200, {
        created: true,
        tenant
      });
    }


    // CREATE RUNTIME TENANT DOMAIN

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/domains")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/domains", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const domain_name = body.domain_name;
      const domain_role = body.domain_role || "primary";
      const status = body.status || "active";

      if (!domain_name) {
        return send(res, 400, {
          error: "missing_domain_name"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const existingDomainResult = await db.query(`
        SELECT domain_id, tenant_id, domain_name
        FROM runtime_tenant_domains
        WHERE domain_name = $1
        LIMIT 1
      `, [
        domain_name
      ]);

      if (existingDomainResult.rows.length > 0) {
        return send(res, 409, {
          error: "domain_already_exists",
          domain: existingDomainResult.rows[0]
        });
      }

      const domain_id =
        "dom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_tenant_domains (
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [
        domain_id,
        tenant_id,
        domain_name,
        domain_role,
        status,
        created_by
      ]);

      const domain = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.domain.created",
        message: `Tenant domain created: ${domain.domain_name}`
      });

      return send(res, 200, {
        created: true,
        domain
      });
    }


    // UPSERT RUNTIME TENANT SETTING

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/settings", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const setting_key = body.setting_key;
      const setting_value = body.setting_value || {};

      if (!setting_key) {
        return send(res, 400, {
          error: "missing_setting_key"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const actor =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const setting_id =
        "set-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const result = await db.query(`
        INSERT INTO runtime_tenant_settings (
          setting_id,
          tenant_id,
          setting_key,
          setting_value,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant_id, setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_by = $5,
          updated_at = now()
        RETURNING *
      `, [
        setting_id,
        tenant_id,
        setting_key,
        JSON.stringify(setting_value),
        actor
      ]);

      const setting = result.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.setting.upserted",
        message: `Tenant setting upserted: ${setting.setting_key}`
      });

      return send(res, 200, {
        upserted: true,
        setting
      });
    }


    // GET RUNTIME TENANT SETTINGS

    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/settings", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const result = await db.query(`
        SELECT
          setting_id,
          tenant_id,
          setting_key,
          setting_value,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_settings
        WHERE tenant_id = $1
        ORDER BY setting_key ASC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        setting_count: result.rows.length,
        settings: result.rows
      });
    }


    // CREATE RUNTIME TENANT MEMBER

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/members", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const username = body.username;
      const display_name = body.display_name || null;
      const email = body.email || null;
      const role = body.role || "tenant_user";
      const status = body.status || "active";

      if (!username) {
        return send(res, 400, {
          error: "missing_username"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const existingResult = await db.query(`
        SELECT member_id, tenant_id, username
        FROM runtime_tenant_members
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_member_already_exists",
          member: existingResult.rows[0]
        });
      }

      const member_id =
        "mem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_tenant_members (
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [
        member_id,
        tenant_id,
        username,
        display_name,
        email,
        role,
        status,
        created_by
      ]);

      const member = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.member.created",
        message: `Tenant member created: ${member.username}`
      });

      return send(res, 200, {
        created: true,
        member
      });
    }


    // GET RUNTIME TENANT MEMBERS

    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/members", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const result = await db.query(`
        SELECT
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_members
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        member_count: result.rows.length,
        members: result.rows
      });
    }

    // GET RUNTIME TENANTS





    // RSOS-049C Training Plan Generator
    if (req.method === "POST" && path === "/runtime/training-plans/generate-from-gaps") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
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
          Math.random().toString(36).substring(2,8);

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

      return send(res, 200, {
        tenant_id,
        generated: createdPlans.length,
        training_plans: createdPlans
      });
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


    // RSOS-049F Generate Recommendations From Competency Gaps
    if (req.method === "POST" && path === "/runtime/recommendations/generate-from-gaps") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
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
            existing_recommendation_id: existingResult.rows[0].recommendation_id
          });
          continue;
        }

        const recommendation_id =
          "rec-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

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
          auth.user.operator_id || auth.user.username || "runtime_admin"
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
        event_type: "runtime.recommendations.generated_from_competency_gaps",
        tenant_id,
        message:
          "Generated " +
          inserted.length +
          " competency gap recommendations"
      });

      return send(res, 200, {
        tenant_id,
        generated: inserted.length,
        skipped_duplicates: skipped_duplicates.length,
        recommendations: inserted,
        duplicates: skipped_duplicates
      });
    }





    // RSOS-054B Knowledge API - Create
    if (req.method === "POST" && path === "/runtime/knowledge") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance",
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      const knowledge_id =
        body.knowledge_id ||
        "kn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const knowledge_type = body.knowledge_type;
      const parent_knowledge_id = body.parent_knowledge_id || null;
      const title = body.title;
      const description = body.description || null;
      const language_code = body.language_code || "de";
      const version = body.version || 1;
      const status = body.status || "active";
      const source = body.source || "manual";

      const content =
        typeof body.content === "string"
          ? body.content
          : JSON.stringify(body.content || {});

      if (!tenant_id || !knowledge_type || !title) {
        return send(res, 400, {
          error: "missing_required_knowledge_fields",
          required: [
            "tenant_id",
            "knowledge_type",
            "title"
          ]
        });
      }

      const existingResult = await db.query(`
        SELECT knowledge_id
        FROM runtime_knowledge
        WHERE knowledge_id = $1
        LIMIT 1
      `, [knowledge_id]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "knowledge_already_exists",
          knowledge_id
        });
      }

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_knowledge (
          knowledge_id,
          tenant_id,
          object_id,
          knowledge_type,
          parent_knowledge_id,
          title,
          description,
          content,
          source,
          language_code,
          version,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [
        knowledge_id,
        tenant_id,
        body.object_id || null,
        knowledge_type,
        parent_knowledge_id,
        title,
        description,
        content,
        source,
        language_code,
        version,
        status,
        created_by
      ]);

      await writeEvent({
        event_type: "runtime.knowledge.created",
        object_id: knowledge_id,
        tenant_id,
        message: "Knowledge created: " + title
      });

      return send(res, 200, {
        created: true,
        knowledge: insertResult.rows[0]
      });
    }

    // RSOS-054B Knowledge API - List
    if (req.method === "GET" && path === "/runtime/knowledge") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance",
        "auditor",
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const knowledge_type = urlObj.searchParams.get("knowledge_type");
      const parent_knowledge_id = urlObj.searchParams.get("parent_knowledge_id");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (knowledge_type) {
        params.push(knowledge_type);
        where += " AND knowledge_type = $" + params.length;
      }

      if (parent_knowledge_id) {
        params.push(parent_knowledge_id);
        where += " AND parent_knowledge_id = $" + params.length;
      }

      const result = await db.query(`
        SELECT
          knowledge_id,
          tenant_id,
          object_id,
          knowledge_type,
          parent_knowledge_id,
          title,
          description,
          content,
          source,
          language_code,
          version,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_knowledge
        ${where}
        ORDER BY created_at ASC, title ASC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-054B Knowledge API - Detail
    if (req.method === "GET" && path.startsWith("/runtime/knowledge/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance",
        "auditor",
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const knowledge_id = decodeURIComponent(
        path.replace("/runtime/knowledge/", "")
      );

      if (!knowledge_id) {
        return send(res, 400, {
          error: "missing_knowledge_id"
        });
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_knowledge
        WHERE knowledge_id = $1
        LIMIT 1
      `, [knowledge_id]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "knowledge_not_found",
          knowledge_id
        });
      }

      const knowledge = result.rows[0];

      if (auth.user.scope !== "global" && knowledge.tenant_id !== auth.user.tenant_id) {
        return send(res, 403, {
          error: "tenant_scope_violation"
        });
      }

      const childrenResult = await db.query(`
        SELECT
          knowledge_id,
          knowledge_type,
          title,
          description,
          language_code,
          status,
          created_at
        FROM runtime_knowledge
        WHERE tenant_id = $1
          AND parent_knowledge_id = $2
        ORDER BY created_at ASC, title ASC
      `, [
        knowledge.tenant_id,
        knowledge.knowledge_id
      ]);

      return send(res, 200, {
        knowledge,
        children: {
          count: childrenResult.rows.length,
          items: childrenResult.rows
        }
      });
    }

    // RSOS-051A Global Dashboard API
    if (req.method === "GET" && path === "/runtime/admin/dashboard") {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const summaryResult = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM runtime_tenants) AS tenant_count,
          (SELECT COUNT(*)::int FROM runtime_tenant_members) AS member_count,
          (SELECT COUNT(*)::int FROM runtime_operator_credentials) AS credential_count,
          (SELECT COUNT(*)::int FROM runtime_objects) AS object_count,
          (SELECT COUNT(*)::int FROM runtime_recommendations) AS recommendation_count,
          (SELECT COUNT(*)::int FROM runtime_training_plans) AS training_plan_count,
          (SELECT COUNT(*)::int FROM runtime_learning_evidence) AS learning_evidence_count,
          0 AS risk_count,
          (SELECT COUNT(*)::int FROM runtime_governance_decisions) AS governance_decision_count,
          (SELECT COUNT(*)::int FROM runtime_communication_events) AS communication_event_count,
          (SELECT COUNT(*)::int FROM runtime_events) AS audit_event_count
      `);

      const tenantHealthResult = await db.query(`
        SELECT
          t.tenant_id,
          t.tenant_name,
          t.tenant_type,
          t.status,

          COALESCE(m.members, 0)::int AS members,
          COALESCE(c.credentials, 0)::int AS credentials,
          COALESCE(o.objects, 0)::int AS objects,
          COALESCE(r.recommendations, 0)::int AS recommendations,
          COALESCE(tp.training_plans, 0)::int AS training_plans,
          COALESCE(le.learning_evidence, 0)::int AS learning_evidence,
          COALESCE(risk.risks, 0)::int AS risks

        FROM runtime_tenants t

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS members
          FROM runtime_tenant_members
          GROUP BY tenant_id
        ) m ON m.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS credentials
          FROM runtime_operator_credentials
          GROUP BY tenant_id
        ) c ON c.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS objects
          FROM runtime_objects
          GROUP BY tenant_id
        ) o ON o.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS recommendations
          FROM runtime_recommendations
          GROUP BY tenant_id
        ) r ON r.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS training_plans
          FROM runtime_training_plans
          GROUP BY tenant_id
        ) tp ON tp.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS learning_evidence
          FROM runtime_learning_evidence
          GROUP BY tenant_id
        ) le ON le.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, 0 AS risks FROM runtime_tenants
        ) risk ON risk.tenant_id = t.tenant_id

        ORDER BY t.tenant_name ASC
      `);

      const recentActivityResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          tenant_id,
          message,
          created_at
        FROM runtime_events
        ORDER BY created_at DESC
        LIMIT 50
      `);

      return send(res, 200, {
        scope: "global",
        summary: summaryResult.rows[0],
        tenant_health: tenantHealthResult.rows,
        recent_activity: recentActivityResult.rows
      });
    }

    // RSOS-050D Global Tenant Control API - Create Tenant
    if (req.method === "POST" && path === "/runtime/admin/tenants") {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const body = await readBody(req);

      const tenant_id = body.tenant_id;
      const tenant_name = body.tenant_name;
      const tenant_type = body.tenant_type || "business";
      const status = body.status || "active";
      const owner_name = body.owner_name || null;
      const owner_email = body.owner_email || null;
      const domain_name = body.domain_name || null;

      if (!tenant_id || !tenant_name) {
        return send(res, 400, {
          error: "missing_required_tenant_fields",
          required: [
            "tenant_id",
            "tenant_name"
          ]
        });
      }

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const existingResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [tenant_id]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_already_exists",
          tenant_id
        });
      }

      await db.query("BEGIN");

      try {
        const tenantResult = await db.query(`
          INSERT INTO runtime_tenants (
            tenant_id,
            tenant_name,
            tenant_type,
            status,
            owner_name,
            owner_email,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING *
        `, [
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by
        ]);

        let domain = null;

        if (domain_name) {
          const domain_id =
            "dom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

          const domainResult = await db.query(`
            INSERT INTO runtime_tenant_domains (
              domain_id,
              tenant_id,
              domain_name,
              domain_role,
              status,
              created_by
            )
            VALUES ($1,$2,$3,'primary','active',$4)
            RETURNING *
          `, [
            domain_id,
            tenant_id,
            domain_name,
            created_by
          ]);

          domain = domainResult.rows[0];
        }

        await writeEvent({
          tenant_id: auth.user.tenant_id,
          object_id: tenant_id,
          event_type: "runtime.admin.tenant.created",
          message: "Tenant created by system admin: " + tenant_name
        });

        await db.query("COMMIT");

        return send(res, 200, {
          created: true,
          tenant: tenantResult.rows[0],
          domain
        });

      } catch (err) {
        await db.query("ROLLBACK");
        throw err;
      }
    }


    // RSOS-050E Global Tenant Control API - Create Tenant Member
    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/members")) {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/admin/tenants/", "")
          .replace("/members", "")
      );

      const body = await readBody(req);

      const username = body.username;
      const display_name = body.display_name || username;
      const email = body.email || null;
      const role = body.role || "tenant_admin";
      const status = body.status || "active";

      if (!tenant_id || !username) {
        return send(res, 400, {
          error: "missing_required_member_fields",
          required: [
            "tenant_id",
            "username"
          ]
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [tenant_id]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const existingResult = await db.query(`
        SELECT member_id
        FROM runtime_tenant_members
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_member_already_exists",
          tenant_id,
          username
        });
      }

      const member_id =
        "mem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_tenant_members (
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [
        member_id,
        tenant_id,
        username,
        display_name,
        email,
        role,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.admin.tenant_member.created",
        message: "Tenant member created: " + username
      });

      return send(res, 200, {
        created: true,
        member: insertResult.rows[0]
      });
    }


    // RSOS-050F Global Tenant Control API - Create Credential
    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/credentials")) {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/admin/tenants/", "")
          .replace("/credentials", "")
      );

      const body = await readBody(req);

      const username = body.username;
      const password = body.password;
      const status = body.status || "active";
      const scope = body.scope || "tenant";
      const system_role = body.system_role || null;

      if (!tenant_id || !username || !password) {
        return send(res, 400, {
          error: "missing_required_credential_fields",
          required: [
            "tenant_id",
            "username",
            "password"
          ]
        });
      }

      const memberResult = await db.query(`
        SELECT member_id, role, status
        FROM runtime_tenant_members
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (memberResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_member_not_found",
          tenant_id,
          username
        });
      }

      const existingResult = await db.query(`
        SELECT credential_id
        FROM runtime_operator_credentials
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "credential_already_exists",
          tenant_id,
          username
        });
      }

      const credential_id =
        "cred-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_operator_credentials (
          credential_id,
          tenant_id,
          username,
          password,
          status,
          created_by,
          scope,
          system_role
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING
          credential_id,
          tenant_id,
          username,
          status,
          created_by,
          created_at,
          scope,
          system_role
      `, [
        credential_id,
        tenant_id,
        username,
        password,
        status,
        created_by,
        scope,
        system_role
      ]);

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.admin.tenant_credential.created",
        message: "Tenant credential created: " + username
      });

      return send(res, 200, {
        created: true,
        credential: insertResult.rows[0]
      });
    }

    // RSOS-050B Global Tenant Control API - Tenant List
    if (req.method === "GET" && path === "/runtime/admin/tenants") {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const result = await db.query(`
        SELECT
          t.tenant_id,
          t.tenant_name,
          t.tenant_type,
          t.status,
          t.owner_name,
          t.owner_email,
          t.created_at,

          COALESCE(d.domains, 0)::int AS domains,
          COALESCE(m.members, 0)::int AS members,
          COALESCE(c.credentials, 0)::int AS credentials,
          COALESCE(o.objects, 0)::int AS objects,
          COALESCE(r.recommendations, 0)::int AS recommendations,
          COALESCE(tp.training_plans, 0)::int AS training_plans

        FROM runtime_tenants t

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS domains
          FROM runtime_tenant_domains
          GROUP BY tenant_id
        ) d ON d.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS members
          FROM runtime_tenant_members
          GROUP BY tenant_id
        ) m ON m.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS credentials
          FROM runtime_operator_credentials
          GROUP BY tenant_id
        ) c ON c.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS objects
          FROM runtime_objects
          GROUP BY tenant_id
        ) o ON o.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS recommendations
          FROM runtime_recommendations
          GROUP BY tenant_id
        ) r ON r.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS training_plans
          FROM runtime_training_plans
          GROUP BY tenant_id
        ) tp ON tp.tenant_id = t.tenant_id

        ORDER BY t.tenant_name ASC
      `);

      return send(res, 200, {
        scope: "global",
        tenant_count: result.rows.length,
        tenants: result.rows
      });
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


    // RSOS-047 Tenant Dashboard
    if (req.method === "GET" && path === "/runtime/dashboard/tenants") {
      try {
        const result = await db.query(`
          SELECT
            t.tenant_id,
            t.tenant_name AS name,
            COALESCE(d.domains, 0)::int AS domains,
            COALESCE(m.members, 0)::int AS members,
            COALESCE(o.objects, 0)::int AS objects,
            COALESCE(rel.relations, 0)::int AS relations,
            COALESCE(r.risks, 0)::int AS risks,
            COALESCE(rec.recommendations, 0)::int AS recommendations,
            COALESCE(orch.orchestrations, 0)::int AS orchestrations,
            COALESCE(tp.training_plans, 0)::int AS training_plans,
            COALESCE(le.learning_evidence, 0)::int AS learning_evidence,
            COALESCE(gd.governance_decisions, 0)::int AS governance_decisions,
            COALESCE(ce.communication_events, 0)::int AS communication_events

          FROM runtime_tenants t

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS domains
            FROM runtime_tenant_domains
            GROUP BY tenant_id
          ) d ON d.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS members
            FROM runtime_tenant_members
            GROUP BY tenant_id
          ) m ON m.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS objects
            FROM runtime_objects
            GROUP BY tenant_id
          ) o ON o.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS relations
            FROM runtime_relations
            GROUP BY tenant_id
          ) rel ON rel.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, 0 AS risks FROM runtime_tenants
          ) r ON r.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS recommendations
            FROM runtime_recommendations
            GROUP BY tenant_id
          ) rec ON rec.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS orchestrations
            FROM runtime_orchestrations
            GROUP BY tenant_id
          ) orch ON orch.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS training_plans
            FROM runtime_training_plans
            GROUP BY tenant_id
          ) tp ON tp.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS learning_evidence
            FROM runtime_learning_evidence
            GROUP BY tenant_id
          ) le ON le.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS governance_decisions
            FROM runtime_governance_decisions
            GROUP BY tenant_id
          ) gd ON gd.tenant_id = t.tenant_id

          LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS communication_events
            FROM runtime_communication_events
            GROUP BY tenant_id
          ) ce ON ce.tenant_id = t.tenant_id

          ORDER BY t.tenant_name ASC
        `);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          generated_at: new Date().toISOString(),
          tenants: result.rows
        }));
      } catch (err) {
        console.error("RSOS-047 tenant dashboard failed", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "tenant_dashboard_failed",
          details: err.message
        }));
      }
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


    // RSOS-047B Tenant Detail Dashboard
    if (req.method === "GET" && path.startsWith("/runtime/dashboard/tenants/")) {
      try {
        const tenantId = decodeURIComponent(
          path.replace("/runtime/dashboard/tenants/", "").split("/")[0]
        );

        if (!tenantId) {
          return send(res, 400, {
            error: "tenant_id_required"
          });
        }

        const tenantResult = await db.query(`
          SELECT
            tenant_id,
            tenant_name AS name,
            tenant_type,
            status,
            owner_name,
            owner_email,
            created_by,
            created_at,
            updated_by,
            updated_at
          FROM runtime_tenants
          WHERE tenant_id = $1
        `, [tenantId]);

        if (tenantResult.rows.length === 0) {
          return send(res, 404, {
            error: "tenant_not_found",
            tenant_id: tenantId
          });
        }

        const domainsResult = await db.query(`
          SELECT
            domain_id,
            domain_name,
            domain_role,
            status,
            created_by,
            created_at
          FROM runtime_tenant_domains
          WHERE tenant_id = $1
          ORDER BY created_at ASC
        `, [tenantId]);

        const membersResult = await db.query(`
          SELECT
            member_id,
            username,
            display_name,
            email,
            role,
            status,
            created_by,
            created_at,
            updated_by,
            updated_at
          FROM runtime_tenant_members
          WHERE tenant_id = $1
          ORDER BY created_at ASC
        `, [tenantId]);

        const objectsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_objects
          WHERE tenant_id = $1
        `, [tenantId]);

        const objectsByTypeResult = await db.query(`
          SELECT
            runtime_type,
            COUNT(*)::int AS count
          FROM runtime_objects
          WHERE tenant_id = $1
          GROUP BY runtime_type
          ORDER BY count DESC, runtime_type ASC
        `, [tenantId]);

        const relationsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_relations
          WHERE tenant_id = $1
        `, [tenantId]);

        const recommendationsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_recommendations
          WHERE tenant_id = $1
        `, [tenantId]);

        const recommendationsByStatusResult = await db.query(`
          SELECT
            COALESCE(status, 'unknown') AS status,
            COUNT(*)::int AS count
          FROM runtime_recommendations
          WHERE tenant_id = $1
          GROUP BY COALESCE(status, 'unknown')
          ORDER BY count DESC, status ASC
        `, [tenantId]);

        const orchestrationsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_orchestrations
          WHERE tenant_id = $1
        `, [tenantId]);

        const orchestrationsByStatusResult = await db.query(`
          SELECT
            COALESCE(status, 'unknown') AS status,
            COUNT(*)::int AS count
          FROM runtime_orchestrations
          WHERE tenant_id = $1
          GROUP BY COALESCE(status, 'unknown')
          ORDER BY count DESC, status ASC
        `, [tenantId]);

        const trainingPlansResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_training_plans
          WHERE tenant_id = $1
        `, [tenantId]);

        const learningEvidenceResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_learning_evidence
          WHERE tenant_id = $1
        `, [tenantId]);

        const competenciesResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_competencies
          WHERE tenant_id = $1
        `, [tenantId]);

        const governanceDecisionsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_governance_decisions
          WHERE tenant_id = $1
        `, [tenantId]);

        const governanceApprovalsResult = {
          rows: [{ total: 0 }]
        };

        const communicationEventsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_communication_events
          WHERE tenant_id = $1
        `, [tenantId]);

        const communicationEvidenceResult = await db.query(`
          SELECT
            COUNT(*)::int AS total
          FROM runtime_communication_evidence
          WHERE tenant_id = $1
        `, [tenantId]);

        return send(res, 200, {
          generated_at: new Date().toISOString(),
          scope: "tenant",
          tenant_id: tenantId,
          tenant: tenantResult.rows[0],
          domains: domainsResult.rows,
          members: membersResult.rows,
          objects: {
            total: objectsResult.rows[0].total,
            by_type: objectsByTypeResult.rows
          },
          relations: {
            total: relationsResult.rows[0].total
          },
          risks: {
            total: 0,
            by_state: []
          },
          recommendations: {
            total: recommendationsResult.rows[0].total,
            by_status: recommendationsByStatusResult.rows
          },
          orchestrations: {
            total: orchestrationsResult.rows[0].total,
            by_status: orchestrationsByStatusResult.rows
          },
          learning: {
            training_plans: trainingPlansResult.rows[0].total,
            learning_evidence: learningEvidenceResult.rows[0].total,
            competencies: competenciesResult.rows[0].total
          },
          governance: {
            decisions: governanceDecisionsResult.rows[0].total,
            approvals: governanceApprovalsResult.rows[0].total
          },
          communication: {
            events: communicationEventsResult.rows[0].total,
            evidence: communicationEvidenceResult.rows[0].total
          }
        });
      } catch (err) {
        console.error("RSOS-047B tenant detail dashboard failed", err);
        return send(res, 500, {
          error: "tenant_detail_dashboard_failed",
          details: err.message
        });
      }
    }

    if (req.method === "GET" && path === "/runtime/tenants") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenantsResult = await db.query(`
        SELECT
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenants
        ORDER BY created_at DESC
      `);

      const domainsResult = await db.query(`
        SELECT
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by,
          created_at
        FROM runtime_tenant_domains
        ORDER BY created_at DESC
      `);

      return send(res, 200, {
        tenant_count: tenantsResult.rows.length,
        tenants: tenantsResult.rows,
        domain_count: domainsResult.rows.length,
        domains: domainsResult.rows
      });
    }


    // GET RUNTIME TENANT BY ID


    // RSOS-050C Global Tenant Control API - Tenant Detail
    if (req.method === "GET" && path.startsWith("/runtime/admin/tenants/")) {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const tenant_id = decodeURIComponent(
        path.replace("/runtime/admin/tenants/", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const tenantResult = await db.query(`
        SELECT
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [tenant_id]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const domainsResult = await db.query(`
        SELECT
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by,
          created_at
        FROM runtime_tenant_domains
        WHERE tenant_id = $1
        ORDER BY domain_name ASC
      `, [tenant_id]);

      const membersResult = await db.query(`
        SELECT
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_members
        WHERE tenant_id = $1
        ORDER BY username ASC
      `, [tenant_id]);

      const credentialsResult = await db.query(`
        SELECT
          credential_id,
          tenant_id,
          username,
          status,
          scope,
          system_role,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_operator_credentials
        WHERE tenant_id = $1
        ORDER BY username ASC
      `, [tenant_id]);

      const statisticsResult = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM runtime_objects WHERE tenant_id = $1) AS objects,
          (SELECT COUNT(*)::int FROM runtime_relations WHERE tenant_id = $1) AS relations,
          0 AS risks,
          (SELECT COUNT(*)::int FROM runtime_recommendations WHERE tenant_id = $1) AS recommendations,
          (SELECT COUNT(*)::int FROM runtime_training_plans WHERE tenant_id = $1) AS training_plans,
          (SELECT COUNT(*)::int FROM runtime_learning_evidence WHERE tenant_id = $1) AS learning_evidence,
          (SELECT COUNT(*)::int FROM runtime_governance_decisions WHERE tenant_id = $1) AS governance_decisions,
          (SELECT COUNT(*)::int FROM runtime_communication_events WHERE tenant_id = $1) AS communication_events
      `, [tenant_id]);

      const learningResult = await db.query(`
        SELECT
          COUNT(*)::int AS competencies,
          COUNT(*) FILTER (WHERE gap > 0)::int AS open_gaps,
          COUNT(*) FILTER (WHERE gap >= 3)::int AS critical_gaps,
          COALESCE(SUM(gap), 0)::int AS total_gap
        FROM runtime_competencies
        WHERE tenant_id = $1
      `, [tenant_id]);

      const evidenceResult = await db.query(`
        SELECT
          COUNT(*)::int AS evidence_count,
          COALESCE(SUM(gap_before - gap_after), 0)::int AS total_gap_reduction,
          COUNT(*) FILTER (WHERE effectiveness = 'positive')::int AS positive_count
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
      `, [tenant_id]);

      const evidence = evidenceResult.rows[0];

      const effectiveness_score =
        evidence.evidence_count > 0
          ? Math.round((evidence.positive_count / evidence.evidence_count) * 100)
          : 0;

      return send(res, 200, {
        tenant: tenantResult.rows[0],
        domains: {
          count: domainsResult.rows.length,
          items: domainsResult.rows
        },
        members: {
          count: membersResult.rows.length,
          items: membersResult.rows
        },
        credentials: {
          count: credentialsResult.rows.length,
          items: credentialsResult.rows
        },
        statistics: statisticsResult.rows[0],
        learning: {
          ...learningResult.rows[0],
          evidence_count: evidence.evidence_count,
          total_gap_reduction: evidence.total_gap_reduction,
          effectiveness_score
        }
      });
    }

    if (req.method === "GET" && path.startsWith("/runtime/tenants/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path.replace("/runtime/tenants/", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const tenantResult = await db.query(`
        SELECT
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const domainsResult = await db.query(`
        SELECT
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by,
          created_at
        FROM runtime_tenant_domains
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      const settingsResult = await db.query(`
        SELECT
          setting_id,
          tenant_id,
          setting_key,
          setting_value,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_settings
        WHERE tenant_id = $1
        ORDER BY setting_key ASC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant: tenantResult.rows[0],
        domains: {
          count: domainsResult.rows.length,
          items: domainsResult.rows
        },
        settings: {
          count: settingsResult.rows.length,
          items: settingsResult.rows
        }
      });
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


    // RSOS-047C Global Management Dashboard
    if (req.method === "GET" && path === "/runtime/dashboard/management") {
      try {
        const result = await db.query(`
          SELECT
            (SELECT COUNT(*)::int FROM runtime_tenants) AS tenant_count,
            (SELECT COUNT(*)::int FROM runtime_tenant_members) AS member_count,
            (SELECT COUNT(*)::int FROM runtime_tenant_domains) AS domain_count,
            (SELECT COUNT(*)::int FROM runtime_objects) AS object_count,
            (SELECT COUNT(*)::int FROM runtime_relations) AS relation_count,
            (SELECT COUNT(*)::int FROM runtime_recommendations) AS recommendation_count,
            (SELECT COUNT(*)::int FROM runtime_orchestrations) AS orchestration_count,
            (SELECT COUNT(*)::int FROM runtime_training_plans) AS training_plan_count,
            (SELECT COUNT(*)::int FROM runtime_learning_evidence) AS learning_evidence_count,
            (SELECT COUNT(*)::int FROM runtime_competencies) AS competency_count,
            (SELECT COUNT(*)::int FROM runtime_governance_decisions) AS governance_decision_count,
            (SELECT COUNT(*)::int FROM runtime_communication_events) AS communication_event_count,
            (SELECT COUNT(*)::int FROM runtime_events) AS audit_event_count
        `);

        return send(res, 200, {
          generated_at: new Date().toISOString(),
          scope: "global_management",
          dashboard: result.rows[0]
        });
      } catch (err) {
        console.error("RSOS-047C management dashboard failed", err);
        return send(res, 500, {
          error: "management_dashboard_failed",
          details: err.message
        });
      }
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


    if (req.method === "GET" && path === "/runtime/dashboard") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }


      const objectsResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
      `, [auth.user.tenant_id]);

      const eventsResult = await db.query(`
        SELECT *
        FROM runtime_events
        WHERE tenant_id = $1
      `, [auth.user.tenant_id]);

      const objects = objectsResult.rows;
      const events = eventsResult.rows;

      const activeObjects = objects.filter(
        o => o.state !== "completed"
      );

      const highRiskObjects = objects.filter(
        o => o.risk_score >= 70
      );

      return send(res, 200, {
        dashboard: {
          summary: {
            total_objects: objects.length,
            active_objects: activeObjects.length,
            high_risk_objects: highRiskObjects.length,
            total_events: events.length
          },
          objects
        }
      });
    }

    // GOVERNANCE EVALUATE

    if (req.method === "GET" && path === "/governance/evaluate") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }


      const result = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [auth.user.tenant_id]);

      const object = result.rows[0];

      if (!object) {

        return send(res, 200, {
          decision: "no_object"
        });
      }

      const allowed =
        object.risk_score < 70;

      return send(res, 200, {
        decision: allowed
          ? "allowed"
          : "blocked",

        governance_state: allowed
          ? "baseline_clear"
          : "operator_approval_required",

        risk_score: object.risk_score,
        evaluated_object: object.object_id
      });
    }



    // RUNTIME SCHEDULE API V1

    if (req.method === "POST" && path === "/runtime/schedule") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);

      const object_id = body.object_id;
      const execution_type = body.execution_type || "diagnostic.run";
      const payload = body.payload || {};
      const priority = body.priority || 100;
      const delay_seconds = body.delay_seconds || 0;

      const scheduled_for = new Date(
        Date.now() + delay_seconds * 1000
      ).toISOString();

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const latestGovernanceResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        object_id
      ]);

      const latestGovernanceDecision =
        latestGovernanceResult.rows[0] || null;

      if (!latestGovernanceDecision) {
        await writeEvent({
          event_type: "runtime.governance.gate.review_required",
          object_id,
          message: "Schedule gate requires governance check before scheduling",
          tenant_id
        });

        return send(res, 403, {
          error: "governance_decision_required",
          gate_status: "review_required",
          object_id,
          tenant_id
        });
      }

      if (latestGovernanceDecision.governance_status === "blocked") {
        await writeEvent({
          event_type: "runtime.governance.gate.blocked",
          object_id,
          message: "Scheduling blocked by governance gate",
          tenant_id
        });

        return send(res, 403, {
          error: "schedule_blocked_by_governance",
          gate_status: "blocked",
          governance_status: latestGovernanceDecision.governance_status,
          decision_id: latestGovernanceDecision.decision_id,
          object_id,
          tenant_id
        });
      }

      if (latestGovernanceDecision.governance_status === "review_required") {
        const approvalResult = await db.query(`
          SELECT *
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND decision_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [
          tenant_id,
          latestGovernanceDecision.decision_id
        ]);

        const approval = approvalResult.rows[0] || null;

        if (!approval) {
          await writeEvent({
            event_type: "runtime.governance.gate.review_required",
            object_id,
            message: "Scheduling requires review before governance gate allows scheduling",
            tenant_id
          });

          return send(res, 403, {
            error: "schedule_requires_governance_review",
            gate_status: "review_required",
            governance_status: latestGovernanceDecision.governance_status,
            decision_id: latestGovernanceDecision.decision_id,
            object_id,
            tenant_id
          });
        }

        if (approval.approval_status === "rejected") {
          await writeEvent({
            event_type: "runtime.governance.gate.blocked",
            object_id,
            message: "Scheduling rejected by governance approval",
            tenant_id
          });

          return send(res, 403, {
            error: "schedule_rejected_by_governance_approval",
            gate_status: "blocked",
            governance_status: latestGovernanceDecision.governance_status,
            approval_status: approval.approval_status,
            decision_id: latestGovernanceDecision.decision_id,
            approval_id: approval.approval_id,
            object_id,
            tenant_id
          });
        }

        if (approval.approval_status === "approved") {
          await writeEvent({
            event_type: "runtime.governance.gate.allowed",
            object_id,
            message: "Scheduling allowed by governance approval",
            tenant_id
          });
        }
      }

      await writeEvent({
        event_type: "runtime.governance.gate.allowed",
        object_id,
        message: "Scheduling allowed by governance gate",
        tenant_id
      });

      const job_id = `job-${Date.now()}`;

      const result = await db.query(`
        INSERT INTO runtime_execution_jobs (
          job_id,
          tenant_id,
          object_id,
          execution_type,
          status,
          requested_by,
          payload,
          scheduled_for,
          available_at,
          priority
        )
        VALUES (
          $1, $2, $3, $4, 'pending', $5, $6, $7, $7, $8
        )
        RETURNING
          job_id,
          object_id,
          execution_type,
          status,
          scheduled_for,
          priority
      `, [
        job_id,
        tenant_id,
        object_id,
        execution_type,
        auth.user.username || "runtime_admin",
        JSON.stringify(payload),
        scheduled_for,
        priority
      ]);

      await writeEvent({
        event_type: "runtime.job.scheduled",
        object_id,
        message: `Runtime job scheduled for ${scheduled_for}`,
        tenant_id
      });

      return send(res, 200, {
        scheduled: true,
        job: result.rows[0]
      });
    }


async function updateWorkflowState(
  workflowId,
  tenant_id,
  object_id
) {
  const statsResult = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status = 'completed'
      )::int AS completed,
      COUNT(*) FILTER (
        WHERE status = 'failed_permanent'
      )::int AS failed,
      COUNT(*) FILTER (
        WHERE action = 'compensation.run'
          AND status = 'completed'
      )::int AS compensated,
      COUNT(*) FILTER (
        WHERE status IN (
          'pending',
          'running',
          'failed'
        )
      )::int AS active
    FROM runtime_execution_jobs
    WHERE workflow_id = $1
  `, [workflowId]);

  const stats = statsResult.rows[0];

  let workflowStatus = 'running';

  if (
    Number(stats.failed) > 0 &&
    Number(stats.compensated) > 0
  ) {
    workflowStatus = 'compensated';
  } else if (
    Number(stats.failed) > 0 &&
    Number(stats.completed) > 0
  ) {
    workflowStatus = 'partial_failed';
  } else if (
    Number(stats.failed) > 0
  ) {
    workflowStatus = 'failed';
  } else if (
    Number(stats.active) === 0
  ) {
    workflowStatus = 'completed';
  }

  await db.query(`
    INSERT INTO runtime_workflow_instances (
      workflow_id,
      tenant_id,
      object_id,
      status,
      job_count,
      completed_count,
      failed_count,
      compensated_count,
      updated_at,
      completed_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      NOW(),
      CASE
        WHEN $4 IN (
          'completed',
          'failed',
          'compensated',
          'partial_failed'
        )
        THEN NOW()
        ELSE NULL
      END
    )
    ON CONFLICT (workflow_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      job_count = EXCLUDED.job_count,
      completed_count = EXCLUDED.completed_count,
      failed_count = EXCLUDED.failed_count,
      compensated_count = EXCLUDED.compensated_count,
      updated_at = NOW(),
      completed_at = EXCLUDED.completed_at
  `, [
    workflowId,
    tenant_id,
    object_id,
    workflowStatus,
    Number(stats.total),
    Number(stats.completed),
    Number(stats.failed),
    Number(stats.compensated)
  ]);

  return workflowStatus;
}


    // RUNTIME WORKER V4 - LEASE LOCKING

    if (req.method === "POST" && path === "/runtime/worker/run") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const worker_id = `worker-${Date.now()}`;

      await db.query("BEGIN");

      const nextJobResult = await db.query(`
        SELECT *
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND (
            status = 'pending'
            OR (
              status = 'failed'
              AND COALESCE(retry_count, 0) < 3
            )
            OR (
              status = 'running'
              AND lock_expires_at IS NOT NULL
              AND lock_expires_at < NOW()
            )
          )
          AND COALESCE(scheduled_for, available_at, NOW()) <= NOW()
        ORDER BY
          priority ASC,
          COALESCE(scheduled_for, created_at) ASC,
          created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `, [tenant_id]);

      if (nextJobResult.rows.length === 0) {

        await db.query("COMMIT");

        return send(res, 200, {
          worker: "idle",
          pending_jobs: 0
        });
      }

      const job = nextJobResult.rows[0];

      await db.query(`
        UPDATE runtime_execution_jobs
        SET
          status = 'running',
          started_at = COALESCE(started_at, NOW()),
          locked_at = NOW(),
          lock_expires_at = NOW() + interval '60 seconds',
          worker_id = $2,
          last_error = NULL
        WHERE job_id = $1
      `, [
        job.job_id,
        worker_id
      ]);

      await db.query("COMMIT");

      try {

        if (job.execution_type === "diagnostic.fail") {
          throw new Error("Simulated diagnostic failure");
        }

        if (
          job.execution_type ===
          "orchestration.LEARNING_RESPONSE.refresh_recommendations"
        ) {
          await writeEvent({
            event_type: "runtime.recommendations.refresh.started",
            object_id: job.object_id,
            message: "Recommendation refresh started by orchestration worker",
            tenant_id
          });

          const refreshResult = await generateRecommendationsForObject({
            tenant_id,
            object_id: job.object_id,
            requested_by: "orchestration-worker"
          });

          const refreshPayload = job.payload || {};
          const orchestrationId = refreshPayload.orchestration_id || null;

          let completedOrchestration = null;

          if (orchestrationId) {
            const orchestrationCompleteResult = await db.query(`
              UPDATE runtime_orchestrations
              SET
                status = 'completed',
                completed_by = $1,
                completed_at = now()
              WHERE tenant_id = $2
                AND orchestration_id = $3
                AND status = 'executed'
              RETURNING *
            `, [
              worker_id,
              tenant_id,
              orchestrationId
            ]);

            if (orchestrationCompleteResult.rows.length > 0) {
              completedOrchestration = orchestrationCompleteResult.rows[0];

              await writeEvent({
                event_type: "runtime.orchestration.completed",
                object_id: completedOrchestration.source_object_id,
                message:
                  `Orchestration automatically completed by worker: ${completedOrchestration.orchestration_type}`,
                tenant_id
              });
            }
          }

          await writeEvent({
            event_type: "runtime.recommendations.refresh.completed",
            object_id: job.object_id,
            message:
              `Recommendation refresh completed: generated=${refreshResult.generated_count}, skipped=${refreshResult.skipped_duplicate_count}`,
            tenant_id
          });
        }

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = 'completed',
            completed_at = NOW(),
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $2
        `, [
          job.job_id,
          worker_id
        ]);

        // WORKFLOW DAG V1
        const dagPayload = job.payload || {};
        const dag = dagPayload.dag || {};
        const edges = Array.isArray(dag.edges) ? dag.edges : [];

        let nextTypes = [];

        if (job.next_execution_type) {
          nextTypes.push(job.next_execution_type);
        }

        for (const edge of edges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "success"
          ) {

            if (Array.isArray(edge.to)) {
              nextTypes.push(...edge.to);
            } else if (edge.to) {
              nextTypes.push(edge.to);
            }
          }
        }

        nextTypes = [...new Set(nextTypes)];

        for (const nextType of nextTypes) {

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          // DAG V2 dependency resolution

          const dependencyRows = await db.query(`
            SELECT from_execution_type
            FROM runtime_workflow_dependencies
            WHERE workflow_id = $1
              AND to_execution_type = $2
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          const requiredParents = dependencyRows.rows.map(
            r => r.from_execution_type
          );

          const completedRows = await db.query(`
            SELECT DISTINCT execution_type
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND status = 'completed'
          `, [
            job.workflow_id || job.job_id
          ]);

          const completedTypes = completedRows.rows.map(
            r => r.execution_type
          );

          const allSatisfied = requiredParents.every(
            p => completedTypes.includes(p)
          );

          if (!allSatisfied) {

            await writeEvent({
              event_type: "runtime.workflow.waiting_dependencies",
              object_id: job.object_id,
              message: `Waiting dependencies for ${nextType}`,
              tenant_id
            });

            continue;
          }

          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND action = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-dag-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            dagPayload,
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.dag_job_created",
            object_id: job.object_id,
            message: `DAG job created: ${nextJobId} -> ${nextType}`,
            tenant_id
          });
        }

        await writeEvent({
          event_type: "runtime.execution.completed",
          object_id: job.object_id,
          message: `Execution completed by ${worker_id}`,
          tenant_id
        });

        // WORKFLOW TERMINAL STATE ENGINE V1

        const workflowId =
          job.workflow_id || job.job_id;

        const statsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE status = 'completed'
            )::int AS completed,
            COUNT(*) FILTER (
              WHERE status = 'failed_permanent'
            )::int AS failed,
            COUNT(*) FILTER (
              WHERE action = 'compensation.run'
                AND status = 'completed'
            )::int AS compensated,
            COUNT(*) FILTER (
              WHERE status IN (
                'pending',
                'running',
                'failed'
              )
            )::int AS active
          FROM runtime_execution_jobs
          WHERE workflow_id = $1
        `, [workflowId]);

        const stats = statsResult.rows[0];

        let workflowStatus = 'running';

        if (
          Number(stats.failed) > 0 &&
          Number(stats.compensated) > 0
        ) {
          workflowStatus = 'compensated';

        } else if (
          Number(stats.failed) > 0 &&
          Number(stats.completed) > 0
        ) {
          workflowStatus = 'partial_failed';

        } else if (
          Number(stats.failed) > 0
        ) {
          workflowStatus = 'failed';

        } else if (
          Number(stats.active) === 0
        ) {
          workflowStatus = 'completed';
        }

        await db.query(`
          INSERT INTO runtime_workflow_instances (
            workflow_id,
            tenant_id,
            object_id,
            status,
            job_count,
            completed_count,
            failed_count,
            compensated_count,
            updated_at,
            completed_at
          )
          VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,
            NOW(),
            CASE
              WHEN $4 IN (
                'completed',
                'failed',
                'compensated',
                'partial_failed'
              )
              THEN NOW()
              ELSE NULL
            END
          )
          ON CONFLICT (workflow_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            job_count = EXCLUDED.job_count,
            completed_count = EXCLUDED.completed_count,
            failed_count = EXCLUDED.failed_count,
            compensated_count =
              EXCLUDED.compensated_count,
            updated_at = NOW(),
            completed_at = EXCLUDED.completed_at
        `, [
          workflowId,
          tenant_id,
          job.object_id,
          workflowStatus,
          Number(stats.total),
          Number(stats.completed),
          Number(stats.failed),
          Number(stats.compensated)
        ]);

        await writeEvent({
          event_type: "runtime.workflow.state_updated",
          object_id: job.object_id,
          message:
            `Workflow state updated: ${workflowStatus}`,
          tenant_id
        });

        return send(res, 200, {
          worker: "completed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          workflow_status: workflowStatus
        });

      } catch (workerErr) {

        const retryCount = Number(job.retry_count || 0) + 1;
        const finalStatus = retryCount >= 3
          ? "failed_permanent"
          : "failed";

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = $2,
            retry_count = $3,
            failed_at = NOW(),
            last_error = $4,
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $5
        `, [
          job.job_id,
          finalStatus,
          retryCount,
          workerErr.message,
          worker_id
        ]);

        await writeEvent({
          event_type: "runtime.execution.failed",
          object_id: job.object_id,
          message: `Execution failed by ${worker_id}: ${workerErr.message}`,
          tenant_id
        });

        // DAG FAILURE ROUTING V1
        const failureDagPayload = job.payload || {};
        const failureDag = failureDagPayload.dag || {};
        const failureEdges = Array.isArray(failureDag.edges) ? failureDag.edges : [];

        let failureTargets = [];

        for (const edge of failureEdges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "failed"
          ) {
            if (Array.isArray(edge.to)) {
              failureTargets.push(...edge.to);
            } else if (edge.to) {
              failureTargets.push(edge.to);
            }
          }
        }

        failureTargets = [...new Set(failureTargets)];

        for (const nextType of failureTargets) {
          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND action = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            JSON.stringify(job.payload || {}),
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.failure_routing",
            object_id: job.object_id,
            message: `Failure route created: ${nextType}`,
            tenant_id
          });
        }

        await updateWorkflowState(
          job.workflow_id || job.job_id,
          tenant_id,
          job.object_id
        );

        return send(res, 500, {
          worker: "failed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          retry_count: retryCount,
          final_status: finalStatus,
          error: workerErr.message
        });
      }
    }

    // RUNTIME METRICS

    if (req.method === "GET" && path === "/runtime/metrics") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          status,
          COUNT(*)::int AS count
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
        GROUP BY status
        ORDER BY status ASC
      `, [tenant_id]);

      const failedResult = await db.query(`
        SELECT
          COUNT(*)::int AS failed_permanent_count
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND status = 'failed_permanent'
      `, [tenant_id]);

      const recentResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          retry_count,
          last_error,
          created_at,
          started_at,
          completed_at,
          failed_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [tenant_id]);

      return send(res, 200, {
        metrics: {
          jobs_by_status: result.rows,
          failed_permanent_count:
            failedResult.rows[0].failed_permanent_count,
          recent_jobs: recentResult.rows
        }
      });
    }

    // RUNTIME DEAD LETTER QUEUE

    if (req.method === "GET" && path === "/runtime/dead-letter") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          retry_count,
          last_error,
          failed_at,
          created_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND status = 'failed_permanent'
        ORDER BY failed_at DESC NULLS LAST, created_at DESC
      `, [tenant_id]);

      return send(res, 200, {
        dead_letter: {
          count: result.rows.length,
          jobs: result.rows
        }
      });
    }

    if (req.method === "POST" && path === "/runtime/dead-letter/requeue") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);
      const job_id = body.job_id;

      if (!job_id) {
        return send(res, 400, {
          error: "missing_job_id"
        });
      }

      const result = await db.query(`
        UPDATE runtime_execution_jobs
        SET
          status = 'pending',
          retry_count = 0,
          last_error = NULL,
          failed_at = NULL
        WHERE job_id = $1
          AND tenant_id = $2
          AND status = 'failed_permanent'
        RETURNING
          job_id,
          object_id,
          execution_type,
          status,
          retry_count
      `, [
        job_id,
        tenant_id
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "dead_letter_job_not_found",
          job_id
        });
      }

      const job = result.rows[0];

      await writeEvent({
        event_type: "runtime.dead_letter.requeued",
        object_id: job.object_id,
        message: `Dead letter job requeued: ${job.job_id}`,
        tenant_id
      });

      return send(res, 200, {
        requeued: true,
        job
      });
    }

    // RUNTIME WORKFLOW STATE V1

    if (req.method === "GET" && path.startsWith("/runtime/workflows/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const workflow_id = path.split("/").pop();

      const jobsResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          parent_job_id,
          workflow_id,
          chain_position,
          status,
          retry_count,
          last_error,
          created_at,
          started_at,
          completed_at,
          failed_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND workflow_id = $2
        ORDER BY chain_position ASC, created_at ASC
      `, [
        tenant_id,
        workflow_id
      ]);

      const jobs = jobsResult.rows;

      const counts = jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});

      let workflow_status = "unknown";

      if (jobs.length === 0) {
        workflow_status = "not_found";
      } else if ((counts.failed_permanent || 0) > 0) {
        workflow_status = "failed";
      } else if ((counts.running || 0) > 0) {
        workflow_status = "running";
      } else if ((counts.pending || 0) > 0 || (counts.failed || 0) > 0) {
        workflow_status = "blocked_or_pending";
      } else if (jobs.every(j => j.status === "completed")) {
        workflow_status = "completed";
      } else {
        workflow_status = "mixed";
      }

      return send(res, 200, {
        workflow: {
          workflow_id,
          status: workflow_status,
          counts,
          job_count: jobs.length,
          jobs
        }
      });
    }



    // RSOS-066B RUNTIME DEFENSE LAYER

    if (req.method === "POST" && path === "/runtime/defense/ingress") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;

      const payload = body.payload || {};
      const payload_hash = require("crypto")
        .createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");

      const result = await db.query(`
        INSERT INTO runtime_ingress_events (
          tenant_id,
          source_type,
          source_id,
          actor_id,
          actor_type,
          request_id,
          correlation_id,
          idempotency_key,
          ingress_channel,
          ingress_intent,
          target_object_id,
          target_object_type,
          target_action,
          payload,
          payload_hash,
          defense_status,
          defense_decision,
          risk_score,
          confidence_score
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          'classified',
          'shadow_validate',
          $16,
          $17
        )
        RETURNING *
      `, [
        tenant_id,
        body.source_type || "manual",
        body.source_id || null,
        auth.user.username || body.actor_id || null,
        body.actor_type || "user",
        body.request_id || null,
        body.correlation_id || null,
        body.idempotency_key || null,
        body.ingress_channel || "api",
        body.ingress_intent || "runtime_change",
        body.target_object_id || null,
        body.target_object_type || null,
        body.target_action || "unknown",
        JSON.stringify(payload),
        payload_hash,
        body.risk_score || 10,
        body.confidence_score || 70
      ]);

      const ingress = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.ingress.received",
        object_id: ingress.target_object_id,
        message: `Defense ingress received: ${ingress.ingress_id}`,
        tenant_id
      });

      await writeEvent({
        event_type: "runtime.defense.ingress.classified",
        object_id: ingress.target_object_id,
        message: `Defense ingress classified: ${ingress.defense_decision}`,
        tenant_id
      });

      const defense_pipeline = await executeDefensePipeline(ingress.ingress_id);

      const ingressRefresh = await db.query(`
        SELECT *
        FROM runtime_ingress_events
        WHERE ingress_id = $1
        LIMIT 1
      `, [
        ingress.ingress_id
      ]);

      const ingress_current = ingressRefresh.rows[0];

      // RSOS-070A ingress to observation/evidence bridge
      let signal_bridge = null;

      if (ingress_current && ingress_current.defense_decision === "allow") {
        const observationResult = await db.query(`
          INSERT INTO runtime_observations (
            observation_id,
            tenant_id,
            observation_text,
            observation_time,
            confidence,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            now(),
            $3,
            $4
          )
          RETURNING *
        `, [
          tenant_id,
          "Ingress signal observed: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          auth.user.username || "system"
        ]);

        const evidenceHash = require("crypto")
          .createHash("sha256")
          .update(JSON.stringify({
            ingress_id: ingress_current.ingress_id,
            payload_hash: ingress_current.payload_hash,
            defense_decision: ingress_current.defense_decision
          }))
          .digest("hex");

        const evidenceResult = await db.query(`
          INSERT INTO runtime_evidence (
            evidence_id,
            tenant_id,
            object_id,
            event_id,
            evidence_type,
            title,
            evidence_text,
            evidence_hash,
            confidence,
            evidence_status,
            observed_at,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            now(),
            $10
          )
          RETURNING *
        `, [
          tenant_id,
          ingress_current.target_object_id,
          ingress_current.ingress_id,
          "ingress_signal",
          "Evidence from ingress signal",
          "Evidence generated from allowed ingress signal " + ingress_current.ingress_id,
          evidenceHash,
          ingress_current.confidence_score || 70,
          "captured",
          auth.user.username || "system"
        ]);

        await db.query(`
          UPDATE runtime_observations
          SET evidence_id = $1
          WHERE observation_id = $2
            AND tenant_id = $3
        `, [
          evidenceResult.rows[0].evidence_id,
          observationResult.rows[0].observation_id,
          tenant_id
        ]);

        await writeEvent({
          event_type: "runtime.signal.bridge.created",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "INGRESS_TO_OBSERVATION_EVIDENCE",
            ingress_id: ingress_current.ingress_id,
            observation_id: observationResult.rows[0].observation_id,
            evidence_id: evidenceResult.rows[0].evidence_id
          })
        });

        const assumptionResult = await db.query(`
          INSERT INTO runtime_assumptions (
            assumption_id,
            tenant_id,
            evidence_id,
            assumption_text,
            confidence,
            status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          evidenceResult.rows[0].evidence_id,
          "Allowed ingress signal may represent a valid runtime observation requiring verification: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          "open",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.assumption.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "EVIDENCE_TO_ASSUMPTION_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            evidence_id: evidenceResult.rows[0].evidence_id,
            assumption_id: assumptionResult.rows[0].assumption_id
          })
        });

        const hypothesisResult = await db.query(`
          INSERT INTO runtime_hypotheses (
            hypothesis_id,
            tenant_id,
            assumption_id,
            hypothesis_text,
            confidence,
            verification_status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          assumptionResult.rows[0].assumption_id,
          "If the allowed ingress signal is valid, then it should be verifiable as a runtime event: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          "pending",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.hypothesis.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "ASSUMPTION_TO_HYPOTHESIS_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            assumption_id: assumptionResult.rows[0].assumption_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id
          })
        });

        const verificationObjectResult = await db.query(`
          INSERT INTO runtime_verifications (
            verification_id,
            tenant_id,
            hypothesis_id,
            verification_method,
            verification_notes,
            status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          hypothesisResult.rows[0].hypothesis_id,
          "signal_validation",
          "Verification object generated from ingress signal " + ingress_current.ingress_id,
          "pending",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.verification.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "HYPOTHESIS_TO_VERIFICATION_OBJECT_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id,
            verification_id: verificationObjectResult.rows[0].verification_id
          })
        });

        const verificationCycleResult = await db.query(`
          INSERT INTO runtime_verification_cycles (
            verification_id,
            tenant_id,
            hypothesis_id,
            assumption_id,
            verification_type,
            verification_status,
            expected_value,
            confidence_before,
            created_by
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING *
        `, [
          verificationObjectResult.rows[0].verification_id,
          tenant_id,
          hypothesisResult.rows[0].hypothesis_id,
          assumptionResult.rows[0].assumption_id,
          "signal_validation",
          "pending",
          "Ingress signal should remain traceable and verifiable: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.verification_cycle.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "HYPOTHESIS_TO_VERIFICATION_CYCLE_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id,
            verification_id: verificationCycleResult.rows[0].verification_id
          })
        });

        signal_bridge = {
          observation: observationResult.rows[0],
          evidence: evidenceResult.rows[0],
          assumption: assumptionResult.rows[0],
          hypothesis: hypothesisResult.rows[0],
          verification: verificationObjectResult.rows[0],
          verification_cycle: verificationCycleResult.rows[0]
        };
      }

      return send(res, 201, {
        ingress: ingress_current,
        defense_pipeline,
        signal_bridge
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/ingress") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_ingress_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [tenant_id]);

      return send(res, 200, {
        ingress_events: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/defense/shadow-validations") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;

      const result = await db.query(`
        INSERT INTO runtime_shadow_validations (
          tenant_id,
          ingress_id,
          object_id,
          runtime_type,
          proposed_action,
          current_state,
          proposed_state,
          validation_scope,
          validation_engine,
          validation_status,
          validation_decision,
          risk_score,
          confidence_score,
          findings,
          required_actions,
          completed_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          'passed_with_warnings',
          'requires_human_review',
          $10,$11,$12,$13,now()
        )
        RETURNING *
      `, [
        tenant_id,
        body.ingress_id,
        body.object_id || null,
        body.object_type || null,
        body.proposed_action || "unknown",
        JSON.stringify(body.current_state || {}),
        JSON.stringify(body.proposed_state || {}),
        body.validation_scope || "runtime_write",
        body.validation_engine || "rsos-defense-shadow-v1",
        body.risk_score || 20,
        body.confidence_score || 75,
        JSON.stringify(body.findings || []),
        JSON.stringify(body.required_actions || [])
      ]);

      const validation = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.shadow_validation.completed",
        object_id: validation.object_id,
        message: `Shadow validation completed: ${validation.shadow_validation_id}`,
        tenant_id
      });

      return send(res, 201, {
        shadow_validation: validation
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/shadow-validations") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_shadow_validations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [tenant_id]);

      return send(res, 200, {
        shadow_validations: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/defense/quarantine") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;

      const result = await db.query(`
        INSERT INTO runtime_quarantine_queue (
          tenant_id,
          ingress_id,
          quarantine_reason,
          severity,
          category,
          object_id,
          runtime_type,
          proposed_action,
          proposed_payload,
          detected_by,
          detection_details,
          required_approval_level
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING *
      `, [
        tenant_id,
        body.ingress_id,
        body.quarantine_reason || "defense_review_required",
        body.severity || "medium",
        body.category || "runtime_defense",
        body.object_id || null,
        body.object_type || null,
        body.proposed_action || "unknown",
        JSON.stringify(body.proposed_payload || {}),
        body.detected_by || "runtime_defense_layer",
        JSON.stringify(body.detection_details || {}),
        body.required_approval_level || "runtime_admin"
      ]);

      const quarantine = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.quarantine.created",
        object_id: quarantine.object_id,
        message: `Quarantine item created: ${quarantine.quarantine_id}`,
        tenant_id
      });

      return send(res, 201, {
        quarantine
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/quarantine") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_quarantine_queue
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [tenant_id]);

      return send(res, 200, {
        quarantine_queue: result.rows
      });
    }


    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/review")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const quarantine_id = path
        .replace("/runtime/defense/quarantine/", "")
        .replace("/review", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        UPDATE runtime_quarantine_queue
        SET
          status = 'under_review',
          assigned_to = COALESCE($3, assigned_to),
          reviewed_by = $4,
          reviewed_at = now(),
          review_comment = $5,
          updated_at = now()
        WHERE quarantine_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        quarantine_id,
        tenant_id,
        body.assigned_to || null,
        auth.user.username || auth.user.operator_id || "system",
        body.review_comment || "review_started"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "quarantine item not found"
        });
      }

      const quarantine = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.quarantine.review_started",
        object_id: quarantine.object_id,
        message: `Quarantine review started: ${quarantine.quarantine_id}`,
        tenant_id
      });

      return send(res, 200, {
        quarantine
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/approve")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const quarantine_id = path
        .replace("/runtime/defense/quarantine/", "")
        .replace("/approve", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        UPDATE runtime_quarantine_queue
        SET
          status = 'approved_for_apply',
          reviewed_by = $3,
          reviewed_at = now(),
          review_decision = 'approved',
          review_comment = $4,
          updated_at = now()
        WHERE quarantine_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        quarantine_id,
        tenant_id,
        auth.user.username || auth.user.operator_id || "system",
        body.review_comment || "approved by runtime defense review"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "quarantine item not found"
        });
      }

      const quarantine = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.quarantine.approved",
        object_id: quarantine.object_id,
        message: `Quarantine approved: ${quarantine.quarantine_id}`,
        tenant_id
      });

      await db.query(`
        UPDATE runtime_ingress_events
        SET
          defense_status = 'approved',
          defense_decision = 'allow_after_review'
        WHERE ingress_id = $1
          AND tenant_id = $2
      `, [
        quarantine.ingress_id,
        tenant_id
      ]);

      await db.query(`
        UPDATE runtime_defense_state
        SET
          open_quarantine_count = (
            SELECT COUNT(*)
            FROM runtime_quarantine_queue
            WHERE tenant_id = $1
              AND status = 'open'
          ),
          state_reason = 'quarantine approved',
          updated_by = $2,
          updated_at = now()
        WHERE tenant_id = $1
      `, [
        tenant_id,
        auth.user.username || auth.user.operator_id || "system"
      ]);

      return send(res, 200, {
        quarantine
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/reject")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const quarantine_id = path
        .replace("/runtime/defense/quarantine/", "")
        .replace("/reject", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        UPDATE runtime_quarantine_queue
        SET
          status = 'rejected',
          reviewed_by = $3,
          reviewed_at = now(),
          review_decision = 'rejected',
          review_comment = $4,
          updated_at = now()
        WHERE quarantine_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        quarantine_id,
        tenant_id,
        auth.user.username || auth.user.operator_id || "system",
        body.review_comment || "rejected by runtime defense review"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "quarantine item not found"
        });
      }

      const quarantine = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.quarantine.rejected",
        object_id: quarantine.object_id,
        message: `Quarantine rejected: ${quarantine.quarantine_id}`,
        tenant_id
      });

      await db.query(`
        UPDATE runtime_ingress_events
        SET
          defense_status = 'rejected',
          defense_decision = 'reject_after_review'
        WHERE ingress_id = $1
          AND tenant_id = $2
      `, [
        quarantine.ingress_id,
        tenant_id
      ]);

      await db.query(`
        UPDATE runtime_defense_state
        SET
          open_quarantine_count = (
            SELECT COUNT(*)
            FROM runtime_quarantine_queue
            WHERE tenant_id = $1
              AND status = 'open'
          ),
          recent_rejection_count = recent_rejection_count + 1,
          state_reason = 'quarantine rejected',
          updated_by = $2,
          updated_at = now()
        WHERE tenant_id = $1
      `, [
        tenant_id,
        auth.user.username || auth.user.operator_id || "system"
      ]);

      return send(res, 200, {
        quarantine
      });
    }

    if (req.method === "POST" && path === "/runtime/defense/savepoints") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;
      const previous_state = body.previous_state || {};
      const previous_state_hash = require("crypto")
        .createHash("sha256")
        .update(JSON.stringify(previous_state))
        .digest("hex");

      const result = await db.query(`
        INSERT INTO runtime_savepoints (
          tenant_id,
          object_id,
          runtime_type,
          created_for_ingress_id,
          created_for_action,
          previous_state,
          previous_state_hash,
          savepoint_reason,
          criticality
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
        RETURNING *
      `, [
        tenant_id,
        body.object_id,
        body.runtime_type,
        body.created_for_ingress_id || null,
        body.created_for_action || "runtime_change",
        JSON.stringify(previous_state),
        previous_state_hash,
        body.savepoint_reason || "pre_change_defense_savepoint",
        body.criticality || "medium"
      ]);

      const savepoint = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.savepoint.created",
        object_id: savepoint.object_id,
        message: `Defense savepoint created: ${savepoint.savepoint_id}`,
        tenant_id
      });

      return send(res, 201, {
        savepoint
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/savepoints") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_savepoints
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [tenant_id]);

      return send(res, 200, {
        savepoints: result.rows
      });
    }


    if (req.method === "POST" && path.startsWith("/runtime/defense/savepoints/") && path.endsWith("/rollback")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const savepoint_id = path
        .replace("/runtime/defense/savepoints/", "")
        .replace("/rollback", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const savepointResult = await db.query(`
        SELECT *
        FROM runtime_savepoints
        WHERE savepoint_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        savepoint_id,
        tenant_id
      ]);

      if (savepointResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "savepoint not found"
        });
      }

      const savepoint = savepointResult.rows[0];

      if (savepoint.rollback_status !== "available") {
        return send(res, 409, {
          error: "rollback_not_available",
          message: `savepoint rollback_status is ${savepoint.rollback_status}`,
          savepoint
        });
      }

      const previous_state = savepoint.previous_state || {};
      const restored_runtime_type =
        previous_state.runtime_type ||
        previous_state.type ||
        savepoint.object_type ||
        "restored_object";

      const restored_state =
        previous_state.state ||
        previous_state.status ||
        "restored";

      const restored_priority =
        previous_state.priority ||
        "normal";

      const restored_risk_score =
        Number(previous_state.risk_score || 0);

      await writeEvent({
        event_type: "runtime.defense.savepoint.rollback.started",
        object_id: String(savepoint.object_id),
        message: `Rollback started from savepoint: ${savepoint.savepoint_id}`,
        tenant_id
      });

      const runtimeResult = await db.query(`
        INSERT INTO runtime_objects (
          object_id,
          runtime_type,
          state,
          priority,
          risk_score,
          tenant_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6
        )
        ON CONFLICT (object_id)
        DO UPDATE SET
          runtime_type = EXCLUDED.runtime_type,
          state = EXCLUDED.state,
          priority = EXCLUDED.priority,
          risk_score = EXCLUDED.risk_score,
          tenant_id = EXCLUDED.tenant_id
        RETURNING *
      `, [
        String(savepoint.object_id),
        restored_runtime_type,
        restored_state,
        restored_priority,
        restored_risk_score,
        tenant_id
      ]);

      const rollbackEventId = crypto.randomUUID();

      await db.query(`
        UPDATE runtime_savepoints
        SET
          rollback_status = 'used',
          rollback_event_id = $3,
          rolled_back_by = $4,
          rolled_back_at = now()
        WHERE savepoint_id = $1
          AND tenant_id = $2
      `, [
        savepoint_id,
        tenant_id,
        rollbackEventId,
        actor_id
      ]);

      await db.query(`
        UPDATE runtime_defense_state
        SET
          defense_mode = 'recovery',
          defense_level = 'elevated',
          state_reason = $2,
          updated_by = $3,
          updated_at = now()
        WHERE tenant_id = $1
      `, [
        tenant_id,
        body.rollback_reason || "runtime rollback executed",
        actor_id
      ]);

      await writeEvent({
        event_type: "runtime.defense.savepoint.rollback.completed",
        object_id: String(savepoint.object_id),
        message: `Rollback completed from savepoint: ${savepoint.savepoint_id}`,
        tenant_id
      });

      return send(res, 200, {
        rollback: {
          rollback_event_id: rollbackEventId,
          savepoint_id,
          object_id: String(savepoint.object_id),
          status: "completed",
          reason: body.rollback_reason || "runtime rollback executed"
        },
        restored_object: runtimeResult.rows[0]
      });
    }


    if (req.method === "POST" && path === "/runtime/defense/recovery-requests") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const result = await db.query(`
        INSERT INTO runtime_recovery_requests (
          tenant_id,
          quarantine_id,
          savepoint_id,
          request_type,
          request_reason,
          requested_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6
        )
        RETURNING *
      `, [
        tenant_id,
        body.quarantine_id || null,
        body.savepoint_id || null,
        body.request_type || "rollback",
        body.request_reason || "runtime recovery requested",
        actor_id
      ]);

      const recovery_request = result.rows[0];

      await writeEvent({
        event_type: "runtime.recovery.request.created",
        object_id: body.savepoint_id || body.quarantine_id || null,
        message: `Recovery request created: ${recovery_request.recovery_request_id}`,
        tenant_id
      });

      return send(res, 201, {
        recovery_request
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/recovery-requests") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_recovery_requests
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        recovery_requests: result.rows
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/review")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const recovery_request_id = path
        .replace("/runtime/defense/recovery-requests/", "")
        .replace("/review", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const result = await db.query(`
        UPDATE runtime_recovery_requests
        SET
          review_status = 'under_review',
          reviewed_by = $3,
          reviewed_at = now(),
          review_comment = $4,
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        recovery_request_id,
        tenant_id,
        actor_id,
        body.review_comment || "recovery review started"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "recovery request not found"
        });
      }

      const recovery_request = result.rows[0];

      await writeEvent({
        event_type: "runtime.recovery.request.review_started",
        object_id: recovery_request.savepoint_id || recovery_request.quarantine_id,
        message: `Recovery request review started: ${recovery_request.recovery_request_id}`,
        tenant_id
      });

      return send(res, 200, {
        recovery_request
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/approve")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const recovery_request_id = path
        .replace("/runtime/defense/recovery-requests/", "")
        .replace("/approve", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const result = await db.query(`
        UPDATE runtime_recovery_requests
        SET
          review_status = 'approved',
          reviewed_by = $3,
          reviewed_at = now(),
          review_comment = $4,
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        recovery_request_id,
        tenant_id,
        actor_id,
        body.review_comment || "recovery request approved"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "recovery request not found"
        });
      }

      const recovery_request = result.rows[0];

      await writeEvent({
        event_type: "runtime.recovery.request.approved",
        object_id: recovery_request.savepoint_id || recovery_request.quarantine_id,
        message: `Recovery request approved: ${recovery_request.recovery_request_id}`,
        tenant_id
      });

      return send(res, 200, {
        recovery_request
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/reject")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const recovery_request_id = path
        .replace("/runtime/defense/recovery-requests/", "")
        .replace("/reject", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const result = await db.query(`
        UPDATE runtime_recovery_requests
        SET
          review_status = 'rejected',
          reviewed_by = $3,
          reviewed_at = now(),
          review_comment = $4,
          execution_status = 'blocked',
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        recovery_request_id,
        tenant_id,
        actor_id,
        body.review_comment || "recovery request rejected"
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "recovery request not found"
        });
      }

      const recovery_request = result.rows[0];

      await writeEvent({
        event_type: "runtime.recovery.request.rejected",
        object_id: recovery_request.savepoint_id || recovery_request.quarantine_id,
        message: `Recovery request rejected: ${recovery_request.recovery_request_id}`,
        tenant_id
      });

      return send(res, 200, {
        recovery_request
      });
    }


    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/execute")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const recovery_request_id = path
        .replace("/runtime/defense/recovery-requests/", "")
        .replace("/execute", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const requestResult = await db.query(`
        SELECT *
        FROM runtime_recovery_requests
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        recovery_request_id,
        tenant_id
      ]);

      if (requestResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "recovery request not found"
        });
      }

      const recovery_request = requestResult.rows[0];

      if (recovery_request.review_status !== "approved") {
        return send(res, 409, {
          error: "recovery_not_approved",
          message: `review_status is ${recovery_request.review_status}`,
          recovery_request
        });
      }

      if (recovery_request.execution_status !== "pending") {
        return send(res, 409, {
          error: "recovery_not_pending",
          message: `execution_status is ${recovery_request.execution_status}`,
          recovery_request
        });
      }

      if (!recovery_request.savepoint_id) {
        return send(res, 400, {
          error: "missing_savepoint",
          message: "recovery request has no savepoint_id"
        });
      }

      await db.query(`
        UPDATE runtime_recovery_requests
        SET
          execution_status = 'executing',
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
      `, [
        recovery_request_id,
        tenant_id
      ]);

      await writeEvent({
        event_type: "runtime.recovery.execution.started",
        object_id: recovery_request.savepoint_id,
        message: `Recovery execution started: ${recovery_request_id}`,
        tenant_id
      });

      const savepointResult = await db.query(`
        SELECT *
        FROM runtime_savepoints
        WHERE savepoint_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        recovery_request.savepoint_id,
        tenant_id
      ]);

      if (savepointResult.rows.length === 0) {
        await db.query(`
          UPDATE runtime_recovery_requests
          SET
            execution_status = 'failed',
            verification_status = 'savepoint_not_found',
            updated_at = now()
          WHERE recovery_request_id = $1
            AND tenant_id = $2
        `, [
          recovery_request_id,
          tenant_id
        ]);

        return send(res, 404, {
          error: "savepoint_not_found",
          message: "linked savepoint not found"
        });
      }

      const savepoint = savepointResult.rows[0];

      if (savepoint.rollback_status !== "available") {
        await db.query(`
          UPDATE runtime_recovery_requests
          SET
            execution_status = 'failed',
            verification_status = 'savepoint_not_available',
            updated_at = now()
          WHERE recovery_request_id = $1
            AND tenant_id = $2
        `, [
          recovery_request_id,
          tenant_id
        ]);

        return send(res, 409, {
          error: "savepoint_not_available",
          message: `savepoint rollback_status is ${savepoint.rollback_status}`,
          savepoint
        });
      }

      const previous_state = savepoint.previous_state || {};
      const restored_runtime_type =
        previous_state.runtime_type ||
        previous_state.type ||
        savepoint.object_type ||
        "restored_object";

      const restored_state =
        previous_state.state ||
        previous_state.status ||
        "restored";

      const restored_priority =
        previous_state.priority ||
        "normal";

      const restored_risk_score =
        Number(previous_state.risk_score || 0);

      const runtimeResult = await db.query(`
        INSERT INTO runtime_objects (
          object_id,
          runtime_type,
          state,
          priority,
          risk_score,
          tenant_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6
        )
        ON CONFLICT (object_id)
        DO UPDATE SET
          runtime_type = EXCLUDED.runtime_type,
          state = EXCLUDED.state,
          priority = EXCLUDED.priority,
          risk_score = EXCLUDED.risk_score,
          tenant_id = EXCLUDED.tenant_id
        RETURNING *
      `, [
        String(savepoint.object_id),
        restored_runtime_type,
        restored_state,
        restored_priority,
        restored_risk_score,
        tenant_id
      ]);

      const rollbackEventId = crypto.randomUUID();

      await db.query(`
        UPDATE runtime_savepoints
        SET
          rollback_status = 'used',
          rollback_event_id = $3,
          rolled_back_by = $4,
          rolled_back_at = now()
        WHERE savepoint_id = $1
          AND tenant_id = $2
      `, [
        savepoint.savepoint_id,
        tenant_id,
        rollbackEventId,
        actor_id
      ]);

      await db.query(`
        UPDATE runtime_recovery_requests
        SET
          execution_status = 'completed',
          rollback_event_id = $3,
          verification_status = 'restored',
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        RETURNING *
      `, [
        recovery_request_id,
        tenant_id,
        rollbackEventId
      ]);

      const finalResult = await db.query(`
        SELECT *
        FROM runtime_recovery_requests
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        recovery_request_id,
        tenant_id
      ]);

      await db.query(`
        UPDATE runtime_defense_state
        SET
          defense_mode = 'recovery',
          defense_level = 'elevated',
          state_reason = $2,
          updated_by = $3,
          updated_at = now()
        WHERE tenant_id = $1
      `, [
        tenant_id,
        body.execution_reason || "approved recovery executed",
        actor_id
      ]);

      await writeEvent({
        event_type: "runtime.recovery.execution.completed",
        object_id: savepoint.object_id,
        message: `Recovery execution completed: ${recovery_request_id}`,
        tenant_id
      });

      return send(res, 200, {
        recovery_request: finalResult.rows[0],
        rollback: {
          rollback_event_id: rollbackEventId,
          savepoint_id: savepoint.savepoint_id,
          object_id: String(savepoint.object_id),
          status: "completed"
        },
        restored_object: runtimeResult.rows[0]
      });
    }


    if (req.method === "POST" && path === "/runtime/defense/recovery-verifications") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const recoveryResult = await db.query(`
        SELECT *
        FROM runtime_recovery_requests
        WHERE recovery_request_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        body.recovery_request_id,
        tenant_id
      ]);

      if (recoveryResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "recovery request not found"
        });
      }

      const recovery_request = recoveryResult.rows[0];

      if (recovery_request.execution_status !== "completed") {
        return send(res, 409, {
          error: "recovery_not_completed",
          message: `execution_status is ${recovery_request.execution_status}`,
          recovery_request
        });
      }

      const verification_status =
        body.verification_status || "verified";

      const closure_status =
        verification_status === "verified"
          ? "ready_to_close"
          : "pending";

      const result = await db.query(`
        INSERT INTO runtime_recovery_verifications (
          tenant_id,
          recovery_request_id,
          savepoint_id,
          verification_status,
          verification_result,
          verified_by,
          closure_status,
          notes
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8
        )
        RETURNING *
      `, [
        tenant_id,
        body.recovery_request_id,
        recovery_request.savepoint_id,
        verification_status,
        JSON.stringify(body.verification_result || {}),
        actor_id,
        closure_status,
        body.notes || null
      ]);

      const verification = result.rows[0];

      await db.query(`
        UPDATE runtime_recovery_requests
        SET
          verification_status = $3,
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
      `, [
        body.recovery_request_id,
        tenant_id,
        verification_status
      ]);

      await writeEvent({
        event_type: "runtime.recovery.verification.created",
        object_id: recovery_request.savepoint_id,
        message: `Recovery verification created: ${verification.verification_id}`,
        tenant_id
      });

      return send(res, 201, {
        verification
      });
    }

    if (req.method === "GET" && path === "/runtime/defense/recovery-verifications") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_recovery_verifications
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        recovery_verifications: result.rows
      });
    }

    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-verifications/") && path.endsWith("/close")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const verification_id = path
        .replace("/runtime/defense/recovery-verifications/", "")
        .replace("/close", "");

      const body = await readBody(req);
      const tenant_id = auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const result = await db.query(`
        UPDATE runtime_recovery_verifications
        SET
          closure_status = 'closed',
          notes = COALESCE($3, notes)
        WHERE verification_id = $1
          AND tenant_id = $2
          AND verification_status = 'verified'
        RETURNING *
      `, [
        verification_id,
        tenant_id,
        body.notes || null
      ]);

      if (result.rows.length === 0) {
        return send(res, 409, {
          error: "closure_not_allowed",
          message: "verification not found or verification_status is not verified"
        });
      }

      const verification = result.rows[0];

      await db.query(`
        UPDATE runtime_recovery_requests
        SET
          verification_status = 'closed',
          updated_at = now()
        WHERE recovery_request_id = $1
          AND tenant_id = $2
      `, [
        verification.recovery_request_id,
        tenant_id
      ]);

      await db.query(`
        UPDATE runtime_defense_state
        SET
          state_reason = $2,
          updated_by = $3,
          updated_at = now()
        WHERE tenant_id = $1
      `, [
        tenant_id,
        body.notes || "recovery verified and closed",
        actor_id
      ]);

      await writeEvent({
        event_type: "runtime.recovery.verification.closed",
        object_id: verification.savepoint_id,
        message: `Recovery verification closed: ${verification.verification_id}`,
        tenant_id
      });

      return send(res, 200, {
        verification
      });
    }


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


    if (req.method === "POST" && path === "/runtime/audit-reports/generate") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;
      const actor_id = auth.user.username || auth.user.operator_id || "system";

      const period_start = body.period_start || new Date().toISOString().slice(0, 10);
      const period_end = body.period_end || period_start;
      const report_type = body.report_type || "defense_recovery_audit";

      const metricsResult = await db.query(`
        SELECT *
        FROM runtime_defense_metrics
        WHERE tenant_id = $1
          AND metric_date BETWEEN $2::date AND $3::date
        ORDER BY metric_date ASC
      `, [
        tenant_id,
        period_start,
        period_end
      ]);

      const stateResult = await db.query(`
        SELECT *
        FROM runtime_defense_state
        WHERE tenant_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `, [
        tenant_id
      ]);

      const quarantineResult = await db.query(`
        SELECT *
        FROM runtime_quarantine_queue
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2::date AND $3::date
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id,
        period_start,
        period_end
      ]);

      const recoveryResult = await db.query(`
        SELECT *
        FROM runtime_recovery_requests
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2::date AND $3::date
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id,
        period_start,
        period_end
      ]);

      const verificationResult = await db.query(`
        SELECT *
        FROM runtime_recovery_verifications
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2::date AND $3::date
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id,
        period_start,
        period_end
      ]);

      const report_data = {
        report_context: {
          report_type,
          tenant_id,
          period_start,
          period_end,
          generated_by: actor_id
        },
        executive_summary: {
          purpose: "Defense and recovery audit evidence snapshot",
          closure_ready: verificationResult.rows.some(v => v.closure_status === "closed"),
          recovery_completed: recoveryResult.rows.some(r => r.execution_status === "completed"),
          open_quarantine_count: quarantineResult.rows.filter(q => q.status === "open").length
        },
        metrics: metricsResult.rows,
        defense_state: stateResult.rows[0] || null,
        quarantines: quarantineResult.rows,
        recovery_requests: recoveryResult.rows,
        recovery_verifications: verificationResult.rows
      };

      const result = await db.query(`
        INSERT INTO runtime_audit_reports (
          tenant_id,
          report_type,
          report_period_start,
          report_period_end,
          generated_by,
          report_data
        )
        VALUES (
          $1,$2,$3::date,$4::date,$5,$6
        )
        RETURNING *
      `, [
        tenant_id,
        report_type,
        period_start,
        period_end,
        actor_id,
        JSON.stringify(report_data)
      ]);

      const report = result.rows[0];

      await writeEvent({
        event_type: "runtime.audit_report.generated",
        object_id: report.report_id,
        message: `Audit report generated: ${report.report_id}`,
        tenant_id
      });

      return send(res, 201, {
        audit_report: report
      });
    }

    if (req.method === "GET" && path === "/runtime/audit-reports") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          report_id,
          tenant_id,
          report_type,
          report_period_start,
          report_period_end,
          report_status,
          generated_by,
          generated_at,
          created_at
        FROM runtime_audit_reports
        WHERE tenant_id = $1
        ORDER BY generated_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        audit_reports: result.rows
      });
    }

    if (req.method === "GET" && path.startsWith("/runtime/audit-reports/")) {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const report_id = path.replace("/runtime/audit-reports/", "");
      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_audit_reports
        WHERE report_id = $1
          AND tenant_id = $2
        LIMIT 1
      `, [
        report_id,
        tenant_id
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "audit report not found"
        });
      }

      return send(res, 200, {
        audit_report: result.rows[0]
      });
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
