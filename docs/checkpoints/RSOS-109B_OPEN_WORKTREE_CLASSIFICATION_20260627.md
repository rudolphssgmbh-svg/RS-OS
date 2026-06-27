# RSOS-109B Open Worktree Classification

Status: Draft
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Ergebnis

Der verifizierte Foundation-Kern ist committed und durch run_all_tir.sh validiert.

Der Worktree enthaelt weiterhin offene Aenderungen, die vor einem Merge separat bewertet werden muessen.

## A - Verifizierter Foundation-Kern

Committed und geprueft:

- RSOS-001 Principle of Selection
- RSOS-002 Principle of Tension
- RSOS-106 Runtime Element Foundation
- RSOS-108 Adaptive Element Prototype
- RSOS-110A Competency Formation
- RSOS-120 Tenant Element Model
- TIR-0111A/B
- TIR-0110A
- TIR-0120A
- TIR-0121A
- run_all_tir.sh

## B - Separater Infrastruktur-Sprint

Nicht mit Foundation-Merge vermischen:

- dashboard/
- docker-compose.yml
- frontend/index.html
- registry-server/
- node-agent/
- docker/

## C - Knowledge / Generated / Status Artefakte

Separat pruefen:

- knowledge/current/*.json
- knowledge/current/*.sh
- knowledge/current/*.sha256
- knowledge/*.sh

## D - Einzeldateien gesondert pruefen

- runtime-api/016_runtime_relations.sql
- runtime-api/migrations/090_runtime_verification_cycle_result_link.sql
- runtime-api/migrations/obsolete/
- runtime-api/RSOS-060_IST_ZUSTAND_20260619.md
- runtime-api/RSOS-060_MODULARISIERUNG_STATUS_20260619.md
- master

## Regel

Kein Merge in main/develop, solange B, C und D nicht bewertet oder isoliert wurden.
