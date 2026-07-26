# RSOS DS-001 Canonical Signage Runtime API Contract

## Document identity

- Contract: DS-001-R1-A4-A2
- Status: Proposed canonical contract
- Repository branch: feature/RSOS-DS-001-signage-foundation
- Repository HEAD: 0337b923070468a20171936061134f390d5d48e3
- Migration: runtime-api/migrations/107_runtime_signage_foundation.sql
- Migration SHA-256: aef4a8a12a361b1749b749ba977aff7a537611d6a35c1425eb8917a5f5f38fcb
- Runtime language: JavaScript CommonJS
- HTTP architecture: Custom Node.js HTTP server
- Central dispatcher: runtime-api/server.js

## 1. Contract authority

The implementation MUST conform to the following existing RSOS sources:

1. Authentication and role enforcement:
   `runtime-api/verification/auth.js`
2. HTTP response serialization:
   `runtime-api/response/send.js`
3. Runtime event creation:
   `runtime-api/evidence/runtime-event-writer.js`
4. Audit hashing:
   `runtime-api/evidence/audit-hash.js`
5. Central route dispatch:
   `runtime-api/server.js`
6. Signage persistence:
   `runtime-api/migrations/107_runtime_signage_foundation.sql`

This contract MUST NOT introduce Express, TypeScript, an independent JWT
implementation, an independent response envelope, or a parallel audit mechanism.

## 2. Scope

This API phase covers management-plane resources only:

- screens
- content
- content versions
- playlists
- playlist versions
- publications

The following capabilities are explicitly excluded:

- player authentication
- player credentials
- player check-in
- player heartbeat
- player configuration delivery
- offline synchronization
- media binary upload
- content rendering
- publication approval UI
- automatic scheduling workers

Excluded capabilities require separate security and lifecycle contracts.

## 3. Base path

```text
/runtime/signage
```

All routes MUST be registered through the existing custom Node.js HTTP
dispatcher in `runtime-api/server.js`.

## 4. Authentication

Every signage route MUST require a valid RSOS bearer token through the
existing authentication implementation.

No signage handler may:

- decode JWTs independently,
- accept unsigned identity claims,
- trust caller-provided roles,
- implement a second authentication path.

## 5. Tenant authority

The authoritative tenant identity MUST be obtained from the authenticated
runtime context established by the existing RSOS authentication contract.

A request body or query parameter MUST NOT be allowed to override the
authoritative tenant.

When a body contains `tenant_id` for compatibility or validation purposes,
the handler MUST reject the request if it differs from the authenticated
tenant.

All database operations MUST include an explicit tenant predicate.

A resource lookup by identifier alone is prohibited.

Required lookup form:

```sql
WHERE tenant_id = $1
  AND <resource_id> = $2
```

## 6. Authorization baseline

The implementation MUST use the existing RSOS role enforcement mechanism.

Baseline policy:

| Operation | system_admin | runtime_admin | governance | auditor |
|---|---:|---:|---:|---:|
| List/read resources | allow | allow | allow | allow |
| Create/update screens | allow | allow | deny unless existing policy permits | deny |
| Create content and versions | allow | allow | allow where existing policy permits | deny |
| Create playlists and versions | allow | allow | allow where existing policy permits | deny |
| Create publication proposal | allow | allow | allow | deny |
| Activate/cancel publication | allow | conditional | allow | deny |

The implementation review MUST compare this baseline against the exact
semantics of `requireRole` before code is accepted.

## 7. Trace and request correlation

Trace behavior MUST reuse the existing runtime handler pattern.

Trace policy detected during synthesis:

```text
EXISTING_RUNTIME_HANDLER_PATTERN
```

The Signage API MUST NOT create a conflicting trace format.

Where the runtime already provides a trace or correlation identifier, it MUST
be propagated to:

- database mutations where supported,
- runtime events,
- audit evidence,
- error responses,
- successful write responses.

## 8. Response contract

All handlers MUST use the existing `send` helper from:

```text
runtime-api/response/send.js
```

Handlers MUST NOT call `res.end(JSON.stringify(...))` directly unless that
is the established behavior of the shared helper itself.

