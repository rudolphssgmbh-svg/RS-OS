async function handleDefenseIngressRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent,
  executeDefensePipeline
}) {
    if (req.method === "POST" && path === "/runtime/defense/ingress") {
      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "operator",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);
      const tenant_id = body.tenant_id || auth.user.tenant_id;

      const payload = body.payload || {};
      const payload_hash = require("crypto")
        .createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");

      const result = await db.query(`
        INSERT INTO runtime_ingress_events (
          tenant_id,
          source_type,
          source_id,
          actor_id,
          actor_type,
          request_id,
          correlation_id,
          idempotency_key,
          ingress_channel,
          ingress_intent,
          target_object_id,
          target_object_type,
          target_action,
          payload,
          payload_hash,
          defense_status,
          defense_decision,
          risk_score,
          confidence_score
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          'classified',
          'shadow_validate',
          $16,
          $17
        )
        RETURNING *
      `, [
        tenant_id,
        body.source_type || "manual",
        body.source_id || null,
        auth.user.username || body.actor_id || null,
        body.actor_type || "user",
        body.request_id || null,
        body.correlation_id || null,
        body.idempotency_key || null,
        body.ingress_channel || "api",
        body.ingress_intent || "runtime_change",
        body.target_object_id || null,
        body.target_object_type || null,
        body.target_action || "unknown",
        JSON.stringify(payload),
        payload_hash,
        body.risk_score || 10,
        body.confidence_score || 70
      ]);

      const ingress = result.rows[0];

      await writeEvent({
        event_type: "runtime.defense.ingress.received",
        object_id: ingress.target_object_id,
        message: `Defense ingress received: ${ingress.ingress_id}`,
        tenant_id
      });

      await writeEvent({
        event_type: "runtime.defense.ingress.classified",
        object_id: ingress.target_object_id,
        message: `Defense ingress classified: ${ingress.defense_decision}`,
        tenant_id
      });

      const defense_pipeline = await executeDefensePipeline(ingress.ingress_id);

      const ingressRefresh = await db.query(`
        SELECT *
        FROM runtime_ingress_events
        WHERE ingress_id = $1
        LIMIT 1
      `, [
        ingress.ingress_id
      ]);

      const ingress_current = ingressRefresh.rows[0];

      // RSOS-070A ingress to observation/evidence bridge
      let signal_bridge = null;

      if (ingress_current && ingress_current.defense_decision === "allow") {
        const observationResult = await db.query(`
          INSERT INTO runtime_observations (
            observation_id,
            tenant_id,
            observation_text,
            observation_time,
            confidence,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            now(),
            $3,
            $4
          )
          RETURNING *
        `, [
          tenant_id,
          "Ingress signal observed: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          auth.user.username || "system"
        ]);

        const evidenceHash = require("crypto")
          .createHash("sha256")
          .update(JSON.stringify({
            ingress_id: ingress_current.ingress_id,
            payload_hash: ingress_current.payload_hash,
            defense_decision: ingress_current.defense_decision
          }))
          .digest("hex");

        const evidenceResult = await db.query(`
          INSERT INTO runtime_evidence (
            evidence_id,
            tenant_id,
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
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            now(),
            $10
          )
          RETURNING *
        `, [
          tenant_id,
          ingress_current.target_object_id,
          ingress_current.ingress_id,
          "ingress_signal",
          "Evidence from ingress signal",
          "Evidence generated from allowed ingress signal " + ingress_current.ingress_id,
          evidenceHash,
          ingress_current.confidence_score || 70,
          "captured",
          auth.user.username || "system"
        ]);

        await db.query(`
          UPDATE runtime_observations
          SET evidence_id = $1
          WHERE observation_id = $2
            AND tenant_id = $3
        `, [
          evidenceResult.rows[0].evidence_id,
          observationResult.rows[0].observation_id,
          tenant_id
        ]);

        await writeEvent({
          event_type: "runtime.signal.bridge.created",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "INGRESS_TO_OBSERVATION_EVIDENCE",
            ingress_id: ingress_current.ingress_id,
            observation_id: observationResult.rows[0].observation_id,
            evidence_id: evidenceResult.rows[0].evidence_id
          })
        });

        const assumptionResult = await db.query(`
          INSERT INTO runtime_assumptions (
            assumption_id,
            tenant_id,
            evidence_id,
            assumption_text,
            confidence,
            status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          evidenceResult.rows[0].evidence_id,
          "Allowed ingress signal may represent a valid runtime observation requiring verification: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          "open",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.assumption.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "EVIDENCE_TO_ASSUMPTION_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            evidence_id: evidenceResult.rows[0].evidence_id,
            assumption_id: assumptionResult.rows[0].assumption_id
          })
        });

        const hypothesisResult = await db.query(`
          INSERT INTO runtime_hypotheses (
            hypothesis_id,
            tenant_id,
            assumption_id,
            hypothesis_text,
            confidence,
            verification_status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          assumptionResult.rows[0].assumption_id,
          "If the allowed ingress signal is valid, then it should be verifiable as a runtime event: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          "pending",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.hypothesis.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "ASSUMPTION_TO_HYPOTHESIS_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            assumption_id: assumptionResult.rows[0].assumption_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id
          })
        });

        const verificationObjectResult = await db.query(`
          INSERT INTO runtime_verifications (
            verification_id,
            tenant_id,
            hypothesis_id,
            verification_method,
            verification_notes,
            status,
            created_by
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `, [
          tenant_id,
          hypothesisResult.rows[0].hypothesis_id,
          "signal_validation",
          "Verification object generated from ingress signal " + ingress_current.ingress_id,
          "pending",
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.verification.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "HYPOTHESIS_TO_VERIFICATION_OBJECT_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id,
            verification_id: verificationObjectResult.rows[0].verification_id
          })
        });

        const verificationCycleResult = await db.query(`
          INSERT INTO runtime_verification_cycles (
            verification_id,
            tenant_id,
            hypothesis_id,
            assumption_id,
            verification_type,
            verification_status,
            expected_value,
            confidence_before,
            created_by
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING *
        `, [
          verificationObjectResult.rows[0].verification_id,
          tenant_id,
          hypothesisResult.rows[0].hypothesis_id,
          assumptionResult.rows[0].assumption_id,
          "signal_validation",
          "pending",
          "Ingress signal should remain traceable and verifiable: " + ingress_current.ingress_id,
          ingress_current.confidence_score || 70,
          auth.user.username || "system"
        ]);

        await writeEvent({
          event_type: "runtime.verification_cycle.generated",
          object_id: ingress_current.target_object_id,
          tenant_id,
          message: JSON.stringify({
            reason_code: "HYPOTHESIS_TO_VERIFICATION_CYCLE_FROM_INGRESS",
            ingress_id: ingress_current.ingress_id,
            hypothesis_id: hypothesisResult.rows[0].hypothesis_id,
            verification_id: verificationCycleResult.rows[0].verification_id
          })
        });

        signal_bridge = {
          observation: observationResult.rows[0],
          evidence: evidenceResult.rows[0],
          assumption: assumptionResult.rows[0],
          hypothesis: hypothesisResult.rows[0],
          verification: verificationObjectResult.rows[0],
          verification_cycle: verificationCycleResult.rows[0]
        };
      }

      return send(res, 201, {
        ingress: ingress_current,
        defense_pipeline,
        signal_bridge
      });
    }

  return false;
}

module.exports = {
  handleDefenseIngressRoute
};
