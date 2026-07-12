const AUDIT_CHAIN_LOCK_NAME =
  "rsos.runtime_events.audit_chain.v1";

function requireQueryClient(
  client,
  errorCode = "invalid_database_client"
) {
  if (
    !client ||
    typeof client.query !== "function"
  ) {
    throw new Error(errorCode);
  }

  return client;
}

function requireDatabasePool(db) {
  if (
    !db ||
    typeof db.connect !== "function"
  ) {
    throw new Error(
      "invalid_database_pool"
    );
  }

  return db;
}

function requireAuditHashFactory(
  createAuditHash
) {
  if (
    typeof createAuditHash !== "function"
  ) {
    throw new Error(
      "invalid_audit_hash_factory"
    );
  }

  return createAuditHash;
}

function buildRuntimeEventId() {
  return (
    "evt-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );
}

async function writeRuntimeEventWithClient({
  client,
  createAuditHash,
  event_type,
  object_id = null,
  message = "",
  tenant_id = null,
  event_payload = {}
}) {
  const queryClient =
    requireQueryClient(client);

  const auditHashFactory =
    requireAuditHashFactory(
      createAuditHash
    );

  await queryClient.query(`
    SELECT pg_advisory_xact_lock(
      hashtextextended($1, 0)
    )
  `, [
    AUDIT_CHAIN_LOCK_NAME
  ]);

  const previousEvent =
    await queryClient.query(`
      SELECT
        event_id,
        audit_hash,
        created_at
      FROM runtime_events
      ORDER BY
        created_at DESC,
        event_id DESC
      LIMIT 1
    `);

  const previous_hash =
    previousEvent.rows.length > 0
      ? previousEvent.rows[0].audit_hash
      : null;

  const audit_hash =
    auditHashFactory({
      event_type,
      object_id,
      message,
      previous_hash,
      tenant_id
    });

  const event_id =
    buildRuntimeEventId();

  const insertResult =
    await queryClient.query(`
      INSERT INTO runtime_events
      (
        event_id,
        event_type,
        object_id,
        message,
        audit_hash,
        previous_hash,
        tenant_id,
        event_payload,
        created_at
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
        clock_timestamp()
      )
      RETURNING
        created_at
    `, [
      event_id,
      event_type,
      object_id,
      message,
      audit_hash,
      previous_hash,
      tenant_id,
      JSON.stringify(event_payload)
    ]);

  return {
    event_id,
    audit_hash,
    previous_hash,
    created_at:
      insertResult.rows[0]
        ? insertResult.rows[0].created_at
        : null
  };
}

function createRuntimeEventWriter({
  db,
  createAuditHash
}) {
  const databasePool =
    requireDatabasePool(db);

  const auditHashFactory =
    requireAuditHashFactory(
      createAuditHash
    );

  return async function writeEvent({
    event_type,
    object_id = null,
    message = "",
    tenant_id = null,
    event_payload = {},
    transaction_client = null
  }) {
    if (transaction_client) {
      return writeRuntimeEventWithClient({
        client: transaction_client,
        createAuditHash:
          auditHashFactory,
        event_type,
        object_id,
        message,
        tenant_id,
        event_payload
      });
    }

    const client =
      await databasePool.connect();

    if (
      !client ||
      typeof client.query !== "function" ||
      typeof client.release !== "function"
    ) {
      throw new Error(
        "invalid_database_transaction_client"
      );
    }

    try {
      await client.query("BEGIN");

      const result =
        await writeRuntimeEventWithClient({
          client,
          createAuditHash:
            auditHashFactory,
          event_type,
          object_id,
          message,
          tenant_id,
          event_payload
        });

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original event-write error.
      }

      throw error;
    } finally {
      client.release();
    }
  };
}

module.exports = {
  AUDIT_CHAIN_LOCK_NAME,
  buildRuntimeEventId,
  createRuntimeEventWriter,
  writeRuntimeEventWithClient
};
