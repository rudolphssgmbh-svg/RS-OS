
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * RSOS-060 Verifications / Verification Results Routes
 * Extracted from server.js.
 * No domain logic changes.
 */

async function handleRsos060VerificationsRoutes(ctx) {
  const {
    req,
    res,
    path,
    db,
    crypto,
    verifyToken,
    readBody,
    writeEvent,
    send
  } = ctx;

    if (req.method === "POST" && path === "/runtime/verifications") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const hypothesis_id = body.hypothesis_id || null;
      const verification_method = body.verification_method;
      const verification_notes = body.verification_notes || null;
      const status = body.status || "pending";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!verification_method) {
        return send(res, 400, {
          error: "validation_error",
          message: "verification_method required"
        });
      }

      const verification_id =
        "00000000-0000-4005-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_verifications (
          verification_id,
          tenant_id,
          hypothesis_id,
          verification_method,
          verification_notes,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        verification_id,
        tenant_id,
        hypothesis_id,
        verification_method,
        verification_notes,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: verification_id,
        event_type: "runtime.verification.created",
        message: JSON.stringify({
          verification_id,
          hypothesis_id,
          verification_method,
          status
        })
      });

      return send(res, 201, {
        verification: {
          verification_id,
          tenant_id,
          hypothesis_id,
          verification_method,
          verification_notes,
          status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/verifications") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = urlObj.searchParams.get("tenant_id") || authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          v.verification_id,
          v.tenant_id,
          v.hypothesis_id,
          h.hypothesis_text,
          v.verification_method,
          v.verification_notes,
          v.status,
          v.created_at,
          v.created_by
        FROM runtime_verifications v
        LEFT JOIN runtime_hypotheses h
          ON h.hypothesis_id = v.hypothesis_id
        WHERE v.tenant_id = $1
        ORDER BY v.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        verifications: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/verification-results") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const verification_id = body.verification_id || null;
      const result_status = body.result_status;
      const confidence = body.confidence || null;
      const accepted_as_fact = body.accepted_as_fact === true;
      const result_notes = body.result_notes || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!result_status) {
        return send(res, 400, {
          error: "validation_error",
          message: "result_status required"
        });
      }

      const result_id =
        "00000000-0000-4006-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_verification_results (
          result_id,
          tenant_id,
          verification_id,
          result_status,
          confidence,
          accepted_as_fact,
          result_notes,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        result_id,
        tenant_id,
        verification_id,
        result_status,
        confidence,
        accepted_as_fact,
        result_notes,
        created_by
      ]);

      if (verification_id) {
        await db.query(`
          UPDATE runtime_verifications
          SET status = $1
          WHERE tenant_id = $2
            AND verification_id = $3
        `, [
          result_status,
          tenant_id,
          verification_id
        ]);
      }

      await writeEvent({
        tenant_id,
        object_id: result_id,
        event_type: "runtime.verification_result.created",
        message: JSON.stringify({
          result_id,
          verification_id,
          result_status,
          confidence,
          accepted_as_fact
        })
      });

      return send(res, 201, {
        verification_result: {
          result_id,
          tenant_id,
          verification_id,
          result_status,
          confidence,
          accepted_as_fact,
          result_notes,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/verification-results") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = urlObj.searchParams.get("tenant_id") || authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          r.result_id,
          r.tenant_id,
          r.verification_id,
          v.hypothesis_id,
          h.hypothesis_text,
          r.result_status,
          r.confidence,
          r.accepted_as_fact,
          r.result_notes,
          r.created_at,
          r.created_by
        FROM runtime_verification_results r
        LEFT JOIN runtime_verifications v
          ON v.verification_id = r.verification_id
        LEFT JOIN runtime_hypotheses h
          ON h.hypothesis_id = v.hypothesis_id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        verification_results: result.rows
      });
    }


    // RSOS-060F Verification Checks API
    const checksMatch = path.match(/^\/runtime\/verifications\/([^/]+)\/checks$/);

    if (checksMatch && req.method === "GET") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const verification_id = checksMatch[1];
      const tenant_id = authUser.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_verification_checks
        WHERE verification_id = $1
          AND tenant_id = $2
        ORDER BY created_at DESC
      `, [verification_id, tenant_id]);

      return send(res, 200, {
        verification_id,
        checks: result.rows
      });
    }

    if (checksMatch && req.method === "POST") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const verification_id = checksMatch[1];
      const tenant_id = authUser.tenant_id;
      const body = await readJsonBody(req);

      const check_type = body.check_type || "manual_check";
      const check_status = body.check_status || "pending";
      const expected_value = body.expected_value || null;
      const observed_value = body.observed_value || null;
      const check_notes = body.check_notes || null;
      const actor = authUser.operator_id || authUser.username || "system";

      const result = await db.query(`
        INSERT INTO runtime_verification_checks (
          tenant_id,
          verification_id,
          check_type,
          check_status,
          expected_value,
          observed_value,
          check_notes,
          checked_at,
          checked_by,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,$8)
        RETURNING *
      `, [
        tenant_id,
        verification_id,
        check_type,
        check_status,
        expected_value,
        observed_value,
        check_notes,
        actor
      ]);

      // RSOS-060I auto result completion
      let auto_result = null;

      if (check_status === "passed") {
        const autoResult = await db.query(`
          INSERT INTO runtime_verification_results (
            result_id,
            tenant_id,
            verification_id,
            result_status,
            confidence,
            accepted_as_fact,
            result_notes,
            created_by
          )
          VALUES (gen_random_uuid(),$1,NULL,$2,$3,$4,$5,$6)
          RETURNING *
        `, [
          tenant_id,
          "verified",
          90,
          true,
          "Auto result created by RSOS-060I after passed check for cycle " + verification_id,
          actor
        ]);

        auto_result = autoResult.rows[0];

        // RSOS-061A auto lesson and knowledge
        const lessonResult = await db.query(`
          INSERT INTO runtime_lessons_learned (
            lesson_id,
            tenant_id,
            trust_level,
            outcome_correct,
            lesson_type,
            lesson_summary,
            recommended_action,
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
            $7
          )
          RETURNING *
        `, [
          tenant_id,
          "verified",
          true,
          "verification_result",
          "Verification cycle " + verification_id + " was verified by passed check.",
          "Use this verified result as evidence for future recommendations.",
          actor
        ]);

        await db.query(`
          INSERT INTO runtime_knowledge (
            knowledge_id,
            tenant_id,
            object_id,
            knowledge_type,
            title,
            content,
            source,
            created_by,
            updated_by
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
            $8
          )
        `, [
          "knowledge-rsos061a-" + auto_result.result_id,
          tenant_id,
          verification_id,
          "verification_learning",
          "Verified learning from cycle " + verification_id,
          "A passed verification check confirmed cycle " + verification_id + ". Confidence was raised to 90.",
          "runtime_verification_results:" + auto_result.result_id,
          actor
        ]);

        auto_result.lesson_id = lessonResult.rows[0].lesson_id;

        // RSOS-061C recommendation feedback
        const knowledgeId = "knowledge-rsos061a-" + auto_result.result_id;
        const recommendationId = "rec-rsos061c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        // RSOS-061H tenant rule lookup
        const feedbackRuleLookup = await db.query(`
          SELECT rule_id
          FROM runtime_recommendation_rules
          WHERE tenant_id = $1
            AND rule_name = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [
          tenant_id,
          "Competency Gap Requires Training"
        ]);

        const feedbackRuleId = feedbackRuleLookup.rows[0]?.rule_id || null;

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
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `, [
          recommendationId,
          tenant_id,
          verification_id,
          "LEARNING_FEEDBACK",
          "normal",
          "open",
          "Verified learning should improve future recommendations.",
          JSON.stringify({
            source: "RSOS-061C",
            verification_id,
            result_id: auto_result.result_id,
            lesson_id: lessonResult.rows[0].lesson_id,
            knowledge_id: knowledgeId,
            rule_id: feedbackRuleId
          }),
          actor
        ]);

        await db.query(`
          UPDATE runtime_recommendation_rules
          SET
            success_count = success_count + 1,
            feedback_count = feedback_count + 1,
            confidence_score = LEAST(100, confidence_score + 5),
            last_feedback_at = now(),
            updated_by = $2,
            updated_at = now()
          WHERE rule_id = $1
            AND tenant_id = $3
        `, [
          feedbackRuleId,
          actor,
          tenant_id
        ]);

        auto_result.recommendation_id = recommendationId;

        await db.query(`
          UPDATE runtime_verification_cycles
          SET
            verification_status = 'verified',
            verification_result = 'verified by passed check',
            confidence_after = 90,
            verified_at = now()
          WHERE verification_id = $1
            AND tenant_id = $2
        `, [
          verification_id,
          tenant_id
        ]);
      }

      return send(res, 201, {
        verification_id,
        check: result.rows[0],
        auto_result
      });
    }




  return false;
}

module.exports = {
  handleRsos060VerificationsRoutes
};
