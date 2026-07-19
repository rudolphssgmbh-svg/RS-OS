#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

SCRIPTS_ROOT="$(
  cd "$SCRIPT_DIR/.." &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPTS_ROOT/lib/rsos-dashboard-status.sh}"
FINAL_DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
LOCK_FILE="${RSOS_DASHBOARD_LOCK:-/tmp/rsos-dashboard-refresh.lock}"
RELEASE_RETENTION_COUNT="${RSOS_DASHBOARD_RELEASE_RETENTION_COUNT:-672}"

RUN_ID="${RSOS_DASHBOARD_RUN_ID:-dashboard-$(date -u +"%Y%m%dT%H%M%SZ")-$$}"
GENERATED_AT="${RSOS_DASHBOARD_GENERATED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

fail_refresh() {
  echo "REFRESH_RESULT=FAILED"
  echo "REFRESH_REASON=$1"
  exit 1
}

[[ "$RELEASE_RETENTION_COUNT" =~ ^[0-9]+$ ]] ||
  fail_refresh "INVALID_RETENTION_COUNT"

(( RELEASE_RETENTION_COUNT >= 2 )) ||
  fail_refresh "RETENTION_COUNT_BELOW_MINIMUM"

[[ "$RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]] ||
  fail_refresh "INVALID_RUN_ID"

[[ -r "$COMMON_LIBRARY" ]] ||
  fail_refresh "COMMON_LIBRARY_NOT_READABLE"

source "$COMMON_LIBRARY"

SNAPSHOT_ROOT="$FINAL_DASHBOARD_ROOT/.snapshots"
RELEASE_ROOT="$SNAPSHOT_ROOT/releases"
CURRENT_POINTER="$SNAPSHOT_ROOT/current"
PENDING_RELEASE="$RELEASE_ROOT/.pending-${RUN_ID}-$$"
FINAL_RELEASE="$RELEASE_ROOT/$RUN_ID"
NEXT_POINTER="$SNAPSHOT_ROOT/.current.next.$$"
FINAL_RELEASE_PUBLISHED="NO"

mkdir -p "$FINAL_DASHBOARD_ROOT"
mkdir -p "$RELEASE_ROOT"
mkdir -p "$(dirname "$LOCK_FILE")"

if [[ -e "$CURRENT_POINTER" ]] &&
   [[ ! -L "$CURRENT_POINTER" ]]; then
  fail_refresh "CURRENT_POINTER_NOT_SYMLINK"
fi

if [[ -e "$FINAL_RELEASE" ]] ||
   [[ -L "$FINAL_RELEASE" ]]; then
  fail_refresh "RELEASE_ALREADY_EXISTS"
fi

if [[ -e "$PENDING_RELEASE" ]] ||
   [[ -L "$PENDING_RELEASE" ]]; then
  fail_refresh "PENDING_RELEASE_ALREADY_EXISTS"
fi

if [[ -e "$NEXT_POINTER" ]] ||
   [[ -L "$NEXT_POINTER" ]]; then
  fail_refresh "NEXT_POINTER_ALREADY_EXISTS"
fi

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "REFRESH_RESULT=SKIPPED"
  echo "REFRESH_REASON=LOCKED"
  exit 0
fi

cleanup() {
  rm -f -- "$NEXT_POINTER"

  if [[ -d "$PENDING_RELEASE" ]]; then
    rm -rf -- "$PENDING_RELEASE"
  fi

  if [[ "$FINAL_RELEASE_PUBLISHED" != "YES" ]] &&
     [[ -d "$FINAL_RELEASE" ]]; then
    rm -rf -- "$FINAL_RELEASE"
  fi
}

trap cleanup EXIT

is_committed_release() {
  local release="$1"
  local manifest="$release/run-manifest.txt"

  [[ -d "$release" ]] || return 1
  [[ -f "$manifest" ]] || return 1

  [[ "$(
    read_dashboard_value "$manifest" PUBLISH_STATE UNKNOWN
  )" == "COMMITTED" ]] || return 1

  [[ "$(
    read_dashboard_value "$manifest" PUBLISH_CONTRACT UNKNOWN
  )" == "ATOMIC_POINTER" ]] || return 1

  [[ "$(
    read_dashboard_value "$manifest" AUTHORITATIVE_SNAPSHOT NO
  )" == "YES" ]] || return 1
}

prune_releases_before_publish() {
  local new_release="$1"
  local current_release=""
  local record
  local release
  local retention_before=0
  local retention_deleted=0
  local retention_unverified=0
  local keep_count=0

  local -a committed_releases=()
  local -A keep=()

  if [[ -L "$CURRENT_POINTER" ]]; then
    current_release="$(
      realpath -e -- "$CURRENT_POINTER" 2>/dev/null || true
    )"
  fi

  while IFS= read -r -d '' record; do
    release="${record#*$'\t'}"

    if is_committed_release "$release"; then
      committed_releases+=("$release")
    else
      retention_unverified=$((retention_unverified + 1))
    fi
  done < <(
    find "$RELEASE_ROOT" \
      -mindepth 1 \
      -maxdepth 1 \
      -type d \
      ! -name '.pending-*' \
      -printf '%T@\t%p\0' |
      sort -z -nr
  )

  retention_before="${#committed_releases[@]}"

  keep["$new_release"]="YES"
  keep_count=1

  if [[ -n "$current_release" ]] &&
     [[ "$current_release" != "$new_release" ]] &&
     is_committed_release "$current_release"; then

    keep["$current_release"]="YES"
    keep_count=$((keep_count + 1))
  fi

  for release in "${committed_releases[@]}"; do
    if [[ -n "${keep[$release]:-}" ]]; then
      continue
    fi

    if (( keep_count < RELEASE_RETENTION_COUNT )); then
      keep["$release"]="YES"
      keep_count=$((keep_count + 1))
      continue
    fi

    rm -rf -- "$release" || return 1
    retention_deleted=$((retention_deleted + 1))
  done

  echo "RETENTION_POLICY=COUNT"
  echo "RETENTION_LIMIT=$RELEASE_RETENTION_COUNT"
  echo "RETENTION_RELEASES_BEFORE=$retention_before"
  echo "RETENTION_RELEASES_DELETED=$retention_deleted"
  echo "RETENTION_RELEASES_AFTER=$((retention_before - retention_deleted))"
  echo "RETENTION_UNVERIFIED_RELEASES=$retention_unverified"
  echo "RETENTION_RESULT=PASS"
}

mkdir -p "$PENDING_RELEASE"

export RSOS_DASHBOARD_COMMON="$COMMON_LIBRARY"
export RSOS_DASHBOARD_ROOT="$PENDING_RELEASE"
export RSOS_DASHBOARD_RUN_ID="$RUN_ID"
export RSOS_DASHBOARD_GENERATED_AT="$GENERATED_AT"
export RSOS_DASHBOARD_ORCHESTRATED="YES"

SCRIPTS=(
  "$SCRIPTS_ROOT/dashboard/rsos337_generate_backup_dashboard.sh"
  "$SCRIPTS_ROOT/runtime-health/rsos338_runtime_health_dashboard.sh"
  "$SCRIPTS_ROOT/audit-dashboard/rsos343_audit_report_dashboard.sh"
  "$SCRIPTS_ROOT/tenant-dashboard/rsos360_tenant_dashboard.sh"
  "$SCRIPTS_ROOT/operations/rsos340_operations_dashboard.sh"
  "$SCRIPTS_ROOT/governance/rsos345_governance_dashboard.sh"
  "$SCRIPTS_ROOT/unified-dashboard/rsos351_unified_dashboard.sh"
  "$SCRIPTS_ROOT/master-dashboard/rsos356_master_dashboard.sh"
)

SNAPSHOT_FILES=(
  "backup-health.txt"
  "runtime/runtime-health.txt"
  "audit/audit-report-dashboard.txt"
  "tenant/tenant-dashboard.txt"
  "operations/operations-health.txt"
  "governance/governance-health.txt"
  "unified/unified-dashboard.txt"
  "master/master-dashboard.txt"
)

for script in "${SCRIPTS[@]}"; do
  [[ -x "$script" ]] ||
    fail_refresh "SCRIPT_NOT_EXECUTABLE:$script"

  echo "RUNNING_SCRIPT=$script"
  "$script"
done

STAGED_FILES=()

for relative in "${SNAPSHOT_FILES[@]}"; do
  file="$PENDING_RELEASE/$relative"

  [[ -s "$file" ]] ||
    fail_refresh "STAGED_FILE_MISSING:$relative"

  STAGED_FILES+=("$file")
done

SNAPSHOT_STATUS="$(
  snapshot_consistency_status \
    "$RUN_ID" \
    "$GENERATED_AT" \
    "${STAGED_FILES[@]}"
)"

[[ "$SNAPSHOT_STATUS" == "GREEN" ]] ||
  fail_refresh "STAGED_SNAPSHOT_INCONSISTENT"

BACKUP_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/backup-health.txt" \
    STATUS \
    UNKNOWN
)"

RUNTIME_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/runtime/runtime-health.txt" \
    STATUS \
    UNKNOWN
)"

AUDIT_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/audit/audit-report-dashboard.txt" \
    STATUS \
    UNKNOWN
)"

