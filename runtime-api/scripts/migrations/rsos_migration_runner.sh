#!/usr/bin/env bash
set -euo pipefail

RUNNER_VERSION="RSOS-generic-migration-v1"
CONTRACT_VERSION="RSOS-generic-migration-v1"
STATIC_POLICY_VERSION="RSOS-migration-static-v1"

RUNNER_PATH="runtime-api/scripts/migrations/rsos_migration_runner.sh"
CONTRACT_PATH="docs/engineering/RSOS_MIGRATION_RUNNER_CONTRACT.md"

EXPECTED_DB_CONTAINER="rsos-migration-isolated-postgres"
DB_CONTAINER="$EXPECTED_DB_CONTAINER"
PRODUCTION_DB_CONTAINER="rsos-postgres"
EXPECTED_NETWORK_MODE="none"

DB_NAME="rsos_runtime"
DB_USER="rsos"

MIGRATION_PATH=""
EXPECTED_HEAD=""
BACKUP_FILE=""
EXPECTED_BACKUP_SHA256=""
APPLY_REQUESTED="NO"

usage() {
  cat <<'EOF'
RSOS fail-closed generic migration runner

Current implementation state:
  GENERIC ISOLATED PLAN AND APPLY CANDIDATE
  PRODUCTION TARGET LOCKED OUT

Required arguments:
  --migration <repository-relative-path>
  --expected-head <40-character-commit>
  --backup-file <absolute-path>
  --backup-sha256 <64-character-sha256>

Optional:
  --apply
      Explicitly requests the generic isolated transactional apply path.
      Without this flag, the runner remains read-only.

  --help
      Display this help.
EOF
}

fail() {
  local reason="$1"

  echo
  echo "RUNNER_RESULT=FAILED"
  echo "failure_reason=$reason"
  exit 1
}

require_value() {
  local option="$1"
  local value="${2-}"

  if [ -z "$value" ]; then
    fail "missing_value_for:${option}"
  fi
}

db_query() {
  local sql="$1"

  docker exec "$DB_CONTAINER" \
    psql \
      -X \
      -qAt \
      -v ON_ERROR_STOP=1 \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "$sql"
}

schema_hash() {
  docker exec "$DB_CONTAINER" \
    pg_dump \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      --schema-only \
      --no-owner \
      --no-privileges \
    2>/dev/null \
  | sed \
      -e '/^\\restrict /d' \
      -e '/^\\unrestrict /d' \
  | sha256sum \
  | awk '{print $1}'
}

core_state() {
  db_query "
    SELECT concat_ws(
      '|',
      (SELECT COUNT(*) FROM runtime_events),
      (SELECT COUNT(*) FROM runtime_objects),
      (SELECT COUNT(*) FROM runtime_tenants),
      (SELECT COUNT(*) FROM runtime_audit_reports),
      (SELECT COUNT(*) FROM runtime_governance_decisions),
      (SELECT COUNT(*) FROM runtime_governance_approvals)
    );
  "
}

ledger_fingerprint() {
  db_query "
    SELECT concat_ws(
      '|',
      COUNT(*),
      COALESCE(MIN(migration_number)::TEXT, 'NONE'),
      COALESCE(MAX(migration_number)::TEXT, 'NONE'),
      COALESCE(
        string_agg(
          migration_key || ':' ||
          migration_sha256 || ':' ||
          source_commit,
          ','
          ORDER BY migration_number, migration_key
        ),
        'EMPTY'
      )
    )
    FROM public.runtime_schema_migrations;
  "
}

public_table_count() {
  db_query "
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'public';
  "
}

ledger_row_count() {
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations;
  "
}

maximum_migration_number() {
  db_query "
    SELECT COALESCE(
      MAX(migration_number),
      0
    )
    FROM public.runtime_schema_migrations;
  "
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --migration)
      require_value "$1" "${2-}"
      MIGRATION_PATH="$2"
      shift 2
      ;;

    --expected-head)
      require_value "$1" "${2-}"
      EXPECTED_HEAD="$2"
      shift 2
      ;;

    --backup-file)
      require_value "$1" "${2-}"
      BACKUP_FILE="$2"
      shift 2
      ;;

    --backup-sha256)
      require_value "$1" "${2-}"
      EXPECTED_BACKUP_SHA256="$2"
      shift 2
      ;;

    --apply)
      APPLY_REQUESTED="YES"
      shift
      ;;

    --help|-h)
      usage
      exit 0
      ;;

    *)
      fail "unknown_argument:$1"
      ;;
  esac
done

[ -n "$MIGRATION_PATH" ] ||
  fail "missing_required_argument:--migration"

[ -n "$EXPECTED_HEAD" ] ||
  fail "missing_required_argument:--expected-head"

[ -n "$BACKUP_FILE" ] ||
  fail "missing_required_argument:--backup-file"

[ -n "$EXPECTED_BACKUP_SHA256" ] ||
  fail "missing_required_argument:--backup-sha256"

