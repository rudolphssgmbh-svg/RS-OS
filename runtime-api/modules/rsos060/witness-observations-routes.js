/**
 * RSOS-060 Witness / Observations Routes
 * Extracted from server.js.
 * No domain logic changes.
 */

async function handleRsos060WitnessObservationsRoutes(ctx) {
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

    if (req.method === "POST" && path === "/runtime/witnesses") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const witness_type = body.witness_type;
      const name = body.name;
      const role = body.role || null;
      const reliability_score = body.reliability_score || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!witness_type || !name) {
        return send(res, 400, {
          error: "validation_error",
          message: "witness_type and name required"
        });
      }

      const witness_id =
        "00000000-0000-4001-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_witnesses (
          witness_id,
          tenant_id,
          witness_type,
          name,
          role,
          reliability_score,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        witness_id,
        tenant_id,
        witness_type,
        name,
        role,
        reliability_score,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: witness_id,
        event_type: "runtime.witness.created",
        message: JSON.stringify({
          witness_id,
          witness_type,
          name,
          role,
          reliability_score
        })
      });

      return send(res, 201, {
        witness: {
          witness_id,
          tenant_id,
          witness_type,
          name,
          role,
          reliability_score,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/witnesses") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id =
        urlObj.searchParams.get("tenant_id") && authUser.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          witness_id,
          tenant_id,
          witness_type,
          name,
          role,
          reliability_score,
          created_at,
          created_by
        FROM runtime_witnesses
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        witnesses: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/observations") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const witness_id = body.witness_id || null;
      const evidence_id = body.evidence_id || null;
      const observation_text = body.observation_text;
      const observation_time = body.observation_time || null;
      const confidence = body.confidence || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!observation_text) {
        return send(res, 400, {
          error: "validation_error",
          message: "observation_text required"
        });
      }

      const observation_id =
        "00000000-0000-4002-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_observations (
          observation_id,
          tenant_id,
          witness_id,
          evidence_id,
          observation_text,
          observation_time,
          confidence,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        observation_id,
        tenant_id,
        witness_id,
        evidence_id,
        observation_text,
        observation_time,
        confidence,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: observation_id,
        event_type: "runtime.observation.created",
        message: JSON.stringify({
          observation_id,
          witness_id,
          evidence_id,
          confidence
        })
      });

      return send(res, 201, {
        observation: {
          observation_id,
          tenant_id,
          witness_id,
          evidence_id,
          observation_text,
          observation_time,
          confidence,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/observations") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id =
        urlObj.searchParams.get("tenant_id") && authUser.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          o.observation_id,
          o.tenant_id,
          o.witness_id,
          w.name AS witness_name,
          w.witness_type,
          o.evidence_id,
          e.title AS evidence_title,
          o.observation_text,
          o.observation_time,
          o.confidence,
          o.created_at,
          o.created_by
        FROM runtime_observations o
        LEFT JOIN runtime_witnesses w
          ON w.witness_id = o.witness_id
        LEFT JOIN runtime_evidence e
          ON e.evidence_id = o.evidence_id
        WHERE o.tenant_id = $1
        ORDER BY o.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        observations: result.rows
      });
    }



  return false;
}

module.exports = {
  handleRsos060WitnessObservationsRoutes
};
