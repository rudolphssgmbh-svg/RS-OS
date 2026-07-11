const {
  TrustRiskReviewError,
  acknowledgeTrustRisk,
  resolveTrustRisk
} = require(
  "../../modules/trust/" +
  "trust-risk-review-service"
);

const ACKNOWLEDGE_PATH_PATTERN =
  /^\/runtime\/execution\/trust-risks\/([^/]+)\/acknowledge$/;

const RESOLVE_PATH_PATTERN =
  /^\/runtime\/execution\/trust-risks\/([^/]+)\/resolve$/;

function extractPathTrustRiskId({
  path,
  pattern
}) {
  const match = path.match(
    pattern
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

function extractAcknowledgeTrustRiskId(path) {
  return extractPathTrustRiskId({
    path,
    pattern:
      ACKNOWLEDGE_PATH_PATTERN
  });
}

function extractResolveTrustRiskId(path) {
  return extractPathTrustRiskId({
    path,
    pattern:
      RESOLVE_PATH_PATTERN
  });
}

function getReviewTarget(path) {
  const acknowledgeTrustRiskId =
    extractAcknowledgeTrustRiskId(
      path
    );

  if (acknowledgeTrustRiskId !== null) {
    return {
      action:
        "acknowledge",

      trustRiskId:
        acknowledgeTrustRiskId
    };
  }

  const resolveTrustRiskId =
    extractResolveTrustRiskId(
      path
    );

  if (resolveTrustRiskId !== null) {
    return {
      action:
        "resolve",

      trustRiskId:
        resolveTrustRiskId
    };
  }

  return null;
}

async function handleTrustRiskReviewRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody
}) {
  if (req.method !== "POST") {
    return false;
  }

  const reviewTarget =
    getReviewTarget(path);

  if (!reviewTarget) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin"
  ]);

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  if (!reviewTarget.trustRiskId) {
    return send(res, 400, {
      error:
        "invalid_trust_risk_id"
    });
  }

  let body;

  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, {
      error:
        "invalid_json_body"
    });
  }

  try {
    const operatorId =
      auth.user.operator_id ||
      auth.user.username ||
      "system_admin";

    if (
      reviewTarget.action ===
      "acknowledge"
    ) {
      const acknowledgedAt =
        new Date();

      const trustRisk =
        await acknowledgeTrustRisk({
          db,

          trustRiskId:
            reviewTarget.trustRiskId,

          acknowledgedBy:
            operatorId,

          acknowledgementNote:
            body.acknowledgement_note,

          acknowledgedAt
        });

      return send(res, 200, {
        action:
          "runtime.execution." +
          "trust-risk.acknowledge",

        acknowledged_by:
          operatorId,

        acknowledged_at:
          acknowledgedAt.toISOString(),

        trust_risk:
          trustRisk
      });
    }

    const resolvedAt =
      new Date();

    const trustRisk =
      await resolveTrustRisk({
        db,

        trustRiskId:
          reviewTarget.trustRiskId,

        resolvedBy:
          operatorId,

        resolutionNote:
          body.resolution_note,

        resolvedAt
      });

    return send(res, 200, {
      action:
        "runtime.execution." +
        "trust-risk.resolve",

      resolved_by:
        operatorId,

      resolved_at:
        resolvedAt.toISOString(),

      trust_risk:
        trustRisk
    });
  } catch (error) {
    if (
      error instanceof
      TrustRiskReviewError
    ) {
      return send(
        res,
        error.status,
        {
          error:
            error.code,

          ...error.details
        }
      );
    }

    throw error;
  }
}

module.exports = {
  ACKNOWLEDGE_PATH_PATTERN,
  RESOLVE_PATH_PATTERN,
  extractAcknowledgeTrustRiskId,
  extractResolveTrustRiskId,
  getReviewTarget,
  handleTrustRiskReviewRoute
};