if [ "$APPLY_REQUESTED" = "YES" ]; then
  RUNNER_MODE="APPLY"
else
  RUNNER_MODE="PLAN"
fi

echo "=== RSOS GENERIC MIGRATION RUNNER ==="
echo "runner_version=$RUNNER_VERSION"
echo "contract_version=$CONTRACT_VERSION"
echo "static_policy_version=$STATIC_POLICY_VERSION"
echo "RUNNER_MODE=$RUNNER_MODE"

echo
echo "=== 0. GENERIC ISOLATED TARGET CHECK ==="

[ "$DB_CONTAINER" = "$EXPECTED_DB_CONTAINER" ] ||
  fail "database_target_not_expected_generic_isolated_container"

[ "$DB_CONTAINER" != "$PRODUCTION_DB_CONTAINER" ] ||
  fail "production_database_target_forbidden"

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 ||
  fail "generic_isolated_database_container_missing"

DATABASE_CONTAINER_RUNNING="$(
  docker inspect     --format '{{.State.Running}}'     "$DB_CONTAINER"
)"

DATABASE_NETWORK_MODE="$(
  docker inspect     --format '{{.HostConfig.NetworkMode}}'     "$DB_CONTAINER"
)"

DATABASE_PORTS="$(
  docker inspect     --format '{{json .NetworkSettings.Ports}}'     "$DB_CONTAINER"
)"

DATABASE_PORT_BINDINGS="$(
  docker inspect     --format '{{json .HostConfig.PortBindings}}'     "$DB_CONTAINER"
)"

[ "$DATABASE_CONTAINER_RUNNING" = "true" ] ||
  fail "generic_isolated_database_container_not_running"

[ "$DATABASE_NETWORK_MODE" = "$EXPECTED_NETWORK_MODE" ] ||
  fail "generic_isolated_database_network_mode_invalid"

case "$DATABASE_PORTS" in
  "{}"|"null")
    ;;
  *)
    fail "generic_isolated_database_has_published_ports"
    ;;
esac

case "$DATABASE_PORT_BINDINGS" in
  "{}"|"null")
    ;;
  *)
    fail "generic_isolated_database_has_port_bindings"
    ;;
esac

echo "database_container=$DB_CONTAINER"
echo "database_network_mode=$DATABASE_NETWORK_MODE"
echo "database_ports=$DATABASE_PORTS"
echo "database_port_bindings=$DATABASE_PORT_BINDINGS"
echo "production_container=$PRODUCTION_DB_CONTAINER"
echo "PRODUCTION_TARGET=LOCKED_OUT"
echo "GENERIC_ISOLATED_TARGET_CHECK=PASS"

echo
echo "=== 1. REPOSITORY CHECK ==="

REPOSITORY_ROOT="$(
  git rev-parse --show-toplevel 2>/dev/null
)" ||
  fail "not_inside_git_repository"

CURRENT_DIRECTORY="$(pwd -P)"
REPOSITORY_ROOT="$(cd "$REPOSITORY_ROOT" && pwd -P)"

[ "$CURRENT_DIRECTORY" = "$REPOSITORY_ROOT" ] ||
  fail "runner_must_execute_from_repository_root"

ACTUAL_RUNNER_PATH="$(
  readlink -f "${BASH_SOURCE[0]}"
)"

[ "$ACTUAL_RUNNER_PATH" = \
  "${REPOSITORY_ROOT}/${RUNNER_PATH}" ] ||
  fail "runner_path_mismatch"

[ -f "$CONTRACT_PATH" ] ||
  fail "contract_file_missing"

if ! [[ "$EXPECTED_HEAD" =~ ^[0-9a-f]{40}$ ]]; then
  fail "expected_head_format_invalid"
fi

CURRENT_HEAD="$(git rev-parse HEAD)"

[ "$CURRENT_HEAD" = "$EXPECTED_HEAD" ] ||
  fail "expected_head_mismatch"

for integrity_path in \
  "$RUNNER_PATH" \
  "$CONTRACT_PATH"
do
  git ls-files \
    --error-unmatch \
    "$integrity_path" \
    >/dev/null 2>&1 ||
    fail "integrity_file_not_tracked:${integrity_path}"

  git cat-file \
    -e "HEAD:${integrity_path}" \
    2>/dev/null ||
    fail "integrity_file_missing_from_head:${integrity_path}"

  git diff \
    --quiet \
    -- "$integrity_path" ||
    fail "integrity_file_has_unstaged_changes:${integrity_path}"

  git diff \
    --cached \
    --quiet \
    -- "$integrity_path" ||
    fail "integrity_file_has_staged_changes:${integrity_path}"

  integrity_worktree_sha256="$(
    sha256sum "$integrity_path" |
      awk '{print $1}'
  )"

  integrity_head_sha256="$(
    git show "HEAD:${integrity_path}" |
      sha256sum |
      awk '{print $1}'
  )"

  [ "$integrity_worktree_sha256" = \
    "$integrity_head_sha256" ] ||
    fail "integrity_file_head_mismatch:${integrity_path}"
