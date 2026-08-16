/**
 * RSOS-060 Evidence Routes
 * Extracted from server.js.
 * No domain logic changes.
 */

async function handleRsos060EvidenceRoutes(ctx) {
  const {
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
  } = ctx;

    if (req.method === "POST" && path === "/runtime/evidence") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const evidence_type = body.evidence_type;
      const title = body.title || null;
      const evidence_text = body.evidence_text || null;
      const source_id = body.source_id || null;
      const object_id = body.object_id || null;
      const event_id = body.event_id || null;
      const confidence = body.confidence || null;
      const observed_at = body.observed_at || null;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!evidence_type) {
        return send(res, 400, {
          error: "validation_error",
          message: "evidence_type required"
        });
      }

      const evidence_id =
        "00000000-0000-4000-8000-" +
        crypto.randomBytes(6).toString("hex");

      const evidence_hash = createAuditHash({
        tenant_id,
        source_id,
        object_id,
        event_id,
        evidence_type,
        title,
        evidence_text,
        confidence,
        observed_at
      });

      await db.query(`
        INSERT INTO runtime_evidence (
          evidence_id,
          tenant_id,
          source_id,
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
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'captured',$11,$12)
      `, [
        evidence_id,
        tenant_id,
        source_id,
        object_id,
        event_id,
        evidence_type,
        title,
        evidence_text,
        evidence_hash,
        confidence,
        observed_at,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: evidence_id,
        event_type: "runtime.evidence.created",
        message: JSON.stringify({
          evidence_id,
          evidence_type,
          title,
          evidence_hash
        })
      });

      return send(res, 201, {
        evidence: {
          evidence_id,
          tenant_id,
          source_id,
          object_id,
          event_id,
          evidence_type,
          title,
          evidence_hash,
          confidence,
          evidence_status: "captured",
          observed_at,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/evidence") {
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
          evidence_id,
          tenant_id,
          source_id,
          object_id,
          event_id,
          evidence_type,
          title,
          evidence_text,
          evidence_hash,
          confidence,
          evidence_status,
          observed_at,
          created_at,
          created_by
        FROM runtime_evidence
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        evidence: result.rows
      });
    }




  return false;
}

module.exports = {
  handleRsos060EvidenceRoutes
};
