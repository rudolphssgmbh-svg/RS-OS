/**
 * RSOS-060 Assumptions / Hypotheses Routes
 * Extracted from server.js.
 * No domain logic changes.
 */

async function handleRsos060AssumptionsHypothesesRoutes(ctx) {
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

    if (req.method === "POST" && path === "/runtime/assumptions") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const evidence_id = body.evidence_id || null;
      const assumption_text = body.assumption_text;
      const confidence = body.confidence || null;
      const status = body.status || "open";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!assumption_text) {
        return send(res, 400, {
          error: "validation_error",
          message: "assumption_text required"
        });
      }

      const assumption_id =
        "00000000-0000-4003-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_assumptions (
          assumption_id,
          tenant_id,
          evidence_id,
          assumption_text,
          confidence,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        assumption_id,
        tenant_id,
        evidence_id,
        assumption_text,
        confidence,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: assumption_id,
        event_type: "runtime.assumption.created",
        message: JSON.stringify({
          assumption_id,
          evidence_id,
          confidence,
          status
        })
      });

      return send(res, 201, {
        assumption: {
          assumption_id,
          tenant_id,
          evidence_id,
          assumption_text,
          confidence,
          status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/assumptions") {
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
          a.assumption_id,
          a.tenant_id,
          a.evidence_id,
          e.title AS evidence_title,
          a.assumption_text,
          a.confidence,
          a.status,
          a.created_at,
          a.created_by
        FROM runtime_assumptions a
        LEFT JOIN runtime_evidence e
          ON e.evidence_id = a.evidence_id
        WHERE a.tenant_id = $1
        ORDER BY a.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        assumptions: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/hypotheses") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const assumption_id = body.assumption_id || null;
      const hypothesis_text = body.hypothesis_text;
      const confidence = body.confidence || null;
      const verification_status = body.verification_status || "unverified";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!hypothesis_text) {
        return send(res, 400, {
          error: "validation_error",
          message: "hypothesis_text required"
        });
      }

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
        hypothesis_text,
        confidence,
        verification_status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: hypothesis_id,
        event_type: "runtime.hypothesis.created",
        message: JSON.stringify({
          hypothesis_id,
          assumption_id,
          confidence,
          verification_status
        })
      });

      return send(res, 201, {
        hypothesis: {
          hypothesis_id,
          tenant_id,
          assumption_id,
          hypothesis_text,
          confidence,
          verification_status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/hypotheses") {
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
          h.hypothesis_id,
          h.tenant_id,
          h.assumption_id,
          a.assumption_text,
          h.hypothesis_text,
          h.confidence,
          h.verification_status,
          h.created_at,
          h.created_by
        FROM runtime_hypotheses h
        LEFT JOIN runtime_assumptions a
          ON a.assumption_id = h.assumption_id
        WHERE h.tenant_id = $1
        ORDER BY h.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        hypotheses: result.rows
      });
    }



  return false;
}

module.exports = {
  handleRsos060AssumptionsHypothesesRoutes
};
