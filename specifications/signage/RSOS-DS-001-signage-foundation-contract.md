# RSOS-DS-001 Signage Foundation Contract

Status: SPECIFIED
Version: 1.0
Domain: Digital Signage Runtime
Architecture: Tenant-scoped, governed, versioned, auditable

## 1. Purpose

The RSOS Digital Signage Runtime provides centrally managed,
tenant-isolated and auditable content delivery to registered screens.

The runtime shall support:

- screen registration
- screen credentials
- versioned content
- versioned playlists
- governed publication
- player configuration delivery
- player check-ins
- offline fallback
- publication rollback

The runtime shall not rely on removable storage as the normal
content-delivery mechanism.

## 2. Architectural principles

The Signage Runtime shall follow these RSOS principles:

1. Tenant isolation
2. Human responsibility
3. Explicit governance
4. Immutable published versions
5. Complete audit events
6. Fail-closed publication
7. Recoverable player operation
8. No hidden cross-tenant access
9. No user JWT stored on display devices
10. No publication without a validated playlist version

## 3. Core entities

### 3.1 Screen

A Screen represents one registered playback device.

Required identity:

- screen_id
- tenant_id
- screen_key
- screen_name
- location_name
- status
- created_at
- updated_at

Allowed screen status values:

- provisioning
- active
- suspended
- revoked
- retired

A screen_key must be unique inside one tenant.

### 3.2 Screen Credential

A Screen Credential authorizes a single screen to:

- read its published player configuration
- submit its own check-in

A Screen Credential must contain:

- credential_id
- tenant_id
- screen_id
- token_hash
- token_prefix
- status
- issued_at
- expires_at
- last_used_at
- revoked_at

Allowed credential status values:

- active
- rotated
- revoked
- expired

The plaintext token must never be persisted.

### 3.3 Content

Content is the stable business identity of a signage asset.

Required identity:

- content_id
- tenant_id
- content_key
- title
- content_type
- status
- created_by
- created_at
- updated_at

Allowed content types:

- image
- video
- html
- text
- qr
- external_url

Allowed content status values:

- draft
- active
- archived

A content_key must be unique inside one tenant.

### 3.4 Content Version

A Content Version is immutable after it becomes approved or published.

Required fields:

- content_version_id
- tenant_id
- content_id
- version_number
- payload
- checksum
- lifecycle_status
- valid_from
- valid_until
- created_by
- created_at

Allowed lifecycle status values:

- draft
- review_required
- approved
- published
- expired
- archived
- rejected

Version numbers must increase monotonically inside one content object.

### 3.5 Playlist

A Playlist is the stable business identity of an ordered content set.

Required fields:

- playlist_id
- tenant_id
- playlist_key
- playlist_name
- status
- created_by
- created_at
- updated_at

Allowed playlist status values:

- draft
- active
- archived

A playlist_key must be unique inside one tenant.

### 3.6 Playlist Version

A Playlist Version is an immutable playback contract after approval.

Required fields:

- playlist_version_id
- tenant_id
- playlist_id
- version_number
- lifecycle_status
- checksum
- valid_from
- valid_until
- created_by
- created_at

Allowed lifecycle status values:

- draft
- validation_failed
- validated
- review_required
- approved
- published
- superseded
- expired
- archived
- rejected

Version numbers must increase monotonically inside one playlist.

### 3.7 Playlist Item

A Playlist Item references exactly one Content Version.

Required fields:

- playlist_item_id
- tenant_id
- playlist_version_id
- content_version_id
- position
- duration_seconds
- transition_type
- item_config

Constraints:

- position must be positive
- position must be unique inside one playlist version
- duration_seconds must be positive
- referenced content must belong to the same tenant
- referenced content version must not be draft or rejected
- published playlist versions must not be modified

### 3.8 Publication

A Publication assigns one approved Playlist Version to one Screen.

Required fields:

- publication_id
- tenant_id
- screen_id
- playlist_version_id
- publication_status
- governance_decision_id
- governance_approval_id
- published_by
- published_at
- superseded_at
- revoked_at

Allowed publication status values:

- pending
- published
- superseded
- revoked
- expired
- failed

Only one current published publication may exist per screen.

### 3.9 Player Check-in

A Player Check-in records device health and delivery state.

Required fields:

- checkin_id
- tenant_id
- screen_id
- publication_id
- playlist_version_id
- player_version
- device_time
- received_at
- connectivity_status
- playback_status
- cache_status
- last_error
- metrics

Allowed connectivity status values:

- online
- degraded
- offline_recovered

Allowed playback status values:

