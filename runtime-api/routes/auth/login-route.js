async function handleAuthLoginRoute({
  req,
  res,
  db,
  send,
  readBody,
  verifyOperatorSignature,
  generateToken
}) {
  const body = await readBody(req);

  const username = body.username;
  const password = body.password;

  if (!username || !password) {
    return send(res, 400, {
      authenticated: false,
      error: "missing_credentials"
    });
  }

  const credentialResult = await db.query(`
    SELECT
      c.username,
      c.tenant_id,
      m.role,
      m.status AS member_status,
      c.status AS credential_status,
      c.scope,
      c.system_role
    FROM runtime_operator_credentials c
    JOIN runtime_tenant_members m
      ON m.tenant_id = c.tenant_id
     AND m.username = c.username
    WHERE c.username = $1
      AND c.password = $2
      AND c.status = 'active'
      AND m.status = 'active'
    LIMIT 1
  `, [
    username,
    password
  ]);

  if (credentialResult.rows.length === 0) {
    return send(res, 401, {
      authenticated: false,
      error: "invalid_credentials"
    });
  }

  const credential = credentialResult.rows[0];

  const operator = {
    operator_id: credential.username,
    username: credential.username,
    role: credential.system_role || (credential.role === "tenant_admin" ? "runtime_admin" : credential.role),
    tenant_id: credential.tenant_id,
    scope: credential.scope || "tenant",
    system_role: credential.system_role || null
  };

  const operatorCertValid = verifyOperatorSignature();

  if (!operatorCertValid) {
    return send(res, 403, {
      authenticated: false,
      error: "operator_certificate_invalid"
    });
  }

  const token = generateToken(operator);

  return send(res, 200, {
    authenticated: true,
    operator_certificate_verified: true,
    operator: {
      operator_id: operator.operator_id,
      role: operator.role,
      tenant_id: operator.tenant_id,
      scope: operator.scope || "tenant",
      system_role: operator.system_role || null
    },
    token
  });
}

module.exports = { handleAuthLoginRoute };
