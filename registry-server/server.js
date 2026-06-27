const basicAuth = require("express-basic-auth");
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");

const PORT = Number(process.env.RSOS_REGISTRY_PORT || 8090);
const HOST = process.env.RSOS_REGISTRY_HOST || "127.0.0.1";
const BASE_DIR = process.env.RSOS_REGISTRY_BASE_DIR || "/opt/rsos/registry-server";
const DATA_DIR = process.env.RSOS_REGISTRY_DATA_DIR || path.join(BASE_DIR, "data");
const AUTH_USER = process.env.RSOS_REGISTRY_USER || "admin";
const AUTH_PASSWORD = process.env.RSOS_REGISTRY_PASSWORD || "RSOS-2026-SECURE";
const MAX_JSON_SIZE = process.env.RSOS_REGISTRY_MAX_JSON_SIZE || "2mb";
const MAX_UPLOAD_BYTES = Number(process.env.RSOS_REGISTRY_MAX_UPLOAD_BYTES || 250 * 1024 * 1024);
const MAX_EVENTS = Number(process.env.RSOS_REGISTRY_MAX_EVENTS || 2000);
const FLEET_SCAN_INTERVAL_MS = Number(process.env.RSOS_FLEET_SCAN_INTERVAL_MS || 60000);

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const FLEET_DIR = path.join(DATA_DIR, "fleet");
const COMMAND_DIR = path.join(DATA_DIR, "commands");
const METRICS_DIR = path.join(DATA_DIR, "metrics");
const ALERTS_DIR = path.join(DATA_DIR, "alerts");

const REGISTRY_FILE = path.join(DATA_DIR, "registry.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const CONTROL_FILE = path.join(BASE_DIR, "control.html");
const ROOT_PUBLIC_KEY_FILE = path.join(BASE_DIR, "keys/root_public.pem");

const ALLOWED_COMMANDS = new Set([
  "restart-runtime",
  "pull-latest",
  "rollback-runtime"
]);

const PACKAGE_RE = /^[a-zA-Z0-9._-]+\.rspkg$/;
const SIGNATURE_RE = /^[a-zA-Z0-9._-]+\.rspkg\.sig$/;
const NODE_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

for (const dir of [DATA_DIR, UPLOAD_DIR, FLEET_DIR, COMMAND_DIR, METRICS_DIR, ALERTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const ROOT_PUBLIC_KEY = fs.existsSync(ROOT_PUBLIC_KEY_FILE)
  ? fs.readFileSync(ROOT_PUBLIC_KEY_FILE)
  : null;

app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(
  basicAuth({
    users: { [AUTH_USER]: AUTH_PASSWORD },
    challenge: true,
    unauthorizedResponse: () => ({ error: "unauthorized" })
  })
);

app.use(express.json({ limit: MAX_JSON_SIZE }));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function sendError(res, status, error, details = {}) {
  return res.status(status).json({
    error,
    ...details,
    time: new Date().toISOString()
  });
}

function atomicWriteFile(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function safeReadJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteJSON(file, data) {
  atomicWriteFile(file, JSON.stringify(data, null, 2));
}

function readJsonFilesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => safeReadJSON(path.join(dir, entry.name), null))
    .filter(Boolean);
}

function safePackageName(filename) {
  if (!filename) return null;
  const safeName = path.basename(String(filename));
  return PACKAGE_RE.test(safeName) ? safeName : null;
}

function safeSignatureName(filename) {
  if (!filename) return null;
  const safeName = path.basename(String(filename));
  return SIGNATURE_RE.test(safeName) ? safeName : null;
}

function safeNodeId(nodeId) {
  if (!nodeId) return null;
  const value = String(nodeId);
  return NODE_ID_RE.test(value) ? value : null;
}

function loadRegistry() {
  return safeReadJSON(REGISTRY_FILE, []);
}

function saveRegistry(data) {
  safeWriteJSON(REGISTRY_FILE, data);
}

function readEvents() {
  return safeReadJSON(EVENTS_FILE, []);
}

function writeEvents(events) {
  safeWriteJSON(EVENTS_FILE, events.slice(-MAX_EVENTS));
}

function addEvent(type, node, message, data = {}, severity = "info") {
  const events = readEvents();
  const event = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    severity,
    type,
    node: String(node || "system"),
    message,
    data,
    witness: {
      witness_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source_type: "registry-server",
      verification_status: "observed",
      confidence: null,
      reason_code: null
    },
    audit: {
      actor: "system",
      tenant_id: null,
      action_scope: "registry-fleet",
      impact_class: "A",
      requires_review: false
    }
  };

  events.push(event);
  writeEvents(events);
  return event;
}

function addAlert(type, node, message, data = {}, severity = "warning") {
  const alert = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    severity,
    type,
    node: String(node || "system"),
    message,
    data,
    status: "open"
  };

  safeWriteJSON(path.join(ALERTS_DIR, `${alert.id}.json`), alert);
  addEvent("alert", alert.node, message, alert, severity);
  return alert;
}