- playing
- idle
- fallback
- error

Allowed cache status values:

- current
- stale
- missing
- fallback

## 4. Tenant isolation contract

For authenticated management routes:

tenant_id = authenticated user tenant_id

A tenant_id supplied by:

- request body
- query parameter
- route parameter
- player payload

must never override the authenticated or credential-bound tenant.

Global tenant selection is only permitted when:

- role = system_admin
- scope = global

Every database read and write must include tenant_id in its scope.

Cross-tenant references must fail.

## 5. Management authorization

The initial management role contract is:

Read:

- system_admin
- runtime_admin
- governance
- auditor

Create and update drafts:

- system_admin
- runtime_admin
- governance

Validate:

- system_admin
- runtime_admin
- governance

Approve:

- system_admin
- governance

Publish:

- system_admin
- governance

Revoke:

- system_admin
- governance

Auditor access is read-only.

## 6. Player authorization

Player requests use a screen token and do not use an operator JWT.

Required request header:

Authorization: Bearer <screen-token>

The token is bound to:

- one tenant
- one screen
- display:read
- checkin:write

The token shall not authorize:

- content management
- playlist management
- governance decisions
- publication
- access to another screen
- access to another tenant
- general runtime administration

The stored credential representation shall use a cryptographic hash.

The clear token shall only be returned during issue or rotation.

## 7. Content lifecycle

Allowed transition graph:

draft
  -> review_required
  -> approved
  -> published
  -> expired
  -> archived

Alternative transitions:

review_required -> rejected
approved -> archived
published -> archived

Forbidden transitions include:

- draft -> published
- rejected -> published
- archived -> published
- expired -> published
- published -> draft

Published content versions are immutable.

A correction requires a new version.

## 8. Playlist lifecycle

Allowed transition graph:

draft
  -> validated
  -> review_required
  -> approved
  -> published
  -> superseded
  -> archived

Validation failure:

draft -> validation_failed

Rework:

validation_failed -> draft
rejected -> draft only through a new version

Expiry:

published -> expired -> archived

Forbidden transitions include:

- draft -> approved
- draft -> published
- validation_failed -> published
- review_required -> published
- rejected -> published
- archived -> published

Published playlist versions are immutable.

## 9. Playlist validation contract

Validation must fail when any of the following is true:

- no playlist items exist
- duplicate positions exist
- a referenced content version does not exist
- a referenced content version belongs to another tenant
- content is draft, rejected, expired or archived
- content valid_until is before publication validity
- duration_seconds is not positive
- unsupported content_type is referenced
- external URL violates the configured allowlist
- the calculated checksum differs from the stored checksum

Validation output must contain:

- validation_status
- validated_at
- findings
- blocking_findings
- warning_findings
- calculated_checksum

Warnings do not permit bypassing blocking findings.

## 10. Governance contract

The governance object for publication is:

object_id = playlist_version_id

The Signage Runtime reuses:

- runtime_governance_decisions
- runtime_governance_approvals
- governance decision revisions
- approval cardinality
- governance enforcement

Publication requires an enforcement result of:

- allowed = true
- status = allowed

All other outcomes block publication, including:

- review_required
- blocked
- missing decision
- missing approval
- rejected approval
- unknown status
- inconsistent revision
- stale approval

The publication row must reference the effective decision and approval.

## 11. Publication contract

Publication is an atomic operation.

It must:

1. verify tenant scope
2. lock the target screen publication scope
3. verify the screen is active
4. verify the playlist version is approved
5. verify playlist validity dates
6. run the governance enforcement gate
7. supersede the current publication, if present
8. insert the new publication
9. mark the playlist version as published
10. write the runtime audit event
11. commit all changes together

If any step fails, no partial publication may remain.

Concurrent publication attempts for the same screen must serialize.

## 12. Player configuration contract

The player configuration response shall include:

- contract_version
- tenant_id
- screen_id
- publication_id
- playlist_version_id
- playlist_checksum
- generated_at
- refresh_after_seconds
- offline_cache_ttl_seconds
- fallback_policy
- items

Each item shall include:

- content_version_id
- content_type
- source
- checksum
- duration_seconds
- transition_type
- item_config

The player may only receive the current published publication assigned
to its credential-bound screen.

No draft, review, rejected or archived content may be returned.

## 13. Offline behavior

The player must retain the last successfully validated configuration.

When the runtime cannot be reached:

1. continue the last cached published playlist
2. mark local state as offline
3. retry with bounded backoff
4. preserve the cached playlist until cache expiry
5. switch to packaged fallback content only when no valid cache remains

