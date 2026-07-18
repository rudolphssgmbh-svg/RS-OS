# RSOS-106 Migration Runner Contract

## 1. Status

Contract state: SPECIFIED

Implementation state: NOT IMPLEMENTED

Production activation state: NOT ACTIVE

The migration runner is not permitted to modify a database until its implementation, static tests, isolated database tests, rollback tests, and human approval have all passed.

## 2. Purpose

The RS OS migration runner provides a deterministic, fail-closed, auditable mechanism for applying all schema migrations after migration 105.

Migration 105 remains the bootstrap migration for the append-only migration ledger.

The runner must never attempt to replay migrations 001 through 105.

## 3. Authoritative paths

Runner:

`runtime-api/scripts/migrations/rsos106_migration_runner.sh`

Migration directory:

`runtime-api/migrations`

Rollback directory:

`runtime-api/migrations/rollback`

Ledger table:

`public.runtime_schema_migrations`

## 4. Migration identity

The canonical migration identity is the complete migration filename.

Example:

`106_runtime_migration_runner_foundation.sql`

The corresponding ledger key is identical to that filename.

The canonical file path is the repository-relative path:

`runtime-api/migrations/106_runtime_migration_runner_foundation.sql`

Historical duplicate numeric prefixes remain accepted as bootstrap history.

For all migrations after 105, numeric prefixes must be unique and strictly sequential.

The next migration number must equal:

`MAX(runtime_schema_migrations.migration_number) + 1`

A skipped, repeated, lower, or parallel migration number must be rejected.

## 5. Invocation contract

Every invocation requires all of the following explicit inputs:

- `--migration <repository-relative-path>`
- `--expected-head <40-character-commit>`
- `--backup-file <absolute-path>`
- `--backup-sha256 <64-character-sha256>`

Default operation is read-only planning.

Application additionally requires:

- `--apply`

Plan mode and apply mode must execute the same repository, provenance, static SQL, ledger, and backup gates.

Plan mode must terminate before acquiring a database migration lock or executing migration SQL.

The absence of any required input must block both plan mode and apply mode.

The runner must not run automatically during:

- application startup
- container startup
- system boot
- health checks
- cron jobs
- dashboard generation
- node-agent check-in
- deployment image construction

Only an explicitly authorized human invocation may apply a migration.

## 6. Repository integrity gate

Before planning or application, the runner must verify:

1. It is executing from the RS OS repository root.
2. The migration path is under `runtime-api/migrations/`.
3. The migration filename matches `^[0-9]{3}_[a-z0-9_]+\.sql$`.
4. The migration file is tracked by Git.
5. The migration file exists in `HEAD`.
6. The working-tree file is byte-identical to the file stored in `HEAD`.
7. The migration file has no staged or unstaged changes.
8. The explicit expected full HEAD equals the current full HEAD.
9. Git history contains exactly one non-merge commit affecting the migration file path.
10. That sole commit introduced the migration file and is the authoritative source commit.
11. The authoritative source commit is an ancestor of the current HEAD.
12. The migration blob in the source commit, the migration blob in HEAD, and the working-tree file have identical SHA-256 values.
13. No unexpected repository paths are modified.

Generated dashboard files may be present as known operational output but must never be staged or included in a migration commit.

## 7. Provenance contract

The runner calculates:

- `migration_sha256`: SHA-256 of the exact migration file bytes
- `source_commit`: full 40-character sole commit that introduced the exact immutable migration file
- `repository_head`: full current HEAD
- `migration_key`: complete filename
- `migration_number`: numeric filename prefix
- `migration_name`: filename without numeric prefix and `.sql`
- `file_path`: repository-relative file path

The runner must verify the migration hash against both committed Git objects before database execution:

- the migration blob stored in the authoritative source commit
- the migration blob stored in the current HEAD

Both committed blobs and the working-tree file must be byte-identical.

A later modification, replacement, rename, history ambiguity, or hash mismatch must block execution.

## 8. Backup gate

Apply mode requires an existing pre-migration PostgreSQL dump.

The runner does not create the backup in its first implementation.

The supplied backup must satisfy all of the following:

