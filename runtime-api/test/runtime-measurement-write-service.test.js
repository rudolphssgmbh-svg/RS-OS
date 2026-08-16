'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRuntimeMeasurementWriteService,
} = require(
  '../src/services/runtime-measurement-write-service'
);

function createHarness({
  failAt = null,
  rollbackFails = false,
} = {}) {
  const sequence = [];
  let released = false;

  const client = {
    async query(sql) {
      const normalized =
        String(sql).replace(/\s+/g, ' ').trim();

      if (normalized === 'BEGIN') {
        sequence.push('BEGIN');

        if (failAt === 'BEGIN') {
          throw new Error('fail-BEGIN');
        }

        return { rows: [] };
      }

      if (normalized === 'COMMIT') {
        sequence.push('COMMIT');

        if (failAt === 'COMMIT') {
          throw new Error('fail-COMMIT');
        }

        return { rows: [] };
      }

      if (normalized === 'ROLLBACK') {
        sequence.push('ROLLBACK');

        if (rollbackFails) {
          throw new Error('fail-ROLLBACK');
        }

        return { rows: [] };
      }

      if (
        normalized.includes(
          'INSERT INTO runtime_measurements'
        )
      ) {
        sequence.push('measurement-write');

        if (failAt === 'measurement') {
          throw new Error('fail-measurement');
        }

        return {
          rows: [{
            measurement_id: 'measurement-1',
            tenant_id: 'tenant-alpha',
            metric_name: 'latency_ms',
            metric_value: 17,
          }],
        };
      }

      if (
        normalized.includes(
          'INSERT INTO runtime_verification_cycles'
        )
      ) {
        sequence.push('verification-cycle-write');

        if (failAt === 'cycle') {
          throw new Error('fail-cycle');
        }

        return {
          rows: [{
            verification_id: 'verification-1',
          }],
        };
      }

      if (
        normalized.includes(
          'INSERT INTO runtime_verification_checks'
        )
      ) {
        sequence.push('verification-check-write');

        if (failAt === 'check') {
          throw new Error('fail-check');
        }

        return {
          rows: [],
        };
      }

      throw new Error(
        `unexpected SQL: ${normalized}`
      );
    },

    release() {
      sequence.push('release');
      released = true;
    },
  };

  const db = {
    async connect() {
      sequence.push('connect');

      if (failAt === 'connect') {
        throw new Error('fail-connect');
      }

      return client;
    },

    async query() {
      throw new Error(
        'pool-query-forbidden-during-a2'
      );
    },
  };

  let eventNumber = 0;

  const writeEvent = async (event) => {
    eventNumber += 1;

    sequence.push(
      `event-${eventNumber}:${event.event_type}`
    );

    assert.equal(
      event.transaction_client,
      client,
      'every event must use shared transaction client'
    );

    if (
      failAt === 'measurement-event' &&
      event.event_type ===
        'runtime.measurement.created'
    ) {
      throw new Error(
        'fail-measurement-event'
      );
    }

    if (
      failAt === 'cycle-event' &&
      event.event_type ===
        'runtime.verification.cycle.auto_created'
    ) {
      throw new Error(
        'fail-cycle-event'
      );
    }

    if (
      failAt === 'check-event' &&
      event.event_type ===
        'runtime.verification.check.auto_created'
    ) {
      throw new Error(
        'fail-check-event'
      );
    }

    return {};
  };

  return {
    db,
    client,
    writeEvent,
    sequence,
    released: () => released,
  };
}

function measurementInput() {
  return {
    tenant_id: 'tenant-alpha',
    outcome_id: null,
    metric_name: 'latency_ms',
    metric_value: 17,
    metric_unit: 'ms',
    target_value: 20,
    variance_value: -3,
    measurement_time: null,
    created_by: 'operator-1',
  };
}

test(
  'A2 commits the complete Measurement unit atomically',
  async () => {
    const h = createHarness();

    const service =
      createRuntimeMeasurementWriteService({
        db: h.db,
        writeEvent: h.writeEvent,
      });

    const measurement =
      await service.create(
        measurementInput()
      );

    assert.equal(
      measurement.measurement_id,
      'measurement-1'
    );

    assert.deepEqual(
      h.sequence,
      [
        'connect',
        'BEGIN',
        'measurement-write',
        'event-1:runtime.measurement.created',
        'verification-cycle-write',
        'verification-check-write',
        'event-2:runtime.verification.cycle.auto_created',
        'event-3:runtime.verification.check.auto_created',
        'COMMIT',
        'release',
      ]
    );

    assert.equal(
      h.released(),
      true
    );
  }
);

for (const failure of [
  'measurement',
  'measurement-event',
  'cycle',
  'check',
  'cycle-event',
  'check-event',
]) {
  test(
    `A2 rolls back on ${failure}`,
    async () => {
      const h = createHarness({
        failAt: failure,
      });

      const service =
        createRuntimeMeasurementWriteService({
          db: h.db,
          writeEvent: h.writeEvent,
        });

      await assert.rejects(
        service.create(
          measurementInput()
        ),
        new RegExp(`fail-${failure}`)
      );

      assert.ok(
        h.sequence.includes('BEGIN')
      );

      assert.ok(
        h.sequence.includes('ROLLBACK')
      );

      assert.equal(
        h.sequence.includes('COMMIT'),
        false
      );

      assert.equal(
        h.sequence.at(-1),
        'release'
      );

      assert.equal(
        h.released(),
        true
      );
    }
  );
}

test(
  'A2 propagates COMMIT failure and releases client',
  async () => {
    const h = createHarness({
      failAt: 'COMMIT',
    });

    const service =
      createRuntimeMeasurementWriteService({
        db: h.db,
        writeEvent: h.writeEvent,
      });

    await assert.rejects(
      service.create(
        measurementInput()
      ),
      /fail-COMMIT/
    );

    assert.ok(
      h.sequence.includes('COMMIT')
    );

    assert.ok(
      h.sequence.includes('ROLLBACK')
    );

    assert.equal(
      h.sequence.at(-1),
      'release'
    );

    assert.equal(
      h.released(),
      true
    );
  }
);

test(
  'rollback failure preserves original operation error',
  async () => {
    const h = createHarness({
      failAt: 'measurement',
      rollbackFails: true,
    });

    const service =
      createRuntimeMeasurementWriteService({
        db: h.db,
        writeEvent: h.writeEvent,
      });

    await assert.rejects(
      service.create(
        measurementInput()
      ),
      /fail-measurement/
    );

    assert.ok(
      h.sequence.includes('ROLLBACK')
    );

    assert.equal(
      h.sequence.at(-1),
      'release'
    );

    assert.equal(
      h.released(),
      true
    );
  }
);

test(
  'A2 rejects invalid transaction client',
  async () => {
    const service =
      createRuntimeMeasurementWriteService({
        db: {
          async connect() {
            return {};
          },
        },

        writeEvent: async () => {},
      });

    await assert.rejects(
      service.create(
        measurementInput()
      ),
      /invalid_database_transaction_client/
    );
  }
);

test(
  'A2 requires transaction-capable database pool',
  () => {
    assert.throws(
      () =>
        createRuntimeMeasurementWriteService({
          db: {
            query: async () => {},
          },

          writeEvent: async () => {},
        }),
      /requires db\.connect/
    );
  }
);
