# RSOS Generic Migration Runner Contract

## 1. Status

Contract state: IMPLEMENTED CANDIDATE

Production activation state: NOT ACTIVE

The generic migration runner is a separately tracked successor to the
historical RSOS-106 isolated apply runner.

The historical RSOS-106 runner and its contracts remain immutable evidence.

This contract does not authorize production execution.

## 2. Authoritative paths

Runner:

`runtime-api/scripts/migrations/rsos_migration_runner.sh`

Migration directory:

`runtime-api/migrations`

Ledger:

`public.runtime_schema_migrations`

## 3. Human execution boundary

The runner may only be invoked explicitly by an authorized human.

It must not execute automatically during:

- application startup;
- container startup;
- host startup;
- health checks;
- cron jobs;
- deployment image construction;
- dashboard generation;
- node-agent processing.

Default operation is read-only planning.

Database-changing execution requires the explicit `--apply` flag.

## 4. Database target boundary

The initial generic candidate is restricted to:

`rsos-migration-isolated-postgres`

The production container:

`rsos-postgres`

is explicitly forbidden.

The target container, database name, and database user are compiled into the
runner and have no environment or command-line override surface.

Production activation requires a separate reviewed contract and changeset.

## 5. Migration identity

The canonical migration identity is the complete filename.

A migration path must match:

`runtime-api/migrations/[0-9]{3}_[a-z0-9_]+.sql`

For migrations after bootstrap migration 105:

- migration numbers must be unique;
- migration numbers must be strictly sequential;
- the next number must equal the current maximum plus one;
- skipped, repeated, lower, or parallel numbers are rejected.

## 6. Repository integrity

Before plan or apply, the runner must verify:

1. execution occurs from the repository root;
2. the runner and contract are tracked in Git;
3. the runner and contract exist in the current HEAD;
4. the runner and contract match their HEAD blobs byte for byte;
5. the migration is tracked in Git;
6. the migration exists in the current HEAD;
7. the migration matches its HEAD blob byte for byte;
8. the supplied full expected HEAD equals the current HEAD;
9. the migration has one authoritative non-merge source commit;
10. source-commit, HEAD, and worktree migration bytes are identical;
11. no staged changes exist;
12. no unauthorized worktree paths are modified.

Ambiguity must fail closed.

## 7. Transaction ownership

The generic runner is the sole transaction owner.

Runner-managed migration files must not contain transaction-control
statements.

The runner constructs one PostgreSQL transaction containing:

1. `BEGIN`;
2. local transaction timeouts;
3. one transaction-scoped advisory lock;
4. execution-context binding;
5. migration SQL;
6. one append-only migration-ledger insertion;
7. `COMMIT`.

Any failure before commit must roll back both migration effects and ledger
insertion.

## 8. Advisory lock

The transaction must attempt:

`pg_try_advisory_xact_lock(hashtextextended('rsos-runtime-schema-migrations', 0))`

Execution must fail before migration SQL when the lock is unavailable.

The lock remains held until commit or rollback.

The logical lock identity is:

`hashtextextended:rsos-runtime-schema-migrations:0`

## 9. Static SQL policy

Static policy version:

`RSOS-migration-static-v1`

Runner-managed migrations must reject:

- transaction control;
- `CREATE DATABASE`;
- `DROP DATABASE`;
- `VACUUM`;
- `ALTER SYSTEM`;
- concurrent index or reindex operations;
- role or user creation, alteration, or deletion;
- privilege grants or revocations;
- `SET ROLE`;
- `SECURITY DEFINER`;
- extension creation;
- psql connection or include commands;
- psql data terminators;
- `COPY ... FROM STDIN`;
- unsafe dynamic SQL in routine bodies.

Comments, quoted strings, and routine bodies must be distinguished where
technically possible.

Uncertain parsing must fail closed.

## 10. Backup gate

Plan and apply require an explicitly supplied backup artifact.

The backup must be:

- an absolute path;
- a regular non-symlink file;
- mode `600`;
- non-empty;
- bound to the supplied SHA-256;
- free from PostgreSQL fatal markers;
- accompanied by a completion marker;
- consistent with inspected database state.

The runner validates but does not create the backup.

## 11. Ledger preconditions

Before application, the runner verifies:

- the ledger table exists;
- the append-only function exists;
- the append-only trigger exists;
- the migration key is absent;
- the file path is absent;
- the migration SHA-256 is absent;
- the migration number is exactly sequential;
- no higher migration number exists;
- the current maximum is the expected predecessor.

Existing ledger history is immutable.

The runner may insert but must never update, delete, truncate, disable, or
replace migration-ledger protection.

## 12. Ledger insertion

Migration SQL and exactly one ledger insertion execute atomically.

The ledger row records:

- migration key;
- migration number;
- migration name;
- file path;
- migration SHA-256;
- authoritative source commit;
- execution mode `runner`;
- runner version and SHA-256;
- contract version and SHA-256;
- isolated target identity;
- advisory-lock identity;
- atomic apply contract.

## 13. Schema migration semantics

A successful generic migration may legitimately change:

- schema SHA-256;
- public-table count;
- indexes;
- constraints;
- functions;
- triggers;
- other declared schema objects.

Pre- and post-schema state are evidence. They are not required to remain equal.

Protected RSOS core-state row counts must remain unchanged unless a future
data-migration extension supplies a dedicated declaration and verification
contract.

## 14. Plan mode

Plan mode performs repository, provenance, static-policy, backup, ledger, and
database-state checks.

Plan mode must not:

- acquire the migration advisory lock;
- execute migration SQL;
- insert a ledger row;
- change schema state;
- change protected core state.

## 15. Apply mode

Apply mode requires `--apply`.

After all plan-grade checks pass, the runner:

1. opens one transaction;
2. configures local timeouts;
3. acquires the named advisory lock;
4. binds validated migration provenance;
5. executes the migration;
6. inserts one ledger row;
7. commits only after all SQL succeeds;
8. performs deterministic post-commit verification.

## 16. Post-application verification

After commit, the runner verifies:

- ledger row count increased by exactly one;
- the migration is the new maximum migration;
- exactly one matching ledger row exists;
- stored path, hash, source commit, and execution mode are correct;
- protected core state is unchanged;
- repository HEAD remains unchanged;
- runner and migration provenance remain valid;
- database connectivity remains healthy.

Pre- and post-schema hashes and public-table counts are recorded but are not
required to remain equal.

A post-commit verification failure is a deployment incident and must not be
reported as success.

## 17. Rollback boundary

The runner performs no automatic rollback after commit.

Rollback requires a separate controlled artifact, explicit authorization,
verified backup, transaction probe, and post-rollback verification.

## 18. Evidence and secrets

Every invocation emits deterministic markers and records:

- repository HEAD;
- runner identity;
- contract identity;
- migration identity;
- source commit;
- backup identity;
- target identity;
- pre- and post-schema state;
- pre- and post-ledger state;
- pre- and post-protected core state.

Passwords, tokens, credentials, and connection strings must never be written
to repository files or evidence output.

## 19. Acceptance sequence

The generic runner must proceed through:

1. controlled creation;
2. static validation;
3. fail-closed repository-gate tests;
4. isolated plan tests;
5. isolated successful apply;
6. duplicate rejection;
7. sequential-number rejection;
8. concurrent invocation test;
9. transactional rollback test;
10. evidence review;
11. separate human production authorization.

No stage may be skipped.