- regular file
- absolute path
- mode `600`
- non-empty
- exact supplied SHA-256
- one PostgreSQL completion marker
- no `ERROR`, `FATAL`, or `PANIC` marker
- public table count consistent with the current live database
- creation time recorded in runner evidence

A missing or unverifiable backup must block execution.

Restore validation remains a separate controlled procedure.

## 9. Static SQL policy

Future runner-managed migration files must not contain their own transaction control.

The following statements or constructs are prohibited:

- `BEGIN`
- `START TRANSACTION`
- `COMMIT`
- `ROLLBACK`
- `SAVEPOINT`
- `RELEASE SAVEPOINT`
- `CREATE DATABASE`
- `DROP DATABASE`
- `VACUUM`
- `ALTER SYSTEM`
- `CREATE INDEX CONCURRENTLY`
- `REINDEX CONCURRENTLY`
- psql `\connect`
- psql `\include`
- psql `\i`
- psql `\ir`
- `COPY ... FROM STDIN`
- embedded `\.` data terminators

Migration 105 is exempt because it predates the runner and is already represented by the verified bootstrap ledger record.

SQL comments and string literals must be excluded from static statement detection where technically feasible.

When the static parser cannot determine safety, the runner must reject the migration.

## 10. Concurrency contract

The migration body and ledger insertion execute in one PostgreSQL transaction.

At the beginning of that transaction, the runner must acquire:

`pg_try_advisory_xact_lock(hashtextextended('rsos-runtime-schema-migrations', 0))`

If the lock is unavailable, execution must terminate without applying any SQL.

The advisory lock must remain held until the migration transaction commits or rolls back.

No migration may be executed outside the locked transaction.

## 11. Transaction contract

The runner constructs one execution unit containing:

1. `BEGIN`
2. local timeout configuration
3. advisory transaction lock
4. live ledger preconditions
5. migration SQL body
6. append-only ledger insertion
7. ledger verification
8. `COMMIT`

The following defaults apply:

- `lock_timeout = 5s`
- `statement_timeout = 15min`
- `idle_in_transaction_session_timeout = 5min`

Any SQL or verification failure must roll back both schema changes and ledger insertion.

The runner must invoke `psql` with:

- `-X`
- `ON_ERROR_STOP=1`
- no interactive password prompt
- pager disabled

A successful schema change without a matching ledger row is forbidden.

A ledger row without successful schema completion is forbidden.

## 12. Ledger preconditions

Before executing the migration body, the transaction must verify:

- the ledger table exists
- the append-only function exists
- the append-only trigger exists
- the migration key is absent
- the file path is absent
- the migration SHA-256 is absent
- the migration number is exactly the next sequential number
- no higher migration number already exists
- the current highest migration is the expected predecessor

Any conflict or ambiguity must block execution.

## 13. Ledger insertion

The runner inserts exactly one row with:

- `migration_key`
- `migration_number`
- `migration_name`
- `file_path`
- `migration_sha256`
- `source_commit`
- `execution_mode = 'runner'`
- `metadata`

Required metadata:

- `runner_contract_version`
- `runner_file_sha256`
- `repository_head`
- `previous_migration_key`
- `previous_migration_number`
- `backup_file`
- `backup_sha256`
- `lock_key`
- `static_policy_version`
- `numeric_ordering_contract`
- `identity_contract`
- `applied_via`

Initial contract values:

- `runner_contract_version = 'RSOS-106-v1'`
- `static_policy_version = 'RSOS-106-static-v1'`
- `numeric_ordering_contract = 'strictly_sequential_after_105'`
- `identity_contract = 'full_filename'`
- `applied_via = 'human_authorized_runner'`

## 14. Append-only compatibility

The runner may only insert new ledger rows.

It must never:

- update a ledger row
- delete a ledger row
- truncate the ledger
- disable the append-only trigger
- replace the append-only trigger
- replace the append-only function

Existing ledger history is immutable.

## 15. Post-application verification

After commit, the runner must verify:

