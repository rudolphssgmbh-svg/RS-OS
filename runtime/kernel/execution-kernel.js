const { randomUUID } = require("crypto");

class ExecutionKernel {
  constructor(store, eventBus, executionStore, validator) {
    this.store = store;
    this.eventBus = eventBus;
    this.executionStore = executionStore;
    this.validator = validator;
  }

  async loadGraph(graphId) {
    const graph = await this.store.getGraph(graphId);
    if (!graph) throw new Error("GRAPH_NOT_FOUND");
    return graph;
  }

  async run(graphId) {
    const graph = await this.loadGraph(graphId);

    // 🔐 VALIDATION GATE (NEW)
    this.validator.validateExecution(graph);

    const executionId = randomUUID();

    this.executionStore.create(executionId, graphId);
    this.executionStore.setStatus(executionId, "RUNNING");

    this.eventBus.emit("execution_started", { executionId, graphId });

    for (const node of graph.nodes) {
      this.validator.validateNode(node);

      this.eventBus.emit("node_started", { executionId, nodeId: node.node_id });

      this.executionStore.addNode(executionId, {
        nodeId: node.node_id,
        status: "COMPLETED"
      });

      this.eventBus.emit("node_completed", { executionId, nodeId: node.node_id });
    }

    this.executionStore.setStatus(executionId, "COMPLETED");

    this.eventBus.emit("execution_completed", { executionId });

    return executionId;
  }
}

module.exports = ExecutionKernel;
