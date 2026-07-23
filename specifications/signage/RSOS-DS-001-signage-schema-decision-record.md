# RSOS-DS-001 Signage Schema Decision Record

Status: DECIDED
Version: 1.0
Domain: Digital Signage Runtime
Migration target: 107_runtime_signage_foundation.sql
Parent contract: RSOS-DS-001-signage-foundation-contract.md

## 1. Purpose

This record defines the binding relational schema decisions for the
RSOS Digital Signage Foundation before migration 107 is implemented.

The migration shall create the complete initial signage persistence
foundation atomically.

No route implementation, service implementation or player application
is included in this decision record.

## 2. General database conventions

The signage schema shall use:

- PostgreSQL
- UUID primary keys
- gen_random_uuid() for generated UUID values
- TEXT for tenant identifiers
- TIMESTAMPTZ for time values
- JSONB for structured extensible payloads
- explicit CHECK constraints for closed state sets
- explicit tenant-scoped uniqueness
- explicit foreign keys
- explicit indexes for player and management access paths
- transactional migration execution
- runtime schema migration ledger compatibility

All tables shall use the runtime_signage_ prefix.

All tenant-owned rows shall contain a non-null tenant_id.

Cross-tenant references are prohibited.

## 3. Identifier strategy

Primary identifiers shall be UUID values generated with:

UUID PRIMARY KEY DEFAULT gen_random_uuid()

Primary identifiers:

- screen_id
- credential_id
- content_id
- content_version_id
- playlist_id
- playlist_version_id
- playlist_item_id
- publication_id
- checkin_id

Business keys shall remain separate from primary identifiers.

Tenant-scoped business keys:

- screen_key
- content_key
- playlist_key

Business keys shall not be globally unique.

## 4. Tenant isolation strategy

Every signage table shall contain tenant_id TEXT NOT NULL.

Foreign-key relationships between signage tables shall include tenant
identity so that a row cannot reference an object from another tenant.

Required tenant-aware parent identities:

- UNIQUE (tenant_id, screen_id)
- UNIQUE (tenant_id, content_id)
- UNIQUE (tenant_id, content_version_id)
- UNIQUE (tenant_id, playlist_id)
- UNIQUE (tenant_id, playlist_version_id)
- UNIQUE (tenant_id, publication_id)

Required tenant-scoped business uniqueness:

- UNIQUE (tenant_id, screen_key)
- UNIQUE (tenant_id, content_key)
- UNIQUE (tenant_id, playlist_key)

No foreign key may permit cross-tenant association.

## 5. Delete behavior

Signage records represent auditable business and publication history.

Destructive cascading deletion shall be avoided.

Foreign keys shall use:

- ON DELETE RESTRICT
- or ON DELETE NO ACTION

Credentials, versions, playlist items, publications and check-ins shall
not be silently deleted because a parent is removed.

Normal lifecycle termination shall occur through status changes,
revocation, retirement, expiry or archival.

Physical retention and deletion policies are outside migration 107.

## 6. Screen table

Table:

runtime_signage_screens

Columns:

- screen_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- screen_key TEXT NOT NULL
- screen_name TEXT NOT NULL
- location_name TEXT
- status TEXT NOT NULL DEFAULT 'provisioning'
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb
- created_by TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- retired_at TIMESTAMPTZ

Allowed status values:

- provisioning
- active
- suspended
- revoked
- retired

Constraints:

- UNIQUE (tenant_id, screen_key)
- UNIQUE (tenant_id, screen_id)
- CHECK (length(btrim(screen_key)) > 0)
- CHECK (length(btrim(screen_name)) > 0)

A retired screen remains queryable for audit and historical publication
resolution.

## 7. Screen credential table

Table:

runtime_signage_screen_credentials

Columns:

- credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- screen_id UUID NOT NULL
- token_hash TEXT NOT NULL
- token_prefix TEXT NOT NULL
- status TEXT NOT NULL DEFAULT 'active'
- issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- expires_at TIMESTAMPTZ
- last_used_at TIMESTAMPTZ
- rotated_at TIMESTAMPTZ
- revoked_at TIMESTAMPTZ
- created_by TEXT NOT NULL
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed status values:

- active
- rotated
- revoked
- expired

The tenant-aware screen foreign key shall use ON DELETE RESTRICT.

The plaintext token shall never be persisted.

token_hash stores the cryptographic verification representation.

token_prefix supports safe operational identification and is not an
authentication secret.

token_hash shall be unique.

Only one active credential may exist per screen.

A partial unique index shall enforce:

UNIQUE (tenant_id, screen_id) WHERE status = 'active'

## 8. Content table

Table:

runtime_signage_content

Columns:

