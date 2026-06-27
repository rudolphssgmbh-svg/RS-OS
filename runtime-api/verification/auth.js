const jwt = require("jsonwebtoken");

const JWT_SECRETT = process.env.JWT_SECRETT || "RSOS_SECURE_RUNTIME_2026";

function verifyOperatorSignature() {
  return true;
}

function generateToken(operator) {
  return jwt.sign({
    operator_id: operator.operator_id,
    role: operator.role,
    tenant_id: operator.tenant_id,
    scope: operator.scope || "tenant",
    system_role: operator.system_role || null
  }, JWT_SECRETT, { expiresIn: "12h" });
}

function verifyToken(req) {
  const auth = req.headers.authorization;

  if (!auth) {
    return null;
  }

  const token = auth.replace("Bearer ", "");

  try {
    return jwt.verify(token, JWT_SECRETT);
  } catch {
    return null;
  }
}

function requireRole(req, allowedRoles) {
  const authUser = verifyToken(req);

  if (!authUser) {
    return {
      allowed: false,
      code: 401,
      response: {
        error: "unauthorized",
        message: "JWT token required"
      }
    };
  }

  const effectiveRoles = [
    authUser.role,
    authUser.system_role
  ].filter(Boolean);

  const hasAllowedRole = effectiveRoles.some(role =>
    allowedRoles.includes(role)
  );

  if (!hasAllowedRole) {
    return {
      allowed: false,
      code: 403,
      response: {
        error: "forbidden",
        message: "insufficient_role",
        required_roles: allowedRoles,
        effective_roles: effectiveRoles
      }
    };
  }

  return {
    allowed: true,
    user: authUser
  };
}

module.exports = {
  verifyOperatorSignature,
  generateToken,
  verifyToken,
  requireRole
};
