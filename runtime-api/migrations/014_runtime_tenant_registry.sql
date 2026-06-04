CREATE TABLE IF NOT EXISTS runtime_tenants (
  tenant_id text PRIMARY KEY,
  tenant_name text NOT NULL,
  tenant_type text NOT NULL DEFAULT 'business',
  status text NOT NULL DEFAULT 'active',
  owner_name text,
  owner_email text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_by text,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS runtime_tenant_domains (
  domain_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES runtime_tenants(tenant_id),
  domain_name text NOT NULL,
  domain_role text NOT NULL DEFAULT 'primary',
  status text NOT NULL DEFAULT 'active',
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(domain_name)
);

CREATE TABLE IF NOT EXISTS runtime_tenant_settings (
  setting_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES runtime_tenants(tenant_id),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_by text,
  updated_at timestamptz,
  UNIQUE(tenant_id, setting_key)
);

INSERT INTO runtime_tenants (
  tenant_id,
  tenant_name,
  tenant_type,
  status,
  owner_name,
  owner_email,
  created_by
)
VALUES (
  'tenant-rudolph-admin',
  'Rudolph Buchhaltung',
  'tenant_management_portal',
  'active',
  'Janette Rudolph',
  'info@bibu-rudolph.de',
  'system'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO runtime_tenant_domains (
  domain_id,
  tenant_id,
  domain_name,
  domain_role,
  status,
  created_by
)
VALUES (
  'dom-rudolph-buchhaltung',
  'tenant-rudolph-admin',
  'www.rudolph-buchhaltung.de',
  'management_portal',
  'active',
  'system'
)
ON CONFLICT (domain_name) DO NOTHING;
