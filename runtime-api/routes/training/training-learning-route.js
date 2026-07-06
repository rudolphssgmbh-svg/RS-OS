async function handleTrainingLearningRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send
}) {
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


  return false;
}

module.exports = {
  handleTrainingLearningRoute
};
