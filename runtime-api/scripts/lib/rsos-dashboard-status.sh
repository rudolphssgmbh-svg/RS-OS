#!/usr/bin/env bash
set -euo pipefail

normalize_status() {
  local value="${1:-UNKNOWN}"

  value="$(
    printf '%s' "$value" |
      tr '[:lower:]' '[:upper:]' |
      tr -d '[:space:]'
  )"

  case "$value" in
    GREEN|OK|HEALTHY|PASS|PASSED|SUCCESS|SUCCEEDED|TRUSTED)
      printf '%s\n' "GREEN"
      ;;
    REVIEW_REQUIRED|DEGRADED|WARNING|WARN|YELLOW|AMBER)
      printf '%s\n' "REVIEW_REQUIRED"
      ;;
    RED|FAILED|FAIL|ERROR|BLOCKED|REJECTED|UNTRUSTED)
      printf '%s\n' "RED"
      ;;
    UNKNOWN|"")
      printf '%s\n' "UNKNOWN"
      ;;
    *)
      printf '%s\n' "UNKNOWN"
      ;;
  esac
}

status_rank() {
  case "$(normalize_status "${1:-UNKNOWN}")" in
    GREEN)
      printf '%s\n' "0"
      ;;
    REVIEW_REQUIRED)
      printf '%s\n' "1"
      ;;
    UNKNOWN)
      printf '%s\n' "2"
      ;;
    RED)
      printf '%s\n' "3"
      ;;
    *)
      printf '%s\n' "2"
      ;;
  esac
}

worst_status() {
  local worst="GREEN"
  local worst_rank="0"
  local current
  local normalized
  local rank

  if [[ "$#" -eq 0 ]]; then
    printf '%s\n' "UNKNOWN"
    return 0
  fi

  for current in "$@"; do
    normalized="$(normalize_status "$current")"
    rank="$(status_rank "$normalized")"

    if (( rank > worst_rank )); then
      worst="$normalized"
      worst_rank="$rank"
    fi
  done

  printf '%s\n' "$worst"
}

result_to_status() {
  normalize_status "${1:-UNKNOWN}"
}

read_dashboard_value() {
  local file="$1"
  local key="$2"
  local fallback="${3:-UNKNOWN}"
  local value=""

  if [[ -f "$file" ]]; then
    value="$(
      sed -n "s/^${key}=//p" "$file" |
        head -n 1
    )"
  fi

  if [[ -n "$value" ]]; then
    printf '%s\n' "$value"
  else
    printf '%s\n' "$fallback"
  fi
}

status_to_result() {
  case "$(normalize_status "${1:-UNKNOWN}")" in
    GREEN)
      printf '%s\n' "TRUSTED"
      ;;
    REVIEW_REQUIRED)
      printf '%s\n' "REVIEW_REQUIRED"
      ;;
    RED)
      printf '%s\n' "UNTRUSTED"
      ;;
    *)
      printf '%s\n' "UNKNOWN"
      ;;
  esac
}

dashboard_generated_at() {
  if [[ -n "${RSOS_DASHBOARD_GENERATED_AT:-}" ]]; then
    printf '%s\n' "$RSOS_DASHBOARD_GENERATED_AT"
  else
    date -u +"%Y-%m-%dT%H:%M:%SZ"
  fi
}

dashboard_run_id() {
  if [[ -n "${RSOS_DASHBOARD_RUN_ID:-}" ]]; then
    printf '%s\n' "$RSOS_DASHBOARD_RUN_ID"
  else
    printf 'standalone-%s-%s\n' \
      "$(date -u +"%Y%m%dT%H%M%SZ")" \
      "$$"
  fi
}

snapshot_consistency_status() {
  local expected_run_id="${1:-}"
  local expected_generated_at="${2:-}"
  local file
  local actual_run_id
  local actual_generated_at

  if [[ "$#" -ge 2 ]]; then
    shift 2
  else
    printf '%s\n' "UNKNOWN"
    return 0
  fi

  if [[ -z "$expected_run_id" ]] ||
     [[ "$expected_run_id" == "UNKNOWN" ]] ||
     [[ -z "$expected_generated_at" ]] ||
     [[ "$expected_generated_at" == "UNKNOWN" ]] ||
     [[ "$#" -eq 0 ]]; then
    printf '%s\n' "UNKNOWN"
    return 0
  fi

  for file in "$@"; do
    actual_run_id="$(
      read_dashboard_value "$file" RUN_ID ""
    )"

    actual_generated_at="$(
      read_dashboard_value "$file" GENERATED_AT ""
    )"

    if [[ -z "$actual_run_id" ]] ||
       [[ -z "$actual_generated_at" ]]; then
      printf '%s\n' "UNKNOWN"
      return 0
    fi

    if [[ "$actual_run_id" != "$expected_run_id" ]] ||
       [[ "$actual_generated_at" != "$expected_generated_at" ]]; then
      printf '%s\n' "RED"
      return 0
    fi
  done

  printf '%s\n' "GREEN"
}

require_dashboard_orchestrator() {
  if [[ "${RSOS_DASHBOARD_ORCHESTRATED:-}" != "YES" ]]; then
    printf '%s\n' "DASHBOARD_GENERATOR_RESULT=FAILED" >&2
    printf '%s\n' "DASHBOARD_GENERATOR_REASON=ORCHESTRATOR_REQUIRED" >&2
    return 1
  fi

  if [[ -z "${RSOS_DASHBOARD_ROOT:-}" ]]; then
    printf '%s\n' "DASHBOARD_GENERATOR_RESULT=FAILED" >&2
    printf '%s\n' "DASHBOARD_GENERATOR_REASON=STAGING_ROOT_REQUIRED" >&2
    return 1
  fi
}

dashboard_authoritative_root() {
  local dashboard_root="${1:-/opt/rsos/dashboard}"
  local canonical_root
  local snapshot_root
  local release_root
  local current_pointer
  local resolved
  local manifest

  canonical_root="$(
    realpath -m -- "$dashboard_root" 2>/dev/null
  )" || return 1

  snapshot_root="$canonical_root/.snapshots"
  release_root="$snapshot_root/releases"
  current_pointer="$snapshot_root/current"

  [[ -L "$current_pointer" ]] || return 1

  resolved="$(
    realpath -e -- "$current_pointer" 2>/dev/null
  )" || return 1

  case "$resolved/" in
    "$release_root/"*)
      ;;
    *)
      return 1
      ;;
  esac

  manifest="$resolved/run-manifest.txt"

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

  printf '%s\n' "$resolved"
}
