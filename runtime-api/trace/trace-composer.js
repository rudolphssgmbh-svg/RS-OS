const { getTraceObject } = require("./providers/object-provider");
const { getTraceRelations } = require("./providers/relation-provider");
const { getTraceRecommendations } = require("./providers/recommendation-provider");
const { getTraceOrchestrations } = require("./providers/orchestration-provider");
const { getTraceTrainingPlans, getTraceLearningEvidence } = require("./providers/learning-provider");
const { getTraceExecution } = require("./providers/execution-provider");
const { getTraceGovernance } = require("./providers/governance-provider");
const { getTraceRisks } = require("./providers/risk-provider");
const { getTraceAudit } = require("./providers/audit-provider");

async function composeFullTrace({
  db,
  tenant_id,
  object_id
}) {
  const objectResult = await getTraceObject({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  const relationsResult = await getTraceRelations({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  const recommendationsResult = await getTraceRecommendations({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  const orchestrationsResult = await getTraceOrchestrations({
    db,
    tenant_id,
    object_id
  });

  const trainingPlansResult = await getTraceTrainingPlans({
    db,
    tenant_id,
    object_id
  });

  const learningEvidenceResult = await getTraceLearningEvidence({
    db,
    tenant_id,
    object_id
  });

  const executionJobsResult = await getTraceExecution({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  const governanceResult = await getTraceGovernance({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  const risksResult = await getTraceRisks({
    db,
    tenant_id,
    object_id
  });

  const auditResult = await getTraceAudit({
    db,
    tenant_id,
    object_id,
    mode: "full"
  });

  return {
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
  };
}

module.exports = {
  composeFullTrace
};
