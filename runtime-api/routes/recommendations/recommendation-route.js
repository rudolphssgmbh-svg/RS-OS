async function handleRecommendationRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send,
  generateRecommendationsForObject
}) {
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
                ORDER BY
                  revision_number DESC,
                  decision_id DESC
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


  return false;
}

module.exports = {
  handleRecommendationRoute
};