- exactly one ledger row exists for the migration key
- stored migration SHA-256 matches the file
- stored source commit matches Git
- stored file path matches the input
- execution mode is `runner`
- required metadata matches the execution
- ledger row count increased by exactly one
- maximum migration number advanced by exactly one
- known RS OS core table row counts did not change unless explicitly declared by the migration contract
- runtime health remains `ok`
- database connectivity remains healthy
- repository HEAD remains unchanged
- migration and runner files remain byte-identical to committed Git objects

The runner must record pre- and post-schema hashes.

A post-commit verification failure is a deployment incident and must not be silently treated as success.

## 16. Data-changing migrations

The initial runner contract assumes schema-only migrations.

A migration that intentionally changes application data must carry an explicit metadata declaration and dedicated verification contract.

Until that extension is implemented, a migration that changes protected RS OS core row counts must fail post-application verification and require human incident handling.

## 17. Rollback boundary

The runner does not perform automatic rollback.

Rollback requires:

- a separate committed rollback artifact
- explicit human authorization
- a verified pre-migration backup
- a rollback precheck
- a transaction probe
- post-rollback verification

Automatic rollback after an uncertain production failure is prohibited.

## 18. Evidence output

Every plan and apply invocation must produce deterministic markers.

Required plan markers:

- `RUNNER_MODE=PLAN`
- `REPOSITORY_CHECK=PASS`
- `STATIC_SQL_CHECK=PASS`
- `LEDGER_PRECHECK=PASS`
- `BACKUP_CHECK=PASS`
- `PLAN_RESULT=PASS`

Required apply markers:

- `RUNNER_MODE=APPLY`
- `LOCK_CHECK=PASS`
- `MIGRATION_TRANSACTION=PASS`
- `LEDGER_INSERT_CHECK=PASS`
- `POST_APPLY_CHECK=PASS`
- `RUNNER_RESULT=PASS`

Evidence must include:

- UTC timestamp
- repository HEAD
- runner SHA-256
- migration SHA-256
- source commit
- backup path and SHA-256
- pre- and post-schema hashes
- pre- and post-ledger state
- pre- and post-core state
- PostgreSQL version
- runtime health result

Secrets, passwords, tokens, and connection strings must never be written to evidence.

## 19. Exit behavior

Any failed precondition returns a non-zero exit code.

The runner must not use a successful exit code when:

- execution was skipped because of ambiguity
- a lock was unavailable
- a backup was invalid
- the migration was already applied with different provenance
- the migration number was unexpected
- the source commit could not be resolved
- static SQL safety could not be established
- post-application verification failed

The shell session must remain active after runner failure.

## 20. Security boundary

The initial runner executes with the existing `rsos` database role.

The current role has elevated privileges and is not the final least-privilege design.

A dedicated migration role is a separate future security work package.

The runner must not broaden database privileges.

The runner must not persist credentials in the repository, command history, evidence, or process arguments.

## 21. Implementation stages

The implementation proceeds in the following order:

1. SPECIFIED — this contract
2. IMPLEMENTED — runner created but not used on production
3. STATICALLY TESTED — parser and repository gates verified
4. ISOLATED TESTED — synthetic migration applied to disposable database
5. CONCURRENCY TESTED — parallel runner invocation tested
6. ROLLBACK TESTED — failed migration proves atomic rollback
7. VERIFIED — evidence reviewed
8. DEPLOYED — first production migration applied
9. OBSERVED — post-deployment health and ledger state monitored

No stage may be skipped.

## 22. Acceptance criteria

The runner foundation is accepted only when all of the following are demonstrated:

- plan mode causes no database mutation
- invalid SQL is rejected before database execution
- uncommitted migration files are rejected
- migration files with more than one path-history commit are rejected
- source-commit, HEAD, and working-tree blob mismatches are rejected
- incorrect expected HEAD is rejected
- incorrect backup SHA-256 is rejected
- duplicate migration identity is rejected
- skipped migration number is rejected
- concurrent execution allows only one runner
- migration SQL and ledger insert are atomic
- a failing migration leaves schema and ledger unchanged
- a successful isolated migration creates exactly one immutable ledger row
- production database remains untouched during all pre-production tests