function getFleetStatus() {
  const now = Date.now();

  return readJsonFilesFromDir(FLEET_DIR).map(node => {
    const last = new Date(node.last_heartbeat).getTime();
    const diff = Number.isFinite(last) ? (now - last) / 1000 : 999999;

    let state = "online";
    if (diff > 60) state = "offline";
    else if (diff > 20) state = "stale";

    return {
      ...node,
      state,
      seconds_since_heartbeat: Math.floor(diff)
    };
  });
}

function verifyPackageSignature(packagePath, signaturePath) {
  if (!ROOT_PUBLIC_KEY) return null;

  return crypto.verify(
    "sha256",
    fs.readFileSync(packagePath),
    ROOT_PUBLIC_KEY,
    fs.readFileSync(signaturePath)
  );
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "rsos-runtime-registry",
    host: HOST,
    port: PORT,
    time: new Date().toISOString()
  });
});

app.get("/control", (req, res) => {
  if (!fs.existsSync(CONTROL_FILE)) {
    return sendError(res, 404, "control_file_not_found");
  }

  res.sendFile(CONTROL_FILE);
});

app.get("/fleet/summary", (req, res) => {
  const nodes = getFleetStatus();
  const metrics = readJsonFilesFromDir(METRICS_DIR);
  const commands = readJsonFilesFromDir(COMMAND_DIR);
  const alerts = readJsonFilesFromDir(ALERTS_DIR).filter(alert => alert.status === "open");

  res.json({
    nodes: {
      total: nodes.length,
      online: nodes.filter(node => node.state === "online").length,
      stale: nodes.filter(node => node.state === "stale").length,
      offline: nodes.filter(node => node.state === "offline").length
    },
    metrics: { total: metrics.length },
    commands: {
      total: commands.length,
      pending: commands.filter(command => command.status === "pending").length,
      completed: commands.filter(command => command.status === "completed").length,
      failed: commands.filter(command => command.status === "failed").length
    },
    alerts: { open: alerts.length },
    time: new Date().toISOString()
  });
});

app.get("/registry/packages", (req, res) => {
  res.json(loadRegistry());
});

app.get("/registry/latest", (req, res) => {
  const registry = loadRegistry();
  if (registry.length === 0) return sendError(res, 404, "no_packages");
  res.json(registry[registry.length - 1]);
});

app.post("/registry/register", (req, res) => {
  const packageName = safePackageName(req.body.package);
  const signatureName = safeSignatureName(req.body.signature);

  if (!packageName) return sendError(res, 400, "invalid_package_name");
  if (req.body.signature && !signatureName) return sendError(res, 400, "invalid_signature_name");

  const entry = {
    package: packageName,
    version: String(req.body.version || "unknown"),
    signature: signatureName,
    deployed_by: String(req.body.deployed_by || "unknown"),
    registered_at: new Date().toISOString()
  };

  const registry = loadRegistry();
  registry.push(entry);
  saveRegistry(registry);
  addEvent("registry", "system", `Package registered: ${entry.package}`, entry);

  res.json({ status: "registered", entry });
});