- content_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- content_key TEXT NOT NULL
- title TEXT NOT NULL
- content_type TEXT NOT NULL
- status TEXT NOT NULL DEFAULT 'draft'
- created_by TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- archived_at TIMESTAMPTZ
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed content status values:

- draft
- review_required
- approved
- published
- expired
- archived

Allowed initial content type values:

- image
- video
- html
- text
- document
- external_url

Constraints:

- UNIQUE (tenant_id, content_key)
- UNIQUE (tenant_id, content_id)
- CHECK (length(btrim(content_key)) > 0)
- CHECK (length(btrim(title)) > 0)

## 9. Content version table

Table:

runtime_signage_content_versions

Columns:

- content_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- content_id UUID NOT NULL
- version_number INTEGER NOT NULL
- status TEXT NOT NULL DEFAULT 'draft'
- source_uri TEXT
- media_type TEXT
- content_payload JSONB NOT NULL DEFAULT '{}'::jsonb
- duration_seconds INTEGER
- checksum_sha256 TEXT NOT NULL
- created_by TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- approved_by TEXT
- approved_at TIMESTAMPTZ
- published_at TIMESTAMPTZ
- expired_at TIMESTAMPTZ
- archived_at TIMESTAMPTZ
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed version status values:

- draft
- review_required
- approved
- published
- expired
- archived

The tenant-aware content foreign key shall use ON DELETE RESTRICT.

Constraints:

- UNIQUE (tenant_id, content_id, version_number)
- UNIQUE (tenant_id, content_version_id)
- CHECK (version_number > 0)
- CHECK (duration_seconds IS NULL OR duration_seconds > 0)
- CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')

checksum_sha256 represents the canonical published content
representation.

For binary assets, the checksum shall be calculated from the exact asset
bytes.

For structured content without binary asset bytes, the checksum shall be
calculated from a deterministic canonical JSON representation produced
by the application layer.

The database shall validate checksum format but shall not implement JSON
canonicalization.

## 10. Playlist table

Table:

runtime_signage_playlists

Columns:

- playlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- playlist_key TEXT NOT NULL
- playlist_name TEXT NOT NULL
- status TEXT NOT NULL DEFAULT 'draft'
- created_by TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- archived_at TIMESTAMPTZ
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed playlist status values:

- draft
- review_required
- approved
- published
- superseded
- archived

Constraints:

- UNIQUE (tenant_id, playlist_key)
- UNIQUE (tenant_id, playlist_id)
- CHECK (length(btrim(playlist_key)) > 0)
- CHECK (length(btrim(playlist_name)) > 0)

## 11. Playlist version table

Table:

runtime_signage_playlist_versions

Columns:

- playlist_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- playlist_id UUID NOT NULL
- version_number INTEGER NOT NULL
- status TEXT NOT NULL DEFAULT 'draft'
- validation_status TEXT NOT NULL DEFAULT 'pending'
- validation_result JSONB NOT NULL DEFAULT '{}'::jsonb
- checksum_sha256 TEXT NOT NULL
- created_by TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- validated_by TEXT
- validated_at TIMESTAMPTZ
- approved_by TEXT
- approved_at TIMESTAMPTZ
- published_at TIMESTAMPTZ
- superseded_at TIMESTAMPTZ
- archived_at TIMESTAMPTZ
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed version status values:

- draft
- review_required
- approved
- published
- superseded
- archived

Allowed validation status values:

- pending
- valid
- invalid

The tenant-aware playlist foreign key shall use ON DELETE RESTRICT.

Constraints:

- UNIQUE (tenant_id, playlist_id, version_number)
- UNIQUE (tenant_id, playlist_version_id)
- CHECK (version_number > 0)
- CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')

A playlist version may be published only if:

- status = 'approved'
- validation_status = 'valid'

The application publication transaction shall enforce this rule and
fail closed.

## 12. Playlist item table

Table:

runtime_signage_playlist_items

Columns:

- playlist_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- playlist_version_id UUID NOT NULL
- content_version_id UUID NOT NULL
- position INTEGER NOT NULL
- duration_seconds INTEGER
- transition_type TEXT
- item_config JSONB NOT NULL DEFAULT '{}'::jsonb
- created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP

The tenant-aware playlist-version foreign key shall reference:

runtime_signage_playlist_versions
(tenant_id, playlist_version_id)

The tenant-aware content-version foreign key shall reference:

runtime_signage_content_versions
(tenant_id, content_version_id)

Both foreign keys shall use ON DELETE RESTRICT.

Constraints:

- UNIQUE (tenant_id, playlist_version_id, position)
- CHECK (position > 0)
- CHECK (duration_seconds IS NULL OR duration_seconds > 0)

Playlist ordering shall be deterministic and based on position.

Migration 107 shall not impose a uniqueness constraint on
content_version_id inside a playlist version.

