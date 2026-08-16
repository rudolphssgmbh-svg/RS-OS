'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRuntimeObservationWriteService,
} = require(
  '../src/services/runtime-observation-write-service'
);

test(
  'observation service preserves persistence and event contract',
  async () => {
    const queries = [];
    const events = [];

    const db = {
      query: async (sql, params) => {
        queries.push({
          sql,
          params,
        });

        return {
          rows: [],
        };
      },
    };

    const writeEvent = async (event) => {
      events.push(event);
    };

    const service =
      createRuntimeObservationWriteService({
        db,
        writeEvent,
      });

    const observation = await service.create({
      tenant_id: 'tenant-alpha',
      witness_id: 'witness-1',
      evidence_id: 'evidence-1',
      observation_text: 'Runtime reachable',
      observation_time: '2026-08-16T11:00:00Z',
      confidence: 80,
      created_by: 'operator-1',
    });

    assert.equal(queries.length, 1);

    assert.match(
      queries[0].sql,
      /INSERT INTO runtime_observations/
    );

    assert.equal(
      queries[0].params[1],
      'tenant-alpha'
    );

    assert.equal(
      observation.tenant_id,
      'tenant-alpha'
    );

    assert.equal(
      observation.observation_text,
      'Runtime reachable'
    );

    assert.match(
      observation.observation_id,
      /^00000000-0000-4002-8000-[0-9a-f]{12}$/
    );

    assert.equal(events.length, 1);

    assert.equal(
      events[0].event_type,
      'runtime.observation.created'
    );

    assert.equal(
      events[0].tenant_id,
      'tenant-alpha'
    );

    assert.equal(
      events[0].object_id,
      observation.observation_id
    );
  }
);

test(
  'observation persistence failure propagates',
  async () => {
    let eventCalls = 0;

    const service =
      createRuntimeObservationWriteService({
        db: {
          query: async () => {
            throw new Error('db failure');
          },
        },
        writeEvent: async () => {
          eventCalls += 1;
        },
      });

    await assert.rejects(
      service.create({
        tenant_id: 'tenant-alpha',
        observation_text: 'test',
        created_by: 'operator-1',
      }),
      /db failure/
    );

    assert.equal(eventCalls, 0);
  }
);
