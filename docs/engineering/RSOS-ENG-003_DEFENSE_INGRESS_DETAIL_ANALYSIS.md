---
document_id: RSOS-ENG-003
title: Defense Ingress Detail Analysis
status: PROPOSED
classification: Engineering / Runtime Route Detail Analysis
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ENG-002]
---

# Zweck

Dieses Dokument analysiert die Defense-Ingress-Routen in `runtime-api/server.js`.

Es führt keine Codeänderungen durch.

---

# 1. Inventurgrundlage

Quelle ist der Defense Ingress Detail Precheck vom 2026-07-01.

Ergebnis:

- POST `/runtime/defense/ingress`: 392 Zeilen
- GET `/runtime/defense/ingress`: 27 Zeilen
- Keine Runtime-Änderung durchgeführt

---

# 2. Routen

| Methode | Route | Funktion |
|---|---|---|
| POST | `/runtime/defense/ingress` | Ingress erfassen, klassifizieren, Pipeline ausführen, Folgeobjekte erzeugen |
| GET | `/runtime/defense/ingress` | Letzte Ingress-Events des Tenants lesen |

---

# 3. Beobachtete Tabellen

Im Ingress-Bereich wurden folgende Runtime-Tabellen referenziert:

- `runtime_ingress_events`
- `runtime_observations`
- `runtime_evidence`
- `runtime_assumptions`
- `runtime_hypotheses`
- `runtime_verifications`
- `runtime_verification_cycles`

Zusätzlich erscheinen Rollenbezüge wie `runtime_admin`.

---

# 4. Beobachtete Helper und Abhängigkeiten

- `requireRole`
- `readBody`
- `send`
- `db.query`
- `crypto.createHash`
- `executeDefensePipeline`
- `writeEvent`

---

# 5. Vorläufige Bewertung

Der POST-Ingress ist kein einfacher Routenhandler.

Er kombiniert mehrere Verantwortlichkeiten:

1. Authentifizierung und Rollenprüfung
2. Body Parsing
3. Payload Hashing
4. Ingress-Persistenz
5. Audit-/Event-Schreibung
6. Ausführung der Defense Pipeline
7. Refresh des Ingress-Zustands
8. Brückenbildung in Observation/Evidence
9. mögliche weitere Knowledge-/Verification-Folgeobjekte

Damit ist dieser Bereich ein Kandidat für spätere Aufteilung in:

- Route Handler
- Ingress Service
- Defense Pipeline Service
- Signal Bridge Service
- Evidence Bridge Service

---

# 6. Risiko

Ein direktes Refactoring ist derzeit nicht freigegeben.

Risiken:

- sicherheitsnaher Bereich
- Tenant-Isolation
- mehrere Datenbanktabellen
- Seiteneffekte durch Event- und Evidence-Schreibung
- Pipeline-Abhängigkeit
- Knowledge-/Verification-Folgeketten

---

# 7. Engineering-Regel

Vor einer Auslagerung müssen folgende Punkte vollständig dokumentiert sein:

1. vollständige Eingabestruktur
2. vollständige Ausgabestruktur
3. alle Tabellenzugriffe
4. alle Seiteneffekte
5. genaue Rolle von `executeDefensePipeline`
6. Testfall für erlaubten Ingress
7. Testfall für verweigerten Zugriff
8. Rollback-Datei

---

# 8. Empfehlung

Nächster Schritt ist keine Auslagerung.

Nächster Schritt ist die Detailanalyse von `executeDefensePipeline`.

Diese Funktion entscheidet, ob der Ingress nur gespeichert oder tatsächlich weiterverarbeitet wird.
