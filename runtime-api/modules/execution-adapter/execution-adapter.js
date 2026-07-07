const path = require("path");

const ExecutionKernel = require("../../../runtime/kernel/execution-kernel");
const EventBus = require("../../../runtime/events/event-bus");
const MemoryStore = require("../../../runtime/store/memory-store");
const ExecutionStore = require("../../../runtime/persistence/execution-store");
const ExecutionGovernance = require("../../../runtime/governance/execution-governance");
const ExecutionValidator = require("../../../runtime/validation/execution-validator");

class ExecutionAdapter {
  constructor() {
    this.store = new MemoryStore();
    this.events = new EventBus();
    this.governance = new ExecutionGovernance();
    this.executionStore = new ExecutionStore(this.governance);
    this.validator = new ExecutionValidator();

    this.kernel = new ExecutionKernel(
      this.store,
      this.events,
      this.executionStore,
      this.validator
    );
  }

  registerGraph(graph) {
    if (!graph || !graph.execution_graph_id) {
      throw new Error("invalid_execution_graph");
    }

    this.store.addGraph(graph);

    return {
      registered: true,
      execution_graph_id: graph.execution_graph_id
    };
  }

  async runGraph(executionGraphId) {
    if (!executionGraphId) {
      throw new Error("missing_execution_graph_id");
    }

    const executionId = await this.kernel.run(executionGraphId);
    const execution = this.executionStore.get(executionId);

    return {
      execution_id: executionId,
      execution
    };
  }

  getExecutions() {
    return this.executionStore.getAll();
  }
}

module.exports = {
  ExecutionAdapter
};
