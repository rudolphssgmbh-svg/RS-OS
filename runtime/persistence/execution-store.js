const fs = require("fs");
const path = "/tmp/rsos-executions.json";

class ExecutionStore {
  constructor(governance = null) {
    this.executions = [];
    this.governance = governance;
    this.load();
  }

  load() {
    if (!fs.existsSync(path)) return;
    const raw = JSON.parse(fs.readFileSync(path));
    this.executions = raw.filter(e => e.executionId && !e.legacy);
  }

  save() {
    fs.writeFileSync(path, JSON.stringify(this.executions, null, 2));
  }

  create(executionId, graphId) {
    const exec = {
      executionId,
      graphId,
      status: "CREATED",
      nodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      signature: null
    };
    this.executions.push(exec);
    this.save();
    return exec;
  }

  setStatus(executionId, status) {
    const exec = this.executions.find(e => e.executionId === executionId);
    if (!exec) return null;
    exec.status = status;
    exec.updatedAt = new Date().toISOString();
    if (this.governance && status === "COMPLETED") {
      exec.signature = this.governance.signExecution(exec);
    }
    this.save();
    return exec;
  }

  addNode(executionId, node) {
    const exec = this.executions.find(e => e.executionId === executionId);
    if (!exec) return null;
    exec.nodes.push(node);
    exec.updatedAt = new Date().toISOString();
    this.save();
    return exec;
  }

  getAll() {
    return this.executions;
  }

  getById(executionId) {
    return this.executions.find(e => e.executionId === executionId);
  }
}

module.exports = ExecutionStore;
