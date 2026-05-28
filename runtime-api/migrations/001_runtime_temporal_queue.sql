ALTER TABLE runtime_execution_jobs
ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
ADD COLUMN IF NOT EXISTS available_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_execution_jobs_available
ON runtime_execution_jobs(status, available_at);

CREATE INDEX IF NOT EXISTS idx_execution_jobs_priority
ON runtime_execution_jobs(priority);

CREATE INDEX IF NOT EXISTS idx_execution_jobs_schedule
ON runtime_execution_jobs(scheduled_for);
