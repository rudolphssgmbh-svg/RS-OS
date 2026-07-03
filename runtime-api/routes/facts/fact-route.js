async function handleFactRoute({
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
if (req.method === "POST" && path === "/runtime/facts") {
  const authUser = verifyToken(req);

  if (!authUser) {
    return send(res, 401, {
      error: "unauthorized",
      message: "JWT token required"
    });
  }

  const body = await readBody(req);

  const tenant_id = authUser.tenant_id;
  const verification_result_id = body.verification_result_id || null;
  const fact_text = body.fact_text;
  const confidence = body.confidence || null;
  const fact_status = body.fact_status || "accepted";
  const evidence_id = body.evidence_id || null;
  const source_weight = body.source_weight || null;
  const created_by = authUser.operator_id || authUser.role || "runtime_user";

  if (!tenant_id) {
    return send(res, 400, {
      error: "validation_error",
      message: "tenant_id required"
    });
  }

  if (!verification_result_id) {
    return send(res, 400, {
      error: "validation_error",
      message: "verification_result_id required"
    });
  }

  if (!fact_text) {
    return send(res, 400, {
      error: "validation_error",
      message: "fact_text required"
    });
  }

  const verificationResult = await db.query(`
    SELECT
      result_id,
      tenant_id,
      result_status,
      confidence,
      accepted_as_fact
    FROM runtime_verification_results
    WHERE tenant_id = $1
      AND result_id = $2
    LIMIT 1
  `, [
    tenant_id,
    verification_result_id
  ]);

  if (verificationResult.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "verification_result not found"
    });
  }

  if (verificationResult.rows[0].accepted_as_fact !== true) {
    return send(res, 409, {
      error: "fact_not_accepted",
      message: "verification_result.accepted_as_fact must be true before creating a fact"
    });
  }

  const fact_id =
    "00000000-0000-4007-8000-" +
    crypto.randomBytes(6).toString("hex");

  await db.query(`
    INSERT INTO runtime_facts (
      fact_id,
      tenant_id,
      verification_result_id,
      fact_text,
      confidence,
      fact_status,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [
    fact_id,
    tenant_id,
    verification_result_id,
    fact_text,
    confidence,
    fact_status,
    created_by
  ]);

  let fact_source_id = null;

  if (evidence_id) {
    fact_source_id =
      "00000000-0000-4008-8000-" +
      crypto.randomBytes(6).toString("hex");

    await db.query(`
      INSERT INTO runtime_fact_sources (
        fact_source_id,
        tenant_id,
        fact_id,
        evidence_id,
        source_weight
      )
      VALUES ($1,$2,$3,$4,$5)
    `, [
      fact_source_id,
      tenant_id,
      fact_id,
      evidence_id,
      source_weight
    ]);
  }

  await writeEvent({
    tenant_id,
    object_id: fact_id,
    event_type: "runtime.fact.created",
    message: JSON.stringify({
      fact_id,
      verification_result_id,
      confidence,
      fact_status,
      evidence_id,
      fact_source_id
    })
  });

  return send(res, 201, {
    fact: {
      fact_id,
      tenant_id,
      verification_result_id,
      fact_text,
      confidence,
      fact_status,
      evidence_id,
      fact_source_id,
      created_by
    }
  });
}

if (req.method === "GET" && path === "/runtime/facts") {
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
      f.fact_id,
      f.tenant_id,
      f.verification_result_id,
      vr.result_status,
      vr.accepted_as_fact,
      f.fact_text,
      f.confidence,
      f.fact_status,
      f.created_at,
      f.created_by
    FROM runtime_facts f
    LEFT JOIN runtime_verification_results vr
      ON vr.result_id = f.verification_result_id
    WHERE f.tenant_id = $1
    ORDER BY f.created_at DESC
    LIMIT 100
  `, [
    tenant_id
  ]);

  return send(res, 200, {
    facts: result.rows
  });
}


