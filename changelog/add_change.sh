#!/bin/bash

CHANGE="$1"

FILE="/opt/rsos/changelog/CHANGELOG.md"

echo "[$(date -Iseconds)] $CHANGE" >> "$FILE"

echo "Changelog updated."
