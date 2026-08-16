'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRuntimeMeasurementWriteService,
} = require(
  '../src/services/runtime-measurement-write-service'
);

test(
  'measurement service preserves current write and event order',
  async () => {
    const sequence = [];

    const db = {
      query: async (sql) => {
        if (
          sql.includes(
            'INSERT INTO runtime_measurements'
          )
        ) {
          sequence.push('measurement-write');

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
          sql.includes(
            'INSERT INTO runtime_verification_cycles'
          )
        ) {
          sequence.push('verification-cycle-write');

          return {
            rows: [{
              verification_id: 'verification-1',
            }],
          };
        }

        if (
          sql.includes(
            'INSERT INTO runtime_verification_checks'
          )
        ) {
          sequence.push('verification-check-write');

          return {
            rows: [],
          };
        }

        throw new Error('unexpected SQL');
      },
    };

    const writeEvent = async (event) => {
      sequence.push(event.event_type);
    };

    const service =
      createRuntimeMeasurementWriteService({
        db,
        writeEvent,
      });

    const measurement = await service.create({
      tenant_id: 'tenant-alpha',
      outcome_id: null,
      metric_name: 'latency_ms',
      metric_value: 17,
      metric_unit: 'ms',
      target_value: 20,
      variance_value: -3,
      measurement_time: null,
      created_by: 'operator-1',
    });

    assert.equal(
      measurement.measurement_id,
      'measurement-1'
    );

    assert.deepEqual(sequence, [
      'measurement-write',
      'runtime.measurement.created',
      'verification-cycle-write',
      'verification-check-write',
      'runtime.verification.cycle.auto_created',
      'runtime.verification.check.auto_created',
    ]);
  }
);

test(
  'measurement partial-failure behavior remains non-transactional',
  async () => {
    const sequence = [];

    const db = {
      query: async (sql) => {
        if (
          sql.includes(
            'INSERT INTO runtime_measurements'
          )
        ) {
          sequence.push('measurement-write');

          return {
            rows: [{
              measurement_id: 'measurement-1',
            }],
          };
        }

        if (
          sql.includes(
            'INSERT INTO runtime_verification_cycles'
          )
        ) {
          sequence.push('verification-cycle-failure');
          throw new Error('cycle failure');
        }

        throw new Error('unexpected SQL');
      },
    };

    const service =
      createRuntimeMeasurementWriteService({
        db,
        writeEvent: async (event) => {
          sequence.push(event.event_type);
        },
      });

    await assert.rejects(
      service.create({
        tenant_id: 'tenant-alpha',
        metric_name: 'latency_ms',
        metric_value: 17,
        created_by: 'operator-1',
      }),
      /cycle failure/
    );

    assert.deepEqual(sequence, [
      'measurement-write',
      'runtime.measurement.created',
      'verification-cycle-failure',
    ]);
  }
);
