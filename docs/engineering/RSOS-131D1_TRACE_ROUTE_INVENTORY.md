# RSOS-131D1 Trace Route Inventory

Status: Draft
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Zweck

Dieses Dokument startet die Inventur der Trace-Routen im manuellen HTTP-Dispatcher.

Es veraendert keinen Code.

## Anlass

Die erwartete Route GET /runtime/object/:id existiert im aktuellen server.js nicht.

Stattdessen existieren Trace-Aggregationsrouten:

- GET /runtime/trace/:object_id/full
- GET /runtime/trace/:object_id

Diese Routen sind keine einfachen Object-Detail-Routen, sondern Kompositionsrouten ueber mehrere Runtime-Domaenen.

## Grundsatz

Observation
-> Classification
-> Transformation
-> Verification

Keine Trace-Extraktion ohne vorherige Inventur und Klassifikation.

## Bekannte Datenquellen aus /runtime/trace/:object_id/full

- runtime_objects
- runtime_relations
- runtime_recommendations
- runtime_orchestrations
- runtime_training_plans
- runtime_learning_evidence
- runtime_execution_jobs
- runtime_governance_decisions
- runtime_risks
- runtime_events

## Vorlaeufige Klassifikation

| Teilbereich | Primaere Rolle |
| --- | --- |
| runtime_objects | Object Snapshot |
| runtime_relations | Interaction / Graph |
| runtime_recommendations | Adaptation |
| runtime_orchestrations | Interaction |
| runtime_training_plans | Learning / Adaptation |
| runtime_learning_evidence | Knowledge / Evidence |
| runtime_execution_jobs | Execution |
| runtime_governance_decisions | Governance |
| runtime_risks | Risk / Governance |
| runtime_events | Evidence / Audit |

## Entscheidung

Trace wird nicht als naechste kleine Route direkt extrahiert.

Trace benoetigt zuerst eine eigene Klassifikation und spaeter ggf. Teil-Provider.

## Naechster Schritt

RSOS-131D2 Trace Classification.


## Beobachteter Trace Full Block

```text

    if (req.method === "GET" && path.startsWith("/runtime/trace/") && path.endsWith("/full")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const object_id = decodeURIComponent(
        path
          .replace("/runtime/trace/", "")
          .replace("/full", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const objectResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = $2
        LIMIT 1
      `, [
        tenant_id,
        object_id
      ]);

      const relationsResult = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = $2
            OR target_object_id = $2
          )
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const recommendationsResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const orchestrationsResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND source_object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const trainingPlansResult = await db.query(`
        SELECT *
        FROM runtime_training_plans
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const learningEvidenceResult = await db.query(`
        SELECT *
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const executionJobsResult = await db.query(`
        SELECT *
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const governanceResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const risksResult = await db.query(`
        SELECT *
        FROM runtime_risks
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const auditResult = await db.query(`
        SELECT *
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        tenant_id,
        object_id
      ]);

      return send(res, 200, {
        tenant_id,
        object_id,
        exists_in_runtime_objects: objectResult.rows.length > 0,
        runtime_object: objectResult.rows[0] || null,
        relations: {
          count: relationsResult.rows.length,
          items: relationsResult.rows
        },
        recommendations: {
          count: recommendationsResult.rows.length,
          open_count: recommendationsResult.rows.filter(r => r.status === "open").length,
          approved_count: recommendationsResult.rows.filter(r => r.status === "approved").length,
          executed_count: recommendationsResult.rows.filter(r => r.status === "executed").length,
          rejected_count: recommendationsResult.rows.filter(r => r.status === "rejected").length,
          items: recommendationsResult.rows
        },
        orchestrations: {
          count: orchestrationsResult.rows.length,
          pending_count: orchestrationsResult.rows.filter(o => o.status === "pending").length,
          approved_count: orchestrationsResult.rows.filter(o => o.status === "approved").length,
          executed_count: orchestrationsResult.rows.filter(o => o.status === "executed").length,
          completed_count: orchestrationsResult.rows.filter(o => o.status === "completed").length,
          items: orchestrationsResult.rows
        },
        training_plans: {
          count: trainingPlansResult.rows.length,
          planned_count: trainingPlansResult.rows.filter(t => t.status === "planned").length,
          completed_count: trainingPlansResult.rows.filter(t => t.status === "completed").length,
          items: trainingPlansResult.rows
        },
        learning_evidence: {
          count: learningEvidenceResult.rows.length,
          positive_count: learningEvidenceResult.rows.filter(e => e.effectiveness === "positive").length,
          neutral_count: learningEvidenceResult.rows.filter(e => e.effectiveness === "neutral").length,
          negative_count: learningEvidenceResult.rows.filter(e => e.effectiveness === "negative").length,
          items: learningEvidenceResult.rows
        },
        execution_jobs: {
          count: executionJobsResult.rows.length,
          pending_count: executionJobsResult.rows.filter(j => j.status === "pending").length,
          running_count: executionJobsResult.rows.filter(j => j.status === "running").length,
          completed_count: executionJobsResult.rows.filter(j => j.status === "completed").length,
          failed_count: executionJobsResult.rows.filter(j =>
            j.status === "failed" || j.status === "failed_permanent"
          ).length,
          items: executionJobsResult.rows
        },
        governance: {
          count: governanceResult.rows.length,
          items: governanceResult.rows
        },
        risks: {
          count: risksResult.rows.length,
          max_risk_score: risksResult.rows.reduce(
            (max, risk) => Math.max(max, Number(risk.risk_score || 0)),
            0
          ),
          acute_count: risksResult.rows.filter(r => r.risk_state === "acute").length,
          items: risksResult.rows
        },
        audit: {
          count: auditResult.rows.length,
          items: auditResult.rows
        }
      });
    }

    // GET UNIFIED OBJECT TRACE

    if (req.method === "GET" && path.startsWith("/runtime/trace/")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/trace/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const objectResult = await db.query(`
        SELECT object_id, runtime_type, state, priority, risk_score, created_at
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = $2
        LIMIT 1
      `, [auth.user.tenant_id, object_id]);

      const auditResult = await db.query(`
        SELECT COUNT(*)::int AS event_count
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
      `, [auth.user.tenant_id, object_id]);

      const governanceResult = await db.query(`
        SELECT governance_status, created_at
```
