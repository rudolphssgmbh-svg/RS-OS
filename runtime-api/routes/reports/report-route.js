async function handleReportRoute({
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
}) {
  if (req.method === "POST" && path === "/runtime/reports") {
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
    const evidence_id = body.evidence_id || null;
    const report_type = body.report_type;
    const title = body.title;
    const report_text = body.report_text || null;
    const received_at = body.received_at || null;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !report_type || !title) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id, report_type and title required"
      });
    }

    const report_id =
      "00000000-0000-4000-8000-" +
      crypto.randomBytes(6).toString("hex");

    const report_hash = createAuditHash({
      tenant_id,
      source_id,
      evidence_id,
      report_type,
      title,
      report_text,
      received_at
    });

    await db.query(`
      INSERT INTO runtime_reports (
        report_id,
        tenant_id,
        source_id,
        evidence_id,
        report_type,
        title,
        report_text,
        report_status,
        report_hash,
        received_at,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'captured',$8,COALESCE($9::timestamptz, now()),$10)
    `, [
      report_id,
      tenant_id,
      source_id,
      evidence_id,
      report_type,
      title,
      report_text,
      report_hash,
      received_at,
      created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: report_id,
      event_type: "runtime.report.created",
      message: JSON.stringify({
        report_id,
        report_type,
        title,
        report_hash
      })
    });

    return send(res, 201, {
      report: {
        report_id,
        tenant_id,
        source_id,
        evidence_id,
        report_type,
        title,
        report_text,
        report_status: "captured",
        report_hash,
        received_at,
        created_by
      }
    });
  }

  if (req.method === "GET" && path === "/runtime/reports") {
    const authUser = verifyToken(req);

    if (!authUser) {
      return send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
    }

    const tenant_id = authUser.tenant_id;

    if (!tenant_id) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id required"
      });
    }

    const result = await db.query(`
      SELECT
        report_id,
        tenant_id,
        source_id,
        evidence_id,
        report_type,
        title,
        report_text,
        report_status,
        report_hash,
        received_at,
        created_at,
        created_by
      FROM runtime_reports
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id
    ]);

    return send(res, 200, {
      reports: result.rows
    });
  }

  if (req.method === "POST" && path === "/runtime/report-segments") {
    const authUser = verifyToken(req);

    if (!authUser) {
      return send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
    }

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const report_id = body.report_id;
    const segment_type = body.segment_type;
    const segment_text = body.segment_text;
    const linked_observation_id = body.linked_observation_id || null;
    const linked_evidence_id = body.linked_evidence_id || null;
    const linked_fact_id = body.linked_fact_id || null;
    const linked_assumption_id = body.linked_assumption_id || null;
    const linked_hypothesis_id = body.linked_hypothesis_id || null;
    const confidence = body.confidence || 0.50;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !report_id || !segment_type || !segment_text) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id, report_id, segment_type and segment_text required"
      });
    }

    const segment_id =
      "00000000-0000-4000-8000-" +
      crypto.randomBytes(6).toString("hex");

    await db.query(`
      INSERT INTO runtime_report_segments (
        segment_id,
        tenant_id,
        report_id,
        segment_type,
        segment_text,
        linked_observation_id,
        linked_evidence_id,
        linked_fact_id,
        linked_assumption_id,
        linked_hypothesis_id,
        confidence,
        segment_status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'extracted',$12)
    `, [
      segment_id,
      tenant_id,
      report_id,
      segment_type,
      segment_text,
      linked_observation_id,
      linked_evidence_id,
      linked_fact_id,
      linked_assumption_id,
      linked_hypothesis_id,
      confidence,
      created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: segment_id,
      event_type: "runtime.report.segment.created",
      message: JSON.stringify({
        segment_id,
        report_id,
        segment_type,
        confidence
      })
    });

    return send(res, 201, {
      segment: {
        segment_id,
        tenant_id,
        report_id,
        segment_type,
        segment_text,
        linked_observation_id,
        linked_evidence_id,
        linked_fact_id,
        linked_assumption_id,
        linked_hypothesis_id,
        confidence,
        segment_status: "extracted",
        created_by
      }
    });
  }

  if (req.method === "GET" && path === "/runtime/report-segments") {
    const authUser = verifyToken(req);

    if (!authUser) {
      return send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
    }

    const urlObj = new URL(req.url, "http://localhost");
    const tenant_id = authUser.tenant_id;
    const report_id = urlObj.searchParams.get("report_id");

    if (!tenant_id) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id required"
      });
    }

    let query = `
      SELECT
        segment_id,
        tenant_id,
        report_id,
        segment_type,
        segment_text,
        linked_observation_id,
        linked_evidence_id,
        linked_fact_id,
        linked_assumption_id,
        linked_hypothesis_id,
        confidence,
        segment_status,
        created_at,
        created_by
      FROM runtime_report_segments
      WHERE tenant_id = $1
    `;

    const params = [tenant_id];

    if (report_id) {
      params.push(report_id);
      query += " AND report_id = $" + params.length;
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await db.query(query, params);

    return send(res, 200, {
      segments: result.rows
    });
  }

  return false;
}

module.exports = {
  handleReportRoute
};