The service layer may reject repeated content assignments where a later
business rule requires that restriction.

## 13. Publication table

Table:

runtime_signage_publications

Columns:

- publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- screen_id UUID NOT NULL
- playlist_version_id UUID NOT NULL
- status TEXT NOT NULL DEFAULT 'current'
- publication_revision BIGINT NOT NULL
- configuration_checksum_sha256 TEXT NOT NULL
- published_by TEXT NOT NULL
- published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- superseded_at TIMESTAMPTZ
- revoked_at TIMESTAMPTZ
- revoke_reason TEXT
- previous_publication_id UUID
- governance_decision_id UUID
- publication_payload JSONB NOT NULL DEFAULT '{}'::jsonb
- metadata JSONB NOT NULL DEFAULT '{}'::jsonb

Allowed publication status values:

- current
- superseded
- revoked

The tenant-aware screen foreign key shall reference:

runtime_signage_screens
(tenant_id, screen_id)

The tenant-aware playlist-version foreign key shall reference:

runtime_signage_playlist_versions
(tenant_id, playlist_version_id)

Both foreign keys shall use ON DELETE RESTRICT.

The previous publication reference shall be tenant-aware.

Constraints:

- UNIQUE (tenant_id, publication_id)
- UNIQUE (tenant_id, screen_id, publication_revision)
- CHECK (publication_revision > 0)
- CHECK (
    configuration_checksum_sha256 ~ '^[0-9a-f]{64}$'
  )

Exactly one current publication may exist per screen.

A partial unique index shall enforce:

UNIQUE (tenant_id, screen_id) WHERE status = 'current'

Publication replacement shall occur within one database transaction.

The transaction shall:

1. lock the target screen publication scope
2. verify that the playlist version is approved and valid
3. mark the previous current publication as superseded
4. create the new current publication
5. persist the publication runtime event
6. commit atomically

The service layer shall use a transaction-scoped PostgreSQL advisory
lock derived from tenant_id and screen_id, or an equivalent row-level
serialization mechanism consistent with existing RSOS conventions.

Unknown or inconsistent publication state shall fail closed.

## 14. Player check-in table

Table:

runtime_signage_player_checkins

Columns:

- checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- tenant_id TEXT NOT NULL
- screen_id UUID NOT NULL
- credential_id UUID
- publication_id UUID
- player_version TEXT
- device_time TIMESTAMPTZ
- received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
- playback_status TEXT NOT NULL
- last_successful_sync_at TIMESTAMPTZ
- reported_publication_revision BIGINT
- reported_checksum_sha256 TEXT
- offline_mode BOOLEAN NOT NULL DEFAULT FALSE
- diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb
- network_info JSONB NOT NULL DEFAULT '{}'::jsonb
- error_code TEXT
- error_message TEXT

Allowed playback status values:

- starting
- online
- playing
- degraded
- offline
- error
- suspended

Tenant-aware foreign keys shall reference:

- runtime_signage_screens
- runtime_signage_screen_credentials
- runtime_signage_publications

All check-in foreign keys shall use ON DELETE RESTRICT.

Constraints:

- CHECK (
    reported_publication_revision IS NULL
    OR reported_publication_revision > 0
  )
- CHECK (
    reported_checksum_sha256 IS NULL
    OR reported_checksum_sha256 ~ '^[0-9a-f]{64}$'
  )

Check-ins are append-only operational evidence.

Migration 107 shall not automatically delete old check-ins.

Retention shall be implemented later as an explicit governed
operational policy.

## 15. Immutability strategy

Published content versions and published playlist versions are
immutable.

Database enforcement shall use trigger functions that reject changes to
protected fields after a row reaches an immutable state.

Protected content-version states:

- published
- expired
- archived

Protected playlist-version states:

- published
- superseded
- archived

Permitted post-publication changes shall be limited to lifecycle state
transitions and lifecycle timestamps explicitly allowed by the
contract.

The following fields shall never change after publication:

- tenant identity
- parent identity
- version number
- source identity
- asset payload
- content payload
- checksum
- media type
- playlist item composition
- playlist item ordering

Publication rows are historical records.

A current publication may transition only to:

- superseded
- revoked

A superseded or revoked publication shall never return to current.

The following publication fields shall remain immutable:

- tenant_id
- screen_id
- playlist_version_id
- publication_revision
- configuration_checksum_sha256
- published_by
- published_at
- previous_publication_id
- publication_payload

Trigger functions shall fail closed on prohibited updates.

Player check-in rows shall be append-only.

UPDATE and DELETE operations on player check-in rows shall be rejected
unless a later governed retention migration explicitly introduces a
controlled retention mechanism.

## 16. Timestamp strategy

All persisted timestamps shall use TIMESTAMPTZ.

