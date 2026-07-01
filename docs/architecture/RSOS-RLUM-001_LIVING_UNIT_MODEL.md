---
document_id: RSOS-RLUM-001
title: RSOS Living Unit Model
status: PROPOSED
classification: Architecture / Model
change_scope: Documentation Only
repository_state: Repository Freeze
depends_on: [RSOS-GENESIS, RSOS-ARCH-005]
---

# Zweck

Dieses Dokument definiert das Living Unit Model als logisches Grundmodell für alle Einheiten innerhalb von RSOS.

Es beschreibt keine Datenbankstruktur und keine Implementierung.

## Grundsatz

Alles innerhalb von RSOS wird als Einheit betrachtet.

Eine Einheit kann ein Mensch, eine Organisation, ein Dokument, ein Fahrzeug, ein Prozess, ein Core, ein Service, ein Tenant oder ein technisches Objekt sein.

## Basiseigenschaften einer Einheit

Eine Einheit besitzt mindestens:

- Identity
- Boundary
- Space
- Time
- State
- Relations
- Capabilities
- Interfaces
- Trust
- Evidence
- History
- Reality
- Evolution

## Abgrenzung

RLUM ersetzt keine physische Speicherung.

Relationale Datenbanken, Dateien, APIs und Repositories bleiben mögliche Trägermedien.

RLUM definiert ausschließlich das logische Einheitenmodell.

## Engineering-Regel

Jede spätere Implementierung muss nachweisen, welche RLUM-Eigenschaften sie abbildet und welche bewusst außerhalb ihres Scopes liegen.
