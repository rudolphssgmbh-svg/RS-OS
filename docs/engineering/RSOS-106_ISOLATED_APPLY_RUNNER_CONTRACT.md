# RSOS-106 Isolated Apply Runner Contract

## Status

This document defines the tracked, isolated apply candidate for RSOS-106.

It is not a production activation contract.

## Fixed execution boundary

The runner is valid only for:

- container: `rsos106-isolated-postgres`
- database: `rsos_runtime`
- database user: `rsos`
- Docker network mode: `none`
- published ports: none
- permitted migration:
  `runtime-api/migrations/106_rsos106_isolated_apply_probe.sql`

The production container name `rsos-postgres` is explicitly denied.

The database target is compiled into the runner and has no command-line
or environment override surface.

## Repository integrity

The runner, this contract, and the migration must:

1. be tracked by Git;
2. exist in the current `HEAD`;
3. have no staged or unstaged differences;
4. match their `HEAD` blobs byte for byte;
5. execute from the repository root;
6. use the exact expected 40-character `HEAD`.

The migration must have been introduced by exactly one non-merge commit.

## Plan mode

Plan mode performs only:

- repository integrity validation;
- static SQL policy validation;
- backup validation;
- ledger prechecks;
- isolated database read-only state comparison.

Plan mode must not execute the migration or insert a ledger row.

## Apply mode

Apply mode requires the explicit `--apply` flag.

After all plan-grade checks pass, the runner:

1. opens one PostgreSQL transaction;
2. sets local lock and statement timeouts;
3. obtains transaction-scoped advisory lock `(106, 1)`;
4. sets the validated execution-context values
   `rsos.migration_sha256` and `rsos.source_commit`;
5. executes the permitted migration;
6. inserts exactly one `execution_mode = 'runner'` ledger row;
7. commits only when every statement succeeds.

Any SQL error, constraint violation, connection loss, or verification
failure before commit must prevent both the migration and ledger insert
from becoming durable.

## Synthetic migration result

Migration 106 is an execution probe. A successful isolated apply must:

- leave the schema SHA-256 unchanged;
- leave the RSOS core-state tuple unchanged;
- leave the public-table count unchanged;
- add exactly one migration-ledger row;
- record migration number 106 and the committed source identity.

## Production prohibition

This candidate must never access, inspect, or execute against
`rsos-postgres`.

Production activation remains `NOT ACTIVE`.
