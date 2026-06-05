# RS OS Customer / Tenant Model V1

## Owner

Rudolph Services & Schulungen GmbH

owner_id:

owner-rudolph

## Technical Tenant

tenant-rudolph

Der Tenant ist die technische Sicherheits- und Governance-Grenze.

## Business Customers

### customer-bibu-rudolph

Domain: accounting  
Website: www.bibu-rudolph.de  
Geschäftsbetrieb: Buchhaltungsservice

### customer-alali24

Domain: transport  
Website: www.alali24.de  
Geschäftsbetrieb: Transportunternehmen

### customer-psgarage-tuebingen

Domain: automotive  
Website: www.psgarage-tuebingen.de  
Geschäftsbetrieb: KFZ Handel, KFZ Service, Werkstatt

## Architekturregel

owner_id
→ tenant_id
→ customer_id
→ runtime_objects
→ workflow_instances
→ runtime_events

## Sicherheitsregel

tenant_id bestimmt Isolation, Governance und Berechtigungen.

customer_id bestimmt Geschäftsbetrieb, Prozesse, Workflows und Reporting.

## Status

Stand: Mai 2026

Noch keine Datenbankmigration.
Dieses Dokument definiert zuerst das Zielmodell.
