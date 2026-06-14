#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/rsos/backups/postgres"

echo "RSOS-336 Backup Retention Policy"
echo "backup_dir=$BACKUP_DIR"
echo "mode=audit_only"
echo

find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.sql" -printf "%TY-%Tm-%Td %TH:%TM %s %p\n" | sort

echo
echo "POLICY:"
echo "daily_keep_days=14"
echo "weekly_keep_weeks=8"
echo "monthly_keep_months=12"
echo "yearly_keep_years=5"
echo
echo "ACTION:"
echo "No deletion performed."