done

if ! [[ "$MIGRATION_PATH" =~ ^runtime-api/migrations/[0-9]{3}_[a-z0-9_]+\.sql$ ]]; then
  fail "migration_path_invalid"
fi

MIGRATION_KEY="$(basename "$MIGRATION_PATH")"
MIGRATION_PREFIX="${MIGRATION_KEY:0:3}"
MIGRATION_NUMBER="$((10#$MIGRATION_PREFIX))"

MIGRATION_NAME="${MIGRATION_KEY#???_}"
MIGRATION_NAME="${MIGRATION_NAME%.sql}"

[ "$MIGRATION_NUMBER" -gt 105 ] ||
  fail "migration_number_not_after_bootstrap"

[ -f "$MIGRATION_PATH" ] ||
  fail "migration_file_missing"

git ls-files \
  --error-unmatch \
  "$MIGRATION_PATH" \
  >/dev/null 2>&1 ||
  fail "migration_file_not_tracked"

git cat-file \
  -e "HEAD:${MIGRATION_PATH}" \
  2>/dev/null ||
  fail "migration_file_missing_from_head"

git diff \
  --quiet \
  -- "$MIGRATION_PATH" ||
  fail "migration_file_has_unstaged_changes"

git diff \
  --cached \
  --quiet \
  -- "$MIGRATION_PATH" ||
  fail "migration_file_has_staged_changes"

if ! git diff --cached --quiet; then
  fail "repository_contains_staged_changes"
fi

while IFS= read -r status_line; do
  [ -n "$status_line" ] || continue

  case "$status_line" in
    " M dashboard/audit/audit-report-dashboard.txt" | \
    " M dashboard/backup-health.txt" | \
    " M dashboard/governance/governance-health.txt" | \
    " M dashboard/master/master-dashboard.txt" | \
    " M dashboard/operations/operations-health.txt" | \
    " M dashboard/runtime/runtime-health.txt" | \
    " M dashboard/tenant/tenant-dashboard.txt" | \
    " M dashboard/unified/unified-dashboard.txt")
      ;;

    *)
      fail "unexpected_worktree_state:${status_line}"
      ;;
  esac
done < <(git status --porcelain)

mapfile -t PATH_COMMITS < <(
  git log \
    --no-merges \
    --format='%H' \
    HEAD \
    -- "$MIGRATION_PATH"
)

[ "${#PATH_COMMITS[@]}" -eq 1 ] ||
  fail "migration_path_history_commit_count_invalid:${#PATH_COMMITS[@]}"

SOURCE_COMMIT="${PATH_COMMITS[0]}"

SOURCE_STATUS="$(
  git diff-tree \
    --root \
    --no-commit-id \
    --name-status \
    -r "$SOURCE_COMMIT" \
    -- "$MIGRATION_PATH"
)"

EXPECTED_SOURCE_STATUS="$(
  printf 'A\t%s' "$MIGRATION_PATH"
)"

[ "$SOURCE_STATUS" = "$EXPECTED_SOURCE_STATUS" ] ||
  fail "migration_source_commit_did_not_introduce_file"

git merge-base \
  --is-ancestor \
  "$SOURCE_COMMIT" \
  "$CURRENT_HEAD" ||
  fail "migration_source_commit_not_ancestor"

git cat-file \
  -e "${SOURCE_COMMIT}:${MIGRATION_PATH}" \
  2>/dev/null ||
  fail "migration_blob_missing_from_source_commit"

WORKTREE_SHA256="$(
  sha256sum "$MIGRATION_PATH" |
    awk '{print $1}'
)"

HEAD_SHA256="$(
  git show "HEAD:${MIGRATION_PATH}" |
    sha256sum |
    awk '{print $1}'
)"

SOURCE_SHA256="$(
  git show "${SOURCE_COMMIT}:${MIGRATION_PATH}" |
    sha256sum |
    awk '{print $1}'
)"

[ "$WORKTREE_SHA256" = "$HEAD_SHA256" ] ||
  fail "worktree_and_head_blob_mismatch"

[ "$WORKTREE_SHA256" = "$SOURCE_SHA256" ] ||
  fail "source_head_worktree_blob_mismatch"

RUNNER_SHA256="$(
  sha256sum "$RUNNER_PATH" |
    awk '{print $1}'
)"

CONTRACT_SHA256="$(
  sha256sum "$CONTRACT_PATH" |
    awk '{print $1}'
)"

echo "repository_root=$REPOSITORY_ROOT"
echo "repository_head=$CURRENT_HEAD"
echo "migration_path=$MIGRATION_PATH"
echo "migration_key=$MIGRATION_KEY"
echo "migration_number=$MIGRATION_NUMBER"
echo "migration_name=$MIGRATION_NAME"
echo "migration_sha256=$WORKTREE_SHA256"
echo "source_commit=$SOURCE_COMMIT"
echo "runner_sha256=$RUNNER_SHA256"
echo "contract_sha256=$CONTRACT_SHA256"
echo "REPOSITORY_CHECK=PASS"