function handleBinaryUpload(req, res, targetName, targetDir, eventType) {
  const targetPath = path.join(targetDir, targetName);
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  const writeStream = fs.createWriteStream(tmpPath, { flags: "wx" });
  const hash = crypto.createHash("sha256");
  let received = 0;
  let finished = false;

  function cleanup() {
    if (!finished && fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
  }

  req.on("data", chunk => {
    received += chunk.length;
    if (received > MAX_UPLOAD_BYTES) {
      req.destroy(new Error("upload_too_large"));
      return;
    }
    hash.update(chunk);
  });

  req.on("error", err => {
    cleanup();
    addEvent("error", "system", `${eventType} upload failed`, { targetName, error: err.message }, "error");
    if (!res.headersSent) sendError(res, 413, err.message === "upload_too_large" ? "upload_too_large" : "upload_failed");
  });

  writeStream.on("finish", () => {
    finished = true;
    fs.renameSync(tmpPath, targetPath);
    const result = {
      status: "uploaded",
      file: targetName,
      sha256: hash.digest("hex"),
      size: received,
      path: targetPath
    };

    addEvent(eventType, "system", `${eventType} uploaded: ${targetName}`, result);
    res.json(result);
  });

  writeStream.on("error", err => {
    cleanup();
    addEvent("error", "system", `${eventType} upload failed`, { targetName, error: err.message }, "error");
    if (!res.headersSent) sendError(res, 500, "upload_failed", { message: err.message });
  });

  req.pipe(writeStream);
}

app.post("/upload", (req, res) => {
  const safeName = safePackageName(req.headers["x-rsos-package-name"]);
  if (!safeName) return sendError(res, 400, "invalid_package_name");
  return handleBinaryUpload(req, res, safeName, UPLOAD_DIR, "package");
});

app.post("/upload/signature", (req, res) => {
  const safeName = safeSignatureName(req.headers["x-rsos-package-name"]);
  if (!safeName) return sendError(res, 400, "invalid_signature_name");
  return handleBinaryUpload(req, res, safeName, UPLOAD_DIR, "signature");
});

app.get("/packages", (req, res) => {
  const channel = String(req.query.channel || "all");
  const allowedChannels = new Set(["all", "stable", "beta", "dev"]);
  if (!allowedChannels.has(channel)) return sendError(res, 400, "invalid_channel");

  const files = fs
    .readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".rspkg"))
    .filter(entry => {
      if (channel === "all") return true;
      if (channel === "stable") return entry.name.includes("rsos-runtime-") && !entry.name.includes("beta") && !entry.name.includes("dev");
      return entry.name.includes(channel);
    })
    .map(entry => {
      const fullPath = path.join(UPLOAD_DIR, entry.name);
      const stat = fs.statSync(fullPath);
      const signaturePath = `${fullPath}.sig`;

      return {
        package: entry.name,
        channel,
        size: stat.size,
        uploaded_at: stat.mtime.toISOString(),
        signature_present: fs.existsSync(signaturePath)
      };
    })
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

  res.json({ channel, packages: files });
});

app.get("/download/:package", (req, res) => {
  const safeName = safePackageName(req.params.package);
  if (!safeName) return sendError(res, 400, "invalid_package_name");

  const filePath = path.join(UPLOAD_DIR, safeName);
  if (!fs.existsSync(filePath)) return sendError(res, 404, "package_not_found");

  addEvent("download", "system", `Package downloaded: ${safeName}`, { package: safeName });
  res.download(filePath, safeName);
});

app.get("/verify/:package", (req, res) => {
  if (!ROOT_PUBLIC_KEY) return sendError(res, 500, "root_public_key_missing");

  const safeName = safePackageName(req.params.package);
  if (!safeName) return sendError(res, 400, "invalid_package_name");

  const packagePath = path.join(UPLOAD_DIR, safeName);
  const signaturePath = path.join(UPLOAD_DIR, `${safeName}.sig`);

  if (!fs.existsSync(packagePath)) return sendError(res, 404, "package_not_found");
  if (!fs.existsSync(signaturePath)) return sendError(res, 404, "signature_not_found");

  const verified = verifyPackageSignature(packagePath, signaturePath);
  const result = { package: safeName, signature: `${safeName}.sig`, verified };

  addEvent(
    verified ? "verify" : "error",
    "system",
    verified ? `Package verified: ${safeName}` : `Package verification failed: ${safeName}`,
    result,
    verified ? "info" : "error"
  );

  res.json(result);
});

