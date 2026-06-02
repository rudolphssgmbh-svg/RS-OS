# RS OS Recovery Runbook v1

## Verified production environment

### Containers

- rsos-runtime-api
- rsos-postgres
- rsos-redis

### Network

- rsos_default

### Volumes

- rsos_postgres
- rsos_redis

## Important finding

The currently running production containers are not managed by the Compose project located in `/opt/rsos/docker`.

`docker-compose ps` from `/opt/rsos/docker` returns no managed containers, while `docker ps` shows active production containers.

Therefore `/opt/rsos/docker/docker-compose.yml` is currently treated as the recovery target definition, not as the active orchestration owner.

## Existing server warning

Do not run the recovery deployment commands on the current production server while `rsos-runtime-api`, `rsos-postgres`, and `rsos-redis` already exist as unmanaged containers.

Doing so causes container name conflicts.

## Recovery build procedure

Run on a clean or recovery server:

    cd /opt/rsos
    sudo docker build -t rsos-runtime-api:latest ./runtime-api

## Recovery deployment procedure for a clean server only

    sudo docker network create rsos_default || true
    sudo docker volume create rsos_postgres || true
    sudo docker volume create rsos_redis || true

    cd /opt/rsos/docker
    sudo docker-compose up -d

## Current risks

- PostgreSQL backup strategy not yet validated
- PostgreSQL restore procedure not yet tested
- Redis recovery strategy not yet validated
- Secret management documentation missing
- Running production containers are not yet managed by Compose

## Recommended next milestones

1. PostgreSQL backup procedure
2. PostgreSQL restore test
3. Compose ownership migration
4. Disaster recovery validation
5. RS OS deployment pipeline
## Verified Backup and Restore Validation

### Backup Procedure

```bash
cd /opt/rsos

sudo mkdir -p backups/postgres

BACKUP_FILE="backups/postgres/rsos_runtime_$(date +%Y%m%d_%H%M%S).sql"

sudo docker exec rsos-postgres \
  pg_dump -U rsos -d rsos_runtime > "$BACKUP_FILE"
```

### Restore Validation Procedure

```bash
sudo docker exec rsos-postgres createdb -U rsos rsos_restore_test

cat "$BACKUP_FILE" | \
sudo docker exec -i rsos-postgres \
psql -U rsos -d rsos_restore_test
```

### Validation Results

Verified successfully on 2026-06-02:

* runtime_events = 167
* runtime_objects = 5

Backup and restore process confirmed operational.