The fallback must not be interpreted as a new publication.

After reconnection, the player reports:

connectivity_status = offline_recovered

## 14. Audit event contract

Required events:

- runtime.signage.screen.created
- runtime.signage.screen.updated
- runtime.signage.screen.suspended
- runtime.signage.screen.revoked
- runtime.signage.credential.issued
- runtime.signage.credential.rotated
- runtime.signage.credential.revoked
- runtime.signage.content.created
- runtime.signage.content_version.created
- runtime.signage.content_version.review_requested
- runtime.signage.content_version.approved
- runtime.signage.content_version.rejected
- runtime.signage.playlist.created
- runtime.signage.playlist_version.created
- runtime.signage.playlist_version.validated
- runtime.signage.playlist_version.validation_failed
- runtime.signage.playlist_version.review_requested
- runtime.signage.playlist_version.approved
- runtime.signage.playlist_version.rejected
- runtime.signage.publication.published
- runtime.signage.publication.superseded
- runtime.signage.publication.revoked
- runtime.signage.player.checked_in
- runtime.signage.player.fallback_reported
- runtime.signage.player.recovered

Audit events must contain structured event_payload data.

The event object_id must identify the primary affected entity.

## 15. Integrity contract

Checksums are required for:

- content version payload
- playlist version item sequence
- delivered player configuration

A published version must not be updated in place.

The player must reject a configuration whose checksum cannot be verified.

## 16. Initial API contract

Management routes:

POST /runtime/signage/screens
GET /runtime/signage/screens
GET /runtime/signage/screens/:screen_id
POST /runtime/signage/screens/:screen_id/credentials
POST /runtime/signage/screens/:screen_id/credentials/rotate
POST /runtime/signage/content
GET /runtime/signage/content
POST /runtime/signage/content/:content_id/versions
POST /runtime/signage/playlists
GET /runtime/signage/playlists
POST /runtime/signage/playlists/:playlist_id/versions
POST /runtime/signage/playlist-versions/:playlist_version_id/validate
POST /runtime/signage/playlist-versions/:playlist_version_id/request-review
POST /runtime/signage/playlist-versions/:playlist_version_id/approve
POST /runtime/signage/playlist-versions/:playlist_version_id/reject
POST /runtime/signage/screens/:screen_id/publish
POST /runtime/signage/publications/:publication_id/revoke

Player routes:

GET /display/v1/config
POST /display/v1/checkin

## 17. Error contract

Errors must use stable machine-readable identifiers.

Required initial errors:

- unauthorized
- forbidden
- tenant_scope_violation
- signage_screen_not_found
- signage_screen_not_active
- signage_credential_invalid
- signage_credential_revoked
- signage_content_not_found
- signage_content_version_not_found
- signage_playlist_not_found
- signage_playlist_version_not_found
- signage_playlist_validation_failed
- signage_playlist_not_approved
- signage_governance_required
- signage_governance_review_required
- signage_governance_blocked
- signage_publication_conflict
- signage_publication_not_found
- signage_no_published_configuration
- signage_checksum_mismatch
- signage_invalid_state_transition

Unknown or inconsistent state must fail closed.

## 18. Database foundation scope

The initial atomic foundation migration shall create:

- runtime_signage_screens
- runtime_signage_screen_credentials
- runtime_signage_content
- runtime_signage_content_versions
- runtime_signage_playlists
- runtime_signage_playlist_versions
- runtime_signage_playlist_items
- runtime_signage_publications
- runtime_signage_player_checkins

The migration shall include:

- tenant-scoped unique constraints
- foreign keys
- state checks
- positive duration checks
- immutable publication support
- one-current-publication-per-screen constraint
- indexes for player lookups
- indexes for tenant management queries
- migration ledger compatibility

## 19. Delivery phases

Phase 1:

- foundation schema
- screen registration
- token authentication
- content and playlist persistence
- validation
- governance publication
- player configuration
- check-in

Phase 2:

- HTML player
- browser cache
- media prefetch
- offline recovery
- Kader pilot

Phase 3:

- campaign rules
- scheduling
- weather triggers
- inventory triggers
- analytics
- automatic recommendations

## 20. Definition of Done

RSOS-DS-001 is complete only when:

- schema migration is verified
- tenant isolation tests pass
- screen token isolation tests pass
- content versioning tests pass
- playlist validation tests pass
- governance publication tests pass
- concurrent publication tests pass
- player config tests pass
- offline fallback tests pass
- audit event tests pass
- rollback is documented and tested
- Kader pilot screen receives only approved content
