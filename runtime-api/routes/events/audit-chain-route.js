async function handleAuditChainVerifyRoute({
  req,
  res,
  db,
  send,
  requireRole
}) {
  const auth = requireRole(req, [
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const result = await db.query(`
    SELECT
      event_id,
      event_type,
      object_id,
      audit_hash,
      previous_hash,
      created_at
    FROM runtime_events
    WHERE tenant_id = $1
    ORDER BY created_at ASC
  `, [
    auth.user.tenant_id
  ]);

  const events = result.rows;

  let chain_valid = true;
  let broken_at = null;
  let expected_previous_hash = null;
  let actual_previous_hash = null;

  for (let i = 1; i < events.length; i++) {
    const previous = events[i - 1];
    const current = events[i];

    if (current.previous_hash !== previous.audit_hash) {
      chain_valid = false;
      broken_at = current.event_id;
      expected_previous_hash = previous.audit_hash;
      actual_previous_hash = current.previous_hash;
      break;
    }
  }

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    events_checked: events.length,
    chain_valid,
    broken_at,
    expected_previous_hash,
    actual_previous_hash,
    first_event_id: events.length > 0 ? events[0].event_id : null,
    last_event_id: events.length > 0 ? events[events.length - 1].event_id : null
  });
}

module.exports = { handleAuditChainVerifyRoute };