if (req.method === "GET" && path.startsWith("/runtime/trace/fact/")) {
  const authUser = verifyToken(req);

  if (!authUser) {
    return send(res, 401, {
      error: "unauthorized",
      message: "JWT token required"
    });
  }

  const tenant_id = authUser.tenant_id;
  const fact_id = path.replace("/runtime/trace/fact/", "");

  const governanceCheck = await db.query(`
    SELECT
      governance_check_id,
      governance_decision,
      trust_level,
      decision_reason,
      checked_by,
      checked_at
    FROM runtime_governance_checks
    WHERE tenant_id = $1
      AND fact_id = $2
    ORDER BY checked_at DESC
    LIMIT 1
  `, [tenant_id, fact_id]);

  if (
    governanceCheck.rows.length > 0 &&
    governanceCheck.rows[0].governance_decision === "quarantine"
  ) {
    const g = governanceCheck.rows[0];

    await writeEvent({
      tenant_id,
      object_id: fact_id,
      event_type: "runtime.trace.fact.denied",
      message: JSON.stringify({
        reason_code: "FACT_TRACE_DENIED_BY_GOVERNANCE_QUARANTINE",
        performed_by: authUser.operator_id || authUser.role || "runtime_user",
        tenant_id,
        fact_id,
        result: "denied",
        http_status: 403,
        governance_check_id: g.governance_check_id,
        governance_decision: g.governance_decision,
        trust_level: g.trust_level,
        decision_reason: g.decision_reason
      })
    });

    return send(res, 403, {
      error: "forbidden",
      message: "fact trace denied by governance quarantine"
    });
  }

  const result = await db.query(`
    SELECT
      f.*,
      vr.result_id,
      vr.verification_id AS result_verification_id,
      vr.result_status,
      vr.accepted_as_fact,
      vr.result_notes,
      vc.verification_id AS cycle_id,
      vc.hypothesis_id,
      vc.assumption_id AS cycle_assumption_id,
      vc.verification_status AS cycle_status,
      vc.verified_at,
      h.hypothesis_text,
      h.assumption_id AS hypothesis_assumption_id,
      a.assumption_text,
      a.evidence_id,
      e.evidence_type,
      e.title AS evidence_title,
      e.evidence_text,
      e.evidence_hash,
      e.evidence_status
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
    LEFT JOIN runtime_evidence e
      ON e.tenant_id = f.tenant_id
     AND e.evidence_id = a.evidence_id
    WHERE f.tenant_id = $1
      AND f.fact_id = $2
    LIMIT 1
  `, [tenant_id, fact_id]);

  if (result.rows.length === 0) {
    await writeEvent({
      tenant_id,
      object_id: fact_id,
      event_type: "runtime.trace.fact.not_found",
      message: JSON.stringify({
        reason_code: "FACT_TRACE_NOT_FOUND_OR_NOT_IN_TENANT",
        performed_by: authUser.operator_id || authUser.role || "runtime_user",
        tenant_id,
        fact_id,
        result: "not_found",
        http_status: 404
      })
    });

    return send(res, 404, {
      error: "not_found",
      message: "fact trace not found"
    });
  }

  const r = result.rows[0];

  const missing_links = [];

  if (!r.verification_result_id || !r.result_id) {
    missing_links.push("verification_result");
  }

  if (!r.cycle_id) {
    missing_links.push("verification_cycle");
  }

  if (!r.hypothesis_id) {
    missing_links.push("hypothesis");
  }

  if (!(r.hypothesis_assumption_id || r.cycle_assumption_id)) {
    missing_links.push("assumption");
  }

  if (!r.evidence_id) {
    missing_links.push("evidence");
  }

  const trace_steps_total = 6;
  const trace_steps_present =
    trace_steps_total - missing_links.length;

  const trace_completeness = Number(
    ((trace_steps_present / trace_steps_total) * 100).toFixed(2)
  );

  await writeEvent({
    tenant_id,
    object_id: fact_id,
    event_type: "runtime.trace.fact.read",
    message: JSON.stringify({
      reason_code: "FACT_EVIDENCE_TRACE_READ",
      performed_by: authUser.operator_id || authUser.role || "runtime_user",
      tenant_id,
      fact_id,
      trace_type: "fact_evidence_trace",
      trace_completeness,
      missing_links
    })
  });

  return send(res, 200, {
    trace_type: "fact_evidence_trace",
    tenant_id,
    fact_id,
    trace_quality: {
      trace_steps_total,
      trace_steps_present,
      trace_completeness,
      missing_links,
      complete: missing_links.length === 0
    },
    trace: {
      fact: {
        fact_id: r.fact_id,
        verification_result_id: r.verification_result_id,
        fact_text: r.fact_text,
        confidence: r.confidence,
        fact_status: r.fact_status,
        created_at: r.created_at,
        created_by: r.created_by
      },
      verification_result: r.result_id ? {
        result_id: r.result_id,
        verification_id: r.result_verification_id,
        result_status: r.result_status,
        accepted_as_fact: r.accepted_as_fact,
        result_notes: r.result_notes
      } : null,
      verification_cycle: r.cycle_id ? {
        verification_cycle_id: r.cycle_id,
        hypothesis_id: r.hypothesis_id,
        assumption_id: r.cycle_assumption_id,
        verification_status: r.cycle_status,
        verified_at: r.verified_at
      } : null,
      hypothesis: r.hypothesis_id ? {
        hypothesis_id: r.hypothesis_id,
        assumption_id: r.hypothesis_assumption_id,
        hypothesis_text: r.hypothesis_text
      } : null,
      assumption: r.hypothesis_assumption_id || r.cycle_assumption_id ? {
        assumption_id: r.hypothesis_assumption_id || r.cycle_assumption_id,
        evidence_id: r.evidence_id,
        assumption_text: r.assumption_text
      } : null,
      evidence: r.evidence_id ? {
        evidence_id: r.evidence_id,
        evidence_type: r.evidence_type,
        title: r.evidence_title,
        evidence_text: r.evidence_text,
        evidence_hash: r.evidence_hash,
        evidence_status: r.evidence_status
      } : null
    }
  });
}



  return false;
}

module.exports = {
  handleFactRoute
};
