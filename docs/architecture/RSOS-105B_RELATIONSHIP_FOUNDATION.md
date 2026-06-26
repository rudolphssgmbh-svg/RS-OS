# RSOS-105B Relationship Foundation

Status: Draft
Datum: 2026-06-26

## Zweck

RSOS beschreibt nicht nur Elemente, sondern auch Beziehungen zwischen Elementen.

Eine Beziehung ist selbst nachvollziehbar, pruefbar und auditierbar.

## Grundsatz

Kein Element steht isoliert.
Jedes relevante Element soll durch Beziehungen in den RSOS-Kontext eingebunden werden.

## Minimalstruktur

Eine Relationship besitzt mindestens:

- relationship_id
- source_element_id
- target_element_id
- relationship_type
- status
- tenant_id
- source_module
- created_at
- updated_at

## Beziehungstypen

Beispiele:

- observes
- describes
- interprets
- proposes_change
- modifies
- verifies
- approves
- rejects
- executes
- proves
- records
- learns_from
- recovers
- depends_on
- belongs_to

## Beispiele

Observation observes Reality.

Evidence proves Observation.

Verification verifies Evidence.

Governance approves Change.

Change modifies Element.

Audit records Execution.

Learning learns_from Audit.

Recovery recovers Element.

## Regel

Eine Beziehung darf nicht nur technisch existieren.
Sie muss fachlich benennbar sein.

## Bedeutung

Mit Relationships wird RSOS zu einem Graphen aus Elementen und nachvollziehbaren Beziehungen.

Dadurch kann RSOS pruefen:

- Welche Elemente sind verbunden?
- Welche Nachweise fehlen?
- Welche Freigaben fehlen?
- Welche Veraenderungen betreffen ein Element?
- Welche Recovery-Pfade existieren?
