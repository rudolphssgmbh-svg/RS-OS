const http = require("http");
const ExecutionKernel = require("../kernel/execution-kernel");
const EventBus = require("../events/event-bus");
const MemoryStore = require("../store/memory-store");
const ExecutionStore = require("../persistence/execution-store");
const ExecutionGovernance = require("../governance/execution-governance");
const ReplayEngine = require("../replay/replay-engine");
const ExecutionValidator = require("../validation/execution-validator");

const store = new MemoryStore();
const events = new EventBus();
const governance = new ExecutionGovernance();
const executionStore = new ExecutionStore(governance);
const replayEngine = new ReplayEngine(executionStore);
const validator = new ExecutionValidator();

const kernel = new ExecutionKernel(store, events, executionStore, validator);

store.addGraph({
  execution_graph_id: "graph-001",
  nodes: [
    { node_id: "n1", type: "execute" },
    { node_id: "n2", type: "observe" }
  ]
});

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 8100;

const server = http.createServer(async (req, res) => {

  try {

    if (req.url === "/run") {
      const id = await kernel.run("graph-001");
      res.end(JSON.stringify({ executionId: id }));
      return;
    }

    if (req.url === "/executions") {
      res.end(JSON.stringify(executionStore.getAll(), null, 2));
      return;
    }

    res.end("RSOS RUNTIME ACTIVE");

  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("RSOS Runtime listening on :", PORT);
});
