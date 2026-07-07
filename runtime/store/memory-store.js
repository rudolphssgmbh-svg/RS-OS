class MemoryStore {
  constructor() {
    this.graphs = new Map();
  }

  addGraph(graph) {
    this.graphs.set(graph.execution_graph_id, graph);
  }

  async getGraph(id) {
    return this.graphs.get(id);
  }
}

module.exports = MemoryStore;
