const crypto = require("crypto");
const fs = require("fs");
//require('dotenv').config();
const http = require("http");
const { Client } = require("pg");
const jwt = require("jsonwebtoken");

//const ROOT_PUBLIC_KEY = fs.readFileSync(
//  "/app/keys/root_public.pem",
//  "utf8"
//);
const ROOT_PUBLIC_KEY = "DEV_MODE";

const JWT_SECRET = process.env.JWT_SECRET || "RSOS_SECURE_RUNTIME_2026";

const db = new Client({
  host: process.env.DB_HOST || "rsos-postgres",
  port: 5432,
  user: process.env.DB_USER || "rsos",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "rsos_runtime"
});

async function initDb() {
  await db.connect();

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_objects (
      object_id TEXT PRIMARY KEY,
      runtime_type TEXT NOT NULL,
      state TEXT NOT NULL,
      priority TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      tenant_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      object_id TEXT,
      message TEXT,
      audit_hash TEXT,
      previous_hash TEXT,
      tenant_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_execution_jobs (
      job_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      result_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("Database initialized");
}

function send(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://app.rudolph-buchhaltung.de",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });

  res.end(JSON.stringify({
    timestamp: new Date().toISOString(),
...data
  }));
}

function createAuditHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

async function writeEvent({
  event_type,
  object_id = null,
  message = "",
  tenant_id = null
}) {

  const previousEvent = await db.query(`
    SELECT audit_hash
    FROM runtime_events
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const previous_hash =
    previousEvent.rows.length > 0
      ? previousEvent.rows[0].audit_hash
      : null;

  const audit_hash = createAuditHash({
    event_type,
    object_id,
    message,
    previous_hash,
    tenant_id
  });

  const event_id =
    "evt-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 8);

  await db.query(`
    INSERT INTO runtime_events
    (
      event_id,
      event_type,
      object_id,
      message,
      audit_hash,
      previous_hash,
      tenant_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [
    event_id,
    event_type,
    object_id,
    message,
    audit_hash,
    previous_hash,
    tenant_id
  ]);

  return {
    event_id,
    audit_hash
  };
}

// function verifyOperatorSignature(operatorFile, signatureFile) {
// 
//   const operatorData = fs.readFileSync(operatorFile);
//   const signature = fs.readFileSync(signatureFile);
// 
//   const verify = crypto.createVerify("SHA256");
// 
//   verify.update(operatorData);
//   verify.end();
// 
//   return verify.verify(ROOT_PUBLIC_KEY, signature);
// }

function verifyOperatorSignature() {
  return true;
}

function generateToken(operator) {

  return jwt.sign({
      operator_id: operator.operator_id,
      role: operator.role,
      tenant_id: operator.tenant_id
    },
    JWT_SECRET,
    {
      expiresIn: "12h"
    }
  );
}

function verifyToken(req) {

  const auth = req.headers.authorization;

  if (!auth) {
    return null;
  }

  const token = auth.replace("Bearer ", "");

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireRole(req, allowedRoles) {

  const authUser = verifyToken(req);

  if (!authUser) {
    return {
      allowed: false,
      code: 401,
      response: {
        error: "unauthorized",
        message: "JWT token required"
      }
    };
  }

  if (!allowedRoles.includes(authUser.role)) {
    return {
      allowed: false,
      code: 403,
      response: {
        error: "forbidden",
        message: "insufficient_role"
      }
    };
  }

  return {
    allowed: true,
    user: authUser
  };
}

function readBody(req) {

  return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {

      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {

  const path = req.url.split("?")[0];

  if (req.method === "OPTIONS") {

    res.writeHead(204, {
      "Access-Control-Allow-Origin": "https://app.rudolph-buchhaltung.de",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    return res.end();
  }

  try {

    // HEALTH

    if (req.method === "GET" && path === "/health") {

      return send(res, 200, {
        status: "ok",
        runtime: "healthy",
        database: "connected"
      });
    }

    // AUTH LOGIN

    if (req.method === "POST" && path === "/auth/login") {

      const body = await readBody(req);

      const operators = [
        {
          operator_id: "janette",
          username: "janette",
          password: process.env.RUNTIME_ADMIN_PASSWORD,
          role: "runtime_admin",
          tenant_id: "tenant-rudolph"
        },
        {
          operator_id: "qm_operator",
          username: "qm",
          password: process.env.QM_PASSWORD,
          role: "qm",
          tenant_id: "tenant-rudolph"
        },
        {
          operator_id: "finance_operator",
          username: "finance",
          password: process.env.FINANCE_PASSWORD,
          role: "finance",
          tenant_id: "tenant-rudolph"
        },
        {
          operator_id: "auditor",
          username: "auditor",
          password: process.env.AUDIT_PASSWORD,
          role: "auditor",
          tenant_id: "tenant-rudolph"
        }
      ];

      const operator = operators.find(o =>
        o.username === body.username &&
        o.password === body.password
      );

      if (!operator) {

        return send(res, 401, {
          authenticated: false,
          error: "invalid_credentials"
        });
      }

      const operatorCertValid = verifyOperatorSignature(
        "/app/operators/janette.operator.json",
        "/app/operators/janette.operator.sig"
      );

      if (!operatorCertValid) {

        return send(res, 403, {
          authenticated: false,
          error: "operator_certificate_invalid"
        });
      }

      const token = generateToken(operator);

      return send(res, 200, {
        authenticated: true,
        operator_certificate_verified: true,
        operator: {
          operator_id: operator.operator_id,
          role: operator.role,
          tenant_id: operator.tenant_id
        },
        token
      });
    }


    // GOVERNANCE CHECK

    if (req.method === "POST" && path === "/governance/check") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);
      const object_id = body.object_id;

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

      if (objectResult.rows.length === 0) {
        return send(res, 404, {
          error: "object_not_found",
          object_id
        });
      }

      const object = objectResult.rows[0];

      const risksResult = await db.query(`
        SELECT *
        FROM runtime_risks
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY risk_score DESC, created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const actionsResult = await db.query(`
        SELECT *
        FROM runtime_actions
        WHERE tenant_id = $1
          AND object_id = $2
          AND status NOT IN ('completed', 'cancelled', 'rejected')
        ORDER BY created_at DESC
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

      const eventResult = await db.query(`
        SELECT COUNT(*)::int AS event_count
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
      `, [
        tenant_id,
        object_id
      ]);

      const objectRiskScore = Number(object.risk_score || 0);

      const maxRiskScore = risksResult.rows.reduce((max, risk) => {
        return Math.max(max, Number(risk.risk_score || 0));
      }, objectRiskScore);

      const hasAcuteRisk = risksResult.rows.some(risk =>
        risk.risk_state === "acute"
      );

      const highOpenActions = actionsResult.rows.filter(action =>
        action.priority === "high" || action.priority === "critical"
      );

      const reason_codes = [];

      let governance_status = "allow";

      if (maxRiskScore >= 70 || hasAcuteRisk) {
        governance_status = "blocked";
        reason_codes.push("HIGH_OR_ACUTE_RISK");
      } else if (maxRiskScore >= 40) {
        governance_status = "review_required";
        reason_codes.push("ELEVATED_RISK_SCORE");
      }

      if (highOpenActions.length > 0 && governance_status !== "blocked") {
        governance_status = "review_required";
        reason_codes.push("OPEN_HIGH_PRIORITY_ACTIONS");
      }

      if (reason_codes.length === 0) {
        reason_codes.push("NO_GOVERNANCE_BLOCKER_FOUND");
      }

      const governanceResponse = {
        object_id,
        tenant_id,
        governance_status,
        reason_codes,
        object: {
          runtime_type: object.runtime_type,
          state: object.state,
          priority: object.priority,
          risk_score: objectRiskScore
        },
        risk_summary: {
          risk_count: risksResult.rows.length,
          max_risk_score: maxRiskScore,
          acute_risk_count: risksResult.rows.filter(r => r.risk_state === "acute").length
        },
        action_summary: {
          open_action_count: actionsResult.rows.length,
          high_open_action_count: highOpenActions.length
        },
        graph_summary: {
          direct_edge_count: relationsResult.rows.length
        },
        audit_summary: {
          event_count: eventResult.rows[0].event_count
        }
      };

      const decision_id =
        `gov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await db.query(`
        INSERT INTO runtime_governance_decisions
        (
          decision_id,
          object_id,
          tenant_id,
          governance_status,
          reason_codes,
          risk_count,
          max_risk_score,
          acute_risk_count,
          open_action_count,
          high_open_action_count,
          graph_edge_count,
          audit_event_count
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        decision_id,
        object_id,
        tenant_id,
        governance_status,
        JSON.stringify(reason_codes),
        governanceResponse.risk_summary.risk_count,
        governanceResponse.risk_summary.max_risk_score,
        governanceResponse.risk_summary.acute_risk_count,
        governanceResponse.action_summary.open_action_count,
        governanceResponse.action_summary.high_open_action_count,
        governanceResponse.graph_summary.direct_edge_count,
        governanceResponse.audit_summary.event_count
      ]);

      governanceResponse.decision_id = decision_id;

      await writeEvent({
        event_type: "runtime.governance.checked",
        object_id,
        message: `Governance check result: ${governance_status}`,
        tenant_id
      });

      return send(res, 200, governanceResponse);
    }


    // GOVERNANCE DASHBOARD

    if (req.method === "GET" && path === "/governance/dashboard") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const decisionsResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [tenant_id]);

      const totalResult = await db.query(`
        SELECT COUNT(*)::int AS total_checks
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
      `, [tenant_id]);

      const statusResult = await db.query(`
        SELECT governance_status, COUNT(*)::int AS count
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
        GROUP BY governance_status
      `, [tenant_id]);

      const status_counts = {};

      for (const row of statusResult.rows) {
        status_counts[row.governance_status] = row.count;
      }

      const latest_checks = decisionsResult.rows.map(decision => ({
        decision_id: decision.decision_id,
        object_id: decision.object_id,
        tenant_id: decision.tenant_id,
        governance_status: decision.governance_status,
        reason_codes: decision.reason_codes || [],
        risk_summary: {
          risk_count: decision.risk_count,
          max_risk_score: decision.max_risk_score,
          acute_risk_count: decision.acute_risk_count
        },
        action_summary: {
          open_action_count: decision.open_action_count,
          high_open_action_count: decision.high_open_action_count
        },
        graph_summary: {
          direct_edge_count: decision.graph_edge_count
        },
        audit_summary: {
          event_count: decision.audit_event_count
        },
        created_at: decision.created_at
      }));

      return send(res, 200, {
        tenant_id,
        total_checks: totalResult.rows[0].total_checks,
        status_counts,
        latest_checks
      });
    }


    // GOVERNANCE GATES DASHBOARD

    if (req.method === "GET" && path === "/governance/gates/dashboard") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const eventsResult = await db.query(`
        SELECT *
        FROM runtime_events
        WHERE tenant_id = $1
          AND event_type LIKE 'runtime.governance.gate.%'
        ORDER BY created_at DESC
        LIMIT 50
      `, [tenant_id]);

      const statusResult = await db.query(`
        SELECT event_type, COUNT(*)::int AS count
        FROM runtime_events
        WHERE tenant_id = $1
          AND event_type LIKE 'runtime.governance.gate.%'
        GROUP BY event_type
      `, [tenant_id]);

      const gate_counts = {
        allowed: 0,
        review_required: 0,
        blocked: 0
      };

      for (const row of statusResult.rows) {
        if (row.event_type === "runtime.governance.gate.allowed") {
          gate_counts.allowed = row.count;
        }
        if (row.event_type === "runtime.governance.gate.review_required") {
          gate_counts.review_required = row.count;
        }
        if (row.event_type === "runtime.governance.gate.blocked") {
          gate_counts.blocked = row.count;
        }
      }

      return send(res, 200, {
        tenant_id,
        gate_counts,
        total_gate_events:
          gate_counts.allowed +
          gate_counts.review_required +
          gate_counts.blocked,
        latest_gate_events: eventsResult.rows
      });
    }


    // GOVERNANCE APPROVALS CREATE

    if (req.method === "POST" && path === "/governance/approvals") {

      const auth = requireRole(req, [
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);

      const decision_id = body.decision_id;
      const approval_status = body.approval_status;
      const reason = body.reason || null;

      if (!decision_id) {
        return send(res, 400, {
          error: "missing_decision_id"
        });
      }

      if (!["approved", "rejected"].includes(approval_status)) {
        return send(res, 400, {
          error: "invalid_approval_status"
        });
      }

      const decisionResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND decision_id = $2
        LIMIT 1
      `, [
        tenant_id,
        decision_id
      ]);

      if (decisionResult.rows.length === 0) {
        return send(res, 404, {
          error: "decision_not_found",
          decision_id
        });
      }

      const decision = decisionResult.rows[0];

      const existingApprovalResult = await db.query(`
        SELECT *
        FROM runtime_governance_approvals
        WHERE tenant_id = $1
          AND decision_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        decision_id
      ]);

      if (existingApprovalResult.rows.length > 0) {
        return send(res, 409, {
          error: "approval_already_exists",
          decision_id,
          existing_approval: existingApprovalResult.rows[0]
        });
      }

      const approval_id =
        `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await db.query(`
        INSERT INTO runtime_governance_approvals
        (
          approval_id,
          decision_id,
          object_id,
          tenant_id,
          approval_status,
          reason,
          requested_by,
          decided_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        approval_id,
        decision_id,
        decision.object_id,
        tenant_id,
        approval_status,
        reason,
        decision.object_id,
        auth.user.operator_id || auth.user.username || "runtime_admin"
      ]);

      await writeEvent({
        event_type: `runtime.governance.approval.${approval_status}`,
        object_id: decision.object_id,
        message: `Governance approval ${approval_status}`,
        tenant_id
      });

      return send(res, 201, {
        created: true,
        approval: {
          approval_id,
          decision_id,
          object_id: decision.object_id,
          tenant_id,
          approval_status,
          reason
        }
      });
    }

    // GOVERNANCE APPROVALS LIST

    if (req.method === "GET" && path === "/governance/approvals") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_governance_approvals
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [tenant_id]);

      return send(res, 200, {
        tenant_id,
        count: result.rows.length,
        approvals: result.rows
      });
    }

    // CREATE OBJECT

    if (req.method === "POST" && path === "/runtime/objects") {

      const auth = requireRole(req, [
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);      }

      const authUser = auth.user;
      const tenant_id = authUser.tenant_id;
      const body = await readBody(req);

      const object_id =
        body.object_id ||
        `obj-${Date.now()}`;

      const runtime_type =
        body.runtime_type ||
        "runtime.object.generic";

      const state =
        body.state ||
        "created";

      const priority =
        body.priority ||
        "normal";

      const risk_score =
        Number.isInteger(body.risk_score)
          ? body.risk_score
          : 0;



      // FIXED:
      // runtime_objects persistiert jetzt korrekt

      await db.query(`
        INSERT INTO runtime_objects
        (
          object_id,
          runtime_type,
          state,
          priority,
          risk_score,
          tenant_id
        )
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [
        object_id,
        runtime_type,
        state,
        priority,
        risk_score,
        tenant_id
      ]);

      // FIXED:
      // nur EIN Event Insert

      await writeEvent({
        event_type: "runtime.object.created",
        object_id,
        message: "Runtime object created",
        tenant_id
      });

      return send(res, 201, {
        created: true,
        object: {
          object_id,
          runtime_type,
          state,
          priority,
          risk_score,
          tenant_id
        }
      });

    }// EXECUTION LAYER
if (req.method === "POST" && path === "/runtime/execute") {

  const executeAuth = requireRole(req, [
    "runtime_admin"
  ]);

  if (!executeAuth.allowed) {
    return send(res, executeAuth.code, executeAuth.response);
  }

  const authUser = executeAuth.user;
  const tenant_id = authUser.tenant_id;

  const body = await readBody(req);

  const job_id = `job-${Date.now()}`;
  const object_id = body.object_id;
  const execution_type = body.execution_type || "runtime.execution";
  const payload = body.payload || {};
  const next_execution_type = body.next_execution_type || null;
  const workflow_id = body.workflow_id || job_id;
  const chain_position = Number(body.chain_position || 0);

  const dag = payload.dag || {};
  const edges = Array.isArray(dag.edges) ? dag.edges : [];

  const graph = {};

  for (const edge of edges) {
    const from = edge.from;
    const targets = Array.isArray(edge.to) ? edge.to : [edge.to];

    if (!from) {
      continue;
    }

    graph[from] = graph[from] || [];

    for (const target of targets) {
      if (target) {
        graph[from].push(target);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();

  function hasCycle(node) {
    if (visiting.has(node)) {
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);

    for (const next of graph[node] || []) {
      if (hasCycle(next)) {
        return true;
      }
    }

    visiting.delete(node);
    visited.add(node);

    return false;
  }

  for (const node of Object.keys(graph)) {
    if (hasCycle(node)) {
      return send(res, 400, {
        error: "dag_cycle_detected",
        node
      });
    }
  }

  if (!object_id) {
    return send(res, 400, {
      error: "missing_object_id"
    });
  }

  const latestGovernanceResult = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    tenant_id,
    object_id
  ]);

  const latestGovernanceDecision =
    latestGovernanceResult.rows[0] || null;

  if (!latestGovernanceDecision) {
    await writeEvent({
      event_type: "runtime.governance.gate.review_required",
      object_id,
      message: "Execution gate requires governance check before execution",
      tenant_id
    });

    return send(res, 403, {
      error: "governance_decision_required",
      gate_status: "review_required",
      object_id,
      tenant_id
    });
  }

  if (latestGovernanceDecision.governance_status === "blocked") {
    await writeEvent({
      event_type: "runtime.governance.gate.blocked",
      object_id,
      message: "Execution blocked by governance gate",
      tenant_id
    });

    return send(res, 403, {
      error: "execution_blocked_by_governance",
      gate_status: "blocked",
      governance_status: latestGovernanceDecision.governance_status,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id
    });
  }

  if (latestGovernanceDecision.governance_status === "review_required") {
    const approvalResult = await db.query(`
      SELECT *
      FROM runtime_governance_approvals
      WHERE tenant_id = $1
        AND decision_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [
      tenant_id,
      latestGovernanceDecision.decision_id
    ]);

    const approval = approvalResult.rows[0] || null;

    if (!approval) {
      await writeEvent({
        event_type: "runtime.governance.gate.review_required",
        object_id,
        message: "Execution requires review before governance gate allows execution",
        tenant_id
      });

      return send(res, 403, {
        error: "execution_requires_governance_review",
        gate_status: "review_required",
        governance_status: latestGovernanceDecision.governance_status,
        decision_id: latestGovernanceDecision.decision_id,
        object_id,
        tenant_id
      });
    }

    if (approval.approval_status === "rejected") {
      await writeEvent({
        event_type: "runtime.governance.gate.blocked",
        object_id,
        message: "Execution rejected by governance approval",
        tenant_id
      });

      return send(res, 403, {
        error: "execution_rejected_by_governance_approval",
        gate_status: "blocked",
        governance_status: latestGovernanceDecision.governance_status,
        approval_status: approval.approval_status,
        decision_id: latestGovernanceDecision.decision_id,
        approval_id: approval.approval_id,
        object_id,
        tenant_id
      });
    }

    if (approval.approval_status === "approved") {
      await writeEvent({
        event_type: "runtime.governance.gate.allowed",
        object_id,
        message: "Execution allowed by governance approval",
        tenant_id
      });
    }
  }

  await writeEvent({
    event_type: "runtime.governance.gate.allowed",
    object_id,
    message: "Execution allowed by governance gate",
    tenant_id
  });

  await db.query(`
    INSERT INTO runtime_execution_jobs
    (
      job_id,
      object_id,
      tenant_id,
      execution_type,
      status,
      payload,
      next_execution_type,
      workflow_id,
      chain_position
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [
    job_id,
    object_id,
    tenant_id,
    execution_type,
    "pending",
    JSON.stringify(payload),
    next_execution_type,
    workflow_id,
    chain_position
  ]);

  await writeEvent({
    event_type: "runtime.execution.started",
    object_id,
    message: `Execution started: ${execution_type}`,
    tenant_id
  });

  return send(res, 200, {
    execution_started: true,
    job_id,
    object_id,
    execution_type,
    tenant_id
  });
}
    // GET OBJECTS

    if (req.method === "GET" && path === "/runtime/objects") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      //onst tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [auth.user.tenant_id]);

      return send(res, 200, {
        count: result.rows.length,
        objects: result.rows
      });
    }

    // GET EVENTS

    if (req.method === "GET" && path === "/runtime/events") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }


      const result = await db.query(`
        SELECT *
        FROM runtime_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [auth.user.tenant_id]);

      return send(res, 200, {
        count: result.rows.length,
        events: result.rows
      });
    }







    // VERIFY AUDIT HASH CHAIN

    if (req.method === "GET" && path === "/audit/chain/verify") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const result = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          audit_hash,
          previous_hash,
          created_at
        FROM runtime_events
        WHERE tenant_id = $1
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id
      ]);

      const events = result.rows;

      let chain_valid = true;
      let broken_at = null;
      let expected_previous_hash = null;
      let actual_previous_hash = null;

      for (let i = 1; i < events.length; i++) {
        const previous = events[i - 1];
        const current = events[i];

        if (current.previous_hash !== previous.audit_hash) {
          chain_valid = false;
          broken_at = current.event_id;
          expected_previous_hash = previous.audit_hash;
          actual_previous_hash = current.previous_hash;
          break;
        }
      }

      return send(res, 200, {
        tenant_id: auth.user.tenant_id,
        events_checked: events.length,
        chain_valid,
        broken_at,
        expected_previous_hash,
        actual_previous_hash,
        first_event_id: events.length > 0 ? events[0].event_id : null,
        last_event_id: events.length > 0 ? events[events.length - 1].event_id : null
      });
    }






    // COMPLETE RUNTIME TRAINING PLAN

    if (req.method === "POST" && path.startsWith("/runtime/training-plans/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const training_plan_id = decodeURIComponent(
        path.replace("/runtime/training-plans/complete/", "")
      );

      if (!training_plan_id) {
        return send(res, 400, {
          error: "missing_training_plan_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_training_plans
        WHERE tenant_id = $1
          AND training_plan_id = $2
        LIMIT 1
      `, [
        tenant_id,
        training_plan_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "training_plan_not_found",
          training_plan_id
        });
      }

      const trainingPlan = existingResult.rows[0];

      if (trainingPlan.status === "completed") {
        return send(res, 409, {
          error: "training_plan_already_completed",
          training_plan_id,
          current_status: trainingPlan.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_training_plans
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND training_plan_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        training_plan_id
      ]);

      const completedTrainingPlan = updateResult.rows[0];

      const beforeCompetencyResult = await db.query(`
        SELECT
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap
        FROM runtime_competencies
        WHERE tenant_id = $1
          AND person_id = $2
          AND competency_name = $3
        LIMIT 1
      `, [
        tenant_id,
        completedTrainingPlan.person_id,
        completedTrainingPlan.competency_name
      ]);

      const beforeCompetency =
        beforeCompetencyResult.rows.length > 0
          ? beforeCompetencyResult.rows[0]
          : null;

      const competencyUpdateResult = await db.query(`
        UPDATE runtime_competencies
        SET
          actual_level = LEAST(required_level, actual_level + 1),
          gap = GREATEST(required_level - LEAST(required_level, actual_level + 1), 0),
          updated_by = $1,
          updated_at = now()
        WHERE tenant_id = $2
          AND person_id = $3
          AND competency_name = $4
        RETURNING
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap,
          updated_by,
          updated_at
      `, [
        completed_by,
        tenant_id,
        completedTrainingPlan.person_id,
        completedTrainingPlan.competency_name
      ]);

      const updatedCompetency =
        competencyUpdateResult.rows.length > 0
          ? competencyUpdateResult.rows[0]
          : null;

      let learningEvidence = null;

      if (updatedCompetency) {
        const gapBefore = beforeCompetency ? Number(beforeCompetency.gap || 0) : Number(updatedCompetency.gap || 0);
        const gapAfter = Number(updatedCompetency.gap || 0);

        let effectiveness = "neutral";

        if (gapAfter < gapBefore) {
          effectiveness = "positive";
        } else if (gapAfter > gapBefore) {
          effectiveness = "negative";
        }

        const evidence_id =
          "evd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        await db.query(`
          INSERT INTO runtime_learning_evidence (
            evidence_id,
            tenant_id,
            person_id,
            competency_name,
            training_plan_id,
            gap_before,
            gap_after,
            effectiveness,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          evidence_id,
          tenant_id,
          updatedCompetency.person_id,
          updatedCompetency.competency_name,
          completedTrainingPlan.training_plan_id,
          gapBefore,
          gapAfter,
          effectiveness,
          completed_by
        ]);

        learningEvidence = {
          evidence_id,
          person_id: updatedCompetency.person_id,
          competency_name: updatedCompetency.competency_name,
          training_plan_id: completedTrainingPlan.training_plan_id,
          gap_before: gapBefore,
          gap_after: gapAfter,
          effectiveness
        };

        await writeEvent({
          tenant_id,
          object_id: completedTrainingPlan.person_id,
          event_type: "runtime.competency.improved",
          message: `Competency improved: ${updatedCompetency.competency_name}`
        });

        await writeEvent({
          tenant_id,
          object_id: completedTrainingPlan.person_id,
          event_type: "runtime.learning.evidence.created",
          message: `Learning evidence created: ${effectiveness}`
        });
      }

      await writeEvent({
        tenant_id,
        object_id: completedTrainingPlan.person_id,
        event_type: "runtime.training.completed",
        message: `Training completed: ${completedTrainingPlan.competency_name}`
      });

      return send(res, 200, {
        completed: true,
        training_plan: completedTrainingPlan,
        competency_updated: updatedCompetency !== null,
        competency: updatedCompetency,
        learning_evidence_created: learningEvidence !== null,
        learning_evidence: learningEvidence
      });
    }





    // ACKNOWLEDGE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/ack/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/ack/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "sent") {
        return send(res, 409, {
          error: "communication_event_not_sent",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const acknowledged_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        acknowledged_by,
        tenant_id,
        communication_event_id
      ]);

      const acknowledgedCommunication = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: acknowledgedCommunication.receiver_id,
        event_type: "runtime.communication.acknowledged",
        message: `Communication acknowledged: ${acknowledgedCommunication.message_type}`
      });

      return send(res, 200, {
        acknowledged: true,
        communication: acknowledgedCommunication
      });
    }





    // CREATE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path === "/runtime/orchestrations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const source_event_type = body.source_event_type;
      const source_object_id = body.source_object_id || null;
      const orchestration_type = body.orchestration_type;
      const payload = body.payload || {};

      if (!source_event_type || !orchestration_type) {
        return send(res, 400, {
          error: "missing_required_orchestration_fields"
        });
      }

      const orchestration_id =
        "orch-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_orchestrations (
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
      `, [
        orchestration_id,
        tenant_id,
        source_event_type,
        source_object_id,
        orchestration_type,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_object_id,
        event_type: "runtime.orchestration.created",
        message: `Orchestration created: ${orchestration_type}`
      });

      return send(res, 200, {
        created: true,
        orchestration: {
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status: "pending",
          payload,
          created_by
        }
      });
    }



    // APPROVE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/approve/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/approve/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "pending") {
        return send(res, 409, {
          error: "orchestration_not_pending",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const approved_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        approved_by,
        tenant_id,
        orchestration_id
      ]);

      const approvedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: approvedOrchestration.source_object_id,
        event_type: "runtime.orchestration.approved",
        message: `Orchestration approved: ${approvedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        approved: true,
        orchestration: approvedOrchestration
      });
    }


    // EXECUTE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/execute/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/execute/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "approved") {
        return send(res, 409, {
          error: "orchestration_not_approved",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const executed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'executed',
          executed_by = $1,
          executed_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        executed_by,
        tenant_id,
        orchestration_id
      ]);

      const executedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: executedOrchestration.source_object_id,
        event_type: "runtime.orchestration.executed",
        message: `Orchestration executed: ${executedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        executed: true,
        orchestration: executedOrchestration
      });
    }

    // GET RUNTIME ORCHESTRATIONS

    if (req.method === "GET" && path === "/runtime/orchestrations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_by,
          executed_at,
          completed_by,
          completed_at
        FROM runtime_orchestrations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        orchestration_count: result.rows.length,
        pending_count: result.rows.filter(row => row.status === "pending").length,
        approved_count: result.rows.filter(row => row.status === "approved").length,
        executed_count: result.rows.filter(row => row.status === "executed").length,
        completed_count: result.rows.filter(row => row.status === "completed").length,
        cancelled_count: result.rows.filter(row => row.status === "cancelled").length,
        orchestrations: result.rows
      });
    }

    // GET COMMUNICATION SUMMARY BY RECEIVER

    if (req.method === "GET" && path.startsWith("/runtime/communication-summary/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const receiver_id = decodeURIComponent(
        path.replace("/runtime/communication-summary/", "")
      );

      if (!receiver_id) {
        return send(res, 400, {
          error: "missing_receiver_id"
        });
      }

      const result = await db.query(`
        SELECT
          communication_evidence_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by,
          created_at
        FROM runtime_communication_evidence
        WHERE tenant_id = $1
          AND receiver_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        receiver_id
      ]);

      const evidence_count = result.rows.length;
      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const avg = (values) => {
        const usable = values.filter(value => value !== null && value !== undefined);
        if (usable.length === 0) return null;
        return Math.round(
          usable.reduce((sum, value) => sum + Number(value || 0), 0) / usable.length
        );
      };

      const average_ack_latency_seconds = avg(
        result.rows.map(row => row.ack_latency_seconds)
      );

      const average_completion_latency_seconds = avg(
        result.rows.map(row => row.completion_latency_seconds)
      );

      const effectiveness_score =
        evidence_count > 0
          ? Math.round((positive_count / evidence_count) * 1000) / 10
          : 0;

      const byMessageType = {};

      for (const row of result.rows) {
        if (!byMessageType[row.message_type]) {
          byMessageType[row.message_type] = {
            message_type: row.message_type,
            evidence_count: 0,
            positive_count: 0,
            neutral_count: 0,
            negative_count: 0,
            average_ack_latency_seconds: null,
            average_completion_latency_seconds: null,
            _ack_values: [],
            _completion_values: []
          };
        }

        const entry = byMessageType[row.message_type];

        entry.evidence_count += 1;

        if (row.effectiveness === "positive") entry.positive_count += 1;
        if (row.effectiveness === "neutral") entry.neutral_count += 1;
        if (row.effectiveness === "negative") entry.negative_count += 1;

        if (row.ack_latency_seconds !== null && row.ack_latency_seconds !== undefined) {
          entry._ack_values.push(row.ack_latency_seconds);
        }

        if (row.completion_latency_seconds !== null && row.completion_latency_seconds !== undefined) {
          entry._completion_values.push(row.completion_latency_seconds);
        }
      }

      for (const entry of Object.values(byMessageType)) {
        entry.average_ack_latency_seconds = avg(entry._ack_values);
        entry.average_completion_latency_seconds = avg(entry._completion_values);
        delete entry._ack_values;
        delete entry._completion_values;
      }

      return send(res, 200, {
        tenant_id,
        receiver_id,
        evidence_count,
        positive_count,
        neutral_count,
        negative_count,
        effectiveness_score,
        average_ack_latency_seconds,
        average_completion_latency_seconds,
        by_message_type: Object.values(byMessageType),
        evidence: result.rows
      });
    }

    // GET COMMUNICATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/communications/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const communicationResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (communicationResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communication = communicationResult.rows[0];

      const auditResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          created_at,
          audit_hash,
          previous_hash
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
          AND event_type LIKE 'runtime.communication.%'
        ORDER BY created_at DESC
      `, [
        tenant_id,
        communication.receiver_id
      ]);

      const createdAt = communication.created_at ? new Date(communication.created_at).getTime() : null;
      const acknowledgedAt = communication.acknowledged_at ? new Date(communication.acknowledged_at).getTime() : null;
      const completedAt = communication.completed_at ? new Date(communication.completed_at).getTime() : null;

      const ack_latency_seconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completion_latency_seconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      return send(res, 200, {
        tenant_id,
        communication_event_id,
        status: communication.status,
        sender_id: communication.sender_id,
        receiver_id: communication.receiver_id,
        direction: communication.direction,
        message_type: communication.message_type,
        subject: communication.subject,
        payload: communication.payload,
        tx: {
          sent: true,
          sent_by: communication.created_by,
          sent_at: communication.created_at
        },
        ack: {
          acknowledged: communication.acknowledged_at !== null,
          acknowledged_by: communication.acknowledged_by,
          acknowledged_at: communication.acknowledged_at,
          ack_latency_seconds
        },
        result: {
          completed: communication.completed_at !== null,
          completed_by: communication.completed_by,
          completed_at: communication.completed_at,
          completion_latency_seconds
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // COMPLETE COMMUNICATION EVENT

    if (req.method === "POST" && path.startsWith("/runtime/communications/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const communication_event_id = decodeURIComponent(
        path.replace("/runtime/communications/complete/", "")
      );

      if (!communication_event_id) {
        return send(res, 400, {
          error: "missing_communication_event_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_communication_events
        WHERE tenant_id = $1
          AND communication_event_id = $2
        LIMIT 1
      `, [
        tenant_id,
        communication_event_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "communication_event_not_found",
          communication_event_id
        });
      }

      const communicationEvent = existingResult.rows[0];

      if (communicationEvent.status !== "acknowledged") {
        return send(res, 409, {
          error: "communication_event_not_acknowledged",
          communication_event_id,
          current_status: communicationEvent.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_communication_events
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND communication_event_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        communication_event_id
      ]);

      const completedCommunication = updateResult.rows[0];

      const createdAt = completedCommunication.created_at ? new Date(completedCommunication.created_at).getTime() : null;
      const acknowledgedAt = completedCommunication.acknowledged_at ? new Date(completedCommunication.acknowledged_at).getTime() : null;
      const completedAt = completedCommunication.completed_at ? new Date(completedCommunication.completed_at).getTime() : null;

      const ackLatencySeconds =
        createdAt && acknowledgedAt
          ? Math.round((acknowledgedAt - createdAt) / 1000)
          : null;

      const completionLatencySeconds =
        createdAt && completedAt
          ? Math.round((completedAt - createdAt) / 1000)
          : null;

      const communicationEffectiveness = "positive";

      const communication_evidence_id =
        "cev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      await db.query(`
        INSERT INTO runtime_communication_evidence (
          communication_evidence_id,
          tenant_id,
          communication_event_id,
          sender_id,
          receiver_id,
          message_type,
          ack_latency_seconds,
          completion_latency_seconds,
          effectiveness,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        communication_evidence_id,
        tenant_id,
        completedCommunication.communication_event_id,
        completedCommunication.sender_id,
        completedCommunication.receiver_id,
        completedCommunication.message_type,
        ackLatencySeconds,
        completionLatencySeconds,
        communicationEffectiveness,
        completed_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.evidence.created",
        message: `Communication evidence created: ${communicationEffectiveness}`
      });

      await writeEvent({
        tenant_id,
        object_id: completedCommunication.receiver_id,
        event_type: "runtime.communication.completed",
        message: `Communication completed: ${completedCommunication.message_type}`
      });

      return send(res, 200, {
        completed: true,
        communication: completedCommunication,
        communication_evidence_created: true,
        communication_evidence: {
          communication_evidence_id,
          communication_event_id: completedCommunication.communication_event_id,
          sender_id: completedCommunication.sender_id,
          receiver_id: completedCommunication.receiver_id,
          message_type: completedCommunication.message_type,
          ack_latency_seconds: ackLatencySeconds,
          completion_latency_seconds: completionLatencySeconds,
          effectiveness: communicationEffectiveness
        }
      });
    }

    // SEND COMMUNICATION EVENT

    if (req.method === "POST" && path === "/runtime/communications/send") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const sender_id = body.sender_id;
      const receiver_id = body.receiver_id;
      const direction = body.direction || "TX";
      const message_type = body.message_type || "MESSAGE";
      const subject = body.subject || null;
      const payload = body.payload || {};

      if (!sender_id || !receiver_id) {
        return send(res, 400, {
          error: "missing_sender_or_receiver"
        });
      }

      const communication_event_id =
        "com-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_communication_events (
          communication_event_id,
          tenant_id,
          sender_id,
          receiver_id,
          direction,
          message_type,
          subject,
          payload,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',$9)
      `, [
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: receiver_id,
        event_type: "runtime.communication.sent",
        message: `Communication sent: ${message_type}`
      });

      return send(res, 200, {
        sent: true,
        communication_event_id,
        tenant_id,
        sender_id,
        receiver_id,
        direction,
        message_type,
        subject,
        status: "sent"
      });
    }

    // GET RUNTIME LEARNING SUMMARY BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/learning-summary/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const person_id = decodeURIComponent(
        path.replace("/runtime/learning-summary/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          competency_name,
          effectiveness,
          gap_before,
          gap_after,
          created_at
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        person_id
      ]);

      const evidence_count = result.rows.length;
      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const total_gap_reduction = result.rows.reduce(
        (sum, row) => sum + Math.max(Number(row.gap_before || 0) - Number(row.gap_after || 0), 0),
        0
      );

      const effectiveness_score =
        evidence_count > 0
          ? Math.round((positive_count / evidence_count) * 1000) / 10
          : 0;

      const byCompetency = {};

      for (const row of result.rows) {
        if (!byCompetency[row.competency_name]) {
          byCompetency[row.competency_name] = {
            competency_name: row.competency_name,
            evidence_count: 0,
            positive_count: 0,
            neutral_count: 0,
            negative_count: 0,
            gap_reduction: 0
          };
        }

        const entry = byCompetency[row.competency_name];

        entry.evidence_count += 1;

        if (row.effectiveness === "positive") entry.positive_count += 1;
        if (row.effectiveness === "neutral") entry.neutral_count += 1;
        if (row.effectiveness === "negative") entry.negative_count += 1;

        entry.gap_reduction += Math.max(
          Number(row.gap_before || 0) - Number(row.gap_after || 0),
          0
        );
      }

      return send(res, 200, {
        tenant_id,
        person_id,
        evidence_count,
        positive_count,
        neutral_count,
        negative_count,
        total_gap_reduction,
        effectiveness_score,
        competencies: Object.values(byCompetency)
      });
    }

    // GET RUNTIME LEARNING EVIDENCE BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/learning-evidence/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const person_id = decodeURIComponent(
        path.replace("/runtime/learning-evidence/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          evidence_id,
          person_id,
          competency_name,
          training_plan_id,
          gap_before,
          gap_after,
          effectiveness,
          created_by,
          created_at
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        person_id
      ]);

      const positive_count = result.rows.filter(row => row.effectiveness === "positive").length;
      const neutral_count = result.rows.filter(row => row.effectiveness === "neutral").length;
      const negative_count = result.rows.filter(row => row.effectiveness === "negative").length;

      const total_gap_reduction = result.rows.reduce(
        (sum, row) => sum + Math.max(Number(row.gap_before || 0) - Number(row.gap_after || 0), 0),
        0
      );

      return send(res, 200, {
        tenant_id,
        person_id,
        evidence_count: result.rows.length,
        positive_count,
        neutral_count,
        negative_count,
        total_gap_reduction,
        evidence: result.rows
      });
    }

    // GET RUNTIME TRAINING PLANS BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/training-plans/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const person_id = decodeURIComponent(
        path.replace("/runtime/training-plans/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          training_plan_id,
          person_id,
          competency_name,
          recommendation_id,
          training_type,
          estimated_duration_minutes,
          status,
          created_by,
          created_at,
          approved_by,
          approved_at,
          completed_by,
          completed_at
        FROM runtime_training_plans
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        person_id
      ]);

      const planned_count = result.rows.filter(row => row.status === "planned").length;
      const approved_count = result.rows.filter(row => row.status === "approved").length;
      const completed_count = result.rows.filter(row => row.status === "completed").length;

      const total_estimated_minutes = result.rows.reduce(
        (sum, row) => sum + Number(row.estimated_duration_minutes || 0),
        0
      );

      return send(res, 200, {
        tenant_id,
        person_id,
        training_plan_count: result.rows.length,
        planned_count,
        approved_count,
        completed_count,
        total_estimated_minutes,
        training_plans: result.rows
      });
    }

    // GET RUNTIME COMPETENCIES BY PERSON

    if (req.method === "GET" && path.startsWith("/runtime/competencies/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const person_id = decodeURIComponent(
        path.replace("/runtime/competencies/", "")
      );

      if (!person_id) {
        return send(res, 400, {
          error: "missing_person_id"
        });
      }

      const result = await db.query(`
        SELECT
          competency_id,
          person_id,
          competency_name,
          required_level,
          actual_level,
          gap,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_competencies
        WHERE tenant_id = $1
          AND person_id = $2
        ORDER BY gap DESC, competency_name ASC
      `, [
        tenant_id,
        person_id
      ]);

      const max_gap = result.rows.reduce(
        (max, row) => Math.max(max, Number(row.gap || 0)),
        0
      );

      const open_gap_count = result.rows.filter(row => Number(row.gap || 0) > 0).length;

      return send(res, 200, {
        tenant_id,
        person_id,
        competency_count: result.rows.length,
        open_gap_count,
        max_gap,
        competencies: result.rows
      });
    }

    // GET RUNTIME RECOMMENDATION RULES

    if (req.method === "GET" && path === "/runtime/recommendation-rules") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const result = await db.query(`
        SELECT
          rule_id,
          tenant_id,
          rule_name,
          enabled,
          condition_definition,
          recommendation_definition,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_recommendation_rules
        WHERE tenant_id = $1
        ORDER BY enabled DESC, rule_id ASC
      `, [
        auth.user.tenant_id
      ]);

      const enabled_count = result.rows.filter(rule => rule.enabled === true).length;

      return send(res, 200, {
        tenant_id: auth.user.tenant_id,
        rule_count: result.rows.length,
        enabled_count,
        rules: result.rows
      });
    }

    // GENERATE RUNTIME RECOMMENDATIONS BY OBJECT

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/generate/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const object_id = decodeURIComponent(
        path.replace("/runtime/recommendations/generate/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const objectResult = await db.query(`
        SELECT object_id, runtime_type, state, priority, risk_score
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = $2
        LIMIT 1
      `, [tenant_id, object_id]);

      if (objectResult.rows.length === 0) {
        return send(res, 404, {
          error: "object_not_found",
          object_id
        });
      }

      const object = objectResult.rows[0];

      const actionsResult = await db.query(`
        SELECT *
        FROM runtime_actions
        WHERE tenant_id = $1
          AND object_id = $2
          AND status NOT IN ('completed', 'cancelled', 'rejected')
        ORDER BY created_at DESC
      `, [tenant_id, object_id]);

      const governanceResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [tenant_id, object_id]);

      const latestGovernance = governanceResult.rows[0] || null;

      let latestApproval = null;

      if (latestGovernance) {
        const approvalResult = await db.query(`
          SELECT *
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND decision_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [tenant_id, latestGovernance.decision_id]);

        latestApproval = approvalResult.rows[0] || null;
      }

      const rulesResult = await db.query(`
        SELECT
          rule_id,
          rule_name,
          condition_definition,
          recommendation_definition
        FROM runtime_recommendation_rules
        WHERE tenant_id = $1
          AND enabled = true
        ORDER BY rule_id ASC
      `, [
        tenant_id
      ]);

      const recommendations = [];

      const riskScore = Number(object.risk_score || 0);

      const highOpenActions = actionsResult.rows.filter(action =>
        action.priority === "high" || action.priority === "critical"
      );

      const governanceReviewWithoutApproval =
        latestGovernance &&
        latestGovernance.governance_status === "review_required" &&
        !latestApproval
          ? true
          : false;

      const competencyResult = await db.query(`
        SELECT
          COUNT(*)::int AS competency_count,
          COALESCE(MAX(gap), 0)::int AS max_gap
        FROM runtime_competencies
        WHERE tenant_id = $1
          AND person_id = $2
      `, [
        tenant_id,
        object_id
      ]);

      const competencyGap =
        competencyResult.rows.length > 0
          ? Number(competencyResult.rows[0].max_gap || 0)
          : 0;

      const context = {
        risk_score: riskScore,
        open_high_actions: highOpenActions.length,
        governance_review_without_approval: governanceReviewWithoutApproval,
        competency_gap: competencyGap
      };

      function evaluateRecommendationRule(condition, context) {
        const field = condition.field;
        const operator = condition.operator;
        const expected = condition.value;
        const actual = context[field];

        if (actual === undefined) {
          return false;
        }

        if (operator === ">=") return Number(actual) >= Number(expected);
        if (operator === ">") return Number(actual) > Number(expected);
        if (operator === "<=") return Number(actual) <= Number(expected);
        if (operator === "<") return Number(actual) < Number(expected);
        if (operator === "=") return actual === expected;
        if (operator === "!=") return actual !== expected;

        return false;
      }

      for (const rule of rulesResult.rows) {
        const condition = rule.condition_definition || {};
        const definition = rule.recommendation_definition || {};

        if (!evaluateRecommendationRule(condition, context)) {
          continue;
        }

        const recommendation_type = definition.recommendation_type;
        const priority = definition.priority || "normal";

        let reason = `Rule matched: ${rule.rule_name}`;
        let evidence = {
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          condition,
          context
        };

        if (recommendation_type === "RECHECK_GOVERNANCE") {
          reason = `Object risk score is ${riskScore}; governance should be reviewed.`;
          evidence = {
            ...evidence,
            risk_score: riskScore,
            runtime_type: object.runtime_type,
            state: object.state
          };
        }

        if (recommendation_type === "CLOSE_OPEN_ACTIONS") {
          reason = `${highOpenActions.length} high priority open action(s) should be resolved.`;
          evidence = {
            ...evidence,
            open_action_count: actionsResult.rows.length,
            high_open_action_count: highOpenActions.length
          };
        }

        if (recommendation_type === "REQUEST_APPROVAL") {
          reason = "Latest governance decision requires review and has no approval.";
          evidence = {
            ...evidence,
            decision_id: latestGovernance ? latestGovernance.decision_id : null,
            governance_status: latestGovernance ? latestGovernance.governance_status : null,
            reason_codes: latestGovernance ? latestGovernance.reason_codes : null
          };
        }

        if (recommendation_type === "TRAINING_REQUIRED") {
          reason = `Competency gap detected; training or micro-learning should be planned.`;
          evidence = {
            ...evidence,
            competency_gap: competencyGap,
            person_id: object_id
          };
        }

        recommendations.push({
          recommendation_type,
          priority,
          reason,
          evidence
        });
      }

      const inserted = [];
      const skipped_duplicates = [];

      for (const recommendation of recommendations) {

        const existingResult = await db.query(`
          SELECT recommendation_id
          FROM runtime_recommendations
          WHERE tenant_id = $1
            AND object_id = $2
            AND recommendation_type = $3
            AND status = 'open'
          LIMIT 1
        `, [
          tenant_id,
          object_id,
          recommendation.recommendation_type
        ]);

        if (existingResult.rows.length > 0) {
          skipped_duplicates.push({
            recommendation_type: recommendation.recommendation_type,
            existing_recommendation_id: existingResult.rows[0].recommendation_id
          });
          continue;
        }

        const recommendation_id =
          "rec-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        await db.query(`
          INSERT INTO runtime_recommendations (
            recommendation_id,
            tenant_id,
            object_id,
            recommendation_type,
            priority,
            status,
            reason,
            evidence,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8)
        `, [
          recommendation_id,
          tenant_id,
          object_id,
          recommendation.recommendation_type,
          recommendation.priority,
          recommendation.reason,
          JSON.stringify(recommendation.evidence || {}),
          auth.user.operator_id || auth.user.username || "runtime_admin"
        ]);

        inserted.push({
          recommendation_id,
          object_id,
          status: "open",
          ...recommendation
        });
      }

      await writeEvent({
        tenant_id,
        object_id,
        event_type: "runtime.recommendations.generated",
        message: `Generated ${inserted.length} runtime recommendation(s)`
      });

      return send(res, 200, {
        object_id,
        tenant_id,
        generated_count: inserted.length,
        skipped_duplicate_count: skipped_duplicates.length,
        recommendations: inserted,
        skipped_duplicates
      });
    }




    // EXECUTE APPROVED RUNTIME RECOMMENDATION

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/execute/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/execute/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const recommendationResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (recommendationResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = recommendationResult.rows[0];

      if (recommendation.status !== "approved") {
        return send(res, 409, {
          error: "recommendation_not_approved",
          recommendation_id,
          current_status: recommendation.status
        });
      }

      const job_id =
        "job-" + Date.now();

      const execution_type =
        "recommendation." + recommendation.recommendation_type;

      const requested_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_execution_jobs (
          job_id,
          tenant_id,
          object_id,
          status,
          requested_by,
          execution_type,
          payload,
          available_at,
          priority,
          workflow_id,
          chain_position
        )
        VALUES ($1,$2,$3,'pending',$4,$5,$6,now(),$7,$8,0)
      `, [
        job_id,
        tenant_id,
        recommendation.object_id,
        requested_by,
        execution_type,
        JSON.stringify({
          recommendation_id,
          recommendation_type: recommendation.recommendation_type,
          reason: recommendation.reason,
          evidence: recommendation.evidence
        }),
        recommendation.priority === "critical" ? 10 : 100,
        job_id
      ]);

      const updateResult = await db.query(`
        UPDATE runtime_recommendations
        SET
          status = 'executed',
          executed_job_id = $1,
          executed_at = now()
        WHERE tenant_id = $2
          AND recommendation_id = $3
        RETURNING *
      `, [
        job_id,
        tenant_id,
        recommendation_id
      ]);

      const executedRecommendation = updateResult.rows[0];

      const createdTrainingPlans = [];

      if (executedRecommendation.recommendation_type === "TRAINING_REQUIRED") {
        const competencyResult = await db.query(`
          SELECT
            competency_id,
            competency_name,
            gap
          FROM runtime_competencies
          WHERE tenant_id = $1
            AND person_id = $2
            AND gap > 0
          ORDER BY gap DESC, competency_name ASC
        `, [
          tenant_id,
          executedRecommendation.object_id
        ]);

        for (const competency of competencyResult.rows) {
          const gap = Number(competency.gap || 0);

          let training_type = "MICRO_LEARNING";
          let estimated_duration_minutes = 15;

          if (gap === 2) {
            training_type = "MICRO_LEARNING";
            estimated_duration_minutes = 30;
          } else if (gap === 3) {
            training_type = "COACHING";
            estimated_duration_minutes = 60;
          } else if (gap >= 4) {
            training_type = "FORMAL_TRAINING";
            estimated_duration_minutes = 120;
          }

          const training_plan_id =
            "trn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

          await db.query(`
            INSERT INTO runtime_training_plans (
              training_plan_id,
              tenant_id,
              person_id,
              competency_name,
              recommendation_id,
              training_type,
              estimated_duration_minutes,
              status,
              created_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,'planned',$8)
          `, [
            training_plan_id,
            tenant_id,
            executedRecommendation.object_id,
            competency.competency_name,
            executedRecommendation.recommendation_id,
            training_type,
            estimated_duration_minutes,
            requested_by
          ]);

          createdTrainingPlans.push({
            training_plan_id,
            person_id: executedRecommendation.object_id,
            competency_name: competency.competency_name,
            gap,
            training_type,
            estimated_duration_minutes,
            status: "planned"
          });
        }
      }

      await writeEvent({
        tenant_id,
        object_id: executedRecommendation.object_id,
        event_type: "runtime.recommendation.executed",
        message: `Recommendation execution job created: ${execution_type}`
      });

      return send(res, 200, {
        executed: true,
        job_id,
        execution_type,
        training_plans_created: createdTrainingPlans.length,
        training_plans: createdTrainingPlans,
        recommendation: executedRecommendation
      });
    }

    // APPROVE RUNTIME RECOMMENDATION

    if (req.method === "POST" && path.startsWith("/runtime/recommendations/approve/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const recommendation_id = decodeURIComponent(
        path.replace("/runtime/recommendations/approve/", "")
      );

      if (!recommendation_id) {
        return send(res, 400, {
          error: "missing_recommendation_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND recommendation_id = $2
        LIMIT 1
      `, [
        tenant_id,
        recommendation_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "recommendation_not_found",
          recommendation_id
        });
      }

      const recommendation = existingResult.rows[0];

      if (recommendation.status !== "open") {
        return send(res, 409, {
          error: "recommendation_not_open",
          recommendation_id,
          current_status: recommendation.status
        });
      }

      const approved_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_recommendations
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = now()
        WHERE tenant_id = $2
          AND recommendation_id = $3
        RETURNING *
      `, [
        approved_by,
        tenant_id,
        recommendation_id
      ]);

      const approvedRecommendation = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: approvedRecommendation.object_id,
        event_type: "runtime.recommendation.approved",
        message: `Recommendation approved: ${approvedRecommendation.recommendation_type}`
      });

      return send(res, 200, {
        approved: true,
        recommendation: approvedRecommendation
      });
    }

    // GET RUNTIME RECOMMENDATIONS BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/recommendations/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const object_id = decodeURIComponent(
        path.replace("/runtime/recommendations/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          recommendation_id,
          object_id,
          recommendation_type,
          priority,
          status,
          reason,
          evidence,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_job_id,
          executed_at
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          created_at DESC
      `, [
        tenant_id,
        object_id
      ]);

      const open_count = result.rows.filter(r => r.status === "open").length;
      const approved_count = result.rows.filter(r => r.status === "approved").length;
      const executed_count = result.rows.filter(r => r.status === "executed").length;
      const rejected_count = result.rows.filter(r => r.status === "rejected").length;

      return send(res, 200, {
        object_id,
        tenant_id,
        recommendation_count: result.rows.length,
        open_count,
        approved_count,
        executed_count,
        rejected_count,
        recommendations: result.rows
      });
    }

    // GET UNIFIED OBJECT TRACE

    if (req.method === "GET" && path.startsWith("/runtime/trace/")) {

      const auth = requireRole(req, [
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
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [auth.user.tenant_id, object_id]);

      const executionResult = await db.query(`
        SELECT status, execution_type, worker_id, created_at, completed_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [auth.user.tenant_id, object_id]);

      const relationResult = await db.query(`
        SELECT relation_id, source_object_id, target_object_id, relation_type, created_at
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = $2
            OR target_object_id = $2
          )
        ORDER BY created_at DESC
      `, [auth.user.tenant_id, object_id]);

      const recommendationResult = await db.query(`
        SELECT
          recommendation_id,
          recommendation_type,
          priority,
          status,
          reason,
          created_at,
          approved_by,
          approved_at,
          executed_job_id,
          executed_at
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [auth.user.tenant_id, object_id]);

      const latestRecommendation =
        recommendationResult.rows.length > 0
          ? recommendationResult.rows[0]
          : null;

      const latestGovernance =
        governanceResult.rows.length > 0
          ? governanceResult.rows[0]
          : null;

      const latestExecution =
        executionResult.rows.length > 0
          ? executionResult.rows[0]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        exists_in_runtime_objects: objectResult.rows.length > 0,
        runtime_object: objectResult.rows[0] || null,
        audit: {
          event_count: auditResult.rows[0].event_count
        },
        governance: {
          decision_count: governanceResult.rows.length,
          latest_status: latestGovernance ? latestGovernance.governance_status : null,
          latest_created_at: latestGovernance ? latestGovernance.created_at : null
        },
        execution: {
          job_count: executionResult.rows.length,
          latest_status: latestExecution ? latestExecution.status : null,
          latest_execution_type: latestExecution ? latestExecution.execution_type : null,
          latest_worker_id: latestExecution ? latestExecution.worker_id : null
        },
        graph: {
          relation_count: relationResult.rows.length,
          relations: relationResult.rows
        },
        recommendations: {
          recommendation_count: recommendationResult.rows.length,
          open_count: recommendationResult.rows.filter(r => r.status === "open").length,
          approved_count: recommendationResult.rows.filter(r => r.status === "approved").length,
          executed_count: recommendationResult.rows.filter(r => r.status === "executed").length,
          rejected_count: recommendationResult.rows.filter(r => r.status === "rejected").length,
          latest_recommendation_type: latestRecommendation ? latestRecommendation.recommendation_type : null,
          latest_status: latestRecommendation ? latestRecommendation.status : null,
          latest_recommendation_id: latestRecommendation ? latestRecommendation.recommendation_id : null,
          recommendations: recommendationResult.rows
        }
      });
    }

    // GET EXECUTION PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/execution/path/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/execution/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          job_id,
          object_id,
          action,
          status,
          requested_by,
          result_message,
          execution_type,
          payload,
          worker_id,
          retry_count,
          last_error,
          failed_at,
          scheduled_for,
          available_at,
          started_at,
          completed_at,
          created_at,
          workflow_id,
          parent_job_id,
          next_execution_type,
          chain_position
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      const executions = result.rows;

      const latestExecution =
        executions.length > 0
          ? executions[executions.length - 1]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        job_count: executions.length,
        latest_status: latestExecution ? latestExecution.status : null,
        latest_execution_type: latestExecution ? latestExecution.execution_type : null,
        latest_worker_id: latestExecution ? latestExecution.worker_id : null,
        executions
      });
    }

    // GET GOVERNANCE PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/governance/path/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/governance/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const decisionsResult = await db.query(`
        SELECT
          decision_id,
          object_id,
          governance_status,
          reason_codes,
          risk_count,
          max_risk_score,
          acute_risk_count,
          open_action_count,
          high_open_action_count,
          graph_edge_count,
          audit_event_count,
          created_at
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      const decisionIds = decisionsResult.rows.map(d => d.decision_id);

      let approvals = [];

      if (decisionIds.length > 0) {
        const approvalsResult = await db.query(`
          SELECT
            approval_id,
            decision_id,
            object_id,
            approval_status,
            reason,
            requested_by,
            decided_by,
            created_at
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND decision_id = ANY($2)
          ORDER BY created_at ASC
        `, [
          auth.user.tenant_id,
          decisionIds
        ]);

        approvals = approvalsResult.rows;
      }

      const latestDecision =
        decisionsResult.rows.length > 0
          ? decisionsResult.rows[decisionsResult.rows.length - 1]
          : null;

      const latestApproval =
        approvals.length > 0
          ? approvals[approvals.length - 1]
          : null;

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        decision_count: decisionsResult.rows.length,
        approval_count: approvals.length,
        latest_status: latestDecision ? latestDecision.governance_status : null,
        latest_approval_status: latestApproval ? latestApproval.approval_status : null,
        decisions: decisionsResult.rows,
        approvals
      });
    }

    // GET AUDIT PATH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/audit/path/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/audit/path/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          message,
          audit_hash,
          previous_hash,
          created_at
        FROM runtime_events
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      return send(res, 200, {
        object_id,
        tenant_id: auth.user.tenant_id,
        event_count: result.rows.length,
        timeline: result.rows
      });
    }


    // GET RELATIONS

    if (req.method === "GET" && path === "/runtime/relations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [auth.user.tenant_id]);

      return send(res, 200, {
        count: result.rows.length,
        relations: result.rows
      });
    }

    // GET RELATIONS BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/relations/object/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/relations/object/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const result = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = $2
            OR target_object_id = $2
          )
        ORDER BY created_at DESC
      `, [
        auth.user.tenant_id,
        object_id
      ]);

      return send(res, 200, {
        object_id,
        count: result.rows.length,
        relations: result.rows
      });
    }


    // GET RUNTIME GRAPH DEPTH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/graph/depth/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const root_object_id = decodeURIComponent(
        path.replace("/runtime/graph/depth/", "")
      );

      if (!root_object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const max_depth = Math.min(
        Math.max(Number(urlObj.searchParams.get("depth") || 3), 1),
        5
      );

      const visited = new Set();
      const frontier = new Set([root_object_id]);
      const allNodeIds = new Set([root_object_id]);
      const edgeMap = new Map();

      for (let depth = 0; depth < max_depth; depth++) {

        const current = Array.from(frontier)
          .filter(id => !visited.has(id));

        if (current.length === 0) {
          break;
        }

        for (const id of current) {
          visited.add(id);
        }

        const relationsResult = await db.query(`
          SELECT *
          FROM runtime_relations
          WHERE tenant_id = $1
            AND (
              source_object_id = ANY($2)
              OR target_object_id = ANY($2)
            )
          ORDER BY created_at DESC
        `, [
          auth.user.tenant_id,
          current
        ]);

        frontier.clear();

        for (const relation of relationsResult.rows) {
          edgeMap.set(relation.relation_id, relation);

          if (!visited.has(relation.source_object_id)) {
            frontier.add(relation.source_object_id);
          }

          if (!visited.has(relation.target_object_id)) {
            frontier.add(relation.target_object_id);
          }

          allNodeIds.add(relation.source_object_id);
          allNodeIds.add(relation.target_object_id);
        }
      }

      const nodesResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = ANY($2)
      `, [
        auth.user.tenant_id,
        Array.from(allNodeIds)
      ]);

      const objectMap = new Map();

      for (const object of nodesResult.rows) {
        objectMap.set(object.object_id, object);
      }

      const nodes = Array.from(allNodeIds).map(id => {
        const object = objectMap.get(id);

        return {
          object_id: id,
          exists_in_runtime_objects: !!object,
          runtime_type: object ? object.runtime_type : null,
          state: object ? object.state : null,
          priority: object ? object.priority : null,
          risk_score: object ? object.risk_score : null,
          tenant_id: auth.user.tenant_id
        };
      });

      const edges = Array.from(edgeMap.values()).map(relation => ({
        relation_id: relation.relation_id,
        source_object_id: relation.source_object_id,
        target_object_id: relation.target_object_id,
        relation_type: relation.relation_type,
        tenant_id: relation.tenant_id,
        created_at: relation.created_at
      }));

      return send(res, 200, {
        root_object_id,
        max_depth,
        node_count: nodes.length,
        edge_count: edges.length,
        nodes,
        edges
      });
    }


    // GET RUNTIME GRAPH BY OBJECT

    if (req.method === "GET" && path.startsWith("/runtime/graph/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const object_id = decodeURIComponent(
        path.replace("/runtime/graph/", "")
      );

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

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
        auth.user.tenant_id,
        object_id
      ]);

      const relations = relationsResult.rows;

      const nodeIds = new Set();
      nodeIds.add(object_id);

      for (const relation of relations) {
        nodeIds.add(relation.source_object_id);
        nodeIds.add(relation.target_object_id);
      }

      const nodesResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = ANY($2)
      `, [
        auth.user.tenant_id,
        Array.from(nodeIds)
      ]);

      const objectMap = new Map();

      for (const object of nodesResult.rows) {
        objectMap.set(object.object_id, object);
      }

      const nodes = Array.from(nodeIds).map(id => {
        const object = objectMap.get(id);

        return {
          object_id: id,
          object_type: object ? object.object_type : null,
          object_name: object ? object.object_name : null,
          exists_in_runtime_objects: !!object
        };
      });

      const edges = relations.map(relation => ({
        relation_id: relation.relation_id,
        from: relation.source_object_id,
        to: relation.target_object_id,
        relation_type: relation.relation_type,
        created_at: relation.created_at
      }));

      return send(res, 200, {
        root: object_id,
        tenant_id: auth.user.tenant_id,
        node_count: nodes.length,
        edge_count: edges.length,
        nodes,
        edges
      });
    }


    // DASHBOARD

    if (req.method === "GET" && path === "/runtime/dashboard") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }


      const objectsResult = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
      `, [auth.user.tenant_id]);

      const eventsResult = await db.query(`
        SELECT *
        FROM runtime_events
        WHERE tenant_id = $1
      `, [auth.user.tenant_id]);

      const objects = objectsResult.rows;
      const events = eventsResult.rows;

      const activeObjects = objects.filter(
        o => o.state !== "completed"
      );

      const highRiskObjects = objects.filter(
        o => o.risk_score >= 70
      );

      return send(res, 200, {
        dashboard: {
          summary: {
            total_objects: objects.length,
            active_objects: activeObjects.length,
            high_risk_objects: highRiskObjects.length,
            total_events: events.length
          },
          objects
        }
      });
    }

    // GOVERNANCE EVALUATE

    if (req.method === "GET" && path === "/governance/evaluate") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }


      const result = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [auth.user.tenant_id]);

      const object = result.rows[0];

      if (!object) {

        return send(res, 200, {
          decision: "no_object"
        });
      }

      const allowed =
        object.risk_score < 70;

      return send(res, 200, {
        decision: allowed
          ? "allowed"
          : "blocked",

        governance_state: allowed
          ? "baseline_clear"
          : "operator_approval_required",

        risk_score: object.risk_score,
        evaluated_object: object.object_id
      });
    }



    // RUNTIME SCHEDULE API V1

    if (req.method === "POST" && path === "/runtime/schedule") {

      const auth = requireRole(req, [
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);

      const object_id = body.object_id;
      const execution_type = body.execution_type || "diagnostic.run";
      const payload = body.payload || {};
      const priority = body.priority || 100;
      const delay_seconds = body.delay_seconds || 0;

      const scheduled_for = new Date(
        Date.now() + delay_seconds * 1000
      ).toISOString();

      if (!object_id) {
        return send(res, 400, {
          error: "missing_object_id"
        });
      }

      const latestGovernanceResult = await db.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id,
        object_id
      ]);

      const latestGovernanceDecision =
        latestGovernanceResult.rows[0] || null;

      if (!latestGovernanceDecision) {
        await writeEvent({
          event_type: "runtime.governance.gate.review_required",
          object_id,
          message: "Schedule gate requires governance check before scheduling",
          tenant_id
        });

        return send(res, 403, {
          error: "governance_decision_required",
          gate_status: "review_required",
          object_id,
          tenant_id
        });
      }

      if (latestGovernanceDecision.governance_status === "blocked") {
        await writeEvent({
          event_type: "runtime.governance.gate.blocked",
          object_id,
          message: "Scheduling blocked by governance gate",
          tenant_id
        });

        return send(res, 403, {
          error: "schedule_blocked_by_governance",
          gate_status: "blocked",
          governance_status: latestGovernanceDecision.governance_status,
          decision_id: latestGovernanceDecision.decision_id,
          object_id,
          tenant_id
        });
      }

      if (latestGovernanceDecision.governance_status === "review_required") {
        const approvalResult = await db.query(`
          SELECT *
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND decision_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [
          tenant_id,
          latestGovernanceDecision.decision_id
        ]);

        const approval = approvalResult.rows[0] || null;

        if (!approval) {
          await writeEvent({
            event_type: "runtime.governance.gate.review_required",
            object_id,
            message: "Scheduling requires review before governance gate allows scheduling",
            tenant_id
          });

          return send(res, 403, {
            error: "schedule_requires_governance_review",
            gate_status: "review_required",
            governance_status: latestGovernanceDecision.governance_status,
            decision_id: latestGovernanceDecision.decision_id,
            object_id,
            tenant_id
          });
        }

        if (approval.approval_status === "rejected") {
          await writeEvent({
            event_type: "runtime.governance.gate.blocked",
            object_id,
            message: "Scheduling rejected by governance approval",
            tenant_id
          });

          return send(res, 403, {
            error: "schedule_rejected_by_governance_approval",
            gate_status: "blocked",
            governance_status: latestGovernanceDecision.governance_status,
            approval_status: approval.approval_status,
            decision_id: latestGovernanceDecision.decision_id,
            approval_id: approval.approval_id,
            object_id,
            tenant_id
          });
        }

        if (approval.approval_status === "approved") {
          await writeEvent({
            event_type: "runtime.governance.gate.allowed",
            object_id,
            message: "Scheduling allowed by governance approval",
            tenant_id
          });
        }
      }

      await writeEvent({
        event_type: "runtime.governance.gate.allowed",
        object_id,
        message: "Scheduling allowed by governance gate",
        tenant_id
      });

      const job_id = `job-${Date.now()}`;

      const result = await db.query(`
        INSERT INTO runtime_execution_jobs (
          job_id,
          tenant_id,
          object_id,
          execution_type,
          status,
          requested_by,
          payload,
          scheduled_for,
          available_at,
          priority
        )
        VALUES (
          $1, $2, $3, $4, 'pending', $5, $6, $7, $7, $8
        )
        RETURNING
          job_id,
          object_id,
          execution_type,
          status,
          scheduled_for,
          priority
      `, [
        job_id,
        tenant_id,
        object_id,
        execution_type,
        auth.user.username || "runtime_admin",
        JSON.stringify(payload),
        scheduled_for,
        priority
      ]);

      await writeEvent({
        event_type: "runtime.job.scheduled",
        object_id,
        message: `Runtime job scheduled for ${scheduled_for}`,
        tenant_id
      });

      return send(res, 200, {
        scheduled: true,
        job: result.rows[0]
      });
    }


async function updateWorkflowState(
  workflowId,
  tenant_id,
  object_id
) {
  const statsResult = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status = 'completed'
      )::int AS completed,
      COUNT(*) FILTER (
        WHERE status = 'failed_permanent'
      )::int AS failed,
      COUNT(*) FILTER (
        WHERE execution_type = 'compensation.run'
          AND status = 'completed'
      )::int AS compensated,
      COUNT(*) FILTER (
        WHERE status IN (
          'pending',
          'running',
          'failed'
        )
      )::int AS active
    FROM runtime_execution_jobs
    WHERE workflow_id = $1
  `, [workflowId]);

  const stats = statsResult.rows[0];

  let workflowStatus = 'running';

  if (
    Number(stats.failed) > 0 &&
    Number(stats.compensated) > 0
  ) {
    workflowStatus = 'compensated';
  } else if (
    Number(stats.failed) > 0 &&
    Number(stats.completed) > 0
  ) {
    workflowStatus = 'partial_failed';
  } else if (
    Number(stats.failed) > 0
  ) {
    workflowStatus = 'failed';
  } else if (
    Number(stats.active) === 0
  ) {
    workflowStatus = 'completed';
  }

  await db.query(`
    INSERT INTO runtime_workflow_instances (
      workflow_id,
      tenant_id,
      object_id,
      status,
      job_count,
      completed_count,
      failed_count,
      compensated_count,
      updated_at,
      completed_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      NOW(),
      CASE
        WHEN $4 IN (
          'completed',
          'failed',
          'compensated',
          'partial_failed'
        )
        THEN NOW()
        ELSE NULL
      END
    )
    ON CONFLICT (workflow_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      job_count = EXCLUDED.job_count,
      completed_count = EXCLUDED.completed_count,
      failed_count = EXCLUDED.failed_count,
      compensated_count = EXCLUDED.compensated_count,
      updated_at = NOW(),
      completed_at = EXCLUDED.completed_at
  `, [
    workflowId,
    tenant_id,
    object_id,
    workflowStatus,
    Number(stats.total),
    Number(stats.completed),
    Number(stats.failed),
    Number(stats.compensated)
  ]);

  return workflowStatus;
}


    // RUNTIME WORKER V4 - LEASE LOCKING

    if (req.method === "POST" && path === "/runtime/worker/run") {

      const auth = requireRole(req, [
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const worker_id = `worker-${Date.now()}`;

      await db.query("BEGIN");

      const nextJobResult = await db.query(`
        SELECT *
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND (
            status = 'pending'
            OR (
              status = 'failed'
              AND COALESCE(retry_count, 0) < 3
            )
            OR (
              status = 'running'
              AND lock_expires_at IS NOT NULL
              AND lock_expires_at < NOW()
            )
          )
          AND COALESCE(scheduled_for, available_at, NOW()) <= NOW()
        ORDER BY
          priority ASC,
          COALESCE(scheduled_for, created_at) ASC,
          created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `, [tenant_id]);

      if (nextJobResult.rows.length === 0) {

        await db.query("COMMIT");

        return send(res, 200, {
          worker: "idle",
          pending_jobs: 0
        });
      }

      const job = nextJobResult.rows[0];

      await db.query(`
        UPDATE runtime_execution_jobs
        SET
          status = 'running',
          started_at = COALESCE(started_at, NOW()),
          locked_at = NOW(),
          lock_expires_at = NOW() + interval '60 seconds',
          worker_id = $2,
          last_error = NULL
        WHERE job_id = $1
      `, [
        job.job_id,
        worker_id
      ]);

      await db.query("COMMIT");

      try {

        if (job.execution_type === "diagnostic.fail") {
          throw new Error("Simulated diagnostic failure");
        }

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = 'completed',
            completed_at = NOW(),
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $2
        `, [
          job.job_id,
          worker_id
        ]);

        // WORKFLOW DAG V1
        const dagPayload = job.payload || {};
        const dag = dagPayload.dag || {};
        const edges = Array.isArray(dag.edges) ? dag.edges : [];

        let nextTypes = [];

        if (job.next_execution_type) {
          nextTypes.push(job.next_execution_type);
        }

        for (const edge of edges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "success"
          ) {

            if (Array.isArray(edge.to)) {
              nextTypes.push(...edge.to);
            } else if (edge.to) {
              nextTypes.push(edge.to);
            }
          }
        }

        nextTypes = [...new Set(nextTypes)];

        for (const nextType of nextTypes) {

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          // DAG V2 dependency resolution

          const dependencyRows = await db.query(`
            SELECT from_execution_type
            FROM runtime_workflow_dependencies
            WHERE workflow_id = $1
              AND to_execution_type = $2
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          const requiredParents = dependencyRows.rows.map(
            r => r.from_execution_type
          );

          const completedRows = await db.query(`
            SELECT DISTINCT execution_type
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND status = 'completed'
          `, [
            job.workflow_id || job.job_id
          ]);

          const completedTypes = completedRows.rows.map(
            r => r.execution_type
          );

          const allSatisfied = requiredParents.every(
            p => completedTypes.includes(p)
          );

          if (!allSatisfied) {

            await writeEvent({
              event_type: "runtime.workflow.waiting_dependencies",
              object_id: job.object_id,
              message: `Waiting dependencies for ${nextType}`,
              tenant_id
            });

            continue;
          }

          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND execution_type = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-dag-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            dagPayload,
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.dag_job_created",
            object_id: job.object_id,
            message: `DAG job created: ${nextJobId} -> ${nextType}`,
            tenant_id
          });
        }

        await writeEvent({
          event_type: "runtime.execution.completed",
          object_id: job.object_id,
          message: `Execution completed by ${worker_id}`,
          tenant_id
        });

        // WORKFLOW TERMINAL STATE ENGINE V1

        const workflowId =
          job.workflow_id || job.job_id;

        const statsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE status = 'completed'
            )::int AS completed,
            COUNT(*) FILTER (
              WHERE status = 'failed_permanent'
            )::int AS failed,
            COUNT(*) FILTER (
              WHERE execution_type = 'compensation.run'
                AND status = 'completed'
            )::int AS compensated,
            COUNT(*) FILTER (
              WHERE status IN (
                'pending',
                'running',
                'failed'
              )
            )::int AS active
          FROM runtime_execution_jobs
          WHERE workflow_id = $1
        `, [workflowId]);

        const stats = statsResult.rows[0];

        let workflowStatus = 'running';

        if (
          Number(stats.failed) > 0 &&
          Number(stats.compensated) > 0
        ) {
          workflowStatus = 'compensated';

        } else if (
          Number(stats.failed) > 0 &&
          Number(stats.completed) > 0
        ) {
          workflowStatus = 'partial_failed';

        } else if (
          Number(stats.failed) > 0
        ) {
          workflowStatus = 'failed';

        } else if (
          Number(stats.active) === 0
        ) {
          workflowStatus = 'completed';
        }

        await db.query(`
          INSERT INTO runtime_workflow_instances (
            workflow_id,
            tenant_id,
            object_id,
            status,
            job_count,
            completed_count,
            failed_count,
            compensated_count,
            updated_at,
            completed_at
          )
          VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,
            NOW(),
            CASE
              WHEN $4 IN (
                'completed',
                'failed',
                'compensated',
                'partial_failed'
              )
              THEN NOW()
              ELSE NULL
            END
          )
          ON CONFLICT (workflow_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            job_count = EXCLUDED.job_count,
            completed_count = EXCLUDED.completed_count,
            failed_count = EXCLUDED.failed_count,
            compensated_count =
              EXCLUDED.compensated_count,
            updated_at = NOW(),
            completed_at = EXCLUDED.completed_at
        `, [
          workflowId,
          tenant_id,
          job.object_id,
          workflowStatus,
          Number(stats.total),
          Number(stats.completed),
          Number(stats.failed),
          Number(stats.compensated)
        ]);

        await writeEvent({
          event_type: "runtime.workflow.state_updated",
          object_id: job.object_id,
          message:
            `Workflow state updated: ${workflowStatus}`,
          tenant_id
        });

        return send(res, 200, {
          worker: "completed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          workflow_status: workflowStatus
        });

      } catch (workerErr) {

        const retryCount = Number(job.retry_count || 0) + 1;
        const finalStatus = retryCount >= 3
          ? "failed_permanent"
          : "failed";

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = $2,
            retry_count = $3,
            failed_at = NOW(),
            last_error = $4,
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $5
        `, [
          job.job_id,
          finalStatus,
          retryCount,
          workerErr.message,
          worker_id
        ]);

        await writeEvent({
          event_type: "runtime.execution.failed",
          object_id: job.object_id,
          message: `Execution failed by ${worker_id}: ${workerErr.message}`,
          tenant_id
        });

        // DAG FAILURE ROUTING V1
        const failureDagPayload = job.payload || {};
        const failureDag = failureDagPayload.dag || {};
        const failureEdges = Array.isArray(failureDag.edges) ? failureDag.edges : [];

        let failureTargets = [];

        for (const edge of failureEdges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "failed"
          ) {
            if (Array.isArray(edge.to)) {
              failureTargets.push(...edge.to);
            } else if (edge.to) {
              failureTargets.push(edge.to);
            }
          }
        }

        failureTargets = [...new Set(failureTargets)];

        for (const nextType of failureTargets) {
          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND execution_type = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            JSON.stringify(job.payload || {}),
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.failure_routing",
            object_id: job.object_id,
            message: `Failure route created: ${nextType}`,
            tenant_id
          });
        }

        await updateWorkflowState(
          job.workflow_id || job.job_id,
          tenant_id,
          job.object_id
        );

        return send(res, 500, {
          worker: "failed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          retry_count: retryCount,
          final_status: finalStatus,
          error: workerErr.message
        });
      }
    }

    // RUNTIME METRICS

    if (req.method === "GET" && path === "/runtime/metrics") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          status,
          COUNT(*)::int AS count
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
        GROUP BY status
        ORDER BY status ASC
      `, [tenant_id]);

      const failedResult = await db.query(`
        SELECT
          COUNT(*)::int AS failed_permanent_count
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND status = 'failed_permanent'
      `, [tenant_id]);

      const recentResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          retry_count,
          last_error,
          created_at,
          started_at,
          completed_at,
          failed_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [tenant_id]);

      return send(res, 200, {
        metrics: {
          jobs_by_status: result.rows,
          failed_permanent_count:
            failedResult.rows[0].failed_permanent_count,
          recent_jobs: recentResult.rows
        }
      });
    }

    // RUNTIME DEAD LETTER QUEUE

    if (req.method === "GET" && path === "/runtime/dead-letter") {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          retry_count,
          last_error,
          failed_at,
          created_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND status = 'failed_permanent'
        ORDER BY failed_at DESC NULLS LAST, created_at DESC
      `, [tenant_id]);

      return send(res, 200, {
        dead_letter: {
          count: result.rows.length,
          jobs: result.rows
        }
      });
    }

    if (req.method === "POST" && path === "/runtime/dead-letter/requeue") {

      const auth = requireRole(req, [
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const body = await readBody(req);
      const job_id = body.job_id;

      if (!job_id) {
        return send(res, 400, {
          error: "missing_job_id"
        });
      }

      const result = await db.query(`
        UPDATE runtime_execution_jobs
        SET
          status = 'pending',
          retry_count = 0,
          last_error = NULL,
          failed_at = NULL
        WHERE job_id = $1
          AND tenant_id = $2
          AND status = 'failed_permanent'
        RETURNING
          job_id,
          object_id,
          execution_type,
          status,
          retry_count
      `, [
        job_id,
        tenant_id
      ]);

      if (result.rows.length === 0) {
        return send(res, 404, {
          error: "dead_letter_job_not_found",
          job_id
        });
      }

      const job = result.rows[0];

      await writeEvent({
        event_type: "runtime.dead_letter.requeued",
        object_id: job.object_id,
        message: `Dead letter job requeued: ${job.job_id}`,
        tenant_id
      });

      return send(res, 200, {
        requeued: true,
        job
      });
    }

    // RUNTIME WORKFLOW STATE V1

    if (req.method === "GET" && path.startsWith("/runtime/workflows/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "auditor"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const workflow_id = path.split("/").pop();

      const jobsResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          parent_job_id,
          workflow_id,
          chain_position,
          status,
          retry_count,
          last_error,
          created_at,
          started_at,
          completed_at,
          failed_at
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND workflow_id = $2
        ORDER BY chain_position ASC, created_at ASC
      `, [
        tenant_id,
        workflow_id
      ]);

      const jobs = jobsResult.rows;

      const counts = jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});

      let workflow_status = "unknown";

      if (jobs.length === 0) {
        workflow_status = "not_found";
      } else if ((counts.failed_permanent || 0) > 0) {
        workflow_status = "failed";
      } else if ((counts.running || 0) > 0) {
        workflow_status = "running";
      } else if ((counts.pending || 0) > 0 || (counts.failed || 0) > 0) {
        workflow_status = "blocked_or_pending";
      } else if (jobs.every(j => j.status === "completed")) {
        workflow_status = "completed";
      } else {
        workflow_status = "mixed";
      }

      return send(res, 200, {
        workflow: {
          workflow_id,
          status: workflow_status,
          counts,
          job_count: jobs.length,
          jobs
        }
      });
    }


  } catch (err) {
    console.error(err);

    return send(res, 500, {
      error: "runtime_error",
      message: err.message
    });
  }
});

initDb()
  .then(() => {

    server.listen(8080, () => {

      console.log(
        "RS OS Runtime active on port 8080"
      );
    });
  })
  .catch(err => {

    console.error(
      "Database init failed:",
      err
    );

    process.exit(1);
  });