The exact response envelope and serialization semantics are inherited from
the shared response helper and are not redefined by this domain contract.

## 9. Error contract

The Signage API MUST preserve the existing RSOS error serialization format.

Required HTTP semantics:

| Condition | HTTP status |
|---|---:|
| Malformed JSON or invalid request shape | 400 |
| Missing or invalid authentication | 401 |
| Authenticated but unauthorized | 403 |
| Tenant-scoped resource not found | 404 |
| Unique, lifecycle, or concurrency conflict | 409 |
| Semantically invalid lifecycle transition | 422 |
| Unexpected internal failure | 500 |

Tenant isolation MUST be fail-closed.

A caller MUST NOT be able to distinguish between:

- a resource belonging to another tenant, and
- a nonexistent resource.

Both cases MUST resolve to the same tenant-scoped not-found behavior.

## 10. Canonical routes

### 10.1 Screens

```text
POST  /runtime/signage/screens
GET   /runtime/signage/screens
GET   /runtime/signage/screens/{screenId}
PATCH /runtime/signage/screens/{screenId}
```

Deletion is excluded from the initial contract unless the migration defines
a lifecycle-safe archival or retirement state.

### 10.2 Content

```text
POST  /runtime/signage/content
GET   /runtime/signage/content
GET   /runtime/signage/content/{contentId}
PATCH /runtime/signage/content/{contentId}
```

### 10.3 Content versions

```text
POST /runtime/signage/content/{contentId}/versions
GET  /runtime/signage/content/{contentId}/versions
GET  /runtime/signage/content/{contentId}/versions/{versionId}
```

Published or otherwise immutable versions MUST NOT be modified in place.

### 10.4 Playlists

```text
POST  /runtime/signage/playlists
GET   /runtime/signage/playlists
GET   /runtime/signage/playlists/{playlistId}
PATCH /runtime/signage/playlists/{playlistId}
```

### 10.5 Playlist versions

```text
POST /runtime/signage/playlists/{playlistId}/versions
GET  /runtime/signage/playlists/{playlistId}/versions
GET  /runtime/signage/playlists/{playlistId}/versions/{versionId}
```

Version payloads MUST reference immutable content versions rather than mutable
content heads where the schema supports that distinction.

### 10.6 Publications

```text
POST /runtime/signage/publications
GET  /runtime/signage/publications
GET  /runtime/signage/publications/{publicationId}
POST /runtime/signage/publications/{publicationId}/cancel
```

A publication MUST reference an existing tenant-owned screen and an existing
tenant-owned playlist version.

Publication creation MUST NOT activate content when governance requirements
have not been satisfied.

## 11. Request rules

Requests MUST use JSON where a body is required.

Unknown security-sensitive fields SHOULD be rejected rather than silently
accepted.

Server-controlled fields MUST NOT be accepted as authoritative input,
including where present in the schema:

- primary identifiers,
- tenant authority,
- audit hashes,
- event identifiers,
- creation timestamps,
- update timestamps,
- activation timestamps,
- publication completion timestamps,
- internal governance decisions.

## 12. Identifier rules

Identifiers MUST follow the identifier strategy already established by
migration 107.

Identifiers MUST be generated server-side unless the migration explicitly
defines a caller-supplied natural key.

Every nested resource lookup MUST verify the parent relationship.

Example:

```text
/content/{contentId}/versions/{versionId}
```

The handler MUST verify that the version belongs to both:

- the authenticated tenant, and
- the specified content object.

## 13. Collection queries

Initial collection endpoints MAY support only bounded pagination and
schema-backed filters.

Permitted baseline query concepts:

- limit
- cursor or offset, following existing runtime convention
- status
- created-before or created-after, if supported consistently
- exact resource reference filters

Unbounded collection reads are prohibited.

The default and maximum limits MUST follow existing runtime conventions.

## 14. Mutation and transaction boundaries

Each write operation MUST execute as one atomic database transaction when it
performs more than one persistent action.

A successful write transaction may include:

1. domain row mutation,
2. version or relation mutation,
3. governance decision linkage,
4. runtime event creation,
5. audit hash persistence.

