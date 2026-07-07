const { spawn } = require("child_process");

let child = null;

function start(port = 8100) {
  if (child) throw new Error("ALREADY_RUNNING");

  child = spawn("node", ["runtime/api/server.js", port], {
    stdio: "inherit"
  });

  console.log("RSOS STARTED ON PORT", port);

  child.on("exit", () => {
    child = null;
    console.log("RSOS STOPPED");
  });
}

function stop() {
  if (child) {
    child.kill();
    child = null;
  }
}

function status() {
  return child ? "RUNNING" : "STOPPED";
}

module.exports = { start, stop, status };
