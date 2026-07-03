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

    if (req.method === "POST" && path === "/runtime/source-quality") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const source_id = body.source_id || null;
      const quality_dimension = body.quality_dimension;
      const rating = body.rating || null;
      const assessment_notes = body.assessment_notes || null;
      const assessed_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!quality_dimension) {
        return send(res, 400, {
          error: "validation_error",
          message: "quality_dimension required"
        });
      }

      const source_quality_id =
        "00000000-0000-4011-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_source_quality (
          source_quality_id,
          tenant_id,
          source_id,
          quality_dimension,
          rating,
          assessment_notes,
          assessed_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        source_quality_id,
        tenant_id,
        source_id,
        quality_dimension,
        rating,
        assessment_notes,
        assessed_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_quality_id,
        event_type: "runtime.source_quality.created",
        message: JSON.stringify({
          source_quality_id,
          source_id,
          quality_dimension,
          rating
        })
      });

      return send(res, 201, {
        source_quality: {
          source_quality_id,
          tenant_id,
          source_id,
          quality_dimension,
          rating,
          assessment_notes,
          assessed_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/source-quality") {
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
          q.source_quality_id,
          q.tenant_id,
          q.source_id,
          s.title AS source_title,
          s.source_type,
          q.quality_dimension,
          q.rating,
          q.assessment_notes,
          q.assessed_at,
          q.assessed_by
        FROM runtime_source_quality q
        LEFT JOIN runtime_sources s
          ON s.source_id = q.source_id
        WHERE q.tenant_id = $1
        ORDER BY q.assessed_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        source_quality: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/source-conflicts") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const source_id_a = body.source_id_a || null;
      const source_id_b = body.source_id_b || null;
      const conflict_type = body.conflict_type;
      const description = body.description || null;
      const status = body.status || "open";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!conflict_type) {
        return send(res, 400, {
          error: "validation_error",
          message: "conflict_type required"
        });
      }

      const conflict_id =
        "00000000-0000-4012-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_source_conflicts (
          conflict_id,
          tenant_id,
          source_id_a,
          source_id_b,
          conflict_type,
          description,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        conflict_id,
        tenant_id,
        source_id_a,
        source_id_b,
        conflict_type,
        description,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: conflict_id,
        event_type: "runtime.source_conflict.created",
        message: JSON.stringify({
          conflict_id,
          source_id_a,
          source_id_b,
          conflict_type,
          status
        })
      });

      return send(res, 201, {
        source_conflict: {
          conflict_id,
          tenant_id,
          source_id_a,
          source_id_b,
          conflict_type,
          description,
          status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/source-conflicts") {
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
          c.conflict_id,
          c.tenant_id,
          c.source_id_a,
          sa.title AS source_a_title,
          c.source_id_b,
          sb.title AS source_b_title,
          c.conflict_type,
          c.description,
          c.status,
          c.created_at,
          c.created_by
        FROM runtime_source_conflicts c
        LEFT JOIN runtime_sources sa
          ON sa.source_id = c.source_id_a
        LEFT JOIN runtime_sources sb
          ON sb.source_id = c.source_id_b
        WHERE c.tenant_id = $1
        ORDER BY c.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        source_conflicts: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/fact-acceptance-rules") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const rule_name = body.rule_name;
      const minimum_verification_confidence = body.minimum_verification_confidence || null;
      const minimum_source_quality = body.minimum_source_quality || null;
      const minimum_evidence_count = body.minimum_evidence_count || null;
      const maximum_open_unknowns = body.maximum_open_unknowns === undefined ? null : body.maximum_open_unknowns;
      const maximum_open_conflicts = body.maximum_open_conflicts === undefined ? null : body.maximum_open_conflicts;
      const enabled = body.enabled === false ? false : true;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!rule_name) {
        return send(res, 400, {
          error: "validation_error",
          message: "rule_name required"
        });
      }

      const rule_id =
        "00000000-0000-4013-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_fact_acceptance_rules (
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        rule_id,
        tenant_id,
        rule_name,
        minimum_verification_confidence,
        minimum_source_quality,
        minimum_evidence_count,
        maximum_open_unknowns,
        maximum_open_conflicts,
        enabled,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: rule_id,
        event_type: "runtime.fact_acceptance_rule.created",
        message: JSON.stringify({
          rule_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled
        })
      });

      return send(res, 201, {
        fact_acceptance_rule: {
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/fact-acceptance-rules") {
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
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_at,
          created_by
        FROM runtime_fact_acceptance_rules
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        fact_acceptance_rules: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/validate") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const factResult = await db.query(`
        SELECT
          f.fact_id,
          f.verification_result_id,
          vr.result_status,
          vr.confidence,
          vr.accepted_as_fact
        FROM runtime_facts f
        JOIN runtime_verification_results vr
          ON vr.result_id = f.verification_result_id
        WHERE f.tenant_id = $1
          AND f.fact_id = $2
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (factResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "fact not found"
        });
      }

      const ruleResult = await db.query(`
        SELECT *
        FROM runtime_fact_acceptance_rules
        WHERE tenant_id = $1
          AND enabled = true
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (ruleResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "no active fact acceptance rule found"
        });
      }

      const rule = ruleResult.rows[0];
      const fact = factResult.rows[0];

      const unknownResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_unknowns
        WHERE tenant_id = $1
          AND related_object_type = 'fact'
          AND related_object_id = $2
          AND status = 'open'
      `, [
        tenant_id,
        fact_id
      ]);

      const conflictResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_source_conflicts
        WHERE tenant_id = $1
          AND status = 'open'
      `, [
        tenant_id
      ]);

      const evidenceResult = await db.query(`
        SELECT COUNT(DISTINCT evidence_id)::int AS count
        FROM (
          SELECT fs.evidence_id
          FROM runtime_fact_sources fs
          WHERE fs.tenant_id = $1
            AND fs.fact_id = $2

          UNION

          SELECT a.evidence_id
          FROM runtime_facts f
          LEFT JOIN runtime_verification_results vr
            ON vr.tenant_id = f.tenant_id
           AND vr.result_id = f.verification_result_id
          LEFT JOIN runtime_verifications v
            ON v.tenant_id = f.tenant_id
           AND v.verification_id = vr.verification_id
          LEFT JOIN runtime_verification_cycles vc
            ON vc.tenant_id = f.tenant_id
           AND (
                vc.verification_result_id = vr.result_id
                OR vc.fact_id = f.fact_id
                OR vc.hypothesis_id = v.hypothesis_id
              )
          LEFT JOIN runtime_hypotheses h
            ON h.tenant_id = f.tenant_id
           AND h.hypothesis_id = COALESCE(vc.hypothesis_id, v.hypothesis_id)
          LEFT JOIN runtime_assumptions a
            ON a.tenant_id = f.tenant_id
           AND a.assumption_id = COALESCE(h.assumption_id, vc.assumption_id)
          WHERE f.tenant_id = $1
            AND f.fact_id = $2
            AND a.evidence_id IS NOT NULL
        ) evidence_links
      `, [
        tenant_id,
        fact_id
      ]);

      const qualityResult = await db.query(`
        SELECT AVG(rating)::numeric(5,2) AS avg_rating
        FROM runtime_source_quality
        WHERE tenant_id = $1
      `, [
        tenant_id
      ]);

      const verificationConfidence = Number(fact.confidence || 0);
      const sourceQuality = Number(qualityResult.rows[0].avg_rating || 0);
      const evidenceCount = Number(evidenceResult.rows[0].count || 0);
      const openUnknowns = Number(unknownResult.rows[0].count || 0);
      const openConflicts = Number(conflictResult.rows[0].count || 0);

      const checks = {
        accepted_as_fact:
          fact.accepted_as_fact === true,

        verification_confidence:
          verificationConfidence >= Number(rule.minimum_verification_confidence || 0),

        source_quality:
          sourceQuality >= Number(rule.minimum_source_quality || 0),

        evidence_count:
          evidenceCount >= Number(rule.minimum_evidence_count || 0),

        open_unknowns:
          openUnknowns <= Number(rule.maximum_open_unknowns ?? 999999),

        open_conflicts:
          openConflicts <= Number(rule.maximum_open_conflicts ?? 999999)
      };

      const reasonMap = {
        accepted_as_fact: "verification_result_not_accepted_as_fact",
        verification_confidence: "minimum_verification_confidence_not_met",
        source_quality: "minimum_source_quality_not_met",
        evidence_count: "minimum_evidence_count_not_met",
        open_unknowns: "maximum_open_unknowns_exceeded",
        open_conflicts: "maximum_open_conflicts_exceeded"
      };

      const reasons = [];

      Object.entries(checks).forEach(([key, passed]) => {
        if (!passed) {
          reasons.push(reasonMap[key] || key);
        }
      });

      const accepted = reasons.length === 0;

      const score =
        Object.values(checks).filter(Boolean).length /
        Object.keys(checks).length;

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.validation.completed",
        message: JSON.stringify({
          fact_id,
          accepted,
          score,
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          reasons
        })
      });

      return send(res, 200, {
        accepted,
        score,
        fact_id,
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        metrics: {
          verification_confidence: verificationConfidence,
          source_quality: sourceQuality,
          evidence_count: evidenceCount,
          open_unknowns: openUnknowns,
          open_conflicts: openConflicts
        },
        checks,
        reasons
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/calculate-confidence") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;
      const calculated_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const factResult = await db.query(`
        SELECT
          f.fact_id,
          f.verification_result_id,
          vr.confidence AS verification_confidence,
          vr.accepted_as_fact
        FROM runtime_facts f
        LEFT JOIN runtime_verification_results vr
          ON vr.result_id = f.verification_result_id
        WHERE f.tenant_id = $1
          AND f.fact_id = $2
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (factResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "fact not found"
        });
      }

      const qualityResult = await db.query(`
        SELECT AVG(rating)::numeric(5,2) AS avg_rating
        FROM runtime_source_quality
        WHERE tenant_id = $1
      `, [
        tenant_id
      ]);

      const evidenceResult = await db.query(`
        SELECT COUNT(DISTINCT evidence_id)::int AS count
        FROM (
          SELECT fs.evidence_id
          FROM runtime_fact_sources fs
          WHERE fs.tenant_id = $1
            AND fs.fact_id = $2

          UNION

          SELECT a.evidence_id
          FROM runtime_facts f
          LEFT JOIN runtime_verification_results vr
            ON vr.tenant_id = f.tenant_id
           AND vr.result_id = f.verification_result_id
          LEFT JOIN runtime_verifications v
            ON v.tenant_id = f.tenant_id
           AND v.verification_id = vr.verification_id
          LEFT JOIN runtime_verification_cycles vc
            ON vc.tenant_id = f.tenant_id
           AND (
                vc.verification_result_id = vr.result_id
                OR vc.fact_id = f.fact_id
                OR vc.hypothesis_id = v.hypothesis_id
              )
          LEFT JOIN runtime_hypotheses h
            ON h.tenant_id = f.tenant_id
           AND h.hypothesis_id = COALESCE(vc.hypothesis_id, v.hypothesis_id)
          LEFT JOIN runtime_assumptions a
            ON a.tenant_id = f.tenant_id
           AND a.assumption_id = COALESCE(h.assumption_id, vc.assumption_id)
          WHERE f.tenant_id = $1
            AND f.fact_id = $2
            AND a.evidence_id IS NOT NULL
        ) evidence_links
      `, [
        tenant_id,
        fact_id
      ]);

      const unknownResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_unknowns
        WHERE tenant_id = $1
          AND related_object_type = 'fact'
          AND related_object_id = $2
          AND status = 'open'
      `, [
        tenant_id,
        fact_id
      ]);

      const conflictResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_source_conflicts
        WHERE tenant_id = $1
          AND status = 'open'
      `, [
        tenant_id
      ]);

      const verificationConfidence =
        Number(factResult.rows[0].verification_confidence || 0);

      const sourceQuality =
        Number(qualityResult.rows[0].avg_rating || 0);

      const evidenceCount =
        Number(evidenceResult.rows[0].count || 0);

      const openUnknowns =
        Number(unknownResult.rows[0].count || 0);

      const openConflicts =
        Number(conflictResult.rows[0].count || 0);

      const evidenceFactor =
        Math.min(1, evidenceCount / 3);

      const unknownPenalty =
        Math.min(0.50, openUnknowns * 0.10);

      const conflictPenalty =
        Math.min(0.50, openConflicts * 0.15);

      const verificationFactor =
        verificationConfidence / 100;

      const sourceQualityFactor =
        sourceQuality / 100;

      let confidenceScore =
        (verificationFactor * 0.45) +
        (sourceQualityFactor * 0.30) +
        (evidenceFactor * 0.25) -
        unknownPenalty -
        conflictPenalty;

      confidenceScore =
        Math.max(0, Math.min(1, confidenceScore));

      confidenceScore =
        Math.round(confidenceScore * 100) / 100;

      let trustLevel = "VERY_LOW";

      if (confidenceScore >= 0.90) {
        trustLevel = "VERY_HIGH";
      } else if (confidenceScore >= 0.75) {
        trustLevel = "HIGH";
      } else if (confidenceScore >= 0.50) {
        trustLevel = "MEDIUM";
      } else if (confidenceScore >= 0.25) {
        trustLevel = "LOW";
      }

      const confidence_id =
        "00000000-0000-4014-8000-" +
        crypto.randomBytes(6).toString("hex");

      const calculationDetails = {
        formula: "verification*0.45 + source_quality*0.30 + evidence_factor*0.25 - unknown_penalty - conflict_penalty",
        verification_confidence: verificationConfidence,
        source_quality: sourceQuality,
        evidence_count: evidenceCount,
        evidence_factor: evidenceFactor,
        open_unknowns: openUnknowns,
        unknown_penalty: unknownPenalty,
        open_conflicts: openConflicts,
        conflict_penalty: conflictPenalty,
        confidence_score: confidenceScore,
        trust_level: trustLevel
      };

      await db.query(`
        INSERT INTO runtime_fact_confidence (
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details,
          calculated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        confidence_id,
        tenant_id,
        fact_id,
        confidenceScore,
        trustLevel,
        JSON.stringify(calculationDetails),
        calculated_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.confidence.calculated",
        message: JSON.stringify({
          confidence_id,
          fact_id,
          confidence_score: confidenceScore,
          trust_level: trustLevel
        })
      });

      return send(res, 201, {
        fact_confidence: {
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score: confidenceScore,
          trust_level: trustLevel,
          calculation_details: calculationDetails,
          calculated_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/fact-confidence") {
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
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details,
          calculated_at,
          calculated_by
        FROM runtime_fact_confidence
        WHERE tenant_id = $1
        ORDER BY calculated_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        fact_confidence: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/governance-check") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;
      const checked_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const confidenceResult = await db.query(`
        SELECT
          confidence_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details
        FROM runtime_fact_confidence
        WHERE tenant_id = $1
          AND fact_id = $2
        ORDER BY calculated_at DESC
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (confidenceResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "no confidence calculation found for fact"
        });
      }

      const confidence = confidenceResult.rows[0];
      const trust_level = confidence.trust_level;

      let governance_decision = "investigate";
      let human_approval_required = true;
      let decision_reason = "LOW or unknown trust requires investigation";

      if (trust_level === "VERY_HIGH") {
        governance_decision = "auto_approve";
        human_approval_required = false;
        decision_reason = "VERY_HIGH trust allows automatic approval";
      } else if (trust_level === "HIGH") {
        governance_decision = "approve";
        human_approval_required = false;
        decision_reason = "HIGH trust allows standard approval";
      } else if (trust_level === "MEDIUM") {
        governance_decision = "four_eyes_required";
        human_approval_required = true;
        decision_reason = "MEDIUM trust requires four-eyes approval";
      } else if (trust_level === "LOW") {
        governance_decision = "investigate";
        human_approval_required = true;
        decision_reason = "LOW trust requires further investigation";
      } else if (trust_level === "VERY_LOW") {
        governance_decision = "quarantine";
        human_approval_required = true;
        decision_reason = "VERY_LOW trust requires quarantine";
      }

      const governance_check_id =
        "00000000-0000-4015-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_governance_checks (
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        governance_check_id,
        tenant_id,
        fact_id,
        confidence.confidence_id,
        trust_level,
        governance_decision,
        human_approval_required,
        decision_reason,
        checked_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.governance.checked",
        message: JSON.stringify({
          governance_check_id,
          fact_id,
          confidence_id: confidence.confidence_id,
          trust_level,
          governance_decision,
          human_approval_required
        })
      });

      return send(res, 201, {
        governance_check: {
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id: confidence.confidence_id,
          confidence_score: confidence.confidence_score,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/governance-checks") {
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
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_at,
          checked_by
        FROM runtime_governance_checks
        WHERE tenant_id = $1
        ORDER BY checked_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        governance_checks: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/governance-outcomes") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const governance_check_id = body.governance_check_id || null;
      const fact_id = body.fact_id || null;
      const outcome_status = body.outcome_status;
      const outcome_correct = body.outcome_correct === undefined ? null : body.outcome_correct;
      const outcome_notes = body.outcome_notes || null;
      const outcome_date = body.outcome_date || null;
      const recorded_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!outcome_status) {
        return send(res, 400, {
          error: "validation_error",
          message: "outcome_status required"
        });
      }

      const outcome_id =
        "00000000-0000-4016-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_governance_outcomes (
          outcome_id,
          tenant_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct,
          outcome_notes,
          outcome_date,
          recorded_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, NOW()),$9)
      `, [
        outcome_id,
        tenant_id,
        governance_check_id,
        fact_id,
        outcome_status,
        outcome_correct,
        outcome_notes,
        outcome_date,
        recorded_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id || governance_check_id || outcome_id,
        event_type: "runtime.governance_outcome.recorded",
        message: JSON.stringify({
          outcome_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct
        })
      });

      return send(res, 201, {
        governance_outcome: {
          outcome_id,
          tenant_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct,
          outcome_notes,
          outcome_date,
          recorded_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/governance-outcomes") {
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
          o.outcome_id,
          o.tenant_id,
          o.governance_check_id,
          o.fact_id,
          gc.trust_level,
          gc.governance_decision,
          o.outcome_status,
          o.outcome_correct,
          o.outcome_notes,
          o.outcome_date,
          o.recorded_at,
          o.recorded_by
        FROM runtime_governance_outcomes o
        LEFT JOIN runtime_governance_checks gc
          ON gc.governance_check_id = o.governance_check_id
        WHERE o.tenant_id = $1
        ORDER BY o.recorded_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        governance_outcomes: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/lessons-learned/generate") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const outcome_id = body.outcome_id;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !outcome_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and outcome_id required"
        });
      }

      const outcomeResult = await db.query(`
        SELECT
          o.outcome_id,
          o.tenant_id,
          o.fact_id,
          o.governance_check_id,
          o.outcome_status,
          o.outcome_correct,
          o.outcome_notes,
          gc.trust_level,
          gc.governance_decision
        FROM runtime_governance_outcomes o
        LEFT JOIN runtime_governance_checks gc
          ON gc.governance_check_id = o.governance_check_id
        WHERE o.tenant_id = $1
          AND o.outcome_id = $2
        LIMIT 1
      `, [
        tenant_id,
        outcome_id
      ]);

      if (outcomeResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "governance outcome not found"
        });
      }

      const outcome = outcomeResult.rows[0];

      let lesson_type = "governance_feedback";
      let lesson_summary = "Governance outcome recorded.";
      let recommended_action = "Review governance outcome manually.";

      if (outcome.outcome_correct === true) {
        if (outcome.trust_level === "LOW" && outcome.governance_decision === "investigate") {
          lesson_type = "trust_validation";
          lesson_summary = "LOW trust correctly triggered investigation.";
          recommended_action = "Keep current LOW trust investigation threshold.";
        } else if (outcome.trust_level === "VERY_LOW" && outcome.governance_decision === "quarantine") {
          lesson_type = "trust_validation";
          lesson_summary = "VERY_LOW trust correctly triggered quarantine.";
          recommended_action = "Keep current VERY_LOW quarantine threshold.";
        } else if ((outcome.trust_level === "HIGH" || outcome.trust_level === "VERY_HIGH") && outcome.governance_decision.includes("approve")) {
          lesson_type = "trust_validation";
          lesson_summary = "High trust correctly supported approval.";
          recommended_action = "Keep current approval threshold.";
        } else if (outcome.trust_level === "MEDIUM" && outcome.governance_decision === "four_eyes_required") {
          lesson_type = "trust_validation";
          lesson_summary = "MEDIUM trust correctly required four-eyes review.";
          recommended_action = "Keep current MEDIUM four-eyes threshold.";
        }
      } else if (outcome.outcome_correct === false) {
        if (outcome.trust_level === "HIGH" || outcome.trust_level === "VERY_HIGH") {
          lesson_type = "false_positive";
          lesson_summary = "High trust decision produced incorrect outcome.";
          recommended_action = "Lower trust weighting or require additional verification for similar cases.";
        } else if (outcome.trust_level === "LOW" || outcome.trust_level === "VERY_LOW") {
          lesson_type = "false_negative";
          lesson_summary = "Low trust assessment may have underestimated a correct outcome.";
          recommended_action = "Review penalty weights and evidence factors for similar cases.";
        } else {
          lesson_type = "governance_miscalibration";
          lesson_summary = "Governance decision produced incorrect outcome.";
          recommended_action = "Review governance rule calibration.";
        }
      }

      const lesson_id =
        "00000000-0000-4017-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_lessons_learned (
          lesson_id,
          tenant_id,
          outcome_id,
          fact_id,
          trust_level,
          governance_decision,
          outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        lesson_id,
        tenant_id,
        outcome.outcome_id,
        outcome.fact_id,
        outcome.trust_level,
        outcome.governance_decision,
        outcome.outcome_correct,
        lesson_type,
        lesson_summary,
        recommended_action,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: outcome.fact_id || outcome.outcome_id,
        event_type: "runtime.lesson_learned.generated",
        message: JSON.stringify({
          lesson_id,
          outcome_id,
          fact_id: outcome.fact_id,
          trust_level: outcome.trust_level,
          governance_decision: outcome.governance_decision,
          outcome_correct: outcome.outcome_correct,
          lesson_type
        })
      });

      return send(res, 201, {
        lesson_learned: {
          lesson_id,
          tenant_id,
          outcome_id: outcome.outcome_id,
          fact_id: outcome.fact_id,
          trust_level: outcome.trust_level,
          governance_decision: outcome.governance_decision,
          outcome_correct: outcome.outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/lessons-learned") {
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
          lesson_id,
          tenant_id,
          outcome_id,
          fact_id,
          trust_level,
          governance_decision,
          outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_at,
          created_by
        FROM runtime_lessons_learned
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        lessons_learned: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/heuristics") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const heuristic_name = body.heuristic_name;
      const heuristic_category = body.heuristic_category || null;
      const description = body.description || null;
      const risk_level = body.risk_level || null;
      const reliability_score = body.reliability_score === undefined ? null : body.reliability_score;
      const enabled = body.enabled === false ? false : true;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!heuristic_name) {
        return send(res, 400, {
          error: "validation_error",
          message: "heuristic_name required"
        });
      }

      const heuristic_id =
        "00000000-0000-4018-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_heuristics (
          heuristic_id,
          tenant_id,
          heuristic_name,
          heuristic_category,
          description,
          risk_level,
          reliability_score,
          enabled,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        heuristic_id,
        tenant_id,
        heuristic_name,
        heuristic_category,
        description,
        risk_level,
        reliability_score,
        enabled,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: heuristic_id,
        event_type: "runtime.heuristic.created",
        message: JSON.stringify({
          heuristic_id,
          heuristic_name,
          heuristic_category,
          risk_level,
          reliability_score,
          enabled
        })
      });

      return send(res, 201, {
        heuristic: {
          heuristic_id,
          tenant_id,
          heuristic_name,
          heuristic_category,
          description,
          risk_level,
          reliability_score,
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
          enabled,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/heuristics") {
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
          heuristic_id,
          tenant_id,
          heuristic_name,
          heuristic_category,
          description,
          risk_level,
          reliability_score,
          usage_count,
          success_count,
          failure_count,
          enabled,
          created_at,
          created_by
        FROM runtime_heuristics
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        heuristics: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/heuristic-triggers") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const heuristic_id = body.heuristic_id;
      const related_object_type = body.related_object_type || null;
      const related_object_id = body.related_object_id || null;
      const trigger_reason = body.trigger_reason || null;
      const generated_assumption = body.generated_assumption || null;
      const generated_hypothesis = body.generated_hypothesis || null;
      const confidence_score = body.confidence_score === undefined ? null : body.confidence_score;
      const status = body.status || "open";
      const triggered_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !heuristic_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and heuristic_id required"
        });
      }

      const heuristicResult = await db.query(`
        SELECT heuristic_id, heuristic_name, enabled
        FROM runtime_heuristics
        WHERE tenant_id = $1
          AND heuristic_id = $2
        LIMIT 1
      `, [
        tenant_id,
        heuristic_id
      ]);

      if (heuristicResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "heuristic not found"
        });
      }

      if (heuristicResult.rows[0].enabled !== true) {
        return send(res, 409, {
          error: "heuristic_disabled",
          message: "heuristic is disabled"
        });
      }

      const trigger_id =
        "00000000-0000-4019-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_heuristic_triggers (
          trigger_id,
          tenant_id,
          heuristic_id,
          related_object_type,
          related_object_id,
          trigger_reason,
          generated_assumption,
          generated_hypothesis,
          confidence_score,
          status,
          triggered_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        trigger_id,
        tenant_id,
        heuristic_id,
        related_object_type,
        related_object_id,
        trigger_reason,
        generated_assumption,
        generated_hypothesis,
        confidence_score,
        status,
        triggered_by
      ]);

      await db.query(`
        UPDATE runtime_heuristics
        SET usage_count = COALESCE(usage_count, 0) + 1
        WHERE tenant_id = $1
          AND heuristic_id = $2
      `, [
        tenant_id,
        heuristic_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: trigger_id,
        event_type: "runtime.heuristic_trigger.created",
        message: JSON.stringify({
          trigger_id,
          heuristic_id,
          heuristic_name: heuristicResult.rows[0].heuristic_name,
          related_object_type,
          related_object_id,
          confidence_score,
          status
        })
      });

      return send(res, 201, {
        heuristic_trigger: {
          trigger_id,
          tenant_id,
          heuristic_id,
          heuristic_name: heuristicResult.rows[0].heuristic_name,
          related_object_type,
          related_object_id,
          trigger_reason,
          generated_assumption,
          generated_hypothesis,
          confidence_score,
          status,
          triggered_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/heuristic-triggers") {
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
          t.trigger_id,
          t.tenant_id,
          t.heuristic_id,
          h.heuristic_name,
          h.heuristic_category,
          t.related_object_type,
          t.related_object_id,
          t.trigger_reason,
          t.generated_assumption,
          t.generated_hypothesis,
          t.confidence_score,
          t.status,
          t.triggered_at,
          t.triggered_by
        FROM runtime_heuristic_triggers t
        LEFT JOIN runtime_heuristics h
          ON h.heuristic_id = t.heuristic_id
        WHERE t.tenant_id = $1
        ORDER BY t.triggered_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        heuristic_triggers: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/heuristic-triggers/materialize") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const trigger_id = body.trigger_id;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !trigger_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and trigger_id required"
        });
      }

      const triggerResult = await db.query(`
        SELECT
          t.trigger_id,
          t.tenant_id,
          t.heuristic_id,
          h.heuristic_name,
          t.generated_assumption,
          t.generated_hypothesis,
          t.confidence_score,
          t.status
        FROM runtime_heuristic_triggers t
        LEFT JOIN runtime_heuristics h
          ON h.heuristic_id = t.heuristic_id
        WHERE t.tenant_id = $1
          AND t.trigger_id = $2
        LIMIT 1
      `, [
        tenant_id,
        trigger_id
      ]);

      if (triggerResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "heuristic trigger not found"
        });
      }

      const trigger = triggerResult.rows[0];

      if (trigger.status === "materialized") {
        return send(res, 409, {
          error: "already_materialized",
          message: "heuristic trigger already materialized"
        });
      }

      if (!trigger.generated_assumption || !trigger.generated_hypothesis) {
        return send(res, 400, {
          error: "validation_error",
          message: "generated_assumption and generated_hypothesis required"
        });
      }

      const assumption_id =
        "00000000-0000-4003-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_assumptions (
          assumption_id,
          tenant_id,
          assumption_text,
          confidence,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [
        assumption_id,
        tenant_id,
        "[Heuristic: " + trigger.heuristic_name + "] " + trigger.generated_assumption,
        trigger.confidence_score,
        "open",
        created_by
      ]);

      const hypothesis_id =
        "00000000-0000-4004-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_hypotheses (
          hypothesis_id,
          tenant_id,
          assumption_id,
          hypothesis_text,
          confidence,
          verification_status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        hypothesis_id,
        tenant_id,
        assumption_id,
        "[Heuristic: " + trigger.heuristic_name + "] " + trigger.generated_hypothesis,
        trigger.confidence_score,
        "unverified",
        created_by
      ]);

      await db.query(`
        UPDATE runtime_heuristic_triggers
        SET status = 'materialized'
        WHERE tenant_id = $1
          AND trigger_id = $2
      `, [
        tenant_id,
        trigger_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: trigger_id,
        event_type: "runtime.heuristic_trigger.materialized",
        message: JSON.stringify({
          trigger_id,
          heuristic_id: trigger.heuristic_id,
          heuristic_name: trigger.heuristic_name,
          assumption_id,
          hypothesis_id,
          confidence_score: trigger.confidence_score
        })
      });

      return send(res, 201, {
        materialized_heuristic_trigger: {
          trigger_id,
          tenant_id,
          heuristic_id: trigger.heuristic_id,
          heuristic_name: trigger.heuristic_name,
          assumption_id,
          hypothesis_id,
          confidence_score: trigger.confidence_score,
          status: "materialized",
          created_by
        }
      });
    }


    if (req.method === "POST" && path === "/runtime/heuristic-feedback") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const heuristic_id = body.heuristic_id;
      const trigger_id = body.trigger_id || null;
      const lesson_id = body.lesson_id || null;
      const outcome_correct = body.outcome_correct === undefined ? null : body.outcome_correct;
      const feedback_reason = body.feedback_reason || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !heuristic_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and heuristic_id required"
        });
      }

      if (outcome_correct === null) {
        return send(res, 400, {
          error: "validation_error",
          message: "outcome_correct required"
        });
      }

      const heuristicResult = await db.query(`
        SELECT
          heuristic_id,
          heuristic_name,
          reliability_score,
          success_count,
          failure_count
        FROM runtime_heuristics
        WHERE tenant_id = $1
          AND heuristic_id = $2
        LIMIT 1
      `, [
        tenant_id,
        heuristic_id
      ]);

      if (heuristicResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "heuristic not found"
        });
      }

      const heuristic = heuristicResult.rows[0];

      const reliability_before =
        Number(heuristic.reliability_score || 0);

      const success_count_before =
        Number(heuristic.success_count || 0);

      const failure_count_before =
        Number(heuristic.failure_count || 0);

      const success_count_after =
        outcome_correct === true
          ? success_count_before + 1
          : success_count_before;

      const failure_count_after =
        outcome_correct === false
          ? failure_count_before + 1
          : failure_count_before;

      const total =
        success_count_after + failure_count_after;

      let reliability_after =
        total > 0
          ? success_count_after / total
          : reliability_before;

      reliability_after =
        Math.round(reliability_after * 100) / 100;

      const feedback_id =
        "00000000-0000-4020-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_heuristic_feedback (
          feedback_id,
          tenant_id,
          heuristic_id,
          trigger_id,
          lesson_id,
          outcome_correct,
          reliability_before,
          reliability_after,
          feedback_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        feedback_id,
        tenant_id,
        heuristic_id,
        trigger_id,
        lesson_id,
        outcome_correct,
        reliability_before,
        reliability_after,
        feedback_reason,
        created_by
      ]);

      await db.query(`
        UPDATE runtime_heuristics
        SET
          success_count = $1,
          failure_count = $2,
          reliability_score = $3
        WHERE tenant_id = $4
          AND heuristic_id = $5
      `, [
        success_count_after,
        failure_count_after,
        reliability_after,
        tenant_id,
        heuristic_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: heuristic_id,
        event_type: "runtime.heuristic.feedback.recorded",
        message: JSON.stringify({
          feedback_id,
          heuristic_id,
          trigger_id,
          lesson_id,
          outcome_correct,
          reliability_before,
          reliability_after
        })
      });

      return send(res, 201, {
        heuristic_feedback: {
          feedback_id,
          tenant_id,
          heuristic_id,
          heuristic_name: heuristic.heuristic_name,
          trigger_id,
          lesson_id,
          outcome_correct,
          reliability_before,
          reliability_after,
          success_count_before,
          success_count_after,
          failure_count_before,
          failure_count_after,
          feedback_reason,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/heuristic-feedback") {
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
          f.feedback_id,
          f.tenant_id,
          f.heuristic_id,
          h.heuristic_name,
          f.trigger_id,
          f.lesson_id,
          f.outcome_correct,
          f.reliability_before,
          f.reliability_after,
          f.feedback_reason,
          f.created_at,
          f.created_by
        FROM runtime_heuristic_feedback f
        LEFT JOIN runtime_heuristics h
          ON h.heuristic_id = f.heuristic_id
        WHERE f.tenant_id = $1
        ORDER BY f.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        heuristic_feedback: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/patterns") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const pattern_name = body.pattern_name;
      const pattern_category = body.pattern_category || null;
      const description = body.description || null;
      const confidence_score = body.confidence_score === undefined ? null : body.confidence_score;
      const enabled = body.enabled === false ? false : true;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!pattern_name) {
        return send(res, 400, {
          error: "validation_error",
          message: "pattern_name required"
        });
      }

      const pattern_id =
        "00000000-0000-4021-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_patterns (
          pattern_id,
          tenant_id,
          pattern_name,
          pattern_category,
          description,
          confidence_score,
          enabled,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        pattern_id,
        tenant_id,
        pattern_name,
        pattern_category,
        description,
        confidence_score,
        enabled,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: pattern_id,
        event_type: "runtime.pattern.created",
        message: JSON.stringify({
          pattern_id,
          pattern_name,
          pattern_category,
          confidence_score,
          enabled
        })
      });

      return send(res, 201, {
        pattern: {
          pattern_id,
          tenant_id,
          pattern_name,
          pattern_category,
          description,
          occurrence_count: 0,
          success_count: 0,
          failure_count: 0,
          confidence_score,
          enabled,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/patterns") {
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
          pattern_id,
          tenant_id,
          pattern_name,
          pattern_category,
          description,
          occurrence_count,
          success_count,
          failure_count,
          confidence_score,
          enabled,
          created_at,
          created_by
        FROM runtime_patterns
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        patterns: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/pattern-matches") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const pattern_id = body.pattern_id;
      const related_object_type = body.related_object_type || null;
      const related_object_id = body.related_object_id || null;
      const heuristic_trigger_id = body.heuristic_trigger_id || null;
      const match_reason = body.match_reason || null;
      const match_confidence = body.match_confidence === undefined ? null : body.match_confidence;
      const status = body.status || "open";
      const matched_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !pattern_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and pattern_id required"
        });
      }

      const patternResult = await db.query(`
        SELECT pattern_id, pattern_name, enabled
        FROM runtime_patterns
        WHERE tenant_id = $1
          AND pattern_id = $2
        LIMIT 1
      `, [
        tenant_id,
        pattern_id
      ]);

      if (patternResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "pattern not found"
        });
      }

      if (patternResult.rows[0].enabled !== true) {
        return send(res, 409, {
          error: "pattern_disabled",
          message: "pattern is disabled"
        });
      }

      const match_id =
        "00000000-0000-4022-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_pattern_matches (
          match_id,
          tenant_id,
          pattern_id,
          related_object_type,
          related_object_id,
          heuristic_trigger_id,
          match_reason,
          match_confidence,
          status,
          matched_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        match_id,
        tenant_id,
        pattern_id,
        related_object_type,
        related_object_id,
        heuristic_trigger_id,
        match_reason,
        match_confidence,
        status,
        matched_by
      ]);

      await db.query(`
        UPDATE runtime_patterns
        SET occurrence_count = COALESCE(occurrence_count, 0) + 1
        WHERE tenant_id = $1
          AND pattern_id = $2
      `, [
        tenant_id,
        pattern_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: match_id,
        event_type: "runtime.pattern_match.created",
        message: JSON.stringify({
          match_id,
          pattern_id,
          pattern_name: patternResult.rows[0].pattern_name,
          related_object_type,
          related_object_id,
          heuristic_trigger_id,
          match_confidence,
          status
        })
      });

      return send(res, 201, {
        pattern_match: {
          match_id,
          tenant_id,
          pattern_id,
          pattern_name: patternResult.rows[0].pattern_name,
          related_object_type,
          related_object_id,
          heuristic_trigger_id,
          match_reason,
          match_confidence,
          status,
          matched_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/pattern-matches") {
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
          m.match_id,
          m.tenant_id,
          m.pattern_id,
          p.pattern_name,
          p.pattern_category,
          m.related_object_type,
          m.related_object_id,
          m.heuristic_trigger_id,
          h.heuristic_name,
          m.match_reason,
          m.match_confidence,
          m.status,
          m.matched_at,
          m.matched_by
        FROM runtime_pattern_matches m
        LEFT JOIN runtime_patterns p
          ON p.pattern_id = m.pattern_id
        LEFT JOIN runtime_heuristic_triggers ht
          ON ht.trigger_id = m.heuristic_trigger_id
        LEFT JOIN runtime_heuristics h
          ON h.heuristic_id = ht.heuristic_id
        WHERE m.tenant_id = $1
        ORDER BY m.matched_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        pattern_matches: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/pattern-feedback") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const pattern_id = body.pattern_id;
      const match_id = body.match_id || null;
      const lesson_id = body.lesson_id || null;
      const outcome_correct = body.outcome_correct === undefined ? null : body.outcome_correct;
      const feedback_reason = body.feedback_reason || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !pattern_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and pattern_id required"
        });
      }

      if (outcome_correct === null) {
        return send(res, 400, {
          error: "validation_error",
          message: "outcome_correct required"
        });
      }

      const patternResult = await db.query(`
        SELECT
          pattern_id,
          pattern_name,
          confidence_score,
          success_count,
          failure_count
        FROM runtime_patterns
        WHERE tenant_id = $1
          AND pattern_id = $2
        LIMIT 1
      `, [
        tenant_id,
        pattern_id
      ]);

      if (patternResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "pattern not found"
        });
      }

      const pattern = patternResult.rows[0];

      const confidence_before =
        Number(pattern.confidence_score || 0);

      const success_count_before =
        Number(pattern.success_count || 0);

      const failure_count_before =
        Number(pattern.failure_count || 0);

      const success_count_after =
        outcome_correct === true
          ? success_count_before + 1
          : success_count_before;

      const failure_count_after =
        outcome_correct === false
          ? failure_count_before + 1
          : failure_count_before;

      const total =
        success_count_after + failure_count_after;

      let confidence_after =
        total > 0
          ? success_count_after / total
          : confidence_before;

      confidence_after =
        Math.round(confidence_after * 100) / 100;

      const feedback_id =
        "00000000-0000-4023-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_pattern_feedback (
          feedback_id,
          tenant_id,
          pattern_id,
          match_id,
          lesson_id,
          outcome_correct,
          confidence_before,
          confidence_after,
          feedback_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        feedback_id,
        tenant_id,
        pattern_id,
        match_id,
        lesson_id,
        outcome_correct,
        confidence_before,
        confidence_after,
        feedback_reason,
        created_by
      ]);

      await db.query(`
        UPDATE runtime_patterns
        SET
          success_count = $1,
          failure_count = $2,
          confidence_score = $3
        WHERE tenant_id = $4
          AND pattern_id = $5
      `, [
        success_count_after,
        failure_count_after,
        confidence_after,
        tenant_id,
        pattern_id
      ]);

      await writeEvent({
        tenant_id,
        object_id: pattern_id,
        event_type: "runtime.pattern.feedback.recorded",
        message: JSON.stringify({
          feedback_id,
          pattern_id,
          match_id,
          lesson_id,
          outcome_correct,
          confidence_before,
          confidence_after
        })
      });

      return send(res, 201, {
        pattern_feedback: {
          feedback_id,
          tenant_id,
          pattern_id,
          pattern_name: pattern.pattern_name,
          match_id,
          lesson_id,
          outcome_correct,
          confidence_before,
          confidence_after,
          success_count_before,
          success_count_after,
          failure_count_before,
          failure_count_after,
          feedback_reason,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/pattern-feedback") {
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
          f.feedback_id,
          f.tenant_id,
          f.pattern_id,
          p.pattern_name,
          f.match_id,
          f.lesson_id,
          f.outcome_correct,
          f.confidence_before,
          f.confidence_after,
          f.feedback_reason,
          f.created_at,
          f.created_by
        FROM runtime_pattern_feedback f
        LEFT JOIN runtime_patterns p
          ON p.pattern_id = f.pattern_id
        WHERE f.tenant_id = $1
        ORDER BY f.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        pattern_feedback: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/cross-loop-validations") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;
      const heuristic_id = body.heuristic_id || null;
      const pattern_id = body.pattern_id || null;
      const trigger_id = body.trigger_id || null;
      const match_id = body.match_id || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const factResult = await db.query(`
        SELECT
          f.fact_id,
          f.verification_result_id,
          vr.confidence AS verification_confidence,
          vr.accepted_as_fact
        FROM runtime_facts f
        LEFT JOIN runtime_verification_results vr
          ON vr.result_id = f.verification_result_id
        WHERE f.tenant_id = $1
          AND f.fact_id = $2
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (factResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "fact not found"
        });
      }

      const fact = factResult.rows[0];

      const qualityResult = await db.query(`
        SELECT AVG(rating)::numeric(5,2) AS avg_rating
        FROM runtime_source_quality
        WHERE tenant_id = $1
      `, [
        tenant_id
      ]);

      const heuristicResult = heuristic_id
        ? await db.query(`
            SELECT reliability_score
            FROM runtime_heuristics
            WHERE tenant_id = $1
              AND heuristic_id = $2
            LIMIT 1
          `, [tenant_id, heuristic_id])
        : { rows: [] };

      const patternResult = pattern_id
        ? await db.query(`
            SELECT confidence_score
            FROM runtime_patterns
            WHERE tenant_id = $1
              AND pattern_id = $2
            LIMIT 1
          `, [tenant_id, pattern_id])
        : { rows: [] };

      const unknownResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_unknowns
        WHERE tenant_id = $1
          AND related_object_type = 'fact'
          AND related_object_id = $2
          AND status = 'open'
      `, [
        tenant_id,
        fact_id
      ]);

      const conflictResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_source_conflicts
        WHERE tenant_id = $1
          AND status = 'open'
      `, [
        tenant_id
      ]);

      const verification_confidence =
        Number(fact.verification_confidence || 0);

      const source_quality =
        Number(qualityResult.rows[0].avg_rating || 0);

      const heuristic_reliability =
        heuristicResult.rows.length
          ? Number(heuristicResult.rows[0].reliability_score || 0)
          : 0;

      const pattern_confidence =
        patternResult.rows.length
          ? Number(patternResult.rows[0].confidence_score || 0)
          : 0;

      const open_unknowns =
        Number(unknownResult.rows[0].count || 0);

      const open_conflicts =
        Number(conflictResult.rows[0].count || 0);

      const unknown_penalty =
        Math.min(0.50, open_unknowns * 0.10);

      const conflict_penalty =
        Math.min(0.50, open_conflicts * 0.15);

      let cross_loop_trust =
        (verification_confidence * 0.40) +
        (source_quality * 0.20) +
        (heuristic_reliability * 0.20) +
        (pattern_confidence * 0.20) -
        unknown_penalty -
        conflict_penalty;

      cross_loop_trust =
        Math.max(0, Math.min(1, cross_loop_trust));

      cross_loop_trust =
        Math.round(cross_loop_trust * 100) / 100;

      const veryHighGates =
        fact.accepted_as_fact === true &&
        verification_confidence >= 0.90 &&
        source_quality >= 0.80 &&
        heuristic_reliability >= 0.85 &&
        pattern_confidence >= 0.85 &&
        open_unknowns === 0 &&
        open_conflicts === 0;

      let trust_level = "VERY_LOW";

      if (cross_loop_trust >= 0.90 && veryHighGates) {
        trust_level = "VERY_HIGH";
      } else if (cross_loop_trust >= 0.75) {
        trust_level = "HIGH";
      } else if (cross_loop_trust >= 0.50) {
        trust_level = "MEDIUM";
      } else if (cross_loop_trust >= 0.25) {
        trust_level = "LOW";
      }

      let governance_recommendation = "quarantine";
      let human_approval_required = true;

      if (trust_level === "VERY_HIGH") {
        governance_recommendation = "auto_approve";
        human_approval_required = false;
      } else if (trust_level === "HIGH") {
        governance_recommendation = "approve";
        human_approval_required = false;
      } else if (trust_level === "MEDIUM") {
        governance_recommendation = "four_eyes_required";
        human_approval_required = true;
      } else if (trust_level === "LOW") {
        governance_recommendation = "investigate";
        human_approval_required = true;
      }

      const validation_id =
        "00000000-0000-4024-8000-" +
        crypto.randomBytes(6).toString("hex");

      const calculation_details = {
        formula: "verification*0.40 + source_quality*0.20 + heuristic_reliability*0.20 + pattern_confidence*0.20 - unknown_penalty - conflict_penalty",
        accepted_as_fact: fact.accepted_as_fact === true,
        verification_confidence,
        source_quality,
        heuristic_reliability,
        pattern_confidence,
        open_unknowns,
        open_conflicts,
        unknown_penalty,
        conflict_penalty,
        very_high_gates_passed: veryHighGates,
        cross_loop_trust,
        trust_level,
        governance_recommendation,
        human_approval_required
      };

      await db.query(`
        INSERT INTO runtime_cross_loop_validations (
          validation_id,
          tenant_id,
          fact_id,
          heuristic_id,
          pattern_id,
          trigger_id,
          match_id,
          verification_confidence,
          source_quality,
          heuristic_reliability,
          pattern_confidence,
          open_unknowns,
          open_conflicts,
          cross_loop_trust,
          trust_level,
          governance_recommendation,
          human_approval_required,
          calculation_details,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      `, [
        validation_id,
        tenant_id,
        fact_id,
        heuristic_id,
        pattern_id,
        trigger_id,
        match_id,
        verification_confidence,
        source_quality,
        heuristic_reliability,
        pattern_confidence,
        open_unknowns,
        open_conflicts,
        cross_loop_trust,
        trust_level,
        governance_recommendation,
        human_approval_required,
        JSON.stringify(calculation_details),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.cross_loop_validation.completed",
        message: JSON.stringify({
          validation_id,
          fact_id,
          heuristic_id,
          pattern_id,
          cross_loop_trust,
          trust_level,
          governance_recommendation,
          human_approval_required
        })
      });

      return send(res, 201, {
        cross_loop_validation: {
          validation_id,
          tenant_id,
          fact_id,
          heuristic_id,
          pattern_id,
          trigger_id,
          match_id,
          cross_loop_trust,
          trust_level,
          governance_recommendation,
          human_approval_required,
          calculation_details,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/cross-loop-validations") {
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
          validation_id,
          tenant_id,
          fact_id,
          heuristic_id,
          pattern_id,
          trigger_id,
          match_id,
          verification_confidence,
          source_quality,
          heuristic_reliability,
          pattern_confidence,
          open_unknowns,
          open_conflicts,
          cross_loop_trust,
          trust_level,
          governance_recommendation,
          human_approval_required,
          calculation_details,
          created_at,
          created_by
        FROM runtime_cross_loop_validations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        cross_loop_validations: result.rows
      });
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

    // COMPLETE RUNTIME TRAINING PLAN

    if (req.method === "POST" && path.startsWith("/runtime/training-plans/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const training_plan_id = decodeURIComponent(
        path.replace("/runtime/training-plans/complete/", "")
      );

      if (!training_plan_id) {
        return send(res, 400, {
          error: "missing_training_plan_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_training_plans
        WHERE tenant_id = $1
          AND training_plan_id = $2
        LIMIT 1
      `, [
        tenant_id,
        training_plan_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "training_plan_not_found",
          training_plan_id
        });
      }

      const trainingPlan = existingResult.rows[0];

      if (trainingPlan.status === "completed") {
        return send(res, 409, {
          error: "training_plan_already_completed",
          training_plan_id,
          current_status: trainingPlan.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_training_plans
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND training_plan_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        training_plan_id
      ]);

      const completedTrainingPlan = updateResult.rows[0];

      const beforeCompetencyResult = await db.query(`
        SELECT
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap
        FROM runtime_competencies
        WHERE tenant_id = $1
          AND person_id = $2
          AND competency_name = $3
        LIMIT 1
      `, [
        tenant_id,
        completedTrainingPlan.person_id,
        completedTrainingPlan.competency_name
      ]);

      const beforeCompetency =
        beforeCompetencyResult.rows.length > 0
          ? beforeCompetencyResult.rows[0]
          : null;

      const competencyUpdateResult = await db.query(`
        UPDATE runtime_competencies
        SET
          actual_level = LEAST(required_level, actual_level + 1),
          gap = GREATEST(required_level - LEAST(required_level, actual_level + 1), 0),
          updated_by = $1,
          updated_at = now()
        WHERE tenant_id = $2
          AND person_id = $3
          AND competency_name = $4
        RETURNING
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap,
          updated_by,
          updated_at
      `, [
        completed_by,
        tenant_id,
        completedTrainingPlan.person_id,
        completedTrainingPlan.competency_name
      ]);

      const updatedCompetency =
        competencyUpdateResult.rows.length > 0
          ? competencyUpdateResult.rows[0]
          : null;

      let learningEvidence = null;

      if (updatedCompetency) {
        const gapBefore = beforeCompetency ? Number(beforeCompetency.gap || 0) : Number(updatedCompetency.gap || 0);
        const gapAfter = Number(updatedCompetency.gap || 0);

        let effectiveness = "neutral";

        if (gapAfter < gapBefore) {
          effectiveness = "positive";
        } else if (gapAfter > gapBefore) {
          effectiveness = "negative";
        }

        const evidence_id =
          "evd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        await db.query(`
          INSERT INTO runtime_learning_evidence (
            evidence_id,
            tenant_id,
            person_id,
            competency_name,
            training_plan_id,
            gap_before,
            gap_after,
            effectiveness,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          evidence_id,
          tenant_id,
          updatedCompetency.person_id,
          updatedCompetency.competency_name,
          completedTrainingPlan.training_plan_id,
          gapBefore,
          gapAfter,
          effectiveness,
          completed_by
        ]);

        learningEvidence = {
          evidence_id,
          person_id: updatedCompetency.person_id,
          competency_name: updatedCompetency.competency_name,
          training_plan_id: completedTrainingPlan.training_plan_id,
          gap_before: gapBefore,
          gap_after: gapAfter,
          effectiveness
        };

        await writeEvent({
          tenant_id,
          object_id: completedTrainingPlan.person_id,
          event_type: "runtime.competency.improved",
          message: `Competency improved: ${updatedCompetency.competency_name}`
        });

        await writeEvent({
          tenant_id,
          object_id: completedTrainingPlan.person_id,
          event_type: "runtime.learning.evidence.created",
          message: `Learning evidence created: ${effectiveness}`
        });
      }

      const completedTrainingEventType = "runtime.training.completed";

      await writeEvent({
        tenant_id,
        object_id: completedTrainingPlan.person_id,
        event_type: completedTrainingEventType,
        message: `Training completed: ${completedTrainingPlan.competency_name}`
      });

      const autoOrchestrations = [];

      const orchestrationRuleResult = await db.query(`
        SELECT
          rule_id,
          rule_name,
          orchestration_type,
          payload_template
        FROM runtime_orchestration_rules
        WHERE tenant_id = $1
          AND source_event_type = $2
          AND enabled = true
        ORDER BY rule_name ASC
      `, [
        tenant_id,
        completedTrainingEventType
      ]);

      for (const rule of orchestrationRuleResult.rows) {
        const orchestration_id =
          "orch-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        const payload = {
          ...(rule.payload_template || {}),
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          competency_name: completedTrainingPlan.competency_name,
          training_plan_id: completedTrainingPlan.training_plan_id,
          learning_evidence_id: learningEvidence ? learningEvidence.evidence_id : null
        };

        await db.query(`
          INSERT INTO runtime_orchestrations (
            orchestration_id,
            tenant_id,
            source_event_type,
            source_object_id,
            orchestration_type,
            status,
            payload,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
        `, [
          orchestration_id,
          tenant_id,
          completedTrainingEventType,
          completedTrainingPlan.person_id,
          rule.orchestration_type,
          JSON.stringify(payload),
          completed_by
        ]);

        autoOrchestrations.push({
          orchestration_id,
          source_event_type: completedTrainingEventType,
          source_object_id: completedTrainingPlan.person_id,
          orchestration_type: rule.orchestration_type,
          status: "pending",
          payload
        });

        await writeEvent({
          tenant_id,
          object_id: completedTrainingPlan.person_id,
          event_type: "runtime.orchestration.auto_created",
          message: `Auto orchestration created: ${rule.orchestration_type}`
        });
      }

      return send(res, 200, {
        completed: true,
        training_plan: completedTrainingPlan,
        competency_updated: updatedCompetency !== null,
        competency: updatedCompetency,
        learning_evidence_created: learningEvidence !== null,
        learning_evidence: learningEvidence,
        auto_orchestrations_created: autoOrchestrations.length,
        auto_orchestrations: autoOrchestrations
      });
    }





    // ACKNOWLEDGE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/ack/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/ack/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "sent") {
        return send(res, 409, {
          error: "communication_event_not_sent",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const acknowledged_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        acknowledged_by,
        tenant_id,
        communication_event_id
      ]);

      const acknowledgedCommunication = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: acknowledgedCommunication.receiver_id,
        event_type: "runtime.communication.acknowledged",
        message: `Communication acknowledged: ${acknowledgedCommunication.message_type}`
      });

      return send(res, 200, {
        acknowledged: true,
        communication: acknowledgedCommunication
      });
    }





    // CREATE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path === "/runtime/orchestrations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const source_event_type = body.source_event_type;
      const source_object_id = body.source_object_id || null;
      const orchestration_type = body.orchestration_type;
      const payload = body.payload || {};

      if (!source_event_type || !orchestration_type) {
        return send(res, 400, {
          error: "missing_required_orchestration_fields"
        });
      }

      const orchestration_id =
        "orch-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_orchestrations (
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
      `, [
        orchestration_id,
        tenant_id,
        source_event_type,
        source_object_id,
        orchestration_type,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_object_id,
        event_type: "runtime.orchestration.created",
        message: `Orchestration created: ${orchestration_type}`
      });

      return send(res, 200, {
        created: true,
        orchestration: {
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status: "pending",
          payload,
          created_by
        }
      });
    }



    // APPROVE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/approve/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/approve/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "pending") {
        return send(res, 409, {
          error: "orchestration_not_pending",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const approved_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        approved_by,
        tenant_id,
        orchestration_id
      ]);

      const approvedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: approvedOrchestration.source_object_id,
        event_type: "runtime.orchestration.approved",
        message: `Orchestration approved: ${approvedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        approved: true,
        orchestration: approvedOrchestration
      });
    }


    // EXECUTE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/execute/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/execute/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "approved") {
        return send(res, 409, {
          error: "orchestration_not_approved",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const executed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'executed',
          executed_by = $1,
          executed_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        executed_by,
        tenant_id,
        orchestration_id
      ]);

      const executedOrchestration = updateResult.rows[0];

      let recommendationRefreshJob = null;

      if (executedOrchestration.orchestration_type === "LEARNING_RESPONSE") {
        const refresh_job_id =
          "job-" + Date.now();

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
          refresh_job_id,
          tenant_id,
          executedOrchestration.source_object_id,
          executed_by,
          "orchestration.LEARNING_RESPONSE.refresh_recommendations",
          JSON.stringify({
            orchestration_id: executedOrchestration.orchestration_id,
            orchestration_type: executedOrchestration.orchestration_type,
            source_event_type: executedOrchestration.source_event_type,
            source_object_id: executedOrchestration.source_object_id,
            payload: executedOrchestration.payload
          }),
          100,
          refresh_job_id
        ]);

        recommendationRefreshJob = {
          job_id: refresh_job_id,
          object_id: executedOrchestration.source_object_id,
          execution_type: "orchestration.LEARNING_RESPONSE.refresh_recommendations",
          status: "pending"
        };

        await writeEvent({
          tenant_id,
          object_id: executedOrchestration.source_object_id,
          event_type: "runtime.orchestration.recommendation_refresh_requested",
          message: "Recommendation refresh requested by orchestration"
        });
      }

      await writeEvent({
        tenant_id,
        object_id: executedOrchestration.source_object_id,
        event_type: "runtime.orchestration.executed",
        message: `Orchestration executed: ${executedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        executed: true,
        orchestration: executedOrchestration,
        recommendation_refresh_requested: recommendationRefreshJob !== null,
        recommendation_refresh_job: recommendationRefreshJob
      });
    }


    // COMPLETE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/complete/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "executed") {
        return send(res, 409, {
          error: "orchestration_not_executed",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        orchestration_id
      ]);

      const completedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: completedOrchestration.source_object_id,
        event_type: "runtime.orchestration.completed",
        message: `Orchestration completed: ${completedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        completed: true,
        orchestration: completedOrchestration
      });
    }


    // GET ORCHESTRATION RULES

    if (req.method === "GET" && path === "/runtime/orchestration-rules") {

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

      const result = await db.query(`
        SELECT
          rule_id,
          tenant_id,
          rule_name,
          source_event_type,
          orchestration_type,
          enabled,
          payload_template,
          created_by,
          created_at
        FROM runtime_orchestration_rules
        WHERE tenant_id = $1
        ORDER BY rule_name ASC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        rule_count: result.rows.length,
        enabled_count: result.rows.filter(r => r.enabled).length,
        disabled_count: result.rows.filter(r => !r.enabled).length,
        rules: result.rows
      });
    }


    // GET ORCHESTRATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/orchestrations/") && path.endsWith("/trace")) {

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

      const orchestration_id = decodeURIComponent(
        path
          .replace("/runtime/orchestrations/", "")
          .replace("/trace", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const orchestrationResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (orchestrationResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = orchestrationResult.rows[0];

      const payload = orchestration.payload || {};
      const rule_id = payload.rule_id || null;

      let rule = null;

      if (rule_id) {
        const ruleResult = await db.query(`
          SELECT *
          FROM runtime_orchestration_rules
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
            object_id = $2
            OR payload::text LIKE $3
          )
        ORDER BY created_at DESC
      `, [
        tenant_id,
        orchestration.source_object_id,
        `%${orchestration_id}%`
      ]);

      const recommendationsResult = await db.query(`
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
        ORDER BY created_at DESC
      `, [
        tenant_id,
        orchestration.source_object_id
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
            event_type LIKE 'runtime.orchestration.%'
            OR event_type LIKE 'runtime.recommendations.%'
            OR event_type LIKE 'runtime.training.%'
            OR event_type LIKE 'runtime.learning.%'
          )
        ORDER BY created_at ASC
      `, [
        tenant_id,
        orchestration.source_object_id
      ]);

      return send(res, 200, {
        tenant_id,
        orchestration_id,
        source_object_id: orchestration.source_object_id,
        orchestration,
        rule,
        jobs: {
          job_count: jobsResult.rows.length,
          items: jobsResult.rows
        },
        recommendations: {
          recommendation_count: recommendationsResult.rows.length,
          items: recommendationsResult.rows
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // GET RUNTIME ORCHESTRATIONS

    if (req.method === "GET" && path === "/runtime/orchestrations") {

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

      const result = await db.query(`
        SELECT
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_by,
          executed_at,
          completed_by,
          completed_at
        FROM runtime_orchestrations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        orchestration_count: result.rows.length,
        pending_count: result.rows.filter(row => row.status === "pending").length,
        approved_count: result.rows.filter(row => row.status === "approved").length,
        executed_count: result.rows.filter(row => row.status === "executed").length,
        completed_count: result.rows.filter(row => row.status === "completed").length,
        cancelled_count: result.rows.filter(row => row.status === "cancelled").length,
        orchestrations: result.rows
      });
    }

    // GET COMMUNICATION SUMMARY BY RECEIVER

    if (req.method === "GET" && path.startsWith("/runtime/communication-summary/")) {

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

      const receiver_id = decodeURIComponent(
        path.replace("/runtime/communication-summary/", "")
      );

      if (!receiver_id) {
        return send(res, 400, {
          error: "missing_receiver_id"
        });
      }

      const result = await db.query(`
        SELECT
          communication_evidence_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by,
          created_at
        FROM runtime_communication_evidence
        WHERE tenant_id = $1
          AND receiver_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        receiver_id
      ]);

      const evidence_count = result.rows.length;
      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const avg = (values) => {
        const usable = values.filter(value => value !== null && value !== undefined);
        if (usable.length === 0) return null;
        return Math.round(
          usable.reduce((sum, value) => sum + Number(value || 0), 0) / usable.length
        );
      };

      const average_ack_latency_seconds = avg(
        result.rows.map(row => row.ack_latency_seconds)
      );

      const average_completion_latency_seconds = avg(
        result.rows.map(row => row.completion_latency_seconds)
      );

      const effectiveness_score =
        evidence_count > 0
          ? Math.round((positive_count / evidence_count) * 1000) / 10
          : 0;

      const byMessageType = {};

      for (const row of result.rows) {
        if (!byMessageType[row.message_type]) {
          byMessageType[row.message_type] = {
            message_type: row.message_type,
            evidence_count: 0,
            positive_count: 0,
            neutral_count: 0,
            negative_count: 0,
            average_ack_latency_seconds: null,
            average_completion_latency_seconds: null,
            _ack_values: [],
            _completion_values: []
          };
        }

        const entry = byMessageType[row.message_type];

        entry.evidence_count += 1;

        if (row.effectiveness === "positive") entry.positive_count += 1;
        if (row.effectiveness === "neutral") entry.neutral_count += 1;
        if (row.effectiveness === "negative") entry.negative_count += 1;

        if (row.ack_latency_seconds !== null && row.ack_latency_seconds !== undefined) {
          entry._ack_values.push(row.ack_latency_seconds);
        }

        if (row.completion_latency_seconds !== null && row.completion_latency_seconds !== undefined) {
          entry._completion_values.push(row.completion_latency_seconds);
        }
      }

      for (const entry of Object.values(byMessageType)) {
        entry.average_ack_latency_seconds = avg(entry._ack_values);
        entry.average_completion_latency_seconds = avg(entry._completion_values);
        delete entry._ack_values;
        delete entry._completion_values;
      }

      return send(res, 200, {
        tenant_id,
        receiver_id,
        evidence_count,
        positive_count,
        neutral_count,
        negative_count,
        effectiveness_score,
        average_ack_latency_seconds,
        average_completion_latency_seconds,
        by_message_type: Object.values(byMessageType),
        evidence: result.rows
      });
    }

    // GET COMMUNICATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/communications/")) {

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

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const communicationResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (communicationResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communication = communicationResult.rows[0];

      const auditResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          created_at,
          audit_hash,
          previous_hash
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
          AND event_type LIKE 'runtime.communication.%'
        ORDER BY created_at DESC
      `, [
        tenant_id,
        communication.receiver_id
      ]);

      const createdAt = communication.created_at ? new Date(communication.created_at).getTime() : null;
      const acknowledgedAt = communication.acknowledged_at ? new Date(communication.acknowledged_at).getTime() : null;
      const completedAt = communication.completed_at ? new Date(communication.completed_at).getTime() : null;

      const ack_latency_seconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completion_latency_seconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      return send(res, 200, {
        tenant_id,
        communication_event_id,
        status: communication.status,
        sender_id: communication.sender_id,
        receiver_id: communication.receiver_id,
        direction: communication.direction,
        message_type: communication.message_type,
        subject: communication.subject,
        payload: communication.payload,
        tx: {
          sent: true,
          sent_by: communication.created_by,
          sent_at: communication.created_at
        },
        ack: {
          acknowledged: communication.acknowledged_at !== null,
          acknowledged_by: communication.acknowledged_by,
          acknowledged_at: communication.acknowledged_at,
          ack_latency_seconds
        },
        result: {
          completed: communication.completed_at !== null,
          completed_by: communication.completed_by,
          completed_at: communication.completed_at,
          completion_latency_seconds
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // COMPLETE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/complete/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "acknowledged") {
        return send(res, 409, {
          error: "communication_event_not_acknowledged",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        communication_event_id
      ]);

      const completedCommunication = updateResult.rows[0];

      const createdAt = completedCommunication.created_at ? new Date(completedCommunication.created_at).getTime() : null;
      const acknowledgedAt = completedCommunication.acknowledged_at ? new Date(completedCommunication.acknowledged_at).getTime() : null;
      const completedAt = completedCommunication.completed_at ? new Date(completedCommunication.completed_at).getTime() : null;

      const ackLatencySeconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completionLatencySeconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      const communicationEffectiveness = "positive";

      const communication_evidence_id =
        "cev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      await db.query(`
        INSERT INTO runtime_communication_evidence (
          communication_evidence_id,
          tenant_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        communication_evidence_id,
        tenant_id,
        completedCommunication.communication_event_id,
        completedCommunication.sender_id,
        completedCommunication.receiver_id,
        completedCommunication.message_type,
        ackLatencySeconds,
        completionLatencySeconds,
        communicationEffectiveness,
        completed_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.evidence.created",
        message: `Communication evidence created: ${communicationEffectiveness}`
      });

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.completed",
        message: `Communication completed: ${completedCommunication.message_type}`
      });

      return send(res, 200, {
        completed: true,
        communication: completedCommunication,
        communication_evidence_created: true,
        communication_evidence: {
          communication_evidence_id,
          communication_event_id: completedCommunication.communication_event_id,
          sender_id: completedCommunication.sender_id,
          receiver_id: completedCommunication.receiver_id,
          message_type: completedCommunication.message_type,
          ack_latency_seconds: ackLatencySeconds,
          completion_latency_seconds: completionLatencySeconds,
          effectiveness: communicationEffectiveness
        }
      });
    }

    // SEND COMMUNICATION EVENT

    if (req.method === "POST" && path === "/runtime/communications/send") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const sender_id = body.sender_id;
      const receiver_id = body.receiver_id;
      const direction = body.direction || "TX";
      const message_type = body.message_type || "MESSAGE";
      const subject = body.subject || null;
      const payload = body.payload || {};

      if (!sender_id || !receiver_id) {
        return send(res, 400, {
          error: "missing_sender_or_receiver"
        });
      }

      const communication_event_id =
        "com-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_communication_events (
          communication_event_id,
          tenant_id,
          sender_id,
          receiver_id,
          direction,
          message_type,
          subject,
          payload,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',$9)
      `, [
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: receiver_id,
        event_type: "runtime.communication.sent",
        message: `Communication sent: ${message_type}`
      });

      return send(res, 200, {
        sent: true,
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        status: "sent"
      });
    }

    // GET RUNTIME LEARNING SUMMARY BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/learning-summary/")) {

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

      const person_id = decodeURIComponent(
        path.replace("/runtime/learning-summary/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          competency_name,
          effectiveness,
          gap_before,
          gap_after,
          created_at
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        person_id
      ]);

      const evidence_count = result.rows.length;
      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const total_gap_reduction = result.rows.reduce(
        (sum, row) => sum + Math.max(Number(row.gap_before || 0) - Number(row.gap_after || 0), 0),
        0
      );

      const effectiveness_score =
        evidence_count > 0
          ? Math.round((positive_count / evidence_count) * 1000) / 10
          : 0;

      const byCompetency = {};

      for (const row of result.rows) {
        if (!byCompetency[row.competency_name]) {
          byCompetency[row.competency_name] = {
            competency_name: row.competency_name,
            evidence_count: 0,
            positive_count: 0,
            neutral_count: 0,
            negative_count: 0,
            gap_reduction: 0
          };
        }

        const entry = byCompetency[row.competency_name];

        entry.evidence_count += 1;

        if (row.effectiveness === "positive") entry.positive_count += 1;
        if (row.effectiveness === "neutral") entry.neutral_count += 1;
        if (row.effectiveness === "negative") entry.negative_count += 1;

        entry.gap_reduction += Math.max(
          Number(row.gap_before || 0) - Number(row.gap_after || 0),
          0
        );
      }

      return send(res, 200, {
        tenant_id,
        person_id,
        evidence_count,
        positive_count,
        neutral_count,
        negative_count,
        total_gap_reduction,
        effectiveness_score,
        competencies: Object.values(byCompetency)
      });
    }

    // GET RUNTIME LEARNING EVIDENCE BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/learning-evidence/")) {

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

      const person_id = decodeURIComponent(
        path.replace("/runtime/learning-evidence/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
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
        person_id
      ]);

      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const total_gap_reduction = result.rows.reduce(
        (sum, row) => sum + Math.max(Number(row.gap_before || 0) - Number(row.gap_after || 0), 0),
        0
      );

      return send(res, 200, {
        tenant_id,
        person_id,
        evidence_count: result.rows.length,
        positive_count,
        neutral_count,
        negative_count,
        total_gap_reduction,
        evidence: result.rows
      });
    }

    // GET RUNTIME TRAINING PLANS BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/training-plans/")) {

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

      const person_id = decodeURIComponent(
        path.replace("/runtime/training-plans/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
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
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        person_id
      ]);

      const planned_count = result.rows.filter(row => row.status === "planned").length;
      const approved_count = result.rows.filter(row => row.status === "approved").length;
      const completed_count = result.rows.filter(row => row.status === "completed").length;

      const total_estimated_minutes = result.rows.reduce(
        (sum, row) => sum + Number(row.estimated_duration_minutes || 0),
        0
      );

      return send(res, 200, {
        tenant_id,
        person_id,
        training_plan_count: result.rows.length,
        planned_count,
        approved_count,
        completed_count,
        total_estimated_minutes,
        training_plans: result.rows
      });
    }

    // GET RUNTIME COMPETENCIES BY PERSON

    // RSOS-049B Competency Gap Summary
    if (req.method === "GET" && path === "/runtime/competencies/gaps") {
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
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap,
          created_at,
          updated_at
        FROM runtime_competencies
        WHERE tenant_id = $1
        ORDER BY gap DESC, competency_name ASC
      `, [tenant_id]);

      const summaryResult = await db.query(`
        SELECT
          COUNT(*)::int AS competency_count,
          COALESCE(SUM(gap), 0)::int AS total_gap,
          COALESCE(MAX(gap), 0)::int AS max_gap,
          COUNT(*) FILTER (WHERE gap > 0)::int AS open_gap_count,
          COUNT(*) FILTER (WHERE gap >= 3)::int AS critical_gap_count
        FROM runtime_competencies
        WHERE tenant_id = $1
      `, [tenant_id]);

      return send(res, 200, {
        tenant_id,
        summary: summaryResult.rows[0],
        gaps: result.rows
      });
    }

    if (req.method === "GET" && path.startsWith("/runtime/competencies/")) {

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

      const person_id = decodeURIComponent(
        path.replace("/runtime/competencies/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_competencies
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY gap DESC, competency_name ASC
      `, [
        tenant_id,
        person_id
      ]);

      const max_gap = result.rows.reduce(
        (max, row) => Math.max(max, Number(row.gap || 0)),
        0
      );

      const open_gap_count = result.rows.filter(row => Number(row.gap || 0) > 0).length;

      return send(res, 200, {
        tenant_id,
        person_id,
        competency_count: result.rows.length,
        open_gap_count,
        max_gap,
        competencies: result.rows
      });
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


    // RSOS-076D Learning Runtime API - Create Learning State
    if (req.method === "POST" && path === "/runtime/learning/states") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      if (!body.subject_id || !body.knowledge_id || !body.learning_stage) {
        return send(res, 400, {
          error: "missing_required_learning_state_fields",
          required: ["subject_id","knowledge_id","learning_stage"]
        });
      }

      const learning_state_id =
        body.learning_state_id ||
        "11111111-1111-4111-8111-" + Date.now().toString().slice(-12);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const result = await db.query(`
        INSERT INTO runtime_learning_states (
          learning_state_id,
          tenant_id,
          subject_id,
          knowledge_id,
          learning_stage,
          progress_percent,
          confidence_score,
          started_at,
          updated_at,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,NOW()),NOW(),$9)
        RETURNING *
      `, [
        learning_state_id,
        tenant_id,
        body.subject_id,
        body.knowledge_id,
        body.learning_stage,
        body.progress_percent || 0,
        body.confidence_score || 0,
        body.started_at || null,
        created_by
      ]);

      await writeEvent({
        event_type: "runtime.learning.state.created",
        object_id: learning_state_id,
        tenant_id,
        message: "Learning state created: " + body.learning_stage
      });

      return send(res, 200, {
        created: true,
        learning_state: result.rows[0]
      });
    }

    // RSOS-076D Learning Runtime API - List Learning States
    if (req.method === "GET" && path === "/runtime/learning/states") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const subject_id = urlObj.searchParams.get("subject_id");
      const knowledge_id = urlObj.searchParams.get("knowledge_id");
      const learning_stage = urlObj.searchParams.get("learning_stage");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (subject_id) {
        params.push(subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (knowledge_id) {
        params.push(knowledge_id);
        where += " AND knowledge_id = $" + params.length;
      }

      if (learning_stage) {
        params.push(learning_stage);
        where += " AND learning_stage = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_learning_states
        ${where}
        ORDER BY created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-076D Assessment Runtime API - Create Assessment
    if (req.method === "POST" && path === "/runtime/assessments") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      if (!body.title || !body.assessment_type) {
        return send(res, 400, {
          error: "missing_required_assessment_fields",
          required: ["title","assessment_type"]
        });
      }

      const assessment_id =
        body.assessment_id ||
        "22222222-2222-4222-8222-" + Date.now().toString().slice(-12);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const result = await db.query(`
        INSERT INTO runtime_assessments (
          assessment_id,
          tenant_id,
          title,
          assessment_type,
          competence_id,
          qualification_id,
          passing_score,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [
        assessment_id,
        tenant_id,
        body.title,
        body.assessment_type,
        body.competence_id || null,
        body.qualification_id || null,
        body.passing_score || null,
        created_by
      ]);

      await writeEvent({
        event_type: "runtime.assessment.created",
        object_id: assessment_id,
        tenant_id,
        message: "Assessment created: " + body.title
      });

      return send(res, 200, {
        created: true,
        assessment: result.rows[0]
      });
    }

    // RSOS-076D Assessment Runtime API - List Assessments
    if (req.method === "GET" && path === "/runtime/assessments") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const assessment_type = urlObj.searchParams.get("assessment_type");
      const competence_id = urlObj.searchParams.get("competence_id");
      const qualification_id = urlObj.searchParams.get("qualification_id");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (assessment_type) {
        params.push(assessment_type);
        where += " AND assessment_type = $" + params.length;
      }

      if (competence_id) {
        params.push(competence_id);
        where += " AND competence_id = $" + params.length;
      }

      if (qualification_id) {
        params.push(qualification_id);
        where += " AND qualification_id = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_assessments
        ${where}
        ORDER BY created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-076E Assessment Attempts Runtime API - Create Attempt
    if (req.method === "POST" && path === "/runtime/assessment-attempts") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      if (!body.assessment_id || !body.subject_id) {
        return send(res, 400, {
          error: "missing_required_assessment_attempt_fields",
          required: ["assessment_id","subject_id"]
        });
      }

      const attempt_id =
        body.attempt_id ||
        "33333333-3333-4333-8333-" + Date.now().toString().slice(-12);

      const result = await db.query(`
        INSERT INTO runtime_assessment_attempts (
          attempt_id,
          tenant_id,
          assessment_id,
          subject_id,
          score,
          result,
          started_at,
          completed_at,
          verified
        )
        VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,NOW()),COALESCE($8,NOW()),$9)
        RETURNING *
      `, [
        attempt_id,
        tenant_id,
        body.assessment_id,
        body.subject_id,
        body.score || null,
        body.result || null,
        body.started_at || null,
        body.completed_at || null,
        body.verified === true
      ]);

      await writeEvent({
        event_type: "runtime.assessment.attempt.created",
        object_id: attempt_id,
        tenant_id,
        message: "Assessment attempt created"
      });

      return send(res, 200, {
        created: true,
        assessment_attempt: result.rows[0]
      });
    }

    // RSOS-076E Assessment Attempts Runtime API - List Attempts
    if (req.method === "GET" && path === "/runtime/assessment-attempts") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const assessment_id = urlObj.searchParams.get("assessment_id");
      const subject_id = urlObj.searchParams.get("subject_id");
      const result_filter = urlObj.searchParams.get("result");
      const verified = urlObj.searchParams.get("verified");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (assessment_id) {
        params.push(assessment_id);
        where += " AND assessment_id = $" + params.length;
      }

      if (subject_id) {
        params.push(subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (result_filter) {
        params.push(result_filter);
        where += " AND result = $" + params.length;
      }

      if (verified === "true" || verified === "false") {
        params.push(verified === "true");
        where += " AND verified = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_assessment_attempts
        ${where}
        ORDER BY created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-076F Competence State Generator
    if (req.method === "POST" && path === "/runtime/competence/calculate-from-attempts") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      const subject_id = body.subject_id || null;
      const competence_id = body.competence_id || null;

      const params = [tenant_id];
      let where = "WHERE aa.tenant_id = $1 AND aa.result = 'PASSED' AND aa.verified = true";

      if (subject_id) {
        params.push(subject_id);
        where += " AND aa.subject_id = $" + params.length;
      }

      if (competence_id) {
        params.push(competence_id);
        where += " AND a.competence_id = $" + params.length;
      }

      const attemptResult = await db.query(`
        SELECT
          aa.subject_id,
          a.competence_id,
          COUNT(*)::int AS evidence_count,
          COALESCE(AVG(aa.score),0)::numeric(5,2) AS avg_score,
          MAX(aa.completed_at) AS last_verified_at
        FROM runtime_assessment_attempts aa
        JOIN runtime_assessments a
          ON a.assessment_id::text = aa.assessment_id
         AND a.tenant_id = aa.tenant_id
        ${where}
          AND a.competence_id IS NOT NULL
        GROUP BY aa.subject_id, a.competence_id
        ORDER BY aa.subject_id, a.competence_id
      `, params);

      const updated = [];

      for (const row of attemptResult.rows) {
        let competence_level = 5;
        if (Number(row.avg_score) >= 95) competence_level = 7;
        else if (Number(row.avg_score) >= 90) competence_level = 6;
        else if (Number(row.avg_score) >= 80) competence_level = 5;
        else if (Number(row.avg_score) >= 70) competence_level = 4;

        const confidence_score = Math.min(
          95,
          Math.round(Number(row.avg_score) * 0.7 + Number(row.evidence_count) * 10)
        );

        const competence_state_id =
          "44444444-4444-4444-8444-" +
          Date.now().toString().slice(-12);

        const upsertResult = await db.query(`
          INSERT INTO runtime_competence_states (
            competence_state_id,
            tenant_id,
            subject_id,
            competence_id,
            competence_level,
            confidence_score,
            evidence_count,
            gap_score,
            verified,
            updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,0,true,NOW())
          ON CONFLICT (competence_state_id)
          DO UPDATE SET
            competence_level = EXCLUDED.competence_level,
            confidence_score = EXCLUDED.confidence_score,
            evidence_count = EXCLUDED.evidence_count,
            gap_score = EXCLUDED.gap_score,
            verified = EXCLUDED.verified,
            updated_at = NOW()
          RETURNING *
        `, [
          competence_state_id,
          tenant_id,
          row.subject_id,
          row.competence_id,
          competence_level,
          confidence_score,
          row.evidence_count
        ]);

        updated.push(upsertResult.rows[0]);
      }

      await writeEvent({
        event_type: "runtime.competence.calculated_from_attempts",
        tenant_id,
        message: "Calculated competence states from verified assessment attempts: " + updated.length
      });

      return send(res, 200, {
        tenant_id,
        calculated: updated.length,
        items: updated
      });
    }

    // RSOS-076F Competence State API - List States
    if (req.method === "GET" && path === "/runtime/competence/states") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const subject_id = urlObj.searchParams.get("subject_id");
      const competence_id = urlObj.searchParams.get("competence_id");
      const verified = urlObj.searchParams.get("verified");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (subject_id) {
        params.push(subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (competence_id) {
        params.push(competence_id);
        where += " AND competence_id = $" + params.length;
      }

      if (verified === "true" || verified === "false") {
        params.push(verified === "true");
        where += " AND verified = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_competence_states
        ${where}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-076G Competence Gap Runtime - Calculate Gaps
    if (req.method === "POST" && path === "/runtime/competence/gaps/calculate") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      if (!body.subject_id || !body.competence_id || body.required_level === undefined) {
        return send(res, 400, {
          error: "missing_required_gap_fields",
          required: ["subject_id","competence_id","required_level"]
        });
      }

      const stateResult = await db.query(`
        SELECT *
        FROM runtime_competence_states
        WHERE tenant_id = $1
          AND subject_id = $2
          AND competence_id = $3
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        body.subject_id,
        body.competence_id
      ]);

      const actual_level =
        stateResult.rows.length > 0
          ? Number(stateResult.rows[0].competence_level || 0)
          : 0;

      const required_level = Number(body.required_level);
      const gap_score = Math.max(0, required_level - actual_level);

      await db.query(`
        DELETE FROM runtime_competence_gaps
        WHERE tenant_id = $1
          AND subject_id = $2
          AND competence_id = $3
      `, [
        tenant_id,
        body.subject_id,
        body.competence_id
      ]);

      const gap_id =
        body.gap_id ||
        "55555555-5555-4555-8555-" + Date.now().toString().slice(-12);

      const insertResult = await db.query(`
        INSERT INTO runtime_competence_gaps (
          gap_id,
          tenant_id,
          subject_id,
          competence_id,
          required_level,
          actual_level,
          gap_score
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [
        gap_id,
        tenant_id,
        body.subject_id,
        body.competence_id,
        required_level,
        actual_level,
        gap_score
      ]);

      await writeEvent({
        event_type: "runtime.competence.gap.calculated",
        object_id: gap_id,
        tenant_id,
        message: "Competence gap calculated: " + gap_score
      });

      return send(res, 200, {
        calculated: true,
        gap: insertResult.rows[0]
      });
    }

    // RSOS-076G Competence Gap Runtime - List Gaps
    if (req.method === "GET" && path === "/runtime/competence/gaps") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const subject_id = urlObj.searchParams.get("subject_id");
      const competence_id = urlObj.searchParams.get("competence_id");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (subject_id) {
        params.push(subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (competence_id) {
        params.push(competence_id);
        where += " AND competence_id = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_competence_gaps
        ${where}
        ORDER BY created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
    }

    // RSOS-076H Learning Recommendation Generator
    if (req.method === "POST" && path === "/runtime/learning/recommendations/generate") {
      const auth = requireRole(req, ["runtime_admin","governance","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const body = await readBody(req);

      const tenant_id =
        body.tenant_id && auth.user.scope === "global"
          ? body.tenant_id
          : auth.user.tenant_id;

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (body.subject_id) {
        params.push(body.subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (body.competence_id) {
        params.push(body.competence_id);
        where += " AND competence_id = $" + params.length;
      }

      const gapsResult = await db.query(`
        SELECT *
        FROM runtime_competence_gaps
        ${where}
        ORDER BY gap_score DESC, created_at DESC
      `, params);

      const generated = [];

      for (const gap of gapsResult.rows) {
        const gapScore = Number(gap.gap_score || 0);

        let recommendation_type = "LEARNING_REINFORCEMENT";
        let recommendation_text = "Gezielte Wiederholung und Vertiefung empfohlen.";

        if (gapScore >= 5) {
          recommendation_type = "FULL_LEARNING_PATH_REQUIRED";
          recommendation_text = "Vollständiger Lernpfad erforderlich, inklusive Grundlagenaufbau, Anwendung und erneuter Verifikation.";
        } else if (gapScore >= 3) {
          recommendation_type = "INTENSIVE_TRAINING_REQUIRED";
          recommendation_text = "Intensives Training empfohlen, anschließend erneutes Assessment und Mentor-Review.";
        } else if (gapScore >= 1) {
          recommendation_type = "TARGETED_REINFORCEMENT";
          recommendation_text = "Gezielte Vertiefung empfohlen, um die Kompetenzlücke zu schließen.";
        } else {
          recommendation_type = "MAINTAIN_COMPETENCE";
          recommendation_text = "Keine akute Lücke. Kompetenz durch Wiederholung und Praxisnachweise stabil halten.";
        }

        const recommendation_id =
          "66666666-6666-4666-8666-" + Date.now().toString().slice(-12);

        const confidence_score =
          gapScore >= 5 ? 90 :
          gapScore >= 3 ? 80 :
          gapScore >= 1 ? 70 : 60;

        const insertResult = await db.query(`
          INSERT INTO runtime_learning_recommendations (
            recommendation_id,
            tenant_id,
            subject_id,
            recommendation_type,
            recommendation_text,
            confidence_score,
            status
          )
          VALUES ($1,$2,$3,$4,$5,$6,'OPEN')
          RETURNING *
        `, [
          recommendation_id,
          tenant_id,
          gap.subject_id,
          recommendation_type,
          recommendation_text,
          confidence_score
        ]);

        generated.push(insertResult.rows[0]);
      }

      await writeEvent({
        event_type: "runtime.learning.recommendations.generated",
        tenant_id,
        message: "Generated learning recommendations from competence gaps: " + generated.length
      });

      return send(res, 200, {
        tenant_id,
        generated: generated.length,
        items: generated
      });
    }

    // RSOS-076H Learning Recommendation API - List
    if (req.method === "GET" && path === "/runtime/learning/recommendations") {
      const auth = requireRole(req, ["runtime_admin","governance","auditor","system_admin"]);
      if (!auth.allowed) return send(res, auth.code, auth.response);

      const urlObj = new URL(req.url, "http://localhost");

      const tenant_id =
        urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : auth.user.tenant_id;

      const subject_id = urlObj.searchParams.get("subject_id");
      const status = urlObj.searchParams.get("status");

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (subject_id) {
        params.push(subject_id);
        where += " AND subject_id = $" + params.length;
      }

      if (status) {
        params.push(status);
        where += " AND status = $" + params.length;
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_learning_recommendations
        ${where}
        ORDER BY created_at DESC
      `, params);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        items: result.rows
      });
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
