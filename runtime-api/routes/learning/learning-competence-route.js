async function handleLearningCompetenceRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
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


  return false;
}

module.exports = {
  handleLearningCompetenceRoute
};
