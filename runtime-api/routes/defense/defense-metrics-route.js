async function handleDefenseMetricsRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/metrics/recalculate") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const body = await readBody(req);
    const tenant_id = body.tenant_id || auth.user.tenant_id;
    const metric_date = body.metric_date || new Date().toISOString().slice(0, 10);

    const result = await db.query(`
      WITH ingress AS (
        SELECT
          COUNT(*)::int AS ingress_count,
          COUNT(*) FILTER (WHERE defense_decision = 'allow')::int AS allow_count,
          COUNT(*) FILTER (WHERE defense_decision IN ('shadow_validate', 'allow_after_review'))::int AS shadow_validation_count,
          COUNT(*) FILTER (WHERE defense_decision IN ('quarantine', 'reject_after_review'))::int AS quarantine_count,
          COALESCE(AVG(risk_score), 0)::numeric(10,2) AS avg_risk_score,
          COALESCE(AVG(confidence_score), 0)::numeric(10,2) AS avg_confidence_score
        FROM runtime_ingress_events
        WHERE tenant_id = $1
          AND created_at::date = $2::date
      ),
      quarantine AS (
        SELECT
          COUNT(*) FILTER (WHERE status IN ('under_review', 'approved_for_apply', 'rejected'))::int AS review_count,
          COUNT(*) FILTER (WHERE status = 'approved_for_apply')::int AS approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count
        FROM runtime_quarantine_queue
        WHERE tenant_id = $1
          AND created_at::date = $2::date
      ),
      recovery AS (
        SELECT
          COUNT(*)::int AS recovery_request_count,
          COUNT(*) FILTER (WHERE execution_status = 'completed')::int AS recovery_completed_count
        FROM runtime_recovery_requests
        WHERE tenant_id = $1
          AND created_at::date = $2::date
      ),
      verification AS (
        SELECT
          COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verification_count,
          COUNT(*) FILTER (WHERE closure_status = 'closed')::int AS closure_count
        FROM runtime_recovery_verifications
        WHERE tenant_id = $1
          AND created_at::date = $2::date
      )
      INSERT INTO runtime_defense_metrics (
        tenant_id,
        metric_date,
        ingress_count,
        allow_count,
        shadow_validation_count,
        quarantine_count,
        review_count,
        approved_count,
        rejected_count,
        recovery_request_count,
        recovery_completed_count,
        verification_count,
        closure_count,
        avg_risk_score,
        avg_confidence_score
      )
      SELECT
        $1,
        $2::date,
        ingress.ingress_count,
        ingress.allow_count,
        ingress.shadow_validation_count,
        ingress.quarantine_count,
        quarantine.review_count,
        quarantine.approved_count,
        quarantine.rejected_count,
        recovery.recovery_request_count,
        recovery.recovery_completed_count,
        verification.verification_count,
        verification.closure_count,
        ingress.avg_risk_score,
        ingress.avg_confidence_score
      FROM ingress, quarantine, recovery, verification
      ON CONFLICT (tenant_id, metric_date)
      DO UPDATE SET
        ingress_count = EXCLUDED.ingress_count,
        allow_count = EXCLUDED.allow_count,
        shadow_validation_count = EXCLUDED.shadow_validation_count,
        quarantine_count = EXCLUDED.quarantine_count,
        review_count = EXCLUDED.review_count,
        approved_count = EXCLUDED.approved_count,
        rejected_count = EXCLUDED.rejected_count,
        recovery_request_count = EXCLUDED.recovery_request_count,
        recovery_completed_count = EXCLUDED.recovery_completed_count,
        verification_count = EXCLUDED.verification_count,
        closure_count = EXCLUDED.closure_count,
        avg_risk_score = EXCLUDED.avg_risk_score,
        avg_confidence_score = EXCLUDED.avg_confidence_score
      RETURNING *
    `, [
      tenant_id,
      metric_date
    ]);

    await writeEvent({
      event_type: "runtime.defense.metrics.recalculated",
      object_id: null,
      message: `Defense metrics recalculated for ${tenant_id} on ${metric_date}`,
      tenant_id
    });

    return send(res, 200, {
      metrics: result.rows[0]
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/metrics") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      SELECT *
      FROM runtime_defense_metrics
      WHERE tenant_id = $1
      ORDER BY metric_date DESC
      LIMIT 30
    `, [
      tenant_id
    ]);

    return send(res, 200, {
      metrics: result.rows
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/dashboard") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const metricsResult = await db.query(`
      SELECT *
      FROM runtime_defense_metrics
      WHERE tenant_id = $1
      ORDER BY metric_date DESC
      LIMIT 1
    `, [
      tenant_id
    ]);

    const stateResult = await db.query(`
      SELECT *
      FROM runtime_defense_state
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [
      tenant_id
    ]);

    const latest_metrics = metricsResult.rows[0] || null;

    let kpi_ratios = null;

    if (latest_metrics) {
      const ingress_count = Number(latest_metrics.ingress_count || 0);
      const quarantine_count = Number(latest_metrics.quarantine_count || 0);
      const allow_count = Number(latest_metrics.allow_count || 0);
      const shadow_validation_count = Number(latest_metrics.shadow_validation_count || 0);
      const recovery_request_count = Number(latest_metrics.recovery_request_count || 0);
      const recovery_completed_count = Number(latest_metrics.recovery_completed_count || 0);
      const verification_count = Number(latest_metrics.verification_count || 0);
      const closure_count = Number(latest_metrics.closure_count || 0);
      const rejected_count = Number(latest_metrics.rejected_count || 0);
      const approved_count = Number(latest_metrics.approved_count || 0);

      const ratio = (part, total) => {
        if (!total || total === 0) return 0;
        return Math.round((part / total) * 10000) / 100;
      };

      kpi_ratios = {
        allow_rate_percent: ratio(allow_count, ingress_count),
        shadow_validation_rate_percent: ratio(shadow_validation_count, ingress_count),
        quarantine_rate_percent: ratio(quarantine_count, ingress_count),
        recovery_success_rate_percent: ratio(recovery_completed_count, recovery_request_count),
        verification_rate_percent: ratio(verification_count, recovery_completed_count),
        closure_rate_percent: ratio(closure_count, verification_count),
        rejection_rate_percent: ratio(rejected_count, rejected_count + approved_count),
        avg_risk_score: Number(latest_metrics.avg_risk_score || 0),
        avg_confidence_score: Number(latest_metrics.avg_confidence_score || 0)
      };
    }

    return send(res, 200, {
      dashboard: {
        latest_metrics,
        kpi_ratios,
        defense_state: stateResult.rows[0] || null
      }
    });
  }

  return false;
}

module.exports = {
  handleDefenseMetricsRoute
};
