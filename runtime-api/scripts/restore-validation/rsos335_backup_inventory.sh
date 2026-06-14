#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/rsos/backups/postgres"

echo "RSOS-335 Backup Inventory"
echo "backup_dir=$BACKUP_DIR"
echo

du -sh "$BACKUP_DIR"
echo

find "$BACKUP_DIR" -type f -printf "%TY-%Tm-%Td %TH:%TM %s %p\n" | sort