TENANT_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/tenant/tenant-dashboard.txt" \
    STATUS \
    UNKNOWN
)"

OPERATIONS_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/operations/operations-health.txt" \
    OVERALL_STATUS \
    UNKNOWN
)"

GOVERNANCE_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/governance/governance-health.txt" \
    OVERALL_STATUS \
    UNKNOWN
)"

UNIFIED_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/unified/unified-dashboard.txt" \
    OVERALL_STATUS \
    UNKNOWN
)"

MASTER_STATUS="$(
  read_dashboard_value \
    "$PENDING_RELEASE/master/master-dashboard.txt" \
    EXECUTIVE_STATUS \
    UNKNOWN
)"

MASTER_RESULT="$(
  read_dashboard_value \
    "$PENDING_RELEASE/master/master-dashboard.txt" \
    RESULT \
    UNKNOWN
)"

MANIFEST="$PENDING_RELEASE/run-manifest.txt"
TEMP_MANIFEST="$(mktemp "${MANIFEST}.tmp.XXXXXX")"

cat > "$TEMP_MANIFEST" <<EOD
RS OS Dashboard Run Manifest

STATUS=${MASTER_STATUS}
RESULT=${MASTER_RESULT}
PUBLISH_STATE=COMMITTED
PUBLISH_CONTRACT=ATOMIC_POINTER
AUTHORITATIVE_SNAPSHOT=YES
RELEASE_ID=${RUN_ID}
RELEASE_PATH=.snapshots/releases/${RUN_ID}
RETENTION_POLICY=COUNT
RETENTION_LIMIT=${RELEASE_RETENTION_COUNT}

