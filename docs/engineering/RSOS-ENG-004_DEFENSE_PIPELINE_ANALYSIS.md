---
document_id: RSOS-ENG-004
title: Defense Pipeline Analysis
status: PROPOSED
classification: Engineering / Runtime Pipeline Analysis
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ENG-003]
---

# Zweck

Dieses Dokument analysiert die Funktion `executeDefensePipeline` im realen `runtime-api/server.js`.

Es führt keine Codeänderungen durch.

---

# 1. Reality-Befund

Der echte Repository-Scan hat ergeben:

- Funktionsstart: Zeile 31
- Signatur: `executeDefensePipeline(ingress_id)`
- Aufruf aus `POST /runtime/defense/ingress`: Zeile 14835

Nicht übernehmen:

- simulierte Signatur `executeDefensePipeline(ingressContext, defenseRules)`
- simulierte Startzeile 412
- simulierte Hilfsfunktionen ohne Repository-Nachweis

---

# 2. Beobachtete Pipeline-Aufgaben

Die Funktion übernimmt im realen Code mindestens:

1. Laden des Ingress aus `runtime_ingress_events`
2. Bewertung von `risk_score` und `confidence_score`
3. Ableitung von `defense_decision`
4. Aktualisierung des Ingress-Events
5. Erzeugung einer Shadow Validation
6. Optionale Quarantine-Erzeugung
7. Aktualisierung von `runtime_defense_state`
8. Schreiben eines Defense-Events
9. Rückgabe des Pipeline-Ergebnisses

---

# 3. Beobachtete Tabellen

- `runtime_ingress_events`
- `runtime_shadow_validations`
- `runtime_quarantine_queue`
- `runtime_defense_state`

---

# 4. Vorläufige Modulgrenze

Die Pipeline ist ein fachlicher Orchestrator.

Mögliche spätere Modulgrenze:

`runtime-api/routes/defense/pipeline-service.js`

oder granular:

- risk evaluation
- ingress update
- shadow validation
- quarantine handling
- defense state update
- event logging

Die Entscheidung ist noch offen.

---

# 5. Engineering-Regel

Kein Refactoring ohne vorherige Tests für:

1. allow
2. shadow_validate
3. quarantine
4. fehlende ingress_id
5. Tenant-Isolation
6. Event-Schreibung
7. Defense-State-Update

---

# 6. Empfehlung

Nächster Schritt ist die Erstellung eines fachlichen Flow-Dokuments nur auf Basis des realen Codes:

`RSOS-FLOW-001_DEFENSE_PIPELINE_FLOW.md`

Das Flow-Dokument darf keine simulierten Funktionen oder nicht verifizierten Signaturen enthalten.
