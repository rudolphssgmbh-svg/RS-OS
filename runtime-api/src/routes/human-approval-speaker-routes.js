'use strict';

/**
 * RSOS HERMES human approval speaker routes.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * ROUTE REGISTRATION: NOT APPROVED
 * APPLICATION EXECUTION: NOT APPROVED
 *
 * This module defines bounded route handlers only. It does not mount itself,
 * access a database, perform authentication or mutate workflow state.
 */

const {
  OUTCOMES,
  SERVICE_REASON_CODES,
} = require('../services/human-approval-speaker-service');

const ROUTE_REASON_CODES = Object.freeze({
  ROUTE_DRAFT_SHADOW_ONLY: 'ROUTE_DRAFT_SHADOW_ONLY',
  REQUEST_CONTEXT_MISSING: 'REQUEST_CONTEXT_MISSING',
  APPROVAL_ID_MISSING: 'APPROVAL_ID_MISSING',
  BODY_MISSING: 'BODY_MISSING',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONTINUATION_NOT_AVAILABLE: 'CONTINUATION_NOT_AVAILABLE',
});

function requireFunction(object, name) {
  if (!object || typeof object[name] !== 'function') {
    throw new Error(`${ROUTE_REASON_CODES.SERVICE_UNAVAILABLE}:${name}`);
  }
}

function normalizeIdentity(req) {
  const source = req && (req.auth || req.user || req.identity);
  if (!source) return null;

  return {
    id: source.id || source.userId || source.sub || null,
    verified: source.verified === true || source.authenticated === true,
  };
}

function normalizeRoles(req) {
  const source = req && (req.auth || req.user || req.identity);
  const roles = source && (source.roles || source.authorizedRoles);
  return Array.isArray(roles) ? roles : [];
}

function normalizeTenantId(req) {
  return (
    (req && req.tenantId) ||
    (req && req.auth && req.auth.tenantId) ||
    (req && req.user && req.user.tenantId) ||
    null
  );
}

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json({
    ...payload,
    runtimeMode: 'SHADOW',
    allowedToContinueWorkflow: false,
  });
}

function statusForOutcome(outcome) {
  if (outcome === OUTCOMES.ALLOWED_WITH_CONTROLS) return 200;
  if (outcome === OUTCOMES.REVIEW_REQUIRED) return 409;
  return 403;
}

