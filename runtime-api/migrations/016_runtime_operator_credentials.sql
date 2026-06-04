CREATE TABLE IF NOT EXISTS runtime_operator_credentials (
  credential_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, username)
);

INSERT INTO runtime_operator_credentials (
  credential_id,
  tenant_id,
  username,
  password,
  status,
  created_by
)
VALUES
(
  'cred-tenant-rudolph-admin-janette',
  'tenant-rudolph-admin',
  'janette',
  'rsos_secure_2026',
  'active',
  'system'
),
(
  'cred-tenant-psgarage-admin',
  'tenant-psgarage',
  'psgarage-admin',
  'rsos_secure_2026',
  'active',
  'system'
)
ON CONFLICT (tenant_id, username) DO NOTHING;
