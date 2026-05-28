ALTER TABLE runtime_execution_jobs
ADD COLUMN IF NOT EXISTS workflow_id text,
ADD COLUMN IF NOT EXISTS parent_job_id text,
ADD COLUMN IF NOT EXISTS next_execution_type text,
ADD COLUMN IF NOT EXISTS chain_position integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_execution_jobs_workflow
ON runtime_execution_jobs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_execution_jobs_parent
ON runtime_execution_jobs(parent_job_id);