echo
echo "=== 2. STATIC SQL CHECK ==="

set +e

STATIC_OUTPUT="$(
  python3 - "$MIGRATION_PATH" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
source = path.read_text(
    encoding="utf-8",
    errors="strict",
)

result = []
dollar_sections = []
index = 0
length = len(source)

def mask(fragment: str) -> str:
    return "".join(
        "\n" if character == "\n" else " "
        for character in fragment
    )

while index < length:
    if source.startswith("--", index):
        end = source.find("\n", index)

        if end == -1:
            end = length
        else:
            end += 1

        result.append(mask(source[index:end]))
        index = end
        continue

    if source.startswith("/*", index):
        start = index
        index += 2
        depth = 1

        while index < length and depth > 0:
            if source.startswith("/*", index):
                depth += 1
                index += 2
            elif source.startswith("*/", index):
                depth -= 1
                index += 2
            else:
                index += 1

        if depth != 0:
            raise SystemExit(
                "STATIC_PARSE_ERROR:"
                "unclosed_block_comment"
            )

        result.append(mask(source[start:index]))
        continue

    if source[index] == "'":
        start = index
        index += 1

        while index < length:
            if source[index] == "\\" and index + 1 < length:
                index += 2
                continue

            if source[index] == "'":
                if index + 1 < length and source[index + 1] == "'":
                    index += 2
                    continue

                index += 1
                break

            index += 1
        else:
            raise SystemExit(
                "STATIC_PARSE_ERROR:"
                "unclosed_single_quote"
            )

        result.append(mask(source[start:index]))
        continue

    if source[index] == '"':
        start = index
        index += 1

        while index < length:
            if source[index] == '"':
                if index + 1 < length and source[index + 1] == '"':
                    index += 2
                    continue

                index += 1
                break

            index += 1
        else:
            raise SystemExit(
                "STATIC_PARSE_ERROR:"
                "unclosed_double_quote"
            )

        result.append(mask(source[start:index]))
        continue

    if source[index] == "$":
        tag_match = re.match(
            r"\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$",
            source[index:],
        )

        if tag_match:
            tag = tag_match.group(0)
            start = index
            index += len(tag)
            body_start = index
            end = source.find(tag, index)

            if end == -1:
                raise SystemExit(
                    "STATIC_PARSE_ERROR:"
                    "unclosed_dollar_quote"
                )

            body = source[body_start:end]
            prefix = "".join(result)[-500:]

            if re.search(
                r"\bAS\s*$",
                prefix,
                flags=re.IGNORECASE,
            ):
                section_kind = "routine_body"
            else:
                section_kind = "literal"

            dollar_sections.append(
                (section_kind, body)
            )

            index = end + len(tag)
            result.append(mask(source[start:index]))
            continue

    result.append(source[index])
    index += 1

stripped = "".join(result)

patterns = [
    (
        "transaction_begin",
        r"\bBEGIN\b",
    ),
    (
        "start_transaction",
        r"\bSTART\s+TRANSACTION\b",
    ),
    (
        "transaction_commit",
        r"\bCOMMIT\b",
    ),
    (
        "transaction_rollback",
        r"\bROLLBACK\b",
    ),
    (
        "savepoint",
        r"\bSAVEPOINT\b",
    ),
    (
        "release_savepoint",
        r"\bRELEASE\s+SAVEPOINT\b",
    ),
    (
        "create_database",
        r"\bCREATE\s+DATABASE\b",
    ),
    (
        "drop_database",
        r"\bDROP\s+DATABASE\b",
    ),
    (
        "vacuum",
        r"\bVACUUM\b",
    ),
    (
        "alter_system",
        r"\bALTER\s+SYSTEM\b",
    ),
    (
        "create_index_concurrently",
        r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b",
    ),
    (
        "reindex_concurrently",
        r"\bREINDEX\b[\s\S]{0,300}\bCONCURRENTLY\b",
    ),
    (
        "data_insert",
        r"\bINSERT\s+INTO\b",
    ),
    (
        "data_update",
        r"\bUPDATE\b",
    ),
    (
        "data_delete",
        r"\bDELETE\s+FROM\b",
    ),
    (
        "data_merge",
        r"\bMERGE\s+INTO\b",
    ),
    (
        "data_truncate",
        r"\bTRUNCATE\b",
    ),
    (
        "copy_statement",
        r"\bCOPY\b",
    ),
    (
        "create_table_as_select",
        r"\bCREATE\s+TABLE\b[\s\S]{0,2000}\bAS\s+SELECT\b",
    ),
    (
        "anonymous_do_block",
        r"\bDO\b",
    ),
    (
        "create_procedure",
        r"\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\b",
    ),
    (
        "create_role_or_user",
        r"\bCREATE\s+(?:ROLE|USER)\b",
    ),
    (
        "alter_role_or_user",
        r"\bALTER\s+(?:ROLE|USER)\b",
    ),
    (
        "drop_role_or_user",
        r"\bDROP\s+(?:ROLE|USER)\b",
    ),
    (
        "grant_privilege",
        r"\bGRANT\b",
    ),
    (
        "revoke_privilege",
        r"\bREVOKE\b",
    ),
    (
        "set_role",
        r"\bSET\s+ROLE\b",
    ),
    (
        "security_definer",
        r"\bSECURITY\s+DEFINER\b",
    ),
    (
        "create_extension",
        r"\bCREATE\s+EXTENSION\b",
    ),
    (
        "psql_meta_command",
        r"(?m)^\s*\\[A-Za-z]",
    ),
    (
        "psql_data_terminator",
        r"(?m)^\s*\\\.\s*$",
    ),
]

