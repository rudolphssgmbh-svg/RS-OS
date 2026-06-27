# RSOS-131B Dispatcher Route Classification
Status: Draft
Datum: 2026-06-27
Bezug: RSOS-131A Route Inventory

## Zweck

Dieses Dokument klassifiziert die im manuellen HTTP-Dispatcher beobachteten Routen aus runtime-api/server.js.

Es veraendert keinen Code.

## Methodik

Die Route-Erkennung basiert auf:

- req.method === ...
- path === ...
- path.startsWith(...)

Die Klassifikation ist eine erste Arbeitsklassifikation und muss vor technischer Extraktion fachlich geprueft werden.

## Route Classification Table

| Zeile | Methode | Pfad / Prefix | Klassifikation |
| ---: | --- | --- | --- |
| 737 | GET | `/health` | Health / Runtime Status |
| 748 | POST | `/auth/login` | Authentication |
| 2397 | POST | `/runtime/reports` | Response / Reporting |
| 2496 | GET | `/runtime/reports` | Response / Reporting |
| 2543 | POST | `/runtime/report-segments` | Unclassified |
| 2641 | GET | `/runtime/report-segments` | Unclassified |
| 2699 | POST | `/runtime/outcomes` | Response / Reporting |
| 2752 | GET | `/runtime/outcomes` | Response / Reporting |
| 2770 | POST | `/runtime/measurements` | Unclassified |
| 2901 | GET | `/runtime/measurements` | Unclassified |
| 2980 | POST | `/runtime/verification-cycles` | Verification |
| 3064 | GET | `/runtime/verification-cycles` | Verification |
| 3098 | POST | `/runtime/facts` | Knowledge |
| 3249 | GET | `/runtime/facts` | Knowledge |
| 3297 | GET | `/runtime/trace/fact/` | Evidence |
| 3531 | POST | `/runtime/unknowns` | Unclassified |
| 3658 | GET | `/runtime/unknowns` | Unclassified |
| 3736 | POST | `/runtime/source-quality` | Unclassified |
| 3819 | GET | `/runtime/source-quality` | Unclassified |
| 3866 | POST | `/runtime/source-conflicts` | Unclassified |
| 3954 | GET | `/runtime/source-conflicts` | Unclassified |
| 4005 | POST | `/runtime/fact-acceptance-rules` | Unclassified |
| 4104 | GET | `/runtime/fact-acceptance-rules` | Unclassified |
| 4151 | POST | `/runtime/facts/validate` | Verification |
| 4370 | POST | `/runtime/facts/calculate-confidence` | Verification |
| 4605 | GET | `/runtime/fact-confidence` | Verification |
| 4649 | POST | `/runtime/facts/governance-check` | Governance |
| 4784 | GET | `/runtime/governance-checks` | Governance |
| 4830 | POST | `/runtime/governance-outcomes` | Governance |
| 4922 | GET | `/runtime/governance-outcomes` | Governance |
| 4972 | POST | `/runtime/lessons-learned/generate` | Knowledge |
| 5129 | GET | `/runtime/lessons-learned` | Knowledge |
| 5177 | POST | `/runtime/heuristics` | Knowledge |
| 5273 | GET | `/runtime/heuristics` | Knowledge |
| 5322 | POST | `/runtime/heuristic-triggers` | Knowledge |
| 5453 | GET | `/runtime/heuristic-triggers` | Knowledge |
| 5505 | POST | `/runtime/heuristic-triggers/materialize` | Knowledge |
| 5660 | POST | `/runtime/heuristic-feedback` | Knowledge |
| 5832 | GET | `/runtime/heuristic-feedback` | Knowledge |
| 5882 | POST | `/runtime/patterns` | Knowledge |
| 5973 | GET | `/runtime/patterns` | Knowledge |
| 6021 | POST | `/runtime/pattern-matches` | Unclassified |
| 6149 | GET | `/runtime/pattern-matches` | Unclassified |
| 6205 | POST | `/runtime/pattern-feedback` | Unclassified |
| 6377 | GET | `/runtime/pattern-feedback` | Unclassified |
| 6427 | POST | `/runtime/cross-loop-validations` | Unclassified |
| 6711 | GET | `/runtime/cross-loop-validations` | Unclassified |
| 6767 | POST | `/runtime/governance-policies` | Governance |
| 6864 | GET | `/runtime/governance-policies` | Governance |
| 6911 | POST | `/runtime/objects` | Interaction |
| 6994 | POST | `/runtime/execute` | Interaction |
| 7242 | GET | `/runtime/objects` | Interaction |
| 7270 | GET | `/runtime/events` | Evidence |
| 7303 | GET | `/audit/chain/verify` | Evidence |
| 7368 | POST | `/runtime/training-plans/complete/` | Adaptation / Learning |
| 7658 | POST | `/runtime/communications/ack/` | Interaction |
| 7748 | POST | `/runtime/orchestrations` | Interaction |
| 7828 | POST | `/runtime/orchestrations/approve/` | Interaction |
| 7915 | POST | `/runtime/orchestrations/execute/` | Interaction |
| 8057 | POST | `/runtime/orchestrations/complete/` | Interaction |
| 8144 | GET | `/runtime/orchestration-rules` | Interaction |
| 8189 | GET | `/runtime/orchestrations/` | Interaction |
| 8353 | GET | `/runtime/orchestrations` | Interaction |
| 8406 | GET | `/runtime/communication-summary/` | Interaction |
| 8536 | GET | `/runtime/communications/` | Interaction |
| 8650 | POST | `/runtime/communications/complete/` | Interaction |
| 8800 | POST | `/runtime/communications/send` | Interaction |
| 8882 | GET | `/runtime/learning-summary/` | Adaptation / Learning |
| 8981 | GET | `/runtime/learning-evidence/` | Evidence |
| 9049 | GET | `/runtime/training-plans/` | Adaptation / Learning |
| 9122 | GET | `/runtime/competencies/gaps` | Unclassified |
| 9166 | GET | `/runtime/competencies/` | Unclassified |
| 9231 | GET | `/runtime/recommendation-rules` | Adaptation / Learning |
| 9276 | POST | `/runtime/recommendations/generate/` | Adaptation / Learning |
| 9322 | POST | `/runtime/recommendations/feedback/` | Adaptation / Learning |
| 9538 | GET | `/runtime/recommendations/gates/latest/` | Adaptation / Learning |
| 9585 | GET | `/runtime/recommendations/gates/history/` | Adaptation / Learning |
| 9629 | POST | `/runtime/recommendations/verify/` | Adaptation / Learning |
| 10052 | POST | `/runtime/recommendations/execute/` | Adaptation / Learning |
| 10311 | POST | `/runtime/recommendations/approve/` | Adaptation / Learning |
| 10398 | GET | `/runtime/recommendations/trace/` | Evidence |
| 10590 | GET | `/runtime/recommendations/` | Adaptation / Learning |
| 10668 | GET | `/runtime/trace/` | Evidence |
| 10878 | GET | `/runtime/trace/` | Evidence |
| 11015 | GET | `/runtime/execution/path/` | Unclassified |
| 11088 | GET | `/runtime/governance/path/` | Governance |
| 11185 | GET | `/runtime/audit/path/` | Evidence |
| 11236 | POST | `/runtime/relations` | Unclassified |
| 11303 | DELETE | `/runtime/relations/` | Unclassified |
| 11370 | GET | `/runtime/relations` | Unclassified |
| 11396 | GET | `/runtime/relations/object/` | Unclassified |
| 11441 | GET | `/runtime/graph/depth/` | Unclassified |
| 11570 | GET | `/runtime/graph/` | Unclassified |
| 11665 | POST | `/runtime/tenants` | Admin / Governance |
| 11754 | POST | `/runtime/tenants/` | Admin / Governance |
| 11865 | POST | `/runtime/tenants/` | Admin / Governance |
| 11962 | GET | `/runtime/tenants/` | Admin / Governance |
| 12014 | POST | `/runtime/tenants/` | Admin / Governance |
| 12133 | GET | `/runtime/tenants/` | Admin / Governance |
| 12192 | POST | `/runtime/training-plans/generate-from-gaps` | Adaptation / Learning |
| 12288 | GET | `/runtime/learning/dashboard` | Adaptation / Learning |
| 12355 | POST | `/runtime/recommendations/generate-from-gaps` | Adaptation / Learning |
| 12483 | POST | `/runtime/knowledge` | Knowledge |
| 12596 | GET | `/runtime/knowledge` | Knowledge |
| 12663 | GET | `/runtime/knowledge/` | Knowledge |
| 12736 | GET | `/runtime/admin/dashboard` | Response / Reporting |
| 12849 | POST | `/runtime/admin/tenants` | Admin / Governance |
| 12977 | POST | `/runtime/admin/tenants/` | Admin / Governance |
| 13095 | POST | `/runtime/admin/tenants/` | Admin / Governance |
| 13226 | GET | `/runtime/admin/tenants` | Admin / Governance |
| 13308 | GET | `/runtime/dashboard/tenants` | Response / Reporting |
| 13412 | GET | `/runtime/dashboard/tenants/` | Response / Reporting |
| 13630 | GET | `/runtime/tenants` | Admin / Governance |
| 13685 | GET | `/runtime/admin/tenants/` | Admin / Governance |
| 13846 | GET | `/runtime/tenants/` | Admin / Governance |
| 13945 | GET | `/runtime/dashboard/management` | Response / Reporting |
| 13978 | GET | `/runtime/dashboard` | Response / Reporting |
| 14028 | GET | `/governance/evaluate` | Governance |
| 14078 | POST | `/runtime/schedule` | Unclassified |
| 14384 | POST | `/runtime/worker/run` | Unclassified |
| 14943 | GET | `/runtime/metrics` | Response / Reporting |
| 15004 | GET | `/runtime/dead-letter` | Unclassified |
| 15041 | POST | `/runtime/dead-letter/requeue` | Unclassified |
| 15107 | GET | `/runtime/workflows/` | Unclassified |
| 15183 | POST | `/runtime/defense/ingress` | Observation / Defense |
| 15575 | GET | `/runtime/defense/ingress` | Observation / Defense |
| 15602 | POST | `/runtime/defense/shadow-validations` | Observation / Defense |
| 15672 | GET | `/runtime/defense/shadow-validations` | Observation / Defense |
| 15699 | POST | `/runtime/defense/quarantine` | Observation / Defense |
| 15761 | GET | `/runtime/defense/quarantine` | Observation / Defense |
| 15789 | POST | `/runtime/defense/quarantine/` | Observation / Defense |
| 15848 | POST | `/runtime/defense/quarantine/` | Observation / Defense |
| 15935 | POST | `/runtime/defense/quarantine/` | Observation / Defense |
| 16023 | POST | `/runtime/defense/savepoints` | Observation / Defense |
| 16084 | GET | `/runtime/defense/savepoints` | Observation / Defense |
| 16112 | POST | `/runtime/defense/savepoints/` | Observation / Defense |
| 16266 | POST | `/runtime/defense/recovery-requests` | Observation / Defense |
| 16317 | GET | `/runtime/defense/recovery-requests` | Observation / Defense |
| 16346 | POST | `/runtime/defense/recovery-requests/` | Observation / Defense |
| 16404 | POST | `/runtime/defense/recovery-requests/` | Observation / Defense |
| 16461 | POST | `/runtime/defense/recovery-requests/` | Observation / Defense |
| 16520 | POST | `/runtime/defense/recovery-requests/` | Observation / Defense |
| 16782 | POST | `/runtime/defense/recovery-verifications` | Verification |
| 16886 | GET | `/runtime/defense/recovery-verifications` | Verification |
| 16915 | POST | `/runtime/defense/recovery-verifications/` | Verification |
| 16995 | POST | `/runtime/defense/metrics/recalculate` | Observation / Defense |
| 17115 | GET | `/runtime/defense/metrics` | Observation / Defense |
| 17144 | GET | `/runtime/defense/dashboard` | Observation / Defense |
| 17222 | POST | `/runtime/audit-reports/generate` | Evidence |
| 17359 | GET | `/runtime/audit-reports` | Evidence |
| 17396 | GET | `/runtime/audit-reports/` | Evidence |
| 17433 | GET | `/runtime/defense/state` | Observation / Defense |
| 17460 | POST | `/runtime/defense/state` | Observation / Defense |
| 17533 | POST | `/runtime/learning/states` | Adaptation / Learning |
| 17599 | GET | `/runtime/learning/states` | Adaptation / Learning |
| 17647 | POST | `/runtime/assessments` | Unclassified |
| 17710 | GET | `/runtime/assessments` | Unclassified |
| 17758 | GET | `/runtime/learning/runtime-dashboard` | Adaptation / Learning |
| 17847 | POST | `/runtime/assessment-attempts` | Unclassified |
| 17909 | GET | `/runtime/assessment-attempts` | Unclassified |
| 17963 | POST | `/runtime/competence/calculate-from-attempts` | Unclassified |
| 18075 | GET | `/runtime/competence/states` | Unclassified |
| 18123 | POST | `/runtime/competence/gaps/calculate` | Unclassified |
| 18214 | GET | `/runtime/competence/gaps` | Unclassified |
| 18256 | POST | `/runtime/learning/recommendations/generate` | Adaptation / Learning |
| 18355 | GET | `/runtime/learning/recommendations` | Adaptation / Learning |

## Ergebnis

Erkannte Routen / Prefix-Bedingungen: 166

Naechster Schritt: manuelle Pruefung der Klassifikation und Auswahl eines risikoarmen ersten Route-Extraktionsbereichs.
