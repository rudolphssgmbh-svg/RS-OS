---
document_id: RSOS-ENG-001
title: Runtime Route Classification
status: PROPOSED
classification: Engineering / Runtime Classification
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ARCH-007]
---

# Zweck

Dieses Dokument klassifiziert die verbliebenen Inline-Routen in `runtime-api/server.js`.

Es führt keine Codeänderungen durch.

Grundsatz:

Erst klassifizieren, dann refaktorieren.

---

# 1. Inventurgrundlage

Quelle dieser Klassifikation ist der Route-Family-Precheck vom 2026-07-01.

Ergebnis:

- 166 Inline-Routen in `runtime-api/server.js`
- Route-Familien wurden über Pfadpräfixe gruppiert
- Keine Runtime-Änderung durchgeführt

---

# 2. Route-Family-Map

| Anzahl | Route-Familie |
|---:|---|
| 17 | `/runtime/defense` |
| 6 | `/runtime/learning` |
| 5 | `/runtime/facts` |
| 4 | `/runtime/competence` |
| 3 | `/runtime/heuristic-triggers` |
| 3 | `/runtime/dashboard` |
| 3 | `/runtime/admin` |
| 2 | `/runtime/verification-cycles` |
| 2 | `/runtime/unknowns` |
| 2 | `/runtime/tenants` |
| 2 | `/runtime/source-quality` |
| 2 | `/runtime/source-conflicts` |
| 2 | `/runtime/reports` |
| 2 | `/runtime/report-segments` |
| 2 | `/runtime/relations` |
| 2 | `/runtime/patterns` |
| 2 | `/runtime/pattern-matches` |
| 2 | `/runtime/pattern-feedback` |
| 2 | `/runtime/outcomes` |
| 2 | `/runtime/orchestrations` |
| 2 | `/runtime/objects` |
| 2 | `/runtime/measurements` |
| 2 | `/runtime/lessons-learned` |
| 2 | `/runtime/knowledge` |
| 2 | `/runtime/heuristics` |
| 2 | `/runtime/heuristic-feedback` |
| 2 | `/runtime/governance-policies` |
| 2 | `/runtime/governance-outcomes` |
| 2 | `/runtime/fact-acceptance-rules` |
| 2 | `/runtime/dead-letter` |
| 2 | `/runtime/cross-loop-validations` |
| 2 | `/runtime/audit-reports` |
| 2 | `/runtime/assessments` |
| 2 | `/runtime/assessment-attempts` |
| 1 | `/runtime/worker` |
| 1 | `/runtime/training-plans` |
| 1 | `/runtime/schedule` |
| 1 | `/runtime/recommendations` |
| 1 | `/runtime/recommendation-rules` |
| 1 | `/runtime/orchestration-rules` |
| 1 | `/runtime/metrics` |
| 1 | `/runtime/governance-checks` |
| 1 | `/runtime/fact-confidence` |
| 1 | `/runtime/execute` |
| 1 | `/runtime/events` |
| 1 | `/runtime/competencies` |
| 1 | `/runtime/communications` |
| 1 | `/health` |
| 1 | `/governance/evaluate` |
| 1 | `/auth/login` |
| 1 | `/audit/chain` |

---

# 3. Erste Bewertung

Die größte verbleibende Inline-Familie ist `/runtime/defense`.

Bereits ausgelagerte Bereiche wie `/health`, `/auth/login`, `/runtime/events`, `/runtime/objects` und `/audit/chain` sind in der Route-Family-Map weiterhin sichtbar, weil der Scan alle `if (req.method === ...)`-Stellen zählt.

Daher ist vor jeder Refactoring-Entscheidung zusätzlich zu prüfen:

- Ist die Route noch aktiv inline?
- Wird sie bereits an einen ausgelagerten Handler delegiert?
- Existiert eine doppelte oder historische Route?
- Ist das Verhalten durch einen Test abgesichert?

---

# 4. Refactoring-Priorität

Vorläufige Priorisierung:

| Priorität | Bereich | Begründung |
|---|---|---|
| P1 | `/runtime/defense` | größte Familie, sicherheitsnah |
| P2 | `/runtime/facts` | Wissens-/Trust-nah |
| P3 | `/runtime/learning` | Evolution-nah |
| P4 | `/runtime/dashboard` | Sicht-/Monitoring-Ebene |
| P5 | Einzelrouten | nur nach Funktionsprüfung |

---

# 5. Engineering-Regel

Keine Route darf verschoben werden, bevor folgende Punkte geprüft wurden:

1. Aktueller Codeblock lokalisiert
2. Vorher-/Nachher-Verhalten beschrieben
3. Abhängige Datenbanktabellen identifiziert
4. Test oder manueller Reality-Check definiert
5. Rollback-Pfad dokumentiert
6. Funktionale Änderung ausgeschlossen oder ausdrücklich freigegeben

---

# 6. Empfehlung

Nächster Schritt ist kein Refactoring.

Nächster Schritt ist eine Detailinventur der größten Familie:

`/runtime/defense`

Ziel:

- alle Defense-Routen lokalisieren
- Aufgabenbeschreibung je Route erfassen
- Datenbankabhängigkeiten erfassen
- mögliche Modulgrenze bestimmen
- keine Codeänderung durchführen
