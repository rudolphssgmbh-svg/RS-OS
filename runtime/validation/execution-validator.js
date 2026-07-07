class ExecutionValidator {
  validateGraph(graph) {
    if (!graph) throw new Error("GRAPH_MISSING");
    if (!Array.isArray(graph.nodes)) throw new Error("GRAPH_NODES_INVALID");
    if (graph.nodes.length === 0) throw new Error("GRAPH_EMPTY");
    return true;
  }

  validateNode(node) {
    if (!node.node_id) throw new Error("NODE_MISSING_ID");
    if (!node.type) throw new Error("NODE_MISSING_TYPE");
    return true;
  }

  validateExecution(graph) {
    this.validateGraph(graph);
    for (const node of graph.nodes) this.validateNode(node);
    return true;
  }
}

module.exports = ExecutionValidator;
