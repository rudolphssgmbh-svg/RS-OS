#!/usr/bin/env bash
set -euo pipefail
umask 077

export LC_ALL=C

cd "$(git rev-parse --show-toplevel)"

SOURCE_DIR="runtime-api/migration-sources/107"
TARGET_FILE="runtime-api/migrations/107_runtime_signage_foundation.sql"
TEMP_FILE="${TARGET_FILE}.tmp"

MODULES=(
  "010_screens.sql"
  "020_screen_credentials.sql"
  "030_content.sql"
  "040_content_versions.sql"
  "050_playlists.sql"
  "060_playlist_versions.sql"
  "070_playlist_items.sql"
  "080_publications.sql"
  "090_player_checkins.sql"
  "100_constraints.sql"
  "110_indexes.sql"
  "120_immutability.sql"
  "130_comments.sql"
  "990_verify.sql"
)

fail() {
  echo "BUILD_RESULT=FAIL"
  echo "REASON=$1"
  rm -f "$TEMP_FILE"
  exit 1
}

[ -d "$SOURCE_DIR" ] \
  || fail "source_directory_missing"

for module in "${MODULES[@]}"
do
  [ -f "$SOURCE_DIR/$module" ] \
    || fail "source_module_missing:$module"
done

if grep -RInE \
  'Status: scaffold|implementation will be added' \
  "$SOURCE_DIR" \
  --include='*.sql' >/dev/null
then
  fail "scaffold_markers_remain"
fi

if grep -RInE \
  '^[[:space:]]*(BEGIN|COMMIT)[[:space:]]*;' \
  "$SOURCE_DIR" \
  --include='*.sql' >/dev/null
then
  fail "transaction_statement_found_in_source_module"
fi

if grep -RInE \
  '^[[:space:]]*\\(i|ir)[[:space:]]+' \
  "$SOURCE_DIR" \
  --include='*.sql' >/dev/null
then
  fail "psql_include_command_found"
fi

{
  cat <<'SQL'
-- RSOS-DS-001
-- Migration 107: Runtime signage foundation
-- GENERATED FILE - DO NOT EDIT DIRECTLY
-- Source: runtime-api/migration-sources/107
-- Build script: runtime-api/scripts/migrations/build_107_signage_migration.sh

BEGIN;
SQL

  for module in "${MODULES[@]}"
  do
    printf '\n'
    printf '%s\n' "-- BEGIN MODULE: $module"
    cat "$SOURCE_DIR/$module"
    printf '\n%s\n' "-- END MODULE: $module"
  done

  cat <<'SQL'

COMMIT;
SQL
} > "$TEMP_FILE"

BEGIN_COUNT="$(
  grep -Ec '^[[:space:]]*BEGIN[[:space:]]*;' "$TEMP_FILE"
)"

COMMIT_COUNT="$(
  grep -Ec '^[[:space:]]*COMMIT[[:space:]]*;' "$TEMP_FILE"
)"

[ "$BEGIN_COUNT" -eq 1 ] \
  || fail "generated_begin_count_invalid"

[ "$COMMIT_COUNT" -eq 1 ] \
  || fail "generated_commit_count_invalid"

mv "$TEMP_FILE" "$TARGET_FILE"

echo "TARGET_FILE=$TARGET_FILE"
echo "TARGET_SHA256=$(sha256sum "$TARGET_FILE" | awk '{print $1}')"
echo "TARGET_LINES=$(wc -l < "$TARGET_FILE" | tr -d ' ')"
echo "MODULE_COUNT=${#MODULES[@]}"
echo "BUILD_RESULT=PASS"
