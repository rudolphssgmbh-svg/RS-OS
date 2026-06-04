ALTER TABLE runtime_operator_credentials
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'tenant';

ALTER TABLE runtime_operator_credentials
ADD COLUMN IF NOT EXISTS system_role TEXT;

UPDATE runtime_operator_credentials
SET
  scope = 'global',
  system_role = 'system_admin'
WHERE username = 'janette';

UPDATE runtime_operator_credentials
SET
  scope = 'tenant',
  system_role = NULL
WHERE username <> 'janette';