app.post("/fleet/checkin", (req, res) => {
  const nodeId = safeNodeId(req.body.node_id);
  if (!nodeId) return sendError(res, 400, "invalid_or_missing_node_id");

  const node = {
    node_id: nodeId,
    hostname: String(req.body.hostname || ""),
    version: String(req.body.version || "unknown"),
    channel: String(req.body.channel || "stable"),
    health: req.body.health || {},
    last_heartbeat: new Date().toISOString()
  };

  safeWriteJSON(path.join(FLEET_DIR, `${node.node_id}.json`), node);
  addEvent("checkin", node.node_id, "Node checked in", node);
  res.json({ status: "checked_in", node });
});

app.post("/fleet/heartbeat", (req, res) => {
  const nodeId = safeNodeId(req.body.node_id);
  if (!nodeId) return sendError(res, 400, "invalid_or_missing_node_id");

  const existing = safeReadJSON(path.join(FLEET_DIR, `${nodeId}.json`), {});
  const node = {
    ...existing,
    node_id: nodeId,
    hostname: String(req.body.hostname || existing.hostname || ""),
    version: String(req.body.version || existing.version || "unknown"),
    channel: String(req.body.channel || existing.channel || "stable"),
    health: req.body.health || existing.health || {},
    last_heartbeat: new Date().toISOString()
  };

  safeWriteJSON(path.join(FLEET_DIR, `${node.node_id}.json`), node);
  addEvent("heartbeat", node.node_id, "Heartbeat received", node);
  res.json({ status: "heartbeat_received", node });
});

app.get("/fleet/nodes", (req, res) => {
  const nodes = readJsonFilesFromDir(FLEET_DIR);
  res.json({ total_nodes: nodes.length, nodes });
});

app.get("/fleet/status", (req, res) => {
  const nodes = getFleetStatus();
  res.json({ total_nodes: nodes.length, nodes });
});

app.post("/fleet/scan", (req, res) => {
  const alerts = runFleetScan();
  res.json({ status: "scan_completed", alerts_created: alerts.length, alerts });
});

app.post("/fleet/command", (req, res) => {
  const nodeId = safeNodeId(req.body.node_id);
  const action = String(req.body.action || "");

  if (!nodeId || !action) return sendError(res, 400, "missing_node_id_or_action");
  if (!ALLOWED_COMMANDS.has(action)) {
    return sendError(res, 400, "invalid_action", { allowed: [...ALLOWED_COMMANDS] });
  }

  const command = {
    id: crypto.randomUUID(),
    node_id: nodeId,
    action,
    payload: req.body.payload || {},
    created_at: new Date().toISOString(),
    status: "pending"
  };

  safeWriteJSON(path.join(COMMAND_DIR, `${command.id}.json`), command);
  addEvent("command", command.node_id, `Command queued: ${command.action}`, command);
  res.json({ status: "queued", command });
});

app.get("/fleet/commands", (req, res) => {
  const commands = readJsonFilesFromDir(COMMAND_DIR).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ total_commands: commands.length, commands });
});

app.get("/fleet/commands/:node", (req, res) => {
  const nodeId = safeNodeId(req.params.node);
  if (!nodeId) return sendError(res, 400, "invalid_node_id");

  const commands = readJsonFilesFromDir(COMMAND_DIR).filter(
    command => command.node_id === nodeId && command.status === "pending"
  );

  res.json({ node: nodeId, commands });
});

app.post("/fleet/result", (req, res) => {
  const id = String(req.body.command_id || "");
  if (!id) return sendError(res, 400, "missing_command_id");

  const file = path.join(COMMAND_DIR, `${path.basename(id)}.json`);
  if (!fs.existsSync(file)) return sendError(res, 404, "command_not_found");

  const command = safeReadJSON(file, null);
  if (!command) return sendError(res, 500, "command_file_invalid");

  command.status = req.body.success === false ? "failed" : "completed";
  command.result = req.body.result;
  command.completed_at = new Date().toISOString();

  safeWriteJSON(file, command);

  addEvent(
    command.status === "failed" ? "error" : "result",
    command.node_id,
    command.status === "failed" ? `Command failed: ${command.action}` : `Command completed: ${command.action}`,
    command,
    command.status === "failed" ? "error" : "info"
  );

  if (command.status === "failed") {
    addAlert("command_failed", command.node_id, `Command failed: ${command.action}`, command, "error");
  }

  res.json({ status: "result_received", command_id: id, command_status: command.status });
});