BACKUP_STATUS=${BACKUP_STATUS}
RUNTIME_STATUS=${RUNTIME_STATUS}
AUDIT_STATUS=${AUDIT_STATUS}
TENANT_STATUS=${TENANT_STATUS}
OPERATIONS_STATUS=${OPERATIONS_STATUS}
GOVERNANCE_STATUS=${GOVERNANCE_STATUS}
UNIFIED_STATUS=${UNIFIED_STATUS}
MASTER_STATUS=${MASTER_STATUS}
SNAPSHOT_STATUS=${SNAPSHOT_STATUS}

SCRIPT_COUNT=${#SCRIPTS[@]}
RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_MANIFEST" "$MANIFEST"

find "$PENDING_RELEASE" \
  -type d \
  -exec chmod 0755 {} +

find "$PENDING_RELEASE" \
  -type f \
  -exec chmod 0644 {} +

mv \
  "$PENDING_RELEASE" \
  "$FINAL_RELEASE"

prune_releases_before_publish "$FINAL_RELEASE" ||
  fail_refresh "RELEASE_RETENTION_FAILED"

ln -s \
  "releases/$RUN_ID" \
  "$NEXT_POINTER"

mv -Tf \
  "$NEXT_POINTER" \
  "$CURRENT_POINTER"

FINAL_RELEASE_PUBLISHED="YES"

AUTHORITATIVE_ROOT="$(
  dashboard_authoritative_root "$FINAL_DASHBOARD_ROOT"
)" || fail_refresh "AUTHORITATIVE_POINTER_VALIDATION_FAILED"

EXPECTED_RELEASE="$(
  realpath -e -- "$FINAL_RELEASE"
)"

[[ "$AUTHORITATIVE_ROOT" == "$EXPECTED_RELEASE" ]] ||
  fail_refresh "AUTHORITATIVE_RELEASE_MISMATCH"

for relative in "${SNAPSHOT_FILES[@]}"; do
  final_file="$AUTHORITATIVE_ROOT/$relative"

  [[ "$(
    read_dashboard_value "$final_file" RUN_ID ""
  )" == "$RUN_ID" ]] ||
    fail_refresh "FINAL_RUN_ID_MISMATCH:$relative"
done

cat "$AUTHORITATIVE_ROOT/run-manifest.txt"

echo "REFRESH_RESULT=COMPLETE"
echo "REFRESH_RUN_ID=$RUN_ID"
echo "REFRESH_STATUS=$MASTER_STATUS"
echo "PUBLISH_STATE=COMMITTED"
echo "PUBLISH_CONTRACT=ATOMIC_POINTER"
echo "AUTHORITATIVE_RELEASE=$AUTHORITATIVE_ROOT"
echo "RETENTION_POLICY=COUNT"
echo "RETENTION_LIMIT=$RELEASE_RETENTION_COUNT"
echo "RETENTION_RESULT=PASS"
