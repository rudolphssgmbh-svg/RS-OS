'use strict';

const crypto = require('crypto');

function createRuntimeObservationWriteService({
  db,
  writeEvent,
}) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('runtime observation service requires db.query');
  }

  if (typeof writeEvent !== 'function') {
    throw new Error('runtime observation service requires writeEvent');
  }

  async function create(input) {
    const {
      tenant_id,
      witness_id = null,
      evidence_id = null,
      observation_text,
      observation_time = null,
      confidence = null,
      created_by,
    } = input;

    const observation_id =
      '00000000-0000-4002-8000-' +
      crypto.randomBytes(6).toString('hex');

    await db.query(`
      INSERT INTO runtime_observations (
        observation_id,
        tenant_id,
        witness_id,
        evidence_id,
        observation_text,
        observation_time,
        confidence,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      observation_id,
      tenant_id,
      witness_id,
      evidence_id,
      observation_text,
      observation_time,
      confidence,
      created_by,
    ]);

    await writeEvent({
      tenant_id,
      object_id: observation_id,
      event_type: 'runtime.observation.created',
      message: JSON.stringify({
        observation_id,
        witness_id,
        evidence_id,
        confidence,
      }),
    });

    return {
      observation_id,
      tenant_id,
      witness_id,
      evidence_id,
      observation_text,
      observation_time,
      confidence,
      created_by,
    };
  }

  return Object.freeze({
    create,
  });
}

module.exports = {
  createRuntimeObservationWriteService,
};
