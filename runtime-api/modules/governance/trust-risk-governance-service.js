const TRUST_RISK_VERIFICATION_TYPE =
  "runtime.execution.trust";

function normalizeCount(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function extractAnomalyEventIds(
  trustResult = {}
) {
  const anomalies =
    Array.isArray(trustResult.anomalies)
      ? trustResult.anomalies
      : [];

  return [
    ...new Set(
      anomalies
        .map(anomaly =>
          anomaly &&
          typeof anomaly.event_id ===
            "string"
            ? anomaly.event_id.trim()
            : ""
        )
        .filter(Boolean)
    )
  ];
}

function createEmptyLifecycleSummary({
  anomalyEventIds = []
} = {}) {
  return {
    verification_type:
      TRUST_RISK_VERIFICATION_TYPE,

    anomaly_event_count:
      anomalyEventIds.length,

    anomaly_event_ids:
      anomalyEventIds,

    materialized_count:
      0,

    unmaterialized_count:
      anomalyEventIds.length,

    unmaterialized_event_ids:
      [...anomalyEventIds],

    open_count:
      0,

    acknowledged_count:
      0,

    resolved_count:
      0,

    lifecycle_state:
      anomalyEventIds.length > 0
        ? "unmaterialized"
        : "not_applicable",

    risks:
      []
  };
}

async function readTrustRiskLifecycleSummary({
  db,
  trustResult
}) {
  if (
    !db ||
    typeof db.query !== "function"
  ) {
    throw new TypeError(
      "db.query is required"
    );
  }

  const anomalyEventIds =
    extractAnomalyEventIds(
      trustResult
    );

  if (anomalyEventIds.length === 0) {
    return createEmptyLifecycleSummary({
      anomalyEventIds
    });
  }

  const result = await db.query(`
    SELECT
      trust_risk_id,
      source_event_id,
      anomaly_reason,
      severity,
      risk_state,
      occurrence_count,
      resolved_at,
      resolution_note,
      created_at,
      updated_at
    FROM runtime_trust_risks
    WHERE verification_type = $1
      AND source_event_id =
        ANY($2::text[])
    ORDER BY
      source_event_id,
      created_at,
      trust_risk_id
  `, [
    TRUST_RISK_VERIFICATION_TYPE,
    anomalyEventIds
  ]);

  const risks =
    result.rows || [];

  const materializedEventIds =
    new Set(
      risks
        .map(risk =>
          risk.source_event_id
        )
        .filter(Boolean)
    );

  const unmaterializedEventIds =
    anomalyEventIds.filter(
      eventId =>
        !materializedEventIds.has(
          eventId
        )
    );

  const openCount =
    risks.filter(
      risk =>
        risk.risk_state === "open"
    ).length;

  const acknowledgedCount =
    risks.filter(
      risk =>
        risk.risk_state ===
        "acknowledged"
    ).length;

  const resolvedCount =
    risks.filter(
      risk =>
        risk.risk_state ===
        "resolved"
    ).length;

  let lifecycleState =
    "mixed";

  if (unmaterializedEventIds.length > 0) {
    lifecycleState =
      "unmaterialized";
  } else if (openCount > 0) {
    lifecycleState =
      "open";
  } else if (acknowledgedCount > 0) {
    lifecycleState =
      "acknowledged";
  } else if (
    resolvedCount ===
      anomalyEventIds.length &&
    risks.length ===
      anomalyEventIds.length
  ) {
    lifecycleState =
      "resolved";
  }

  return {
    verification_type:
      TRUST_RISK_VERIFICATION_TYPE,

    anomaly_event_count:
      anomalyEventIds.length,

    anomaly_event_ids:
      anomalyEventIds,

    materialized_count:
      risks.length,

    unmaterialized_count:
      unmaterializedEventIds.length,

    unmaterialized_event_ids:
      unmaterializedEventIds,

    open_count:
      openCount,

    acknowledged_count:
      acknowledgedCount,

    resolved_count:
      resolvedCount,

    lifecycle_state:
      lifecycleState,

    risks:
      risks
  };
}

function buildRecommendation({
  trustLevel,
  recommendedGovernance,
  governanceState,
  humanApprovalRequired,
  autonomousExecutionAllowed,
  reason
}) {
  return {
    trust_level:
      trustLevel,

    recommended_governance:
      recommendedGovernance,

    governance_state:
      governanceState,

    human_approval_required:
      humanApprovalRequired,

    autonomous_execution_allowed:
      autonomousExecutionAllowed,

    reason
  };
}

function deriveTrustGovernanceRecommendation(
  trustResult = {},
  lifecycleSummary =
    createEmptyLifecycleSummary()
) {
  const chainValid =
    trustResult.chain_valid === true;

  const hashesValid =
    trustResult.hashes_valid === true;

  const trustScore =
    normalizeCount(
      trustResult.trust_score
    );

  const anomalyEvents =
    normalizeCount(
      trustResult.anomaly_events
    );

  const legacyMode =
    trustResult.legacy_mode === true;

  if (!chainValid || !hashesValid) {
    return buildRecommendation({
      trustLevel:
        "BLOCKED",

      recommendedGovernance:
        "blocked",

      governanceState:
        "trust_blocked",

      humanApprovalRequired:
        true,

      autonomousExecutionAllowed:
        false,

      reason:
        "Execution trust chain or hash verification failed"
    });
  }

  if (trustScore < 60) {
    return buildRecommendation({
      trustLevel:
        "BLOCKED",

      recommendedGovernance:
        "blocked",

      governanceState:
        "trust_blocked",

      humanApprovalRequired:
        true,

      autonomousExecutionAllowed:
        false,

      reason:
        "Trust score below blocking threshold"
    });
  }

  if (trustScore < 80) {
    return buildRecommendation({
      trustLevel:
        "REVIEW_REQUIRED",

      recommendedGovernance:
        "review_required",

      governanceState:
        "trust_review_required",

      humanApprovalRequired:
        true,

      autonomousExecutionAllowed:
        false,

      reason:
        "Trust score requires governance review"
    });
  }

  if (anomalyEvents > 0) {
    if (
      lifecycleSummary
        .unmaterialized_count > 0
    ) {
      return buildRecommendation({
        trustLevel:
          "VERIFIED_WITH_UNMATERIALIZED_ANOMALY",

        recommendedGovernance:
          "review_required",

        governanceState:
          "trust_review_required",

        humanApprovalRequired:
          true,

        autonomousExecutionAllowed:
          false,

        reason:
          "Trust anomaly has not been materialized for human review"
      });
    }

    if (
      lifecycleSummary.open_count > 0
    ) {
      return buildRecommendation({
        trustLevel:
          "VERIFIED_WITH_OPEN_TRUST_RISK",

        recommendedGovernance:
          "review_required",

        governanceState:
          "trust_review_required",

        humanApprovalRequired:
          true,

        autonomousExecutionAllowed:
          false,

        reason:
          "Open trust risk requires human review"
      });
    }

    if (
      lifecycleSummary
        .acknowledged_count > 0
    ) {
      return buildRecommendation({
        trustLevel:
          "VERIFIED_WITH_ACKNOWLEDGED_TRUST_RISK",

        recommendedGovernance:
          "review_required",

        governanceState:
          "trust_risk_acknowledged",

        humanApprovalRequired:
          true,

        autonomousExecutionAllowed:
          false,

        reason:
          "Trust risk was reviewed and acknowledged but remains unresolved"
      });
    }

    const allAnomaliesResolved =
      lifecycleSummary.resolved_count ===
        anomalyEvents &&
      lifecycleSummary
        .materialized_count ===
        anomalyEvents &&
      lifecycleSummary
        .unmaterialized_count === 0;

    if (allAnomaliesResolved) {
      if (legacyMode) {
        return buildRecommendation({
          trustLevel:
            "VERIFIED_WITH_RESOLVED_ANOMALY_AND_LEGACY",

          recommendedGovernance:
            "review_required",

          governanceState:
            "legacy_review_required",

          humanApprovalRequired:
            true,

          autonomousExecutionAllowed:
            false,

          reason:
            "Anomaly risks are resolved but legacy dataset markers still require review"
        });
      }

      return buildRecommendation({
        trustLevel:
          "VERIFIED_WITH_RESOLVED_TRUST_RISK",

        recommendedGovernance:
          "allowed",

        governanceState:
          "trust_risk_resolved",

        humanApprovalRequired:
          false,

        autonomousExecutionAllowed:
          true,

        reason:
          "All materialized trust anomaly risks are resolved"
      });
    }

    return buildRecommendation({
      trustLevel:
        "VERIFIED_WITH_TRUST_RISK_STATE_MISMATCH",

      recommendedGovernance:
        "review_required",

      governanceState:
        "trust_review_required",

      humanApprovalRequired:
        true,

      autonomousExecutionAllowed:
        false,

      reason:
        "Trust anomaly lifecycle state is incomplete or inconsistent"
    });
  }

  if (legacyMode) {
    return buildRecommendation({
      trustLevel:
        "VERIFIED_WITH_LEGACY",

      recommendedGovernance:
        "review_required",

      governanceState:
        "legacy_review_required",

      humanApprovalRequired:
        true,

      autonomousExecutionAllowed:
        false,

      reason:
        "Trust is valid but legacy dataset markers require human review"
    });
  }

  return buildRecommendation({
    trustLevel:
      "VERIFIED",

    recommendedGovernance:
      "allowed",

    governanceState:
      "baseline_clear",

    humanApprovalRequired:
      false,

    autonomousExecutionAllowed:
      true,

    reason:
      "Execution trust verified without active legacy or anomaly restrictions"
  });
}

module.exports = {
  TRUST_RISK_VERIFICATION_TYPE,
  createEmptyLifecycleSummary,
  deriveTrustGovernanceRecommendation,
  extractAnomalyEventIds,
  readTrustRiskLifecycleSummary
};