function createHumanApprovalSpeakerRouter(dependencies) {
  const {
    express,
    service,
    requireAuthenticatedIdentity,
    requireTenantContext,
    requireAuthorizedHumanRole,
  } = dependencies || {};

  if (!express || typeof express.Router !== 'function') {
    throw new Error(`${ROUTE_REASON_CODES.SERVICE_UNAVAILABLE}:express`);
  }

  requireFunction(service, 'listPendingApprovals');
  requireFunction(service, 'getApprovalForPresentation');
  requireFunction(service, 'captureInteraction');
  requireFunction(
    { requireAuthenticatedIdentity },
    'requireAuthenticatedIdentity'
  );
  requireFunction({ requireTenantContext }, 'requireTenantContext');
  requireFunction(
    { requireAuthorizedHumanRole },
    'requireAuthorizedHumanRole'
  );

  const router = express.Router();

  router.use(requireAuthenticatedIdentity);
  router.use(requireTenantContext);
  router.use(requireAuthorizedHumanRole);

  router.get('/pending', async (req, res) => {
    try {
      const tenantId = normalizeTenantId(req);
      const authenticatedIdentity = normalizeIdentity(req);

      if (!tenantId || !authenticatedIdentity) {
        return sendJson(res, 401, {
          outcome: OUTCOMES.BLOCKED,
          approvals: [],
          reasonCodes: [
            ROUTE_REASON_CODES.REQUEST_CONTEXT_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      const result = await service.listPendingApprovals({
        tenantId,
        authenticatedIdentity,
        authorizedHumanRoles: normalizeRoles(req),
        limit: req.query && req.query.limit,
      });

      return sendJson(res, statusForOutcome(result.outcome), {
        outcome: result.outcome,
        approvals: result.approvals || [],
        reasonCodes: [
          ...(result.reasonCodes || []),
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    } catch (error) {
      return sendJson(res, 500, {
        outcome: OUTCOMES.BLOCKED,
        approvals: [],
        reasonCodes: [
          ROUTE_REASON_CODES.INTERNAL_ERROR,
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    }
  });

  router.get('/:approvalRequestId', async (req, res) => {
    try {
      const approvalRequestId =
        req.params && req.params.approvalRequestId;
      const tenantId = normalizeTenantId(req);
      const authenticatedIdentity = normalizeIdentity(req);

      if (!approvalRequestId) {
        return sendJson(res, 400, {
          outcome: OUTCOMES.BLOCKED,
          request: null,
          reasonCodes: [
            ROUTE_REASON_CODES.APPROVAL_ID_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      if (!tenantId || !authenticatedIdentity) {
        return sendJson(res, 401, {
          outcome: OUTCOMES.BLOCKED,
          request: null,
          reasonCodes: [
            ROUTE_REASON_CODES.REQUEST_CONTEXT_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      const result = await service.getApprovalForPresentation({
        approvalRequestId,
        tenantId,
        authenticatedIdentity,
        authorizedHumanRoles: normalizeRoles(req),
        presentedScopeHash:
          req.headers && req.headers['x-rsos-scope-hash'],
        auditPathAvailable: true,
      });

      return sendJson(res, statusForOutcome(result.outcome), {
        outcome: result.outcome,
        request: result.request || null,
        allowedToPresent: result.allowedToPresent === true,
        allowedToRecord: result.allowedToRecord === true,
        reasonCodes: [
          ...(result.reasonCodes || []),
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    } catch (error) {
      return sendJson(res, 500, {
        outcome: OUTCOMES.BLOCKED,
        request: null,
        reasonCodes: [
          ROUTE_REASON_CODES.INTERNAL_ERROR,
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    }
  });

  router.post('/:approvalRequestId/interactions', async (req, res) => {
    try {
      const approvalRequestId =
        req.params && req.params.approvalRequestId;
      const tenantId = normalizeTenantId(req);
      const authenticatedIdentity = normalizeIdentity(req);
      const body = req.body;

      if (!approvalRequestId) {
        return sendJson(res, 400, {
          outcome: OUTCOMES.BLOCKED,
          interaction: null,
          reasonCodes: [
            ROUTE_REASON_CODES.APPROVAL_ID_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      if (!body || typeof body !== 'object') {
        return sendJson(res, 400, {
          outcome: OUTCOMES.BLOCKED,
          interaction: null,
          reasonCodes: [
            ROUTE_REASON_CODES.BODY_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      if (!tenantId || !authenticatedIdentity) {
        return sendJson(res, 401, {
          outcome: OUTCOMES.BLOCKED,
          interaction: null,
          reasonCodes: [
            ROUTE_REASON_CODES.REQUEST_CONTEXT_MISSING,
            ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
          ],
        });
      }

      const result = await service.captureInteraction({
        approvalRequestId,
        tenantId,
        authenticatedIdentity,
        authorizedHumanRoles: normalizeRoles(req),
        presentedText: body.presentedText,
        presentedScopeHash: body.presentedScopeHash,
        presentedRiskLevel: body.presentedRiskLevel,
        decision: body.decision,
        rawResponseText: body.rawResponseText,
        confirmationLevel: body.confirmationLevel,
        requiredConfirmationLevel: body.requiredConfirmationLevel,
        explicitConfirmation: body.explicitConfirmation,
        transcriptHash: body.transcriptHash,
        timeout: body.timeout === true,
        silence: body.silence === true,
        channel: body.channel || 'WEB',
        language: body.language || 'de-DE',
        auditPathAvailable: true,
        previousInteractionHash: body.previousInteractionHash || null,
      });

      return sendJson(res, statusForOutcome(result.outcome), {
        outcome: result.outcome,
        interaction: result.interaction || null,
        reasonCodes: [
          ...(result.reasonCodes || []),
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    } catch (error) {
      return sendJson(res, 500, {
        outcome: OUTCOMES.BLOCKED,
        interaction: null,
        reasonCodes: [
          ROUTE_REASON_CODES.INTERNAL_ERROR,
          ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
        ],
      });
    }
  });

  router.all('/continue', (req, res) =>
    sendJson(res, 405, {
      outcome: OUTCOMES.BLOCKED,
      reasonCodes: [
        ROUTE_REASON_CODES.CONTINUATION_NOT_AVAILABLE,
        ROUTE_REASON_CODES.ROUTE_DRAFT_SHADOW_ONLY,
      ],
    })
  );

  return router;
}

module.exports = {
  ROUTE_REASON_CODES,
  normalizeIdentity,
  normalizeRoles,
  normalizeTenantId,
  sendJson,
  statusForOutcome,
  createHumanApprovalSpeakerRouter,
};
