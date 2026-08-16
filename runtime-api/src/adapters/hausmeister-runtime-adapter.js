'use strict';

/*
 * RSOS Hausmeister Runtime Adapter
 *
 * PF-002C4D authorized scope:
 * - isolated adapter only
 * - no server wiring
 * - no database ownership
 * - no autonomous remediation
 * - no approval authority
 * - no orchestration execution authority
 * - no JARVIS protocol implementation
 */

const OPERATIONS = Object.freeze({
  OBSERVE: 'OBSERVE',
  MEASURE: 'MEASURE',
  REPORT_FINDING: 'REPORT_FINDING',
});

const OUTCOMES = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  BLOCKED: 'BLOCKED',
});

const REASON_CODES = Object.freeze({
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  TENANT_MISSING: 'TENANT_MISSING',
  TENANT_OVERRIDE_FORBIDDEN: 'TENANT_OVERRIDE_FORBIDDEN',
  BODY_INVALID: 'BODY_INVALID',
  OPERATION_UNSUPPORTED: 'OPERATION_UNSUPPORTED',
  OBSERVATION_TEXT_REQUIRED: 'OBSERVATION_TEXT_REQUIRED',
  METRIC_NAME_REQUIRED: 'METRIC_NAME_REQUIRED',
  FINDING_REQUIRED: 'FINDING_REQUIRED',
  DEPENDENCY_INVALID: 'DEPENDENCY_INVALID',
});

function blocked(reasonCode) {
  return Object.freeze({
    outcome: OUTCOMES.BLOCKED,
    allowedToRemediate: false,
    allowedToApprove: false,
    allowedToExecuteOrchestration: false,
    reasonCodes: [reasonCode],
  });
}

function requireMethod(object, methodName, dependencyName) {
  if (!object || typeof object[methodName] !== 'function') {
    throw new Error(
      `${REASON_CODES.DEPENDENCY_INVALID}:${dependencyName}.${methodName}`
    );
  }
}

function normalizeIdentity(authUser) {
  if (!authUser || typeof authUser !== 'object') {
    return null;
  }

  return (
    authUser.operator_id ||
    authUser.user_id ||
    authUser.username ||
    authUser.sub ||
    authUser.role ||
    'runtime_user'
  );
}

function hasTenantOverride(body) {
  return Object.prototype.hasOwnProperty.call(body, 'tenant_id');
}

