const SCREEN_SELECT = `
  SELECT
    screen_id,
    tenant_id,
    screen_key,
    screen_name,
    location_name,
    status,
    metadata,
    created_by,
    created_at,
    updated_at,
    retired_at
  FROM public.runtime_signage_screens
`;

const MAX_COLLECTION_LIMIT = 100;
const DEFAULT_COLLECTION_LIMIT = 50;

class SignageServiceError extends Error {
  constructor(
    code,
    {
      status = 400,
      details = {}
    } = {}
  ) {
    super(code);

    this.name = "SignageServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requireDatabasePool(db) {
  if (
    !db ||
    typeof db.connect !== "function" ||
    typeof db.query !== "function"
  ) {
    throw new Error(
      "invalid_database_pool"
    );
  }

  return db;
}

function requireTransactionClient(client) {
  if (
    !client ||
    typeof client.query !== "function" ||
    typeof client.release !== "function"
  ) {
    throw new Error(
      "invalid_database_transaction_client"
    );
  }

  return client;
}

function requireEventWriter(writeEvent) {
  if (typeof writeEvent !== "function") {
    throw new Error(
      "invalid_runtime_event_writer"
    );
  }

  return writeEvent;
}

function requireNonEmptyString(
  value,
  fieldName,
  maximumLength = null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new SignageServiceError(
      `invalid_or_missing_${fieldName}`,
      {
        status: 400
      }
    );
  }

  const normalized = value.trim();

  if (
    maximumLength !== null &&
    normalized.length > maximumLength
  ) {
    throw new SignageServiceError(
      `${fieldName}_too_long`,
      {
        status: 400,
        details: {
          maximum_length: maximumLength
        }
      }
    );
  }

  return normalized;
}

function normalizeOptionalString(
  value,
  fieldName,
  maximumLength = null
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new SignageServiceError(
      `invalid_${fieldName}`,
      {
        status: 400
      }
    );
  }

  const normalized = value.trim();

  if (
    maximumLength !== null &&
    normalized.length > maximumLength
  ) {
    throw new SignageServiceError(
      `${fieldName}_too_long`,
      {
        status: 400,
        details: {
          maximum_length: maximumLength
        }
      }
    );
  }

  return normalized === ""
    ? null
    : normalized;
}

function normalizeMetadata(value) {
  if (value === undefined) {
    return {};
  }

  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new SignageServiceError(
      "invalid_metadata",
      {
        status: 400
      }
    );
  }

  return value;
}

function normalizeCollectionLimit(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return DEFAULT_COLLECTION_LIMIT;
  }

  const normalized = Number(value);

  if (
    !Number.isInteger(normalized) ||
    normalized < 1 ||
    normalized > MAX_COLLECTION_LIMIT
  ) {
    throw new SignageServiceError(
      "invalid_limit",
      {
        status: 400,
        details: {
          minimum: 1,
          maximum: MAX_COLLECTION_LIMIT
        }
      }
    );
  }

  return normalized;
}

function normalizeCollectionOffset(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const normalized = Number(value);

  if (
    !Number.isInteger(normalized) ||
    normalized < 0
  ) {
    throw new SignageServiceError(
      "invalid_offset",
      {
        status: 400,
        details: {
          minimum: 0
        }
      }
    );
  }

  return normalized;
}

function requireUuidLikeIdentifier(
  value,
  fieldName
) {
  const normalized =
    requireNonEmptyString(
      value,
      fieldName,
      128
    );

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalized)
  ) {
    throw new SignageServiceError(
      `invalid_${fieldName}`,
      {
        status: 400
      }
    );
  }

  return normalized;
}

function mapDatabaseError(error) {
  if (
    error instanceof
    SignageServiceError
  ) {
    return error;
  }

  if (!error || typeof error !== "object") {
    return error;
  }

  if (error.code === "23505") {
    return new SignageServiceError(
      "signage_resource_conflict",
      {
        status: 409,
        details: {
          constraint:
            error.constraint || null
        }
      }
    );
  }

  if (error.code === "23503") {
    return new SignageServiceError(
      "signage_resource_not_found",
      {
        status: 404
      }
    );
  }

  if (error.code === "23514") {
    return new SignageServiceError(
      "invalid_signage_resource_state",
      {
        status: 422,
        details: {
          constraint:
            error.constraint || null
        }
      }
    );
  }

  if (
    error.code === "22P02" ||
    error.code === "22023"
  ) {
    return new SignageServiceError(
      "invalid_request_value",
      {
        status: 400
      }
    );
  }

  return error;
}

async function withTransaction({
  db,
  operation
}) {
  const databasePool =
    requireDatabasePool(db);

  if (typeof operation !== "function") {
    throw new Error(
      "invalid_transaction_operation"
    );
  }

  const client =
    requireTransactionClient(
      await databasePool.connect()
    );

  try {
    await client.query("BEGIN");

    const result =
      await operation(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original write error.
    }

    throw mapDatabaseError(error);
  } finally {
    client.release();
  }
}

