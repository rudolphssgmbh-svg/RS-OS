const {
  SignageServiceError,
  buildActorId,
  createScreen,
  getScreen,
  listScreens,
  updateScreen
} = require(
  "../../modules/signage/signage-service"
);

const SCREEN_COLLECTION_PATH =
  "/runtime/signage/screens";

const SCREEN_DETAIL_PATH_PATTERN =
  /^\/runtime\/signage\/screens\/([^/]+)$/;

const SIGNAGE_READ_ROLES = [
  "system_admin",
  "runtime_admin",
  "auditor",
  "governance"
];

const SIGNAGE_WRITE_ROLES = [
  "system_admin",
  "runtime_admin",
  "governance"
];

function extractScreenId(path) {
  const match =
    path.match(
      SCREEN_DETAIL_PATH_PATTERN
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

function getRequestQuery(req) {
  const requestUrl =
    typeof req.url === "string"
      ? req.url
      : "";

  const queryIndex =
    requestUrl.indexOf("?");

  if (queryIndex < 0) {
    return new URLSearchParams();
  }

  return new URLSearchParams(
    requestUrl.slice(
      queryIndex + 1
    )
  );
}

function requireTenantId(auth) {
  const tenantId =
    auth &&
    auth.user &&
    typeof auth.user.tenant_id === "string"
      ? auth.user.tenant_id.trim()
      : "";

  if (!tenantId) {
    throw new SignageServiceError(
      "authenticated_tenant_required",
      {
        status: 403
      }
    );
  }

  return tenantId;
}

function sendServiceError({
  error,
  res,
  send
}) {
  if (
    error instanceof
    SignageServiceError
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

async function readJsonBody({
  req,
  res,
  readBody,
  send
}) {
  try {
    const body =
      await readBody(req);

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return {
        handled:
          true,

        response:
          send(res, 400, {
            error:
              "invalid_json_body"
          })
      };
    }

    return {
      handled:
        false,

      body
    };
  } catch {
    return {
      handled:
        true,

      response:
        send(res, 400, {
          error:
            "invalid_json_body"
        })
    };
  }
}

async function handleCreateScreen({
  req,
  res,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  const auth =
    requireRole(
      req,
      SIGNAGE_WRITE_ROLES
    );

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  const bodyResult =
    await readJsonBody({
      req,
      res,
      readBody,
      send
    });

  if (bodyResult.handled) {
    return bodyResult.response;
  }

  try {
    const tenantId =
      requireTenantId(auth);

    const actorId =
      buildActorId(
        auth.user
      );

    const result =
      await createScreen({
        db,
        writeEvent,
        tenantId,
        actorId,

        screenKey:
          bodyResult.body.screen_key,

        screenName:
          bodyResult.body.screen_name,

        locationName:
          bodyResult.body.location_name,

        metadata:
          bodyResult.body.metadata
      });

    return send(res, 201, {
      screen:
        result.screen,

      audit_event:
        result.audit_event
    });
  } catch (error) {
    return sendServiceError({
      error,
      res,
      send
    });
  }
}

async function handleListScreens({
  req,
  res,
  db,
  send,
  requireRole
}) {
  const auth =
    requireRole(
      req,
      SIGNAGE_READ_ROLES
    );

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  try {
    const tenantId =
      requireTenantId(auth);

    const query =
      getRequestQuery(req);

    const result =
      await listScreens({
        db,
        tenantId,

        limit:
          query.get("limit"),

        offset:
          query.get("offset"),

        status:
          query.get("status")
      });

    return send(res, 200, {
      screens:
        result.screens,

      pagination:
        result.pagination
    });
  } catch (error) {
    return sendServiceError({
      error,
      res,
      send
    });
  }
}

async function handleGetScreen({
  req,
  res,
  db,
  send,
  requireRole,
  screenId
}) {
  const auth =
    requireRole(
      req,
      SIGNAGE_READ_ROLES
    );

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  try {
    const tenantId =
      requireTenantId(auth);

    const screen =
      await getScreen({
        db,
        tenantId,
        screenId
      });

    if (!screen) {
      return send(res, 404, {
        error:
          "signage_screen_not_found",

        screen_id:
          screenId
      });
    }

    return send(res, 200, {
      screen
    });
  } catch (error) {
    return sendServiceError({
      error,
      res,
      send
    });
  }
}

async function handleUpdateScreen({
  req,
  res,
  db,
  send,
  requireRole,
  readBody,
  writeEvent,
  screenId
}) {
  const auth =
    requireRole(
      req,
      SIGNAGE_WRITE_ROLES
    );

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  const bodyResult =
    await readJsonBody({
      req,
      res,
      readBody,
      send
    });

  if (bodyResult.handled) {
    return bodyResult.response;
  }

  try {
    const tenantId =
      requireTenantId(auth);

    const actorId =
      buildActorId(
        auth.user
      );

    const result =
      await updateScreen({
        db,
        writeEvent,
        tenantId,
        screenId,
        actorId,
        changes:
          bodyResult.body
      });

    return send(res, 200, {
      screen:
        result.screen,

      audit_event:
        result.audit_event
    });
  } catch (error) {
    return sendServiceError({
      error,
      res,
      send
    });
  }
}

async function handleSignageRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (
    path ===
    SCREEN_COLLECTION_PATH
  ) {
    if (req.method === "POST") {
      await handleCreateScreen({
        req,
        res,
        db,
        send,
        requireRole,
        readBody,
        writeEvent
      });

      return true;
    }

    if (req.method === "GET") {
      await handleListScreens({
        req,
        res,
        db,
        send,
        requireRole
      });

      return true;
    }

    return false;
  }

  const screenId =
    extractScreenId(path);

  if (screenId === null) {
    return false;
  }

  if (!screenId) {
    send(res, 400, {
      error:
        "invalid_screen_id"
    });

    return true;
  }

  if (req.method === "GET") {
    await handleGetScreen({
      req,
      res,
      db,
      send,
      requireRole,
      screenId
    });

    return true;
  }

  if (req.method === "PATCH") {
    await handleUpdateScreen({
      req,
      res,
      db,
      send,
      requireRole,
      readBody,
      writeEvent,
      screenId
    });

    return true;
  }

  return false;
}

module.exports = {
  SCREEN_COLLECTION_PATH,
  SCREEN_DETAIL_PATH_PATTERN,
  SIGNAGE_READ_ROLES,
  SIGNAGE_WRITE_ROLES,
  extractScreenId,
  getRequestQuery,
  handleSignageRoute,
  requireTenantId,
  sendServiceError
};
