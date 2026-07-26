-- RSOS-DS-001
-- Migration 107: Runtime signage foundation
-- GENERATED FILE - DO NOT EDIT DIRECTLY
-- Source: runtime-api/migration-sources/107
-- Build script: runtime-api/scripts/migrations/build_107_signage_migration.sh

BEGIN;

-- BEGIN MODULE: 010_screens.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 010_screens.sql
-- Responsibility: runtime signage screen identity and lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Cross-table constraints, indexes, immutability rules and comments are
-- implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_screens (
  screen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_key TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'provisioning',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TIMESTAMPTZ
);

-- END MODULE: 010_screens.sql

-- BEGIN MODULE: 020_screen_credentials.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 020_screen_credentials.sql
-- Responsibility: hashed player credential lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Plaintext bearer tokens must never be persisted.
-- token_hash contains the SHA-256 verification representation.
-- token_prefix is non-secret operational identification data.
-- Foreign keys, checks, uniqueness rules, indexes and comments are
-- implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_screen_credentials (
  credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 020_screen_credentials.sql

-- BEGIN MODULE: 030_content.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 030_content.sql
-- Responsibility: tenant-owned signage content identity and lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Status checks, content type checks, uniqueness rules, indexes and comments
-- are implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_content (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  content_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 030_content.sql

-- BEGIN MODULE: 040_content_versions.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 040_content_versions.sql
-- Responsibility: immutable-version-oriented signage content payload storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, checks, uniqueness rules, indexes, immutability enforcement
-- and comments are implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_content_versions (
  content_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  content_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_uri TEXT,
  media_type TEXT,
  content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INTEGER,
  checksum_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 040_content_versions.sql

-- BEGIN MODULE: 050_playlists.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 050_playlists.sql
-- Responsibility: tenant-owned signage playlist identity and lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Status checks, uniqueness rules, indexes and comments are implemented
-- in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_playlists (
  playlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  playlist_key TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 050_playlists.sql

-- BEGIN MODULE: 060_playlist_versions.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 060_playlist_versions.sql
-- Responsibility: versioned and validated signage playlist configuration storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, status checks, validation checks, uniqueness rules, indexes,
-- publication enforcement and comments are implemented in dedicated modules.

CREATE TABLE public.runtime_signage_playlist_versions (
  playlist_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  playlist_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  validation_status TEXT NOT NULL DEFAULT 'pending',
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 060_playlist_versions.sql

-- BEGIN MODULE: 070_playlist_items.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 070_playlist_items.sql
-- Responsibility: ordered assignment of content versions to playlist versions
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, ordering constraints, duration checks, uniqueness rules,
-- indexes and comments are implemented in dedicated migration source modules.

CREATE TABLE public.runtime_signage_playlist_items (
  playlist_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  playlist_version_id UUID NOT NULL,
  content_version_id UUID NOT NULL,
  position INTEGER NOT NULL,
  duration_seconds INTEGER,
  transition_type TEXT,
  item_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- END MODULE: 070_playlist_items.sql

-- BEGIN MODULE: 080_publications.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 080_publications.sql
-- Responsibility: versioned and auditable screen publication state storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, status checks, revision checks, checksum checks, uniqueness
-- rules, serialization enforcement, indexes and comments are implemented
-- in dedicated migration and application modules.

CREATE TABLE public.runtime_signage_publications (
  publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  playlist_version_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'current',
  publication_revision BIGINT NOT NULL,
  configuration_checksum_sha256 TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  previous_publication_id UUID,
  governance_decision_id UUID,
  publication_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 080_publications.sql

-- BEGIN MODULE: 090_player_checkins.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 090_player_checkins.sql
-- Responsibility: append-only signage player operational check-in evidence
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, playback-status checks, revision checks, checksum checks,
-- retention policy, indexes and comments are implemented in dedicated modules.

CREATE TABLE public.runtime_signage_player_checkins (
  checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  credential_id UUID,
  publication_id UUID,
  player_version TEXT,
  device_time TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  playback_status TEXT NOT NULL,
  last_successful_sync_at TIMESTAMPTZ,
  reported_publication_revision BIGINT,
  reported_checksum_sha256 TEXT,
  offline_mode BOOLEAN NOT NULL DEFAULT FALSE,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  network_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT
);

-- END MODULE: 090_player_checkins.sql

-- BEGIN MODULE: 100_constraints.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 100_constraints.sql
-- Responsibility: signage relational integrity and value-domain enforcement
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Partial unique indexes, append-only enforcement, comments and final
-- migration verification are implemented in dedicated source modules.

ALTER TABLE public.runtime_signage_screens
  ADD CONSTRAINT runtime_signage_screens_status_check
    CHECK (
      status IN (
        'provisioning',
        'active',
        'suspended',
        'revoked',
        'retired'
      )
    ),
  ADD CONSTRAINT runtime_signage_screens_tenant_screen_key_key
    UNIQUE (tenant_id, screen_key),
  ADD CONSTRAINT runtime_signage_screens_tenant_screen_id_key
    UNIQUE (tenant_id, screen_id),
  ADD CONSTRAINT runtime_signage_screens_screen_key_not_blank
    CHECK (length(btrim(screen_key)) > 0),
  ADD CONSTRAINT runtime_signage_screens_screen_name_not_blank
    CHECK (length(btrim(screen_name)) > 0);

ALTER TABLE public.runtime_signage_screen_credentials
  ADD CONSTRAINT runtime_signage_screen_credentials_status_check
    CHECK (
      status IN (
        'active',
        'rotated',
        'revoked',
        'expired'
      )
    ),
  ADD CONSTRAINT runtime_signage_screen_credentials_token_hash_key
    UNIQUE (token_hash),
  ADD CONSTRAINT runtime_signage_screen_credentials_tenant_id_key
    UNIQUE (tenant_id, credential_id),
  ADD CONSTRAINT runtime_signage_screen_credentials_token_hash_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT runtime_signage_screen_credentials_screen_fk
    FOREIGN KEY (tenant_id, screen_id)
    REFERENCES public.runtime_signage_screens (tenant_id, screen_id)
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_signage_content
  ADD CONSTRAINT runtime_signage_content_status_check
    CHECK (
      status IN (
        'draft',
        'review_required',
        'approved',
        'published',
        'expired',
        'archived'
      )
    ),
  ADD CONSTRAINT runtime_signage_content_type_check
    CHECK (
      content_type IN (
        'image',
        'video',
        'html',
        'text',
        'document',
        'external_url'
      )
    ),
  ADD CONSTRAINT runtime_signage_content_tenant_content_key_key
    UNIQUE (tenant_id, content_key),
  ADD CONSTRAINT runtime_signage_content_tenant_content_id_key
    UNIQUE (tenant_id, content_id),
  ADD CONSTRAINT runtime_signage_content_key_not_blank
    CHECK (length(btrim(content_key)) > 0),
  ADD CONSTRAINT runtime_signage_content_title_not_blank
    CHECK (length(btrim(title)) > 0);

ALTER TABLE public.runtime_signage_content_versions
  ADD CONSTRAINT runtime_signage_content_versions_status_check
    CHECK (
      status IN (
        'draft',
        'review_required',
        'approved',
        'published',
        'expired',
        'archived'
      )
    ),
  ADD CONSTRAINT runtime_signage_content_versions_number_key
    UNIQUE (tenant_id, content_id, version_number),
  ADD CONSTRAINT runtime_signage_content_versions_tenant_id_key
    UNIQUE (tenant_id, content_version_id),
  ADD CONSTRAINT runtime_signage_content_versions_number_check
    CHECK (version_number > 0),
  ADD CONSTRAINT runtime_signage_content_versions_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  ADD CONSTRAINT runtime_signage_content_versions_checksum_check
    CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT runtime_signage_content_versions_content_fk
    FOREIGN KEY (tenant_id, content_id)
    REFERENCES public.runtime_signage_content (tenant_id, content_id)
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_signage_playlists
  ADD CONSTRAINT runtime_signage_playlists_status_check
    CHECK (
      status IN (
        'draft',
        'review_required',
        'approved',
        'published',
        'superseded',
        'archived'
      )
    ),
  ADD CONSTRAINT runtime_signage_playlists_tenant_playlist_key_key
    UNIQUE (tenant_id, playlist_key),
  ADD CONSTRAINT runtime_signage_playlists_tenant_playlist_id_key
    UNIQUE (tenant_id, playlist_id),
  ADD CONSTRAINT runtime_signage_playlists_key_not_blank
    CHECK (length(btrim(playlist_key)) > 0),
  ADD CONSTRAINT runtime_signage_playlists_name_not_blank
    CHECK (length(btrim(playlist_name)) > 0);

ALTER TABLE public.runtime_signage_playlist_versions
  ADD CONSTRAINT runtime_signage_playlist_versions_status_check
    CHECK (
      status IN (
        'draft',
        'review_required',
        'approved',
        'published',
        'superseded',
        'archived'
      )
    ),
  ADD CONSTRAINT runtime_signage_playlist_versions_validation_check
    CHECK (
      validation_status IN (
        'pending',
        'valid',
        'invalid'
      )
    ),
  ADD CONSTRAINT runtime_signage_playlist_versions_number_key
    UNIQUE (tenant_id, playlist_id, version_number),
  ADD CONSTRAINT runtime_signage_playlist_versions_tenant_id_key
    UNIQUE (tenant_id, playlist_version_id),
  ADD CONSTRAINT runtime_signage_playlist_versions_number_check
    CHECK (version_number > 0),
  ADD CONSTRAINT runtime_signage_playlist_versions_checksum_check
    CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT runtime_signage_playlist_versions_playlist_fk
    FOREIGN KEY (tenant_id, playlist_id)
    REFERENCES public.runtime_signage_playlists (tenant_id, playlist_id)
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_signage_playlist_items
  ADD CONSTRAINT runtime_signage_playlist_items_position_key
    UNIQUE (tenant_id, playlist_version_id, position),
  ADD CONSTRAINT runtime_signage_playlist_items_position_check
    CHECK (position > 0),
  ADD CONSTRAINT runtime_signage_playlist_items_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  ADD CONSTRAINT runtime_signage_playlist_items_playlist_version_fk
    FOREIGN KEY (tenant_id, playlist_version_id)
    REFERENCES public.runtime_signage_playlist_versions (
      tenant_id,
      playlist_version_id
    )
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_signage_playlist_items_content_version_fk
    FOREIGN KEY (tenant_id, content_version_id)
    REFERENCES public.runtime_signage_content_versions (
      tenant_id,
      content_version_id
    )
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_signage_publications
  ADD CONSTRAINT runtime_signage_publications_status_check
    CHECK (
      status IN (
        'current',
        'superseded',
        'revoked'
      )
    ),
  ADD CONSTRAINT runtime_signage_publications_tenant_id_key
    UNIQUE (tenant_id, publication_id),
  ADD CONSTRAINT runtime_signage_publications_revision_key
    UNIQUE (tenant_id, screen_id, publication_revision),
  ADD CONSTRAINT runtime_signage_publications_revision_check
    CHECK (publication_revision > 0),
  ADD CONSTRAINT runtime_signage_publications_checksum_check
    CHECK (
      configuration_checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT runtime_signage_publications_screen_fk
    FOREIGN KEY (tenant_id, screen_id)
    REFERENCES public.runtime_signage_screens (tenant_id, screen_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_signage_publications_playlist_version_fk
    FOREIGN KEY (tenant_id, playlist_version_id)
    REFERENCES public.runtime_signage_playlist_versions (
      tenant_id,
      playlist_version_id
    )
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_signage_publications_previous_fk
    FOREIGN KEY (tenant_id, previous_publication_id)
    REFERENCES public.runtime_signage_publications (
      tenant_id,
      publication_id
    )
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_signage_player_checkins
  ADD CONSTRAINT runtime_signage_player_checkins_status_check
    CHECK (
      playback_status IN (
        'starting',
        'online',
        'playing',
        'degraded',
        'offline',
        'error',
        'suspended'
      )
    ),
  ADD CONSTRAINT runtime_signage_player_checkins_revision_check
    CHECK (
      reported_publication_revision IS NULL
      OR reported_publication_revision > 0
    ),
  ADD CONSTRAINT runtime_signage_player_checkins_checksum_check
    CHECK (
      reported_checksum_sha256 IS NULL
      OR reported_checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT runtime_signage_player_checkins_screen_fk
    FOREIGN KEY (tenant_id, screen_id)
    REFERENCES public.runtime_signage_screens (tenant_id, screen_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_signage_player_checkins_credential_fk
    FOREIGN KEY (tenant_id, credential_id)
    REFERENCES public.runtime_signage_screen_credentials (
      tenant_id,
      credential_id
    )
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_signage_player_checkins_publication_fk
    FOREIGN KEY (tenant_id, publication_id)
    REFERENCES public.runtime_signage_publications (
      tenant_id,
      publication_id
    )
    ON DELETE RESTRICT;

-- END MODULE: 100_constraints.sql

-- BEGIN MODULE: 110_indexes.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 110_indexes.sql
-- Responsibility: normative partial uniqueness indexes
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- General performance indexes are intentionally deferred until supported
-- by observed query plans and governed operational evidence.

CREATE UNIQUE INDEX runtime_signage_screen_credentials_one_active_per_screen
  ON public.runtime_signage_screen_credentials (tenant_id, screen_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX runtime_signage_publications_one_current_per_screen
  ON public.runtime_signage_publications (tenant_id, screen_id)
  WHERE status = 'current';

-- END MODULE: 110_indexes.sql

-- BEGIN MODULE: 120_immutability.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 120_immutability.sql
-- Responsibility: append-only enforcement for player check-in evidence
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Player check-ins are immutable operational evidence after insertion.
-- Retention and governed deletion are intentionally outside migration 107.

CREATE FUNCTION public.runtime_signage_reject_player_checkin_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'runtime_signage_player_checkins is append-only: % is not permitted',
    TG_OP
    USING ERRCODE = '55000';

  RETURN NULL;
END;
$function$;

CREATE TRIGGER runtime_signage_player_checkins_append_only
BEFORE UPDATE OR DELETE
ON public.runtime_signage_player_checkins
FOR EACH ROW
EXECUTE FUNCTION public.runtime_signage_reject_player_checkin_mutation();

-- END MODULE: 120_immutability.sql

-- BEGIN MODULE: 130_comments.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 130_comments.sql
-- Responsibility: database comments
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
--
-- Intentional no-op:
-- Migration 107 defines no normative COMMENT ON statements.
-- The schema decision record and foundation contract contain no explicit
-- database-comment contract, and no corresponding repository convention
-- was observed in the existing runtime migration set.
--
-- Non-normative database comments are intentionally omitted to prevent
-- invented documentation from becoming part of the governed schema.

-- END MODULE: 130_comments.sql

-- BEGIN MODULE: 990_verify.sql
-- RSOS-DS-001 Migration 107 source module
-- Module: 990_verify.sql
-- Responsibility: fail-closed PostgreSQL catalog verification
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.

DO $verify$
DECLARE
  expected_tables CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content',
    'runtime_signage_content_versions',
    'runtime_signage_player_checkins',
    'runtime_signage_playlist_items',
    'runtime_signage_playlist_versions',
    'runtime_signage_playlists',
    'runtime_signage_publications',
    'runtime_signage_screen_credentials',
    'runtime_signage_screens'
  ];

  expected_constraints CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content_key_not_blank',
    'runtime_signage_content_status_check',
    'runtime_signage_content_tenant_content_id_key',
    'runtime_signage_content_tenant_content_key_key',
    'runtime_signage_content_title_not_blank',
    'runtime_signage_content_type_check',
    'runtime_signage_content_versions_checksum_check',
    'runtime_signage_content_versions_content_fk',
    'runtime_signage_content_versions_duration_check',
    'runtime_signage_content_versions_number_check',
    'runtime_signage_content_versions_number_key',
    'runtime_signage_content_versions_status_check',
    'runtime_signage_content_versions_tenant_id_key',
    'runtime_signage_player_checkins_checksum_check',
    'runtime_signage_player_checkins_credential_fk',
    'runtime_signage_player_checkins_publication_fk',
    'runtime_signage_player_checkins_revision_check',
    'runtime_signage_player_checkins_screen_fk',
    'runtime_signage_player_checkins_status_check',
    'runtime_signage_playlist_items_content_version_fk',
    'runtime_signage_playlist_items_duration_check',
    'runtime_signage_playlist_items_playlist_version_fk',
    'runtime_signage_playlist_items_position_check',
    'runtime_signage_playlist_items_position_key',
    'runtime_signage_playlist_versions_checksum_check',
    'runtime_signage_playlist_versions_number_check',
    'runtime_signage_playlist_versions_number_key',
    'runtime_signage_playlist_versions_playlist_fk',
    'runtime_signage_playlist_versions_status_check',
    'runtime_signage_playlist_versions_tenant_id_key',
    'runtime_signage_playlist_versions_validation_check',
    'runtime_signage_playlists_key_not_blank',
    'runtime_signage_playlists_name_not_blank',
    'runtime_signage_playlists_status_check',
    'runtime_signage_playlists_tenant_playlist_id_key',
    'runtime_signage_playlists_tenant_playlist_key_key',
    'runtime_signage_publications_checksum_check',
    'runtime_signage_publications_playlist_version_fk',
    'runtime_signage_publications_previous_fk',
    'runtime_signage_publications_revision_check',
    'runtime_signage_publications_revision_key',
    'runtime_signage_publications_screen_fk',
    'runtime_signage_publications_status_check',
    'runtime_signage_publications_tenant_id_key',
    'runtime_signage_screen_credentials_screen_fk',
    'runtime_signage_screen_credentials_status_check',
    'runtime_signage_screen_credentials_tenant_id_key',
    'runtime_signage_screen_credentials_token_hash_check',
    'runtime_signage_screen_credentials_token_hash_key',
    'runtime_signage_screens_screen_key_not_blank',
    'runtime_signage_screens_screen_name_not_blank',
    'runtime_signage_screens_status_check',
    'runtime_signage_screens_tenant_screen_id_key',
    'runtime_signage_screens_tenant_screen_key_key'
  ];

  expected_primary_keys CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content_pkey',
    'runtime_signage_content_versions_pkey',
    'runtime_signage_player_checkins_pkey',
    'runtime_signage_playlist_items_pkey',
    'runtime_signage_playlist_versions_pkey',
    'runtime_signage_playlists_pkey',
    'runtime_signage_publications_pkey',
    'runtime_signage_screen_credentials_pkey',
    'runtime_signage_screens_pkey'
  ];

  missing_objects TEXT[];
  unexpected_objects TEXT[];
  actual_count INTEGER;
BEGIN
  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_tables) AS expected_name
  WHERE to_regclass('public.' || expected_name) IS NULL;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: required tables missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_class relation
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname = ANY (expected_tables);

  IF actual_count <> 9 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: table count mismatch',
      DETAIL = 'expected=9 actual=' || actual_count;
  END IF;

  SELECT array_agg(relation.relname ORDER BY relation.relname)
  INTO unexpected_objects
  FROM pg_class relation
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname LIKE 'runtime_signage_%'
    AND NOT relation.relname = ANY (expected_tables);

  IF unexpected_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: unexpected signage tables',
      DETAIL = array_to_string(unexpected_objects, ',');
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_tables) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns column_definition
    WHERE column_definition.table_schema = 'public'
      AND column_definition.table_name = expected_name
      AND column_definition.column_name = 'tenant_id'
      AND column_definition.data_type = 'text'
      AND column_definition.is_nullable = 'NO'
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: tenant_id contract missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_constraints) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_definition
    JOIN pg_class relation
      ON relation.oid = constraint_definition.conrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY (expected_tables)
      AND constraint_definition.conname = expected_name
      AND constraint_definition.convalidated
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: required constraints missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.conname = ANY (expected_constraints)
    AND constraint_definition.convalidated;

  IF actual_count <> 54 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: constraint count mismatch',
      DETAIL = 'expected=54 actual=' || actual_count;
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_primary_keys) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_definition
    JOIN pg_class relation
      ON relation.oid = constraint_definition.conrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY (expected_tables)
      AND constraint_definition.conname = expected_name
      AND constraint_definition.contype = 'p'
      AND constraint_definition.convalidated
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: primary keys missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  JOIN unnest(constraint_definition.conkey)
    WITH ORDINALITY AS key_column(attribute_number, position)
    ON true
  JOIN pg_attribute attribute_definition
    ON attribute_definition.attrelid = relation.oid
   AND attribute_definition.attnum = key_column.attribute_number
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.contype = 'p'
    AND attribute_definition.atttypid = 'uuid'::regtype;

  IF actual_count <> 9 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: UUID primary-key contract invalid',
      DETAIL = 'expected=9 actual=' || actual_count;
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.contype = 'f'
    AND constraint_definition.conname = ANY (expected_constraints)
    AND constraint_definition.confdeltype = 'c';

  IF actual_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: destructive cascade detected',
      DETAIL = 'cascade_foreign_keys=' || actual_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_namespace namespace
      ON namespace.oid = index_relation.relnamespace
    JOIN pg_index index_definition
      ON index_definition.indexrelid = index_relation.oid
    JOIN pg_class table_relation
      ON table_relation.oid = index_definition.indrelid
    WHERE namespace.nspname = 'public'
      AND index_relation.relname =
        'runtime_signage_screen_credentials_one_active_per_screen'
      AND table_relation.relname =
        'runtime_signage_screen_credentials'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND pg_get_expr(
            index_definition.indpred,
            index_definition.indrelid
          ) = '(status = ''active''::text)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: active credential index invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_namespace namespace
      ON namespace.oid = index_relation.relnamespace
    JOIN pg_index index_definition
      ON index_definition.indexrelid = index_relation.oid
    JOIN pg_class table_relation
      ON table_relation.oid = index_definition.indrelid
    WHERE namespace.nspname = 'public'
      AND index_relation.relname =
        'runtime_signage_publications_one_current_per_screen'
      AND table_relation.relname =
        'runtime_signage_publications'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND pg_get_expr(
            index_definition.indpred,
            index_definition.indrelid
          ) = '(status = ''current''::text)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: current publication index invalid';
  END IF;

  IF to_regprocedure(
    'public.runtime_signage_reject_player_checkin_mutation()'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: immutability function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc function_definition
    JOIN pg_namespace namespace
      ON namespace.oid = function_definition.pronamespace
    WHERE namespace.nspname = 'public'
      AND function_definition.proname =
        'runtime_signage_reject_player_checkin_mutation'
      AND function_definition.prorettype = 'trigger'::regtype
      AND function_definition.pronargs = 0
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: immutability function invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_definition
    JOIN pg_class relation
      ON relation.oid = trigger_definition.tgrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_proc function_definition
      ON function_definition.oid = trigger_definition.tgfoid
    JOIN pg_namespace function_namespace
      ON function_namespace.oid = function_definition.pronamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'runtime_signage_player_checkins'
      AND trigger_definition.tgname =
        'runtime_signage_player_checkins_append_only'
      AND NOT trigger_definition.tgisinternal
      AND trigger_definition.tgenabled <> 'D'
      AND (trigger_definition.tgtype & 1) = 1
      AND (trigger_definition.tgtype & 16) = 16
      AND (trigger_definition.tgtype & 8) = 8
      AND (trigger_definition.tgtype & 4) = 0
      AND function_namespace.nspname = 'public'
      AND function_definition.proname =
        'runtime_signage_reject_player_checkin_mutation'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: append-only trigger invalid';
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_trigger trigger_definition
  JOIN pg_class relation
    ON relation.oid = trigger_definition.tgrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'runtime_signage_player_checkins'
    AND trigger_definition.tgname =
      'runtime_signage_player_checkins_append_only'
    AND NOT trigger_definition.tgisinternal;

  IF actual_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: append-only trigger cardinality',
      DETAIL = 'expected=1 actual=' || actual_count;
  END IF;
END
$verify$;

-- END MODULE: 990_verify.sql

COMMIT;