findings = []

for finding_name, pattern in patterns:
    if re.search(
        pattern,
        stripped,
        flags=re.IGNORECASE,
    ):
        findings.append(finding_name)

for section_kind, body in dollar_sections:
    if (
        section_kind == "routine_body"
        and re.search(
            r"\bEXECUTE\b",
            body,
            flags=re.IGNORECASE,
        )
    ):
        findings.append(
            "dynamic_sql_in_routine_body"
        )

findings = list(dict.fromkeys(findings))

if findings:
    for finding in findings:
        print(
            f"static_policy_violation={finding}"
        )

    raise SystemExit(1)

print("static_parser=PASS")
print(
    "static_policy_version="
    "RSOS-migration-static-v1"
)
PY
)"

STATIC_RESULT=$?

set -e

printf '%s\n' "$STATIC_OUTPUT"

[ "$STATIC_RESULT" -eq 0 ] ||
  fail "static_sql_policy_failed"

echo "STATIC_SQL_CHECK=PASS"

echo
echo "=== 3. BACKUP CHECK ==="

if ! [[ "$EXPECTED_BACKUP_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  fail "backup_sha256_format_invalid"
fi

[[ "$BACKUP_FILE" = /* ]] ||
  fail "backup_path_not_absolute"

[ -f "$BACKUP_FILE" ] ||
  fail "backup_file_missing"

[ ! -L "$BACKUP_FILE" ] ||
  fail "backup_symlink_not_allowed"

BACKUP_MODE="$(stat -c '%a' "$BACKUP_FILE")"
BACKUP_SIZE="$(stat -c '%s' "$BACKUP_FILE")"
BACKUP_MTIME="$(stat -c '%y' "$BACKUP_FILE")"

[ "$BACKUP_MODE" = "600" ] ||
  fail "backup_mode_invalid"

[ "$BACKUP_SIZE" -gt 0 ] ||
  fail "backup_file_empty"

ACTUAL_BACKUP_SHA256="$(
  sha256sum "$BACKUP_FILE" |
    awk '{print $1}'
)"

[ "$ACTUAL_BACKUP_SHA256" = "$EXPECTED_BACKUP_SHA256" ] ||
  fail "backup_sha256_mismatch"

COMPLETION_MARKERS="$(
  grep -c \
    '^-- PostgreSQL database dump complete$' \
    "$BACKUP_FILE" ||
    true
)"

[ "$COMPLETION_MARKERS" = "1" ] ||
  fail "backup_completion_marker_invalid"

if grep -nEi \
  '(^|[[:space:]])(ERROR|FATAL|PANIC):' \
  "$BACKUP_FILE"
then
  fail "backup_contains_database_error_marker"
fi

LIVE_PUBLIC_TABLES="$(public_table_count)"

BACKUP_PUBLIC_TABLES="$(
  grep -c \
    '^CREATE TABLE public\.' \
    "$BACKUP_FILE" ||
    true
)"

[ "$BACKUP_PUBLIC_TABLES" = "$LIVE_PUBLIC_TABLES" ] ||
  fail "backup_public_table_count_mismatch"

echo "backup_file=$BACKUP_FILE"
echo "backup_sha256=$ACTUAL_BACKUP_SHA256"
echo "backup_size_bytes=$BACKUP_SIZE"
echo "backup_mode=$BACKUP_MODE"
echo "backup_mtime=$BACKUP_MTIME"
echo "backup_public_table_count=$BACKUP_PUBLIC_TABLES"
echo "BACKUP_CHECK=PASS"

echo
echo "=== 4. LEDGER PRECHECK ==="

docker inspect \
  "$DB_CONTAINER" \
  >/dev/null 2>&1 ||
  fail "database_container_missing"

LEDGER_EXISTS="$(
  db_query "
    SELECT CASE
      WHEN to_regclass(
        'public.runtime_schema_migrations'
      ) IS NULL
      THEN 0
      ELSE 1
    END;
  "
)"

[ "$LEDGER_EXISTS" = "1" ] ||
  fail "migration_ledger_missing"

APPEND_ONLY_FUNCTION_EXISTS="$(
  db_query "
    SELECT CASE
      WHEN to_regprocedure(
        'public.reject_runtime_schema_migration_mutation()'
      ) IS NULL
      THEN 0
      ELSE 1
    END;
  "
)"

[ "$APPEND_ONLY_FUNCTION_EXISTS" = "1" ] ||
  fail "append_only_function_missing"

APPEND_ONLY_TRIGGER_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM pg_trigger
    WHERE tgrelid =
          'public.runtime_schema_migrations'::regclass
      AND tgname =
          'runtime_schema_migrations_append_only_trigger'
      AND NOT tgisinternal;
  "
)"

[ "$APPEND_ONLY_TRIGGER_COUNT" = "1" ] ||
  fail "append_only_trigger_invalid"

LEDGER_ROW_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations;
  "
)"

CURRENT_MAX_MIGRATION="$(
  db_query "
    SELECT COALESCE(
      MAX(migration_number),
      0
    )
    FROM public.runtime_schema_migrations;
  "
)"

CURRENT_PREDECESSOR_KEY="$(
  db_query "
    SELECT migration_key
    FROM public.runtime_schema_migrations
    WHERE migration_number = (
      SELECT MAX(migration_number)
      FROM public.runtime_schema_migrations
    )
    ORDER BY migration_key
    LIMIT 1;
  "
)"

[ "$CURRENT_MAX_MIGRATION" -ge 105 ] ||
  fail "ledger_maximum_below_bootstrap"

EXPECTED_NEXT_MIGRATION="$((CURRENT_MAX_MIGRATION + 1))"

[ "$MIGRATION_NUMBER" -eq "$EXPECTED_NEXT_MIGRATION" ] ||
  fail "migration_number_not_next_sequential"

KEY_CONFLICT_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations
    WHERE migration_key = '${MIGRATION_KEY}';
  "
)"

PATH_CONFLICT_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations
    WHERE file_path = '${MIGRATION_PATH}';
  "
)"

SHA_CONFLICT_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations
    WHERE migration_sha256 = '${WORKTREE_SHA256}';
  "
)"

HIGHER_MIGRATION_COUNT="$(
  db_query "
    SELECT COUNT(*)
    FROM public.runtime_schema_migrations
    WHERE migration_number > ${CURRENT_MAX_MIGRATION};
  "
)"

[ "$KEY_CONFLICT_COUNT" = "0" ] ||
  fail "migration_key_already_present"

[ "$PATH_CONFLICT_COUNT" = "0" ] ||
  fail "migration_file_path_already_present"

[ "$SHA_CONFLICT_COUNT" = "0" ] ||
  fail "migration_sha256_already_present"

[ "$HIGHER_MIGRATION_COUNT" = "0" ] ||
  fail "unexpected_higher_migration_present"

echo "ledger_row_count=$LEDGER_ROW_COUNT"
echo "current_max_migration=$CURRENT_MAX_MIGRATION"
echo "expected_next_migration=$EXPECTED_NEXT_MIGRATION"
echo "current_predecessor_key=$CURRENT_PREDECESSOR_KEY"
echo "migration_key_conflicts=$KEY_CONFLICT_COUNT"
echo "migration_path_conflicts=$PATH_CONFLICT_COUNT"
echo "migration_sha256_conflicts=$SHA_CONFLICT_COUNT"
echo "higher_migration_count=$HIGHER_MIGRATION_COUNT"
echo "LEDGER_PRECHECK=PASS"

echo
echo "=== 5. EXECUTION BASELINE ==="

PRE_SCHEMA_SHA256="$(schema_hash)"
PRE_CORE_STATE="$(core_state)"
PRE_LEDGER_FINGERPRINT="$(ledger_fingerprint)"
PRE_LEDGER_ROW_COUNT="$(ledger_row_count)"
PRE_PUBLIC_TABLES="$(public_table_count)"
PRE_MAX_MIGRATION="$(maximum_migration_number)"
PRE_HEAD="$(git rev-parse HEAD)"

DATABASE_PROBE="$(db_query "SELECT 1;")"

[ "$DATABASE_PROBE" = "1" ] ||
  fail "isolated_database_probe_failed"

echo "pre_schema_sha256=$PRE_SCHEMA_SHA256"
echo "pre_core_state=$PRE_CORE_STATE"
echo "pre_ledger_fingerprint=$PRE_LEDGER_FINGERPRINT"
echo "pre_ledger_row_count=$PRE_LEDGER_ROW_COUNT"
echo "pre_public_table_count=$PRE_PUBLIC_TABLES"
echo "pre_max_migration=$PRE_MAX_MIGRATION"
echo "isolated_database_probe=$DATABASE_PROBE"

if [ "$RUNNER_MODE" = "PLAN" ]; then
  echo
  echo "=== 6. PLAN READ-ONLY VERIFICATION ==="

  POST_SCHEMA_SHA256="$(schema_hash)"
  POST_CORE_STATE="$(core_state)"
  POST_LEDGER_FINGERPRINT="$(ledger_fingerprint)"
  POST_LEDGER_ROW_COUNT="$(ledger_row_count)"
  POST_PUBLIC_TABLES="$(public_table_count)"
  POST_MAX_MIGRATION="$(maximum_migration_number)"
  POST_HEAD="$(git rev-parse HEAD)"

  [ "$POST_SCHEMA_SHA256" = "$PRE_SCHEMA_SHA256" ] ||
    fail "plan_mode_changed_schema"

  [ "$POST_CORE_STATE" = "$PRE_CORE_STATE" ] ||
    fail "plan_mode_changed_core_state"

  [ "$POST_LEDGER_FINGERPRINT" = "$PRE_LEDGER_FINGERPRINT" ] ||
    fail "plan_mode_changed_ledger"

  [ "$POST_LEDGER_ROW_COUNT" = "$PRE_LEDGER_ROW_COUNT" ] ||
    fail "plan_mode_changed_ledger_row_count"

  [ "$POST_PUBLIC_TABLES" = "$PRE_PUBLIC_TABLES" ] ||
    fail "plan_mode_changed_public_table_count"

  [ "$POST_MAX_MIGRATION" = "$PRE_MAX_MIGRATION" ] ||
    fail "plan_mode_changed_maximum_migration"

  [ "$POST_HEAD" = "$PRE_HEAD" ] ||
    fail "repository_head_changed_during_plan"

  echo "post_schema_sha256=$POST_SCHEMA_SHA256"
  echo "post_core_state=$POST_CORE_STATE"
  echo "post_ledger_fingerprint=$POST_LEDGER_FINGERPRINT"
  echo "post_ledger_row_count=$POST_LEDGER_ROW_COUNT"
  echo "post_public_table_count=$POST_PUBLIC_TABLES"
  echo "post_max_migration=$POST_MAX_MIGRATION"

  echo
  echo "=== 7. PLAN SUMMARY ==="

  echo "planned_migration_key=$MIGRATION_KEY"
  echo "planned_migration_number=$MIGRATION_NUMBER"
  echo "planned_migration_name=$MIGRATION_NAME"
  echo "planned_migration_sha256=$WORKTREE_SHA256"
  echo "planned_source_commit=$SOURCE_COMMIT"
  echo "planned_predecessor_key=$CURRENT_PREDECESSOR_KEY"
  echo "planned_backup_file=$BACKUP_FILE"
  echo "planned_backup_sha256=$ACTUAL_BACKUP_SHA256"
  echo "database_execution_performed=NO"
  echo "advisory_lock_acquired=NO"
  echo "ledger_inserted=NO"
  echo "transaction_committed=NO"
  echo "PRODUCTION_TARGET=LOCKED_OUT"

  echo "PLAN_RESULT=PASS"
  echo "RUNNER_RESULT=PASS"
  exit 0
fi

echo
echo "=== 6. GENERIC ISOLATED APPLY TRANSACTION ==="

set +e

APPLY_OUTPUT="$(
  {
    {
      printf '%s\n' 'BEGIN;'
      printf '%s\n' "SET LOCAL lock_timeout = '5s';"
      printf '%s\n' "SET LOCAL statement_timeout = '30s';"
        cat <<'SQL'
DO $rsos_migration_lock$
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended(
      'rsos-runtime-schema-migrations',
      0
    )
  ) THEN
    RAISE EXCEPTION
      'rsos migration advisory lock unavailable';
  END IF;
END
$rsos_migration_lock$;
SQL

      printf '%s\n' \
        "SELECT set_config('rsos.migration_sha256', :'migration_sha256', true);"
      printf '%s\n' \
        "SELECT set_config('rsos.source_commit', :'source_commit', true);"

      cat "$MIGRATION_PATH"
      printf '\n'

      cat <<'SQL'
INSERT INTO public.runtime_schema_migrations (
  migration_key,
  migration_number,
  migration_name,
  file_path,
  migration_sha256,
  source_commit,
  execution_mode,
  metadata
)
VALUES (
  :'migration_key',
  :'migration_number'::INTEGER,
  :'migration_name',
  :'migration_path',
  :'migration_sha256',
  :'source_commit',
  'runner',
  jsonb_build_object(
    'runner_version',
    :'runner_version',
    'runner_sha256',
    :'runner_sha256',
    'contract_version',
    :'contract_version',
    'contract_sha256',
    :'contract_sha256',
    'target_container',
    :'target_container',
    'advisory_lock_key',
'hashtextextended:rsos-runtime-schema-migrations:0',
    'apply_contract',
    'single_transaction_migration_plus_ledger',
    'production_target',
    'locked_out'
  )
);
SQL

      printf '%s\n' 'COMMIT;'
    } |
      docker exec -i "$DB_CONTAINER" \
        psql \
          -X \
          -qAt \
          -v ON_ERROR_STOP=1 \
          -v migration_key="$MIGRATION_KEY" \
          -v migration_number="$MIGRATION_NUMBER" \
          -v migration_name="$MIGRATION_NAME" \
          -v migration_path="$MIGRATION_PATH" \
          -v migration_sha256="$WORKTREE_SHA256" \
          -v source_commit="$SOURCE_COMMIT" \
          -v runner_version="$RUNNER_VERSION" \
          -v runner_sha256="$RUNNER_SHA256" \
          -v contract_version="$CONTRACT_VERSION" \
          -v contract_sha256="$CONTRACT_SHA256" \
          -v target_container="$DB_CONTAINER" \
          -U "$DB_USER" \
          -d "$DB_NAME"
  } 2>&1
)"

APPLY_STATUS=$?

set -e

printf '%s\n' "$APPLY_OUTPUT"

[ "$APPLY_STATUS" -eq 0 ] ||
  fail "isolated_apply_transaction_failed"

echo
echo "=== 7. APPLY VERIFICATION ==="

POST_SCHEMA_SHA256="$(schema_hash)"
POST_CORE_STATE="$(core_state)"
POST_LEDGER_FINGERPRINT="$(ledger_fingerprint)"
POST_LEDGER_ROW_COUNT="$(ledger_row_count)"
POST_PUBLIC_TABLES="$(public_table_count)"
POST_MAX_MIGRATION="$(maximum_migration_number)"
POST_HEAD="$(git rev-parse HEAD)"

EXPECTED_LEDGER_ROW_COUNT="$((PRE_LEDGER_ROW_COUNT + 1))"

APPLIED_LEDGER_ROW="$(
  db_query "
    SELECT concat_ws(
      '|',
      migration_number::TEXT,
      migration_name,
      file_path,
      migration_sha256,
      source_commit,
      execution_mode
    )
    FROM public.runtime_schema_migrations
    WHERE migration_key = '${MIGRATION_KEY}';
  "
)"

EXPECTED_APPLIED_LEDGER_ROW="$(
  printf '%s|%s|%s|%s|%s|runner' \
    "$MIGRATION_NUMBER" \
    "$MIGRATION_NAME" \
    "$MIGRATION_PATH" \
    "$WORKTREE_SHA256" \
    "$SOURCE_COMMIT"
)"

[ "$POST_CORE_STATE" = "$PRE_CORE_STATE" ] ||
  fail "isolated_probe_changed_core_state"

[ "$POST_LEDGER_ROW_COUNT" = "$EXPECTED_LEDGER_ROW_COUNT" ] ||
  fail "ledger_row_count_increment_invalid"

[ "$POST_MAX_MIGRATION" = "$MIGRATION_NUMBER" ] ||
  fail "maximum_migration_not_applied_migration"

[ "$POST_LEDGER_FINGERPRINT" != "$PRE_LEDGER_FINGERPRINT" ] ||
  fail "ledger_fingerprint_did_not_change"

[ "$APPLIED_LEDGER_ROW" = "$EXPECTED_APPLIED_LEDGER_ROW" ] ||
  fail "applied_ledger_row_identity_mismatch"

[ "$POST_HEAD" = "$PRE_HEAD" ] ||
  fail "repository_head_changed_during_apply"

echo "post_schema_sha256=$POST_SCHEMA_SHA256"
echo "post_core_state=$POST_CORE_STATE"
echo "post_ledger_fingerprint=$POST_LEDGER_FINGERPRINT"
echo "post_ledger_row_count=$POST_LEDGER_ROW_COUNT"
echo "post_public_table_count=$POST_PUBLIC_TABLES"
echo "post_max_migration=$POST_MAX_MIGRATION"
echo "applied_ledger_row=$APPLIED_LEDGER_ROW"

echo
echo "=== 8. APPLY SUMMARY ==="

echo "applied_migration_key=$MIGRATION_KEY"
echo "applied_migration_number=$MIGRATION_NUMBER"
echo "applied_migration_name=$MIGRATION_NAME"
echo "applied_migration_sha256=$WORKTREE_SHA256"
echo "applied_source_commit=$SOURCE_COMMIT"
echo "applied_predecessor_key=$CURRENT_PREDECESSOR_KEY"
echo "validated_backup_file=$BACKUP_FILE"
echo "validated_backup_sha256=$ACTUAL_BACKUP_SHA256"
echo "database_execution_performed=YES"
echo "advisory_lock_acquired=YES"
echo "ledger_inserted=YES"
echo "transaction_committed=YES"
echo "PRODUCTION_TARGET=LOCKED_OUT"

echo "APPLY_RESULT=PASS"
echo "RUNNER_RESULT=PASS"
