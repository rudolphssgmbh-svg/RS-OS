async function handleCommunicationRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send
}) {
    // ACKNOWLEDGE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/ack/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/ack/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "sent") {
        return send(res, 409, {
          error: "communication_event_not_sent",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const acknowledged_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        acknowledged_by,
        tenant_id,
        communication_event_id
      ]);

      const acknowledgedCommunication = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: acknowledgedCommunication.receiver_id,
        event_type: "runtime.communication.acknowledged",
        message: `Communication acknowledged: ${acknowledgedCommunication.message_type}`
      });

      return send(res, 200, {
        acknowledged: true,
        communication: acknowledgedCommunication
      });
    }





    const handledOrchestrationRoute = await handleOrchestrationRoute({
      req,
      res,
      path,
      db,
      requireRole,
      readBody,
      writeEvent,
      send
    });

    if (handledOrchestrationRoute) {
      return;
    }

    // GET COMMUNICATION SUMMARY BY RECEIVER

    if (req.method === "GET" && path.startsWith("/runtime/communication-summary/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const receiver_id = decodeURIComponent(
        path.replace("/runtime/communication-summary/", "")
      );

      if (!receiver_id) {
        return send(res, 400, {
          error: "missing_receiver_id"
        });
      }

      const result = await db.query(`
        SELECT
          communication_evidence_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by,
          created_at
        FROM runtime_communication_evidence
        WHERE tenant_id = $1
          AND receiver_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        receiver_id
      ]);

      const evidence_count = result.rows.length;
      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const avg = (values) => {
        const usable = values.filter(value => value !== null && value !== undefined);
        if (usable.length === 0) return null;
        return Math.round(
          usable.reduce((sum, value) => sum + Number(value || 0), 0) / usable.length
        );
      };

      const average_ack_latency_seconds = avg(
        result.rows.map(row => row.ack_latency_seconds)
      );

      const average_completion_latency_seconds = avg(
        result.rows.map(row => row.completion_latency_seconds)
      );

      const effectiveness_score =
        evidence_count > 0
          ? Math.round((positive_count / evidence_count) * 1000) / 10
          : 0;

      const byMessageType = {};

      for (const row of result.rows) {
        if (!byMessageType[row.message_type]) {
          byMessageType[row.message_type] = {
            message_type: row.message_type,
            evidence_count: 0,
            positive_count: 0,
            neutral_count: 0,
            negative_count: 0,
            average_ack_latency_seconds: null,
            average_completion_latency_seconds: null,
            _ack_values: [],
            _completion_values: []
          };
        }

        const entry = byMessageType[row.message_type];

        entry.evidence_count += 1;

        if (row.effectiveness === "positive") entry.positive_count += 1;
        if (row.effectiveness === "neutral") entry.neutral_count += 1;
        if (row.effectiveness === "negative") entry.negative_count += 1;

        if (row.ack_latency_seconds !== null && row.ack_latency_seconds !== undefined) {
          entry._ack_values.push(row.ack_latency_seconds);
        }

        if (row.completion_latency_seconds !== null && row.completion_latency_seconds !== undefined) {
          entry._completion_values.push(row.completion_latency_seconds);
        }
      }

      for (const entry of Object.values(byMessageType)) {
        entry.average_ack_latency_seconds = avg(entry._ack_values);
        entry.average_completion_latency_seconds = avg(entry._completion_values);
        delete entry._ack_values;
        delete entry._completion_values;
      }

      return send(res, 200, {
        tenant_id,
        receiver_id,
        evidence_count,
        positive_count,
        neutral_count,
        negative_count,
        effectiveness_score,
        average_ack_latency_seconds,
        average_completion_latency_seconds,
        by_message_type: Object.values(byMessageType),
        evidence: result.rows
      });
    }

    // GET COMMUNICATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/communications/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const communicationResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (communicationResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communication = communicationResult.rows[0];

      const auditResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          created_at,
          audit_hash,
          previous_hash
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
          AND event_type LIKE 'runtime.communication.%'
        ORDER BY created_at DESC
      `, [
        tenant_id,
        communication.receiver_id
      ]);

      const createdAt = communication.created_at ? new Date(communication.created_at).getTime() : null;
      const acknowledgedAt = communication.acknowledged_at ? new Date(communication.acknowledged_at).getTime() : null;
      const completedAt = communication.completed_at ? new Date(communication.completed_at).getTime() : null;

      const ack_latency_seconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completion_latency_seconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      return send(res, 200, {
        tenant_id,
        communication_event_id,
        status: communication.status,
        sender_id: communication.sender_id,
        receiver_id: communication.receiver_id,
        direction: communication.direction,
        message_type: communication.message_type,
        subject: communication.subject,
        payload: communication.payload,
        tx: {
          sent: true,
          sent_by: communication.created_by,
          sent_at: communication.created_at
        },
        ack: {
          acknowledged: communication.acknowledged_at !== null,
          acknowledged_by: communication.acknowledged_by,
          acknowledged_at: communication.acknowledged_at,
          ack_latency_seconds
        },
        result: {
          completed: communication.completed_at !== null,
          completed_by: communication.completed_by,
          completed_at: communication.completed_at,
          completion_latency_seconds
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // COMPLETE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/complete/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "acknowledged") {
        return send(res, 409, {
          error: "communication_event_not_acknowledged",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        communication_event_id
      ]);

      const completedCommunication = updateResult.rows[0];

      const createdAt = completedCommunication.created_at ? new Date(completedCommunication.created_at).getTime() : null;
      const acknowledgedAt = completedCommunication.acknowledged_at ? new Date(completedCommunication.acknowledged_at).getTime() : null;
      const completedAt = completedCommunication.completed_at ? new Date(completedCommunication.completed_at).getTime() : null;

      const ackLatencySeconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completionLatencySeconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      const communicationEffectiveness = "positive";

      const communication_evidence_id =
        "cev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      await db.query(`
        INSERT INTO runtime_communication_evidence (
          communication_evidence_id,
          tenant_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        communication_evidence_id,
        tenant_id,
        completedCommunication.communication_event_id,
        completedCommunication.sender_id,
        completedCommunication.receiver_id,
        completedCommunication.message_type,
        ackLatencySeconds,
        completionLatencySeconds,
        communicationEffectiveness,
        completed_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.evidence.created",
        message: `Communication evidence created: ${communicationEffectiveness}`
      });

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.completed",
        message: `Communication completed: ${completedCommunication.message_type}`
      });

      return send(res, 200, {
        completed: true,
        communication: completedCommunication,
        communication_evidence_created: true,
        communication_evidence: {
          communication_evidence_id,
          communication_event_id: completedCommunication.communication_event_id,
          sender_id: completedCommunication.sender_id,
          receiver_id: completedCommunication.receiver_id,
          message_type: completedCommunication.message_type,
          ack_latency_seconds: ackLatencySeconds,
          completion_latency_seconds: completionLatencySeconds,
          effectiveness: communicationEffectiveness
        }
      });
    }

    // SEND COMMUNICATION EVENT

    if (req.method === "POST" && path === "/runtime/communications/send") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const sender_id = body.sender_id;
      const receiver_id = body.receiver_id;
      const direction = body.direction || "TX";
      const message_type = body.message_type || "MESSAGE";
      const subject = body.subject || null;
      const payload = body.payload || {};

      if (!sender_id || !receiver_id) {
        return send(res, 400, {
          error: "missing_sender_or_receiver"
        });
      }

      const communication_event_id =
        "com-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_communication_events (
          communication_event_id,
          tenant_id,
          sender_id,
          receiver_id,
          direction,
          message_type,
          subject,
          payload,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',$9)
      `, [
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: receiver_id,
        event_type: "runtime.communication.sent",
        message: `Communication sent: ${message_type}`
      });

      return send(res, 200, {
        sent: true,
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        status: "sent"
      });
    }


  return false;
}

module.exports = {
  handleCommunicationRoute
};