app.post("/fleet/metrics", (req, res) => {
  const nodeId = safeNodeId(req.body.node_id);
  if (!nodeId) return sendError(res, 400, "invalid_or_missing_node_id");

  const metrics = {
    node_id: nodeId,
    hostname: String(req.body.hostname || ""),
    cpu_load: Number(req.body.cpu_load || 0),
    memory_used_mb: Number(req.body.memory_used_mb || 0),
    memory_total_mb: Number(req.body.memory_total_mb || 0),
    disk_used_percent: Number(req.body.disk_used_percent || 0),
    containers_running: Number(req.body.containers_running || 0),
    uptime: Number(req.body.uptime || 0),
    timestamp: new Date().toISOString()
  };

  safeWriteJSON(path.join(METRICS_DIR, `${metrics.node_id}.json`), metrics);
  addEvent("metrics", metrics.node_id, "Metrics received", metrics);

  if (metrics.disk_used_percent >= 90) {
    addAlert("disk_high", metrics.node_id, `Disk usage high: ${metrics.disk_used_percent}%`, metrics, "warning");
  }

  res.json({ status: "metrics_received", metrics });
});

app.get("/fleet/metrics", (req, res) => {
  const metrics = readJsonFilesFromDir(METRICS_DIR);
  res.json({ total_nodes: metrics.length, metrics });
});

app.get("/fleet/events", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  let events = readEvents().slice(-limit).reverse();

  if (req.query.type) events = events.filter(event => event.type === req.query.type);
  if (req.query.node) events = events.filter(event => event.node === req.query.node);

  res.json(events);
});

app.get("/fleet/alerts", (req, res) => {
  const alerts = readJsonFilesFromDir(ALERTS_DIR).sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json({
    total_alerts: alerts.length,
    open_alerts: alerts.filter(alert => alert.status === "open").length,
    alerts
  });
});

app.post("/fleet/alerts/:id/resolve", (req, res) => {
  const id = path.basename(String(req.params.id || ""));
  const file = path.join(ALERTS_DIR, `${id}.json`);

  if (!fs.existsSync(file)) return sendError(res, 404, "alert_not_found");

  const alert = safeReadJSON(file, null);
  if (!alert) return sendError(res, 500, "alert_file_invalid");

  alert.status = "resolved";
  alert.resolved_at = new Date().toISOString();

  safeWriteJSON(file, alert);
  addEvent("alert_resolved", alert.node, `Alert resolved: ${alert.type}`, alert);

  res.json({ status: "resolved", alert });
});

app.post("/fleet/events/clear", (req, res) => {
  addEvent("security", "system", "Blocked attempt to clear registry events", {
    path: req.path,
    method: req.method
  }, "warning");

  return sendError(res, 403, "events_are_immutable");
});

function runFleetScan() {
  const nodes = getFleetStatus();
  const alerts = [];

  for (const node of nodes) {
    const existingAlerts = readJsonFilesFromDir(ALERTS_DIR).filter(alert =>
      alert.node === node.node_id &&
      alert.status === "open" &&
      (alert.type === "node_offline" || alert.type === "node_stale")
    );

    if (existingAlerts.length > 0) continue;

    if (node.state === "offline") {
      alerts.push(addAlert("node_offline", node.node_id, `Node offline: ${node.node_id}`, node, "error"));
    }

    if (node.state === "stale") {
      alerts.push(addAlert("node_stale", node.node_id, `Node stale: ${node.node_id}`, node, "warning"));
    }
  }

  return alerts;
}

setInterval(() => {
  try {
    runFleetScan();
  } catch (err) {
    addEvent("error", "system", "Fleet scan failed", { error: err.message }, "error");
  }
}, FLEET_SCAN_INTERVAL_MS);

app.use((req, res) => {
  sendError(res, 404, "not_found", { path: req.path, method: req.method });
});

app.use((err, req, res, next) => {
  addEvent("error", "system", "Unhandled server error", { error: err.message, path: req.path }, "error");
  if (!res.headersSent) sendError(res, 500, "internal_error", { message: err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`RS OS Runtime Registry running on ${HOST}:${PORT}`);
  addEvent("lifecycle", "system", "Registry service started", {
    service: "rsos-runtime-registry",
    host: HOST,
    port: PORT,
    pid: process.pid,
    started_at: new Date().toISOString()
  });
});