function createHausmeisterRuntimeAdapter(dependencies = {}) {
  const {
    observationPort,
    measurementPort,
    auditPort,
    clock = () => new Date(),
  } = dependencies;

  requireMethod(observationPort, 'create', 'observationPort');
  requireMethod(measurementPort, 'create', 'measurementPort');
  requireMethod(auditPort, 'record', 'auditPort');

  async function auditAccepted({
    tenantId,
    actorId,
    operation,
    objectId,
    resultType,
  }) {
    await auditPort.record({
      tenant_id: tenantId,
      actor_id: actorId,
      operation,
      object_id: objectId || null,
      result_type: resultType,
      occurred_at: clock(),
      authority: {
        remediation: false,
        approval: false,
        orchestrationExecution: false,
      },
    });
  }

  async function execute(input = {}) {
    const {
      operation,
      authUser,
      body,
    } = input;

    if (!authUser || typeof authUser !== 'object') {
      return blocked(REASON_CODES.AUTHENTICATION_REQUIRED);
    }

    const tenantId = authUser.tenant_id || null;

    if (!tenantId) {
      return blocked(REASON_CODES.TENANT_MISSING);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return blocked(REASON_CODES.BODY_INVALID);
    }

    /*
     * Tenant identity always comes from authenticated runtime context.
     * Even a matching payload tenant_id is rejected so the adapter
     * has exactly one tenant authority source.
     */
    if (hasTenantOverride(body)) {
      return blocked(REASON_CODES.TENANT_OVERRIDE_FORBIDDEN);
    }

    const actorId = normalizeIdentity(authUser);

    if (operation === OPERATIONS.OBSERVE) {
      if (
        typeof body.observation_text !== 'string' ||
        !body.observation_text.trim()
      ) {
        return blocked(REASON_CODES.OBSERVATION_TEXT_REQUIRED);
      }

      const observation = await observationPort.create({
        tenant_id: tenantId,
        witness_id: body.witness_id || null,
        evidence_id: body.evidence_id || null,
        observation_text: body.observation_text.trim(),
        observation_time: body.observation_time || null,
        confidence:
          body.confidence === undefined ? null : body.confidence,
        created_by: actorId,
      });

      const observationId =
        observation &&
        (observation.observation_id || observation.id);

      await auditAccepted({
        tenantId,
        actorId,
        operation,
        objectId: observationId,
        resultType: 'observation',
      });

      return {
        outcome: OUTCOMES.ACCEPTED,
        operation,
        tenant_id: tenantId,
        observation,
        allowedToRemediate: false,
        allowedToApprove: false,
        allowedToExecuteOrchestration: false,
        requiresVerification: true,
        reasonCodes: [],
      };
    }

    if (operation === OPERATIONS.MEASURE) {
      if (
        typeof body.metric_name !== 'string' ||
        !body.metric_name.trim()
      ) {
        return blocked(REASON_CODES.METRIC_NAME_REQUIRED);
      }

      const measurement = await measurementPort.create({
        tenant_id: tenantId,
        outcome_id: body.outcome_id || null,
        metric_name: body.metric_name.trim(),
        metric_value:
          body.metric_value === undefined ? null : body.metric_value,
        metric_unit: body.metric_unit || null,
        target_value:
          body.target_value === undefined ? null : body.target_value,
        variance_value:
          body.variance_value === undefined ? null : body.variance_value,
        measurement_time: body.measurement_time || null,
        created_by: actorId,
      });

      const measurementId =
        measurement &&
        (measurement.measurement_id || measurement.id);

      await auditAccepted({
        tenantId,
        actorId,
        operation,
        objectId: measurementId,
        resultType: 'measurement',
      });

      return {
        outcome: OUTCOMES.ACCEPTED,
        operation,
        tenant_id: tenantId,
        measurement,
        allowedToRemediate: false,
        allowedToApprove: false,
        allowedToExecuteOrchestration: false,
        requiresVerification: true,
        reasonCodes: [],
      };
    }

    if (operation === OPERATIONS.REPORT_FINDING) {
      if (
        typeof body.finding !== 'string' ||
        !body.finding.trim()
      ) {
        return blocked(REASON_CODES.FINDING_REQUIRED);
      }

      /*
       * REPORT_FINDING is deliberately record-only.
       *
       * No JARVIS API is invented here.
       * No orchestration is created, approved or executed.
       * Future coordination requires a separately verified binding.
       */
      const finding = Object.freeze({
        tenant_id: tenantId,
        finding: body.finding.trim(),
        severity: body.severity || 'UNKNOWN',
        observation_id: body.observation_id || null,
        measurement_id: body.measurement_id || null,
        evidence_id: body.evidence_id || null,
        reported_by: actorId,
        reported_at: clock(),
      });

      await auditAccepted({
        tenantId,
        actorId,
        operation,
        objectId:
          finding.observation_id ||
          finding.measurement_id ||
          finding.evidence_id,
        resultType: 'finding',
      });

      return {
        outcome: OUTCOMES.ACCEPTED,
        operation,
        tenant_id: tenantId,
        finding,
        coordinationRequested: false,
        coordinationImplemented: false,
        allowedToRemediate: false,
        allowedToApprove: false,
        allowedToExecuteOrchestration: false,
        requiresHumanOrGovernedFollowUp: true,
        reasonCodes: [],
      };
    }

    return blocked(REASON_CODES.OPERATION_UNSUPPORTED);
  }

  return Object.freeze({
    execute,
  });
}

module.exports = {
  OPERATIONS,
  OUTCOMES,
  REASON_CODES,
  createHausmeisterRuntimeAdapter,
};
