---
document_id: RSOS-ENG-002
title: Defense Route Family Analysis
status: PROPOSED
classification: Engineering / Runtime Route Analysis
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ENG-001, RSOS-ARCH-007]
---

# Zweck

Dieses Dokument analysiert die Route-Familie `/runtime/defense` in `runtime-api/server.js`.

Es führt keine Codeänderungen durch.

Grundsatz:

Erst analysieren, dann Modulgrenzen bestimmen, dann refaktorieren.

---

# 1. Inventurgrundlage

Quelle dieser Analyse ist der Defense Route Family Precheck vom 2026-07-01.

Ergebnis:

- 17 Defense-Routen
- Zeilenbereich ungefähr 14748 bis 17025 in `runtime-api/server.js`
- Keine Runtime-Änderung durchgeführt

---

# 2. Defense-Routen

| Methode | Route | Startzeile | Bereich |
|---|---|---:|---|
| POST | `/runtime/defense/ingress` | 14748 | Ingress |
| GET | `/runtime/defense/ingress` | 15140 | Ingress |
| POST | `/runtime/defense/shadow-validations` | 15167 | Shadow Validation |
| GET | `/runtime/defense/shadow-validations` | 15237 | Shadow Validation |
| POST | `/runtime/defense/quarantine` | 15264 | Quarantine |
| GET | `/runtime/defense/quarantine` | 15326 | Quarantine |
| POST | `/runtime/defense/savepoints` | 15588 | Savepoints |
| GET | `/runtime/defense/savepoints` | 15649 | Savepoints |
| POST | `/runtime/defense/recovery-requests` | 15831 | Recovery |
| GET | `/runtime/defense/recovery-requests` | 15882 | Recovery |
| POST | `/runtime/defense/recovery-verifications` | 16347 | Recovery Verification |
| GET | `/runtime/defense/recovery-verifications` | 16451 | Recovery Verification |
| POST | `/runtime/defense/metrics/recalculate` | 16560 | Metrics |
| GET | `/runtime/defense/metrics` | 16680 | Metrics |
| GET | `/runtime/defense/dashboard` | 16709 | Dashboard |
| GET | `/runtime/defense/state` | 16998 | Defense State |
| POST | `/runtime/defense/state` | 17025 | Defense State |

---

# 3. Vorläufige Modulgrenze

Die Defense-Familie bildet fachlich einen zusammenhängenden Runtime-Schutzbereich.

Möglicher zukünftiger Modulpfad:

`runtime-api/routes/defense/defense-routes.js`

oder granularer:

- `runtime-api/routes/defense/ingress-routes.js`
- `runtime-api/routes/defense/shadow-validation-routes.js`
- `runtime-api/routes/defense/quarantine-routes.js`
- `runtime-api/routes/defense/recovery-routes.js`
- `runtime-api/routes/defense/metrics-routes.js`
- `runtime-api/routes/defense/state-routes.js`

Die Entscheidung ist noch offen.

---

# 4. Beobachtete Abhängigkeiten

Aus dem ersten Codefenster sichtbar:

- `requireRole`
- `readBody`
- `send`
- `db.query`
- `crypto.createHash`
- tenantbezogene Autorisierung über `auth.user.tenant_id`

Weitere Abhängigkeiten müssen vor einem Refactoring blockweise geprüft werden.

---

# 5. Risiko

Defense ist sicherheitsnah.

Refactoring darf nur erfolgen, wenn:

1. Verhalten vorab dokumentiert ist
2. Tabellenabhängigkeiten erfasst sind
3. bestehende Rollenprüfung unverändert bleibt
4. Tenant-Isolation unverändert bleibt
5. manuelle oder automatisierte Reality-Tests definiert sind
6. Rollback-Datei vorhanden ist

---

# 6. Bewertung

Die Route-Familie `/runtime/defense` ist ein geeigneter Kandidat für spätere Modularisierung.

Aufgrund der sicherheitsnahen Funktion darf aber kein direkter Codeeingriff erfolgen.

Zuerst muss eine Detailinventur je Unterbereich erstellt werden.

Empfohlene Reihenfolge:

1. Ingress
2. Shadow Validations
3. Quarantine
4. Savepoints
5. Recovery Requests
6. Recovery Verifications
7. Metrics
8. Dashboard
9. State

---

# 7. Nächster Schritt

Nächster Schritt ist eine Detailinventur des Bereichs:

`/runtime/defense/ingress`

Ziel:

- vollständigen Codeblock erfassen
- Datenbanktabellen identifizieren
- Rollen prüfen
- Rückgabestruktur dokumentieren
- Test-/Reality-Check definieren
- keine Codeänderung durchführen
