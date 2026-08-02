# RSOS-AI-011 — HERMES Shadow Package Seal

## Document control

- Document ID: RSOS-AI-011
- Title: HERMES Shadow Package Seal
- Sprint: RSOS-HERMES-001-APPROVAL-SPEAKER-FOUNDATION
- Status: DRAFT SEALED PACKAGE RECORD
- Runtime mode: SHADOW
- Authority activation: NONE
- Route registration: NOT APPROVED
- Database execution: NOT APPROVED
- Production use: NOT APPROVED
- Human pilot: NOT APPROVED
- Voice activation: NOT APPROVED

## Purpose

This document records the identity, integrity and tested state of the HERMES
human approval speaker shadow implementation package.

The seal is evidentiary only. It does not activate HERMES, grant authority,
register routes, execute migrations, continue workflows or authorize production
use.

## Package identity

The sealed package consists of the following nine components.

| Component | Repository path | SHA-256 |
|---|---|---|
| Architecture contract | `docs/architecture/RSOS-AI-010-human-approval-speaker-contract.md` | `e52fd8dfdec2d258828b0b9aa4b9a27c96386366d4f88411938f3f6ff97119ae` |
| Migration draft | `runtime-api/migrations/109_human_approval_speaker_foundation.sql` | `38781c4e655a1a9ac435397b03289369da80d4b9b140343343f2a95419e33540` |
| Policy draft | `runtime-api/src/policies/human-approval-speaker-policy.js` | `886d597c60cb59b10014069c4c42dfab0316b56b421d551fe428a735f4563feb` |
| Service draft | `runtime-api/src/services/human-approval-speaker-service.js` | `064f59ed70aee02a077b72c0be3003be3f04e7d02e9885db070fdbfbe89be672` |
| Route draft | `runtime-api/src/routes/human-approval-speaker-routes.js` | `64a773416b3bb7a741681a0dd1cf5c4360d028c00b73f68393dd9080f2ce2933` |
| Node test adapter | `runtime-api/test/human-approval-speaker.node-test-adapter.js` | `fe9a13ec8f5da910d979e51e1a976cffe97e707e8b369fb533303e460458eed7` |
| Contract tests | `runtime-api/test/human-approval-speaker.contract.test.js` | `08212aeaf8f89163f8e4a88251cad63d94e79b07a9e3177e955f936b82043a08` |
| Security tests | `runtime-api/test/human-approval-speaker.security.test.js` | `ef770bf1a530efcd733b89b17cb030165cc6c2adff4915470228f096ca22af11` |
| Audit tests | `runtime-api/test/human-approval-speaker.audit.test.js` | `7e8dcc5b785430425786d8ea26045b91363f52e7aaf835affcf986d4b9c71149` |

## Verified execution evidence

The accepted isolated execution used:

```text
node --test runtime-api/test/human-approval-speaker.node-test-adapter.js
```

Verified result:

- Test suites: 3
- Total tests: 17
- Passed: 17
- Failed: 0
- Cancelled: 0
- Skipped: 0
- Todo: 0
- Process exit code: 0
- Standard error: empty
- Repository mutation during execution: none
- Package metadata mutation during execution: none

Execution evidence source:

- Task: HERMES-S1-18D-BOUNDED-NODE-TEST-EXECUTION
- Manifest SHA-256:
  `a4e8b65b2605cd4b66221711a89fe4a3436aabc787d83f989910bf7259424f70`

Integrated result review source:

- Task: HERMES-S1-19-ISOLATED-TEST-RESULT-AWA-RAR-HORUS-VEIT-ARP-REVIEW
- Manifest SHA-256:
  `b5714135e9b13b1dd724e907585970d73229c79695bd1155ee1dd1d1f06fc3f2`

Seal decision source:

- Task: HERMES-S1-20-SHADOW-PACKAGE-INTEGRATION-AND-SEAL-DECISION
- Manifest SHA-256:
  `e5ac053b8b1457c8f400852e9ba1fa8a774d94ba68112c19d13c6ef3d259248a`

## Responsibility boundaries

The sealed package preserves these role boundaries:

- JARVIS owns workflow orchestration and process continuation.
- RAR owns responsibility mapping and semantic scope.
- AWA owns completeness verification.
- HORUS owns identity and authorization verification.
- HERMES presents requests and captures human responses only.
- ARP owns audit and provenance controls.
- Human approvers retain organizational decision authority.

HERMES receives no independent approval authority, execution authority,
workflow authority or governance root authority.

## Runtime contract

The sealed shadow package is constrained to:

- presenting pending approval requests;
- presenting exact request scope and risk context;
- capturing rejection, deferral, information request or response data;
- producing stable reason codes;
- preserving transcript and interaction hash references;
- recording append-only interaction evidence through injected dependencies;
- remaining fail-closed on expiry, revocation, ambiguity, silence, timeout,
  identity failure, tenant mismatch, role mismatch, scope change or unavailable
  audit path.

The package must always preserve:

```text
runtimeMode=SHADOW
allowedToContinueWorkflow=false
```

## Explicit prohibitions

This seal does not authorize:

- database migration execution;
- database connection from HERMES;
- route registration;
- application startup with HERMES enabled;
- workflow continuation;
- workflow state mutation;
- approval authority;
- execution authority;
- autonomous governance authority;
- voice activation;
- human pilot operation;
- production use;
- Git staging;
- Git commit.

## Seal interpretation

The package state is:

```text
IMPLEMENTED_AND_TESTED_IN_SHADOW_DRAFT_STATE
```

The seal confirms:

- package identity;
- package component hashes;
- contract consistency;
- shadow-mode boundaries;
- test evidence;
- repository immutability during approved reviews and execution.

The seal does not convert draft code into active runtime behavior.

## Change control

Any change to a sealed component invalidates this package seal unless:

1. the changed component receives a new bounded write record;
2. its SHA-256 is updated;
3. relevant AWA, RAR, HORUS, VEIT and ARP reviews pass;
4. affected tests are rerun;
5. a new integrated result review passes;
6. a replacement seal is issued.

## Next governance gate

A separate review must decide whether this seal record is complete and whether
a bounded Git stage decision may be considered.

No stage or commit is approved by this document.
