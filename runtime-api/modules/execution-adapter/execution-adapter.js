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

  normalizeExecutionResult(execution) {
    if (!execution) {
      throw new Error("missing_execution_result");
    }

    const nodes = Array.isArray(execution.nodes) ? execution.nodes : [];
    const completedNodes = nodes.filter(node => node.status === "COMPLETED");

    return {
      execution_id: execution.executionId,
      execution_graph_id: execution.graphId,
      status: execution.status,
      node_count: nodes.length,
      completed_nodes: completedNodes.length,
      governance_status: execution.signature ? execution.signature.governanceStatus : null,
      signature_hash: execution.signature ? execution.signature.hash : null,
      created_at: execution.createdAt || null,
      updated_at: execution.updatedAt || null
    };
  }

  async runGraph(executionGraphId) {
    if (!executionGraphId) {
      throw new Error("missing_execution_graph_id");
    }

    const executionId = await this.kernel.run(executionGraphId);
    const execution = this.executionStore.getById(executionId);

    if (!execution) {
      throw new Error("execution_result_not_found");
    }

    return {
      execution_id: executionId,
      execution: this.normalizeExecutionResult(execution),
      raw_execution: execution
    };
  }


  loadGraph(graphDefinition) {
    if (!graphDefinition) {
      throw new Error("missing_graph_definition");
    }

    if (!graphDefinition.execution_graph_id) {
      throw new Error("missing_execution_graph_id");
    }

    if (!Array.isArray(graphDefinition.nodes)) {
      throw new Error("missing_execution_nodes");
    }

    this.registerGraph(graphDefinition);

    return {
      loaded: true,
      execution_graph_id: graphDefinition.execution_graph_id,
      node_count: graphDefinition.nodes.length
    };
  }

  getExecutions() {
    return this.executionStore.getAll();
  }
}

module.exports = {
  ExecutionAdapter
};