If any required step fails, the entire write MUST roll back.

No success response may be emitted before the transaction commits.

## 15. Governance boundary

Governance evaluation is mandatory for operations that can alter delivered
signage behavior.

At minimum:

- publication activation,
- replacement of an active publication,
- cancellation affecting an active screen,
- activation of playlist versions,
- security-relevant screen lifecycle changes.

Governance outcomes MUST use existing RSOS decision semantics.

A result equivalent to `blocked` MUST fail closed.

A result equivalent to `review_required` MUST NOT be treated as approval.

## 16. Runtime events

Write operations MUST emit runtime events through the existing event writer.

Canonical event namespace:

```text
runtime.signage.screen.created
runtime.signage.screen.updated
runtime.signage.content.created
runtime.signage.content.updated
runtime.signage.content.version.created
runtime.signage.playlist.created
runtime.signage.playlist.updated
runtime.signage.playlist.version.created
runtime.signage.publication.created
runtime.signage.publication.activated
runtime.signage.publication.cancelled
```

Event payload and hash fields MUST conform to the existing writer contract.

Events MUST include the authoritative tenant identity and the relevant domain
object identifier.

## 17. Audit rules

Audit hashes MUST be created through:

```text
runtime-api/evidence/audit-hash.js
```

The Signage API MUST NOT define an alternative hashing algorithm or canonical
serialization.

Audit-relevant write events MUST be reproducible from committed domain state
and recorded metadata.

## 18. Concurrency and conflicts

Unique constraints from migration 107 are authoritative.

Handlers MUST translate recognized uniqueness violations into a conflict
response rather than an internal server error.

Lifecycle changes SHOULD use one of the following when supported by the schema:

- expected version,
- updated-at precondition,
- current-state predicate,
- immutable version insertion.

A stale lifecycle transition MUST fail rather than overwrite newer state.

## 19. Data visibility

List and detail routes MUST return only tenant-owned records.

Internal secrets, credential hashes, raw tokens, private audit material, and
database-only control fields MUST never be returned merely because they exist
in the row.

Response projections MUST be explicit.

Use of `SELECT *` in final signage handlers is prohibited unless a reviewed
repository abstraction safely projects fields afterward.

## 20. Persistence tables detected from migration 107

```text
runtime_signage_content
runtime_signage_content_versions
runtime_signage_player_checkins
runtime_signage_playlist_items
runtime_signage_playlist_versions
runtime_signage_playlists
runtime_signage_publications
runtime_signage_screen_credentials
runtime_signage_screens
```

The migration remains authoritative for:

- column names,
- nullability,
- defaults,
- foreign keys,
- unique constraints,
- check constraints,
- triggers,
- lifecycle values.

The API implementation MUST NOT invent persistence states absent from the
migration.

## 21. Initial implementation boundary

The first implementation slice SHOULD contain:

1. screen create/list/detail/update,
2. content create/list/detail,
3. content-version create/list/detail,
4. playlist create/list/detail,
5. playlist-version create/list/detail,
6. publication create/list/detail,
7. publication cancel only where supported by migration state rules.

Player runtime endpoints remain out of scope.

## 22. Validation requirements

Before implementation acceptance, the following evidence is required:

- static route registration verification,
- authentication enforcement verification,
- role enforcement verification,
- tenant-isolation verification,
- request-validation verification,
- constraint-to-error mapping verification,
- transactional rollback verification,
- runtime-event verification,
- audit-hash verification,
- cross-tenant not-found equivalence verification,
- migration compatibility verification.

## 23. Prohibited implementation choices

The following are explicitly prohibited:

- introducing Express,
- introducing TypeScript only for this module,
- trusting request-body tenant identity,
- direct unaudited publication activation,
- mutating immutable versions,
- cross-tenant identifier lookup,
- bypassing the shared response helper,
- duplicating JWT validation,
- direct custom audit hashing,
- returning credential material,
- implementing player routes in this sprint.

## 24. Contract disposition

This document defines the management-plane API boundary for the RSOS DS-001
Signage Foundation.

It is ready for semantic review but does not by itself modify the Runtime API.