Database creation timestamps shall default to CURRENT_TIMESTAMP.

updated_at fields shall be maintained by the service layer unless an
existing reusable RSOS update-timestamp trigger is identified during
migration implementation review.

Migration 107 shall not introduce a second generic timestamp framework
without necessity.

Lifecycle timestamps shall be nullable until the corresponding lifecycle
transition occurs.

Lifecycle transitions shall persist the matching timestamp atomically
with the state change.

## 17. Index strategy

Required screen-management indexes:

- (tenant_id, status)
- (tenant_id, location_name)

Required credential lookup indexes:

- (token_hash)
- (tenant_id, screen_id, status)

Required content-management indexes:

- (tenant_id, status, updated_at DESC)
- (tenant_id, content_type, status)
- (tenant_id, content_id, version_number DESC)

Required playlist-management indexes:

- (tenant_id, status, updated_at DESC)
- (tenant_id, playlist_id, version_number DESC)
- (tenant_id, playlist_version_id, position)

Required player publication lookup index:

- (tenant_id, screen_id, status)

Required publication history index:

- (tenant_id, screen_id, publication_revision DESC)

Required check-in indexes:

- (tenant_id, screen_id, received_at DESC)
- (tenant_id, received_at DESC)
- (screen_id, received_at DESC)

Partial unique indexes shall enforce:

- one active credential per tenant and screen
- one current publication per tenant and screen

Index names shall follow existing RSOS naming conventions and remain
deterministic.

Redundant indexes already provided by primary keys or unique constraints
shall not be created unnecessarily.

## 18. Governance linkage

Migration 107 shall provide a nullable governance_decision_id on
publication records.

A foreign key to the existing governance decision table shall be added
only if all of the following are confirmed during implementation:

- the referenced identifier type is UUID
- the referenced row identity is stable
- tenant identity is compatible
- cross-tenant linkage is impossible
- delete behavior preserves audit history

If exact compatibility is not confirmed, governance_decision_id shall
remain an auditable reference without an unsafe foreign key.

Publication authorization remains an application governance
responsibility.

The publication service shall verify the governance decision before the
publication transaction commits.

Unknown, missing, rejected or incompatible governance state shall fail
closed.

## 19. Migration atomicity and ledger compatibility

Migration file:

runtime-api/migrations/107_runtime_signage_foundation.sql

The migration shall:

- execute transactionally
- create all nine signage tables
- create all required constraints
- create all required indexes
- create immutability trigger functions
- create immutability triggers
- create append-only check-in protection
- avoid destructive statements
- avoid seed data
- avoid runtime route changes
- remain compatible with runtime_schema_migrations
- produce deterministic migration content for checksum verification

Migration 107 shall not modify unrelated runtime tables.

Migration 107 shall not be applied during the implementation step that
creates the SQL file.

Application and verification shall occur through the established
isolated migration runner workflow.

The migration shall fail atomically if any table, constraint, index,
function or trigger cannot be created.

No partial signage schema shall remain after a failed migration.

## 20. Deferred decisions

The following are intentionally deferred:

- object-storage provider selection
- media upload transport
- CDN integration
- binary retention policy
- check-in retention duration
- check-in partitioning
- screen grouping
- schedule windows
- multi-zone screen layouts
- remote player commands
- website publication targets
- kiosk interaction
- analytics aggregation
- automated content generation
- media transcoding
- content moderation automation
- device enrollment user interface

Deferred decisions shall not weaken:

- tenant isolation
- governance
- immutability
- auditability
- credential security
- publication consistency
- fail-closed behavior

## 21. Migration implementation acceptance criteria

Migration 107 is acceptable only if:

1. all nine required tables are created
2. all tables contain tenant_id TEXT NOT NULL
3. all primary keys use UUID
4. generated identifiers use gen_random_uuid()
5. tenant-aware foreign keys prevent cross-tenant relationships
6. all lifecycle states are constrained
7. duration, position, revision and version values are positive
8. checksums use lowercase 64-character SHA-256 format
9. published content-version data is immutable
10. published playlist-version data is immutable
11. publication history identity is immutable
12. only one current publication exists per tenant and screen
13. only one active credential exists per tenant and screen
14. player publication lookup indexes exist
15. tenant management query indexes exist
16. check-in evidence is append-only
17. the migration is transactionally safe
18. no existing route is changed
19. no unrelated runtime table is modified
20. migration ledger compatibility is preserved
21. plaintext credentials cannot be persisted
22. cross-tenant references cannot be created
23. unknown publication state fails closed
24. unknown governance state fails closed
25. failed migration execution leaves no partial signage schema
26. no seed data is introduced
27. no destructive cascade is introduced
28. all index and constraint names are deterministic
29. migration 107 is not applied during SQL creation
30. isolated migration verification is required before deployment
