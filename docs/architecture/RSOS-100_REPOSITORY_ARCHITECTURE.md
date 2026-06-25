# RSOS-100 Repository Architecture

## Purpose

This document defines the repository structure for RS OS.

RS OS is treated as a multi-component platform, not as a single application.

## Repository Subsystems

| Path | Role | Versioning |
|---|---|---|
| runtime-api/ | Core runtime API and database migrations | Source of truth |
| frontend/ | User-facing frontend | Source of truth |
| dashboard/ | Operational dashboards and health views | Source of truth |
| docker/ | Deployment and compose definitions | Source of truth |
| registry-server/ | Registry and control service | Source of truth |
| node-agent/ | Node/runtime agent | Source of truth |
| knowledge/ | Foundation, handoff, architecture and evidence documentation | Mixed: definitions versioned, generated runtime artifacts ignored |
| storage/ | Local runtime/database data | Ignored |
| logs/ | Local logs | Ignored |
| backups/ | Local backups | Ignored |
| exports/ | Generated exports | Ignored |

## Commit Rule

Commits should be grouped by subsystem or by clearly defined cross-cutting change.

Avoid mixing unrelated changes such as frontend UI, database migrations, recovery scripts and documentation in one commit.

## Source vs Runtime Rule

Version:
- source code
- database migrations
- deployment definitions
- architecture documentation
- reproducible scripts
- intentional foundation documents

Do not version:
- logs
- caches
- node_modules
- local database files
- generated inventories
- local inspect dumps
- backup snapshots
- runtime event/status dumps unless explicitly accepted as evidence

## RS OS Principle

The repository must preserve the same distinction as RS OS itself:

Definition is not runtime state.
Runtime state is not evidence.
Evidence is not truth.
Truth requires verification.
