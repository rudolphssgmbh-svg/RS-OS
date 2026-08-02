# RSOS-DPROF-001 – Dimension Profile Contract

## Dokumentstatus

| Feld | Wert |
|---|---|
| Dokument-ID | RSOS-DPROF-001 |
| Status | FOUNDATION_DRAFT |
| Zweck | Kontextabhängige Aktivierung von Dimensionen |
| Runtime-Wirkung | Keine |

## 1. Zweck

Ein Dimensionsprofil bestimmt, welche Foundation- und
Erweiterungsdimensionen für eine bestimmte Einheitenklasse, Domäne oder
Aufgabe verpflichtend aktiv sind.

Jedes Profil enthält immer sämtliche fünfzehn Foundation-Dimensionen.

## 2. Profilstruktur

Ein Profil besitzt mindestens:

- profile_id;
- profile_name;
- entity_class;
- foundation_version;
- extension_dimensions;
- mandatory_dimensions;
- optional_dimensions;
- prohibited_dimensions;
- responsible_roles;
- validation_rules;
- review_interval;
- audit_class;
- effective_from;
- supersedes;
- status.

## 3. Beispielprofile

### RSOS-DPROF-DOCUMENT

Foundation-Kern plus:

- Vertrauen;
- Unsicherheit;
- Reproduzierbarkeit;
- Alterung.

### RSOS-DPROF-COMPETENCE

Foundation-Kern plus:

- Vertrauen;
- Unsicherheit;
- Aktualität;
- Alterung;
- Reproduzierbarkeit;
- Regenerationsfähigkeit.

### RSOS-DPROF-MACHINE

Foundation-Kern plus:

- Ressourcen und Energie;
- Reibung;
- Risiko;
- Resilienz;
- Entropie;
- Kompatibilität;
- Umweltabhängigkeit.

### RSOS-DPROF-AI-CORE

Foundation-Kern plus:

- Vertrauen;
- Unsicherheit;
- Ressourcen;
- Risiko;
- Adaptivität;
- Resilienz;
- Entropie;
- Kritikalität.

### RSOS-DPROF-WABENSTOCK

Foundation-Kern plus:

- Kapazität;
- Beziehungen;
- Verkehr;
- Skalierbarkeit;
- Resonanz;
- Resilienz;
- Umweltabhängigkeit.

## 4. Profilregeln

1. Ein Profil darf Foundation-Dimensionen nicht entfernen.
2. Ein Profil darf nur registrierte Erweiterungsdimensionen aktivieren.
3. Profiländerungen erzeugen eine neue Version.
4. Bestehende Einheiten werden nicht stillschweigend migriert.
5. Jede Migration benötigt eine Kompatibilitäts- und Auditprüfung.
6. Fehlende Pflichtdimensionen führen zu INCOMPLETE oder FAIL_CLOSED.
7. Unbekannte Werte bleiben UNKNOWN.
8. Domänenspezifische Profile dürfen strengere Regeln definieren.
9. Profile erzeugen keine operative Autorität.
10. RAR bestimmt die zulässige Verwendung eines Profils.
