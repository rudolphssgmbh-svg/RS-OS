# RSOS-201 Ecosystem Isomorphism Charter

Status: Draft
Datum: 2026-06-27

## I. Dualitaet der Artefakte

Jedes Artefakt im RSOS-Oekosystem wird auf zwei getrennten Ebenen verstanden:

1. Technische Ebene

   Diese Ebene akzeptiert und nutzt die etablierte Sprache und Entwurfsmuster der verwendeten Frameworks, zum Beispiel Router, Controller, Middleware, Tabellen, Views oder Services.

2. Systemische Ebene

   Diese Ebene ordnet jedes Artefakt einer eindeutigen Verantwortung der RSOS-Foundation zu, zum Beispiel Observation, Selection, Interaction, Evidence, Verification, Adaptation, Knowledge, Governance oder Response.

Die Sprache der Frameworks wird nicht bekaempft, sondern in die RSOS-Systematik integriert.

## II. Operationale Vorgabe

Technische Klassen, Skripte und Komponenten sollen so geschnitten werden, dass sie genau eine systemische Hauptrolle abbilden.

Ein Artefakt, das mehrere systemische Rollen vermischt, stellt potenziellen Architektur-Drift dar und muss vor einem Refactoring klassifiziert werden.

## III. Geltungsbereich

Diese Charter gilt fuer:

- Runtime API
- Registry Server
- Node Agent
- Dashboards
- Frontend
- Knowledge-Generatoren
- Deployment- und Infrastruktur-Skripte

## IV. Konsequenz

RSOS erzwingt keine dogmatische Umbenennung technischer Konzepte.

RSOS verlangt jedoch, dass jedes technische Artefakt eine nachvollziehbare systemische Rolle besitzt.

