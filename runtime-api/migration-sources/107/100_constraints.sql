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
