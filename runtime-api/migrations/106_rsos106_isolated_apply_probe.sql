-- RSOS-106 isolated apply probe.
-- This migration validates the runner-supplied execution context.
-- It intentionally performs no persistent schema or business-data change.

SELECT
  1 / CASE
    WHEN COALESCE(
      current_setting(
        'rsos.migration_sha256',
        true
      ) ~ '^[0-9a-f]{64}$',
      false
    )
    AND COALESCE(
      current_setting(
        'rsos.source_commit',
        true
      ) ~ '^[0-9a-f]{40}$',
      false
    )
    THEN 1
    ELSE 0
  END AS rsos106_execution_context_valid;
