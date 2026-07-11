const {
  TrustRiskReviewError,
  acknowledgeTrustRisk
} = require(
  "../../modules/trust/" +
  "trust-risk-review-service"
);

const ACKNOWLEDGE_PATH_PATTERN =
  /^\/runtime\/execution\/trust-risks\/([^/]+)\/acknowledge$/;

function extractAcknowledgeTrustRiskId(path) {
  const match = path.match(
    ACKNOWLEDGE_PATH_PATTERN
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

  const trustRiskId =
    extractAcknowledgeTrustRiskId(
      path
    );

  if (trustRiskId === null) {
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

  if (!trustRiskId) {
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
    const acknowledgedAt =
      new Date();

    const acknowledgedBy =
      auth.user.operator_id ||
      "system_admin";

    const trustRisk =
      await acknowledgeTrustRisk({
        db,
        trustRiskId,
        acknowledgedBy,
        acknowledgementNote:
          body.acknowledgement_note,
        acknowledgedAt
      });

    return send(res, 200, {
      action:
        "runtime.execution." +
        "trust-risk.acknowledge",

      acknowledged_by:
        acknowledgedBy,

      acknowledged_at:
        acknowledgedAt.toISOString(),

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
  extractAcknowledgeTrustRiskId,
  handleTrustRiskReviewRoute
};
