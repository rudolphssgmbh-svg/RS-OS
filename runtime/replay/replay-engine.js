class ReplayEngine {
  constructor(executionStore) {
    this.executionStore = executionStore;
  }

  getExecution(executionId) {
    return this.executionStore.getAll()
      .find(e => e.executionId === executionId);
  }

  replay(executionId) {
    const execution = this.getExecution(executionId);

    if (!execution) {
      throw new Error("EXECUTION_NOT_FOUND");
    }

    const trace = [];

    trace.push({
      step: "LOAD_EXECUTION",
      executionId
    });

    trace.push({
      step: "GRAPH_ID",
      value: execution.graphId
    });

    for (const node of execution.nodes) {
      trace.push({
        step: "NODE_REPLAY",
        nodeId: node.nodeId,
        status: node.status
      });
    }

    trace.push({
      step: "FINAL_STATE",
      status: execution.status
    });

    return trace;
  }
}

module.exports = ReplayEngine;
