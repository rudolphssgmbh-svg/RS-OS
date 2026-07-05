#!/usr/bin/env bash
set -euo pipefail

cd /opt/rsos/knowledge/current

sha256sum FOUNDATION_WITNESS.json > FOUNDATION_WITNESS.sha256

echo "FOUNDATION_WITNESS.sha256 updated"
