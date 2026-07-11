const TRUST_RISK_BASE_PATH =
  "/runtime/execution/trust-risks";

const TRUST_RISK_READ_ROLES = [
  "system_admin",
  "runtime_admin",
  "auditor"
];

const TRUST_RISK_SELECT = `
  SELECT
    trust_risk_id,
    verification_type,
    scope_type,
    tenant_id,
    object_id,
    source_event_id,
    source_event_type,
    source_event_created_at,
    anomaly_reason,
    expected_audit_hash,
    actual_audit_hash,
    severity,
    risk_state,
    occurrence_count,
    first_seen_at,
    last_seen_at,
    resolved_at,
    resolution_note,
    metadata,
    created_at,
    updated_at
  FROM runtime_trust_risks
`;

function authorizeTrustRiskRead({
  req,
  res,
  send,
  requireRole
}) {
  const auth = requireRole(
    req,
    TRUST_RISK_READ_ROLES
  );

  if (!auth.allowed) {
    send(
      res,
      auth.code,
      auth.response
    );

    return null;
  }

  return auth;
}

function extractTrustRiskId(path) {
  const match = path.match(
    /^\/runtime\/execution\/trust-risks\/([^/]+)$/
  );

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(
      match[1]
    ).trim();
  } catch {
    return "";
  }
}

async function handleTrustRiskReadRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method !== "GET") {
    return false;
  }

  if (path === TRUST_RISK_BASE_PATH) {
    const auth = authorizeTrustRiskRead({
      req,
      res,
      send,
      requireRole
    });

    if (!auth) {
      return true;
    }

    const result = await db.query(`
      ${TRUST_RISK_SELECT}
      ORDER BY
        CASE risk_state
          WHEN 'open' THEN 1
          WHEN 'acknowledged' THEN 2
          WHEN 'resolved' THEN 3
          ELSE 4
        END,
        last_seen_at DESC,
        created_at DESC
      LIMIT 100
    `);

    return send(res, 200, {
      count:
        result.rows.length,

      trust_risks:
        result.rows
    });
  }

  const trustRiskId =
    extractTrustRiskId(path);

  if (trustRiskId === null) {
    return false;
  }

  const auth = authorizeTrustRiskRead({
    req,
    res,
    send,
    requireRole
  });

  if (!auth) {
    return true;
  }

  if (!trustRiskId) {
    return send(res, 400, {
      error:
        "invalid_trust_risk_id"
    });
  }

  const result = await db.query(`
    ${TRUST_RISK_SELECT}
    WHERE trust_risk_id = $1
    LIMIT 1
  `, [
    trustRiskId
  ]);

  if (result.rows.length === 0) {
    return send(res, 404, {
      error:
        "trust_risk_not_found",

      trust_risk_id:
        trustRiskId
    });
  }

  return send(res, 200, {
    trust_risk:
      result.rows[0]
  });
}

module.exports = {
  TRUST_RISK_BASE_PATH,
  TRUST_RISK_READ_ROLES,
  extractTrustRiskId,
  handleTrustRiskReadRoute
};
