async function handleHeuristicsPatternRoute({
  req,
  res,
  path,
  db,
  crypto,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
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


  return false;
}

module.exports = {
  handleHeuristicsPatternRoute
};
