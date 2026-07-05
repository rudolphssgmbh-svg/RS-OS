ALTER TABLE runtime_verification_cycles
ADD COLUMN IF NOT EXISTS verification_result_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runtime_verification_cycles_result_fkey'
  ) THEN
    ALTER TABLE runtime_verification_cycles
    ADD CONSTRAINT runtime_verification_cycles_result_fkey
    FOREIGN KEY (verification_result_id)
    REFERENCES runtime_verification_results(result_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_runtime_verification_cycles_result
ON runtime_verification_cycles(verification_result_id);
