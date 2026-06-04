CREATE TABLE IF NOT EXISTS runtime_tenant_members (
  member_id text PRIMARY KEY,

  tenant_id text NOT NULL REFERENCES runtime_tenants(tenant_id),

  username text NOT NULL,
  display_name text,
  email text,

  role text NOT NULL DEFAULT 'tenant_user',

  status text NOT NULL DEFAULT 'active',

  created_by text,
  created_at timestamptz DEFAULT now(),

  updated_by text,
  updated_at timestamptz,

  UNIQUE(tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_runtime_tenant_members_tenant
ON runtime_tenant_members (
  tenant_id,
  status
);

INSERT INTO runtime_tenant_members (
  member_id,
  tenant_id,
  username,
  display_name,
  email,
  role,
  status,
  created_by
)
VALUES (
  'mem-rudolph-admin-janette',
  'tenant-rudolph-admin',
  'janette',
  'Janette Rudolph',
  'info@bibu-rudolph.de',
  'tenant_admin',
  'active',
  'system'
)
ON CONFLICT (tenant_id, username) DO NOTHING;