function buildActorId(user) {
  if (
    !user ||
    typeof user !== "object"
  ) {
    throw new SignageServiceError(
      "authenticated_actor_required",
      {
        status: 401
      }
    );
  }

  return requireNonEmptyString(
    user.operator_id ||
      user.username ||
      user.sub,
    "actor_id",
    256
  );
}

async function createScreen({
  db,
  writeEvent,
  tenantId,
  actorId,
  screenKey,
  screenName,
  locationName = null,
  metadata = {}
}) {
  const eventWriter =
    requireEventWriter(writeEvent);

  const normalizedTenantId =
    requireNonEmptyString(
      tenantId,
      "tenant_id",
      256
    );

  const normalizedActorId =
    requireNonEmptyString(
      actorId,
      "actor_id",
      256
    );

  const normalizedScreenKey =
    requireNonEmptyString(
      screenKey,
      "screen_key",
      256
    );

  const normalizedScreenName =
    requireNonEmptyString(
      screenName,
      "screen_name",
      512
    );

  const normalizedLocationName =
    normalizeOptionalString(
      locationName,
      "location_name",
      512
    );

  const normalizedMetadata =
    normalizeMetadata(metadata);

  return withTransaction({
    db,

    operation: async client => {
      const insertResult =
        await client.query(`
          INSERT INTO public.runtime_signage_screens (
            tenant_id,
            screen_key,
            screen_name,
            location_name,
            metadata,
            created_by
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            $6
          )
          RETURNING
            screen_id,
            tenant_id,
            screen_key,
            screen_name,
            location_name,
            status,
            metadata,
            created_by,
            created_at,
            updated_at,
            retired_at
        `, [
          normalizedTenantId,
          normalizedScreenKey,
          normalizedScreenName,
          normalizedLocationName,
          JSON.stringify(
            normalizedMetadata
          ),
          normalizedActorId
        ]);

      const screen =
        insertResult.rows[0];

      const eventPayload = {
        tenant_id:
          normalizedTenantId,

        screen_id:
          screen.screen_id,

        screen_key:
          screen.screen_key,

        screen_name:
          screen.screen_name,

        status:
          screen.status,

        created_by:
          normalizedActorId
      };

      const auditEvent =
        await eventWriter({
          tenant_id:
            normalizedTenantId,

          object_id:
            screen.screen_id,

          event_type:
            "runtime.signage.screen.created",

          message:
            JSON.stringify(
              eventPayload
            ),

          event_payload:
            eventPayload,

          transaction_client:
            client
        });

      return {
        screen,
        audit_event:
          auditEvent
      };
    }
  });
}

async function listScreens({
  db,
  tenantId,
  limit,
  offset,
  status = null
}) {
  const databasePool =
    requireDatabasePool(db);

  const normalizedTenantId =
    requireNonEmptyString(
      tenantId,
      "tenant_id",
      256
    );

  const normalizedLimit =
    normalizeCollectionLimit(limit);

  const normalizedOffset =
    normalizeCollectionOffset(offset);

  const normalizedStatus =
    normalizeOptionalString(
      status,
      "status",
      64
    );

  const values = [
    normalizedTenantId
  ];

  let statusPredicate = "";

  if (normalizedStatus !== null) {
    values.push(
      normalizedStatus
    );

    statusPredicate =
      `AND status = $${values.length}`;
  }

  values.push(
    normalizedLimit
  );

  const limitPosition =
    values.length;

  values.push(
    normalizedOffset
  );

  const offsetPosition =
    values.length;

  const result =
    await databasePool.query(`
      ${SCREEN_SELECT}
      WHERE tenant_id = $1
        ${statusPredicate}
      ORDER BY
        created_at DESC,
        screen_id DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `, values);

  return {
    screens:
      result.rows,

    pagination: {
      limit:
        normalizedLimit,

      offset:
        normalizedOffset,

      returned:
        result.rows.length
    }
  };
}

async function getScreen({
  db,
  tenantId,
  screenId,
  forUpdate = false
}) {
  const database =
    forUpdate
      ? db
      : requireDatabasePool(db);

  if (
    !database ||
    typeof database.query !== "function"
  ) {
    throw new Error(
      "invalid_database_query_client"
    );
  }

  const normalizedTenantId =
    requireNonEmptyString(
      tenantId,
      "tenant_id",
      256
    );

  const normalizedScreenId =
    requireUuidLikeIdentifier(
      screenId,
      "screen_id"
    );

  const lockingClause =
    forUpdate
      ? "FOR UPDATE"
      : "";

  const result =
    await database.query(`
      ${SCREEN_SELECT}
      WHERE tenant_id = $1
        AND screen_id = $2
      LIMIT 1
      ${lockingClause}
    `, [
      normalizedTenantId,
      normalizedScreenId
    ]);

  return result.rows[0] || null;
}

