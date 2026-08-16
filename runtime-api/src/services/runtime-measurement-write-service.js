'use strict';

function createRuntimeMeasurementWriteService({
  db,
  writeEvent,
}) {
  if (!db || typeof db.connect !== 'function') {
    throw new Error(
      'runtime measurement service requires db.connect'
    );
  }

  if (typeof writeEvent !== 'function') {
    throw new Error(
      'runtime measurement service requires writeEvent'
    );
  }

  async function create(input) {
    const {
      tenant_id,
      outcome_id = null,
      metric_name,
      metric_value = null,
      metric_unit = null,
      target_value = null,
      variance_value = null,
      measurement_time = null,
      created_by,
    } = input;

    const client = await db.connect();

    if (
      !client ||
      typeof client.query !== 'function' ||
      typeof client.release !== 'function'
    ) {
      throw new Error(
        'invalid_database_transaction_client'
      );
    }

    try {
      await client.query('BEGIN');

      /*
       * A2 atomicity boundary:
       *
       * All Measurement, Verification and Runtime Event writes
       * participate in the same PostgreSQL transaction.
       *
       * No successful state becomes durable before COMMIT.
       */

      const result = await client.query(`
        INSERT INTO runtime_measurements (
          tenant_id,
          outcome_id,
          metric_name,
          metric_value,
          metric_unit,
          target_value,
          variance_value,
          measurement_time,
          created_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          COALESCE($8::timestamptz, now()),
          $9
        )
        RETURNING *
      `, [
        tenant_id,
        outcome_id,
        metric_name,
        metric_value,
        metric_unit,
        target_value,
        variance_value,
        measurement_time,
        created_by,
      ]);

      const measurement = result.rows[0];

      await writeEvent({
        transaction_client: client,
        tenant_id,
        object_id: measurement.measurement_id,
        event_type: 'runtime.measurement.created',
        message: JSON.stringify({
          measurement_id:
            measurement.measurement_id,
          outcome_id,
          metric_name,
          metric_value,
          metric_unit,
        }),
      });

      const autoCycle = await client.query(`
        INSERT INTO runtime_verification_cycles (
          tenant_id,
          measurement_id,
          verification_type,
          verification_status,
          expected_value,
          observed_value,
          verification_result,
          confidence_before,
          confidence_after,
          created_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        RETURNING *
      `, [
        tenant_id,
        measurement.measurement_id,
        'measurement_auto_verification',
        'pending',
        'Measurement requires verification',
        'Measurement created',
        'awaiting verification',
        50,
        50,
        created_by,
      ]);

      await client.query(`
        INSERT INTO runtime_verification_checks (
          tenant_id,
          measurement_id,
          verification_cycle_id,
          check_type,
          check_status,
          expected_value,
          observed_value,
          check_notes,
          checked_at,
          checked_by,
          created_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          now(),$9,$9
        )
      `, [
        tenant_id,
        measurement.measurement_id,
        autoCycle.rows[0].verification_id,
        'measurement_created',
        'pending',
        'Measurement should be verified',
        'Measurement created',
        'Automatic RSOS-060H trigger',
        created_by,
      ]);

      await writeEvent({
        transaction_client: client,
        tenant_id,
        object_id: measurement.measurement_id,
        event_type:
          'runtime.verification.cycle.auto_created',
        message: JSON.stringify({
          measurement_id:
            measurement.measurement_id,
          verification_id:
            autoCycle.rows[0].verification_id,
          verification_type:
            'measurement_auto_verification',
          verification_status: 'pending',
        }),
      });

      await writeEvent({
        transaction_client: client,
        tenant_id,
        object_id: measurement.measurement_id,
        event_type:
          'runtime.verification.check.auto_created',
        message: JSON.stringify({
          measurement_id:
            measurement.measurement_id,
          verification_id:
            autoCycle.rows[0].verification_id,
          check_type: 'measurement_created',
          check_status: 'pending',
        }),
      });

      await client.query('COMMIT');

      return measurement;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /*
         * Preserve the original Measurement operation failure.
         * Rollback failure must not mask the causal error.
         */
      }

      throw error;
    } finally {
      client.release();
    }
  }

  return Object.freeze({
    create,
  });
}

module.exports = {
  createRuntimeMeasurementWriteService,
};
