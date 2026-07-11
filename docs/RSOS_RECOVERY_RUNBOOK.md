# RS OS Recovery Runbook v2

Status: Operational baseline verified
Last verified: 2026-07-11

## 1. Authoritative production contract

The authoritative production orchestration is:

- project: `rsos`
- project directory: `/opt/rsos`
- Compose file: `/opt/rsos/docker-compose.yml`
- Compose implementation: Docker Compose v2

Active services:

- `postgres`
- `redis`
- `registry-server`
- `runtime-api`
- `runtime-api-recovery`

Explicit images:

- `postgres:16`
- `redis:7`
- `rsos-registry-server:latest`
- `rsos-runtime-api:latest`
- `rsos-runtime-api-recovery:latest`

## 2. Storage contract

PostgreSQL production data:

`/opt/rsos/storage/postgres:/var/lib/postgresql/data`

Registry data:

`/opt/rsos/registry-server/data:/data`

Redis currently has no persistent production volume.

The active project network is `rsos_default`.

## 3. Safe verification

Use the authoritative project, project directory and Compose file for all
checks.

Runtime health endpoint:

`http://127.0.0.1:8080/health`

Registry health is verified through the container health state. An
unauthenticated Registry HTTP request can return status 401.

Redis must respond with `PONG`.

Critical database baseline verified on 2026-07-11:

`0|0|133`

The public schema contained 86 tables.

## 4. Runtime restart

A Runtime API restart must use Docker Compose v2 with:

- project `rsos`
- project directory `/opt/rsos`
- Compose file `/opt/rsos/docker-compose.yml`
- service `runtime-api`

A restart does not rebuild the Runtime API image.

## 5. Verified PostgreSQL backup

Verified backup:

`/opt/rsos/backups/postgres/rsos_runtime_20260711_200712.sql`

SHA-256:

`2eae5eff2c807f562fd5660aed5c5c740eb87f77f3ff321e806fe855f88a5ff3`

Recorded size:

`953900 bytes`

Validation completed successfully:

- restored critical counts: `0|0|133`
- restored public table count: 86
- production database remained unchanged
- temporary restore database was removed

The empty interrupted dump was quarantined as invalid evidence:

`/opt/rsos/backups/postgres/invalid/rsos_runtime_20260711_195741.sql.invalid-empty`

## 6. Deprecated secondary definition

`/opt/rsos/docker/docker-compose.yml` is not the production definition.

It is deprecated because it:

- defines only three services
- expects external named volumes
- omits Registry Server
- omits Recovery Runtime
- does not represent the production PostgreSQL bind mount
- does not represent the complete image contract

It must not be used against the production server.

## 7. Production safety controls

The following action classes require a separate reviewed procedure:

- removing the full Compose project
- removing project volumes
- pruning Docker storage
- deleting production storage paths
- replacing the PostgreSQL data directory
- recreating every service
- starting the deprecated secondary definition
- restoring directly into the production database
- deleting rollback images
- automatic package cleanup

This section intentionally contains no directly executable destructive
commands.

## 8. Recovery order

Controlled recovery order:

1. PostgreSQL
2. PostgreSQL readiness and data verification
3. Redis
4. Registry Server
5. Recovery Runtime
6. Production Runtime API
7. service-set verification
8. database baseline verification
9. deployed image and source verification

## 9. Recovery completion criteria

Recovery is complete only when:

- the authoritative Compose definition validates
- all five services are running
- PostgreSQL uses `/opt/rsos/storage/postgres`
- Runtime API reports healthy database connectivity
- Registry container health is `healthy`
- Redis responds with `PONG`
- database counts are plausible
- image and source identity are verified
- no unintended container was replaced
- dashboard worktree changes remain untouched
- a valid backup and restore test are recorded

## 10. Open risks

- no complete clean-server recovery rehearsal
- no persistent Redis storage
- no verified off-server backup retention
- no separate Registry restore rehearsal
- secrets remain represented in Compose configuration
- deprecated secondary Compose file remains in the repository