async function requireScreen({
  db,
  tenantId,
  screenId,
  forUpdate = false
}) {
  const screen =
    await getScreen({
      db,
      tenantId,
      screenId,
      forUpdate
    });

  if (!screen) {
    throw new SignageServiceError(
      "signage_screen_not_found",
      {
        status: 404,
        details: {
          screen_id:
            screenId
        }
      }
    );
  }

  return screen;
}

async function updateScreen({
  db,
  writeEvent,
  tenantId,
  screenId,
  actorId,
  changes
}) {
  const eventWriter =
    requireEventWriter(writeEvent);

  const normalizedTenantId =
    requireNonEmptyString(
      tenantId,
      "tenant_id",
      256
    );

  const normalizedScreenId =
    requireUuidLikeIdentifier(
      screenId,
      "screen_id"
    );

  const normalizedActorId =
    requireNonEmptyString(
      actorId,
      "actor_id",
      256
    );

  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new SignageServiceError(
      "invalid_screen_update",
      {
        status: 400
      }
    );
  }

  const allowedFields =
    new Set([
      "screen_name",
      "location_name",
      "metadata"
    ]);

  const suppliedFields =
    Object.keys(changes);

  const unknownFields =
    suppliedFields.filter(
      field =>
        !allowedFields.has(field)
    );

  if (unknownFields.length > 0) {
    throw new SignageServiceError(
      "unsupported_screen_update_fields",
      {
        status: 400,
        details: {
          fields:
            unknownFields
        }
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "status"
    )
  ) {
    throw new SignageServiceError(
      "screen_lifecycle_governance_required",
      {
        status: 422
      }
    );
  }

  if (suppliedFields.length === 0) {
    throw new SignageServiceError(
      "empty_screen_update",
      {
        status: 400
      }
    );
  }

  const assignments = [];
  const values = [
    normalizedTenantId,
    normalizedScreenId
  ];

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "screen_name"
    )
  ) {
    const normalizedScreenName =
      requireNonEmptyString(
        changes.screen_name,
        "screen_name",
        512
      );

    values.push(
      normalizedScreenName
    );

    assignments.push(
      `screen_name = $${values.length}`
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "location_name"
    )
  ) {
    const normalizedLocationName =
      normalizeOptionalString(
        changes.location_name,
        "location_name",
        512
      );

    values.push(
      normalizedLocationName
    );

    assignments.push(
      `location_name = $${values.length}`
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "metadata"
    )
  ) {
    const normalizedMetadata =
      normalizeMetadata(
        changes.metadata
      );

    values.push(
      JSON.stringify(
        normalizedMetadata
      )
    );

    assignments.push(
      `metadata = $${values.length}::jsonb`
    );
  }

  assignments.push(
    "updated_at = clock_timestamp()"
  );

  return withTransaction({
    db,

    operation: async client => {
      const previousScreen =
        await requireScreen({
          db:
            client,

          tenantId:
            normalizedTenantId,

          screenId:
            normalizedScreenId,

          forUpdate:
            true
        });

      const updateResult =
        await client.query(`
          UPDATE public.runtime_signage_screens
          SET
            ${assignments.join(",\n            ")}
          WHERE tenant_id = $1
            AND screen_id = $2
          RETURNING
            screen_id,
            tenant_id,
            screen_key,
            screen_name,
            location_name,
            status,
            metadata,
            created_by,
            created_at,
            updated_at,
            retired_at
        `, values);

      if (updateResult.rows.length !== 1) {
        throw new Error(
          "signage_screen_update_failed"
        );
      }

      const screen =
        updateResult.rows[0];

      const eventPayload = {
        tenant_id:
          normalizedTenantId,

        screen_id:
          normalizedScreenId,

        updated_by:
          normalizedActorId,

        changed_fields:
          suppliedFields,

        previous_updated_at:
          previousScreen.updated_at,

        updated_at:
          screen.updated_at
      };

      const auditEvent =
        await eventWriter({
          tenant_id:
            normalizedTenantId,

          object_id:
            normalizedScreenId,

          event_type:
            "runtime.signage.screen.updated",

          message:
            JSON.stringify(
              eventPayload
            ),

          event_payload:
            eventPayload,

          transaction_client:
            client
        });

      return {
        screen,
        audit_event:
          auditEvent
      };
    }
  });
}

module.exports = {
  DEFAULT_COLLECTION_LIMIT,
  MAX_COLLECTION_LIMIT,
  SCREEN_SELECT,
  SignageServiceError,
  buildActorId,
  createScreen,
  getScreen,
  listScreens,
  mapDatabaseError,
  requireScreen,
  updateScreen,
  withTransaction
};
