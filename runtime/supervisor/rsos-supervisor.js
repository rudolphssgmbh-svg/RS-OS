const fs = require("fs");
const { spawn } = require("child_process");

const PID_FILE = "/tmp/rsos.pid";

let child = null;

function start(port = 8100, detach = true) {
  if (fs.existsSync(PID_FILE)) {
    throw new Error("RSOS_ALREADY_RUNNING");
  }

  const args = ["runtime/api/server.js", port];

  child = spawn("node", args, {
    stdio: detach ? "ignore" : "inherit",
    detached: detach
  });

  fs.writeFileSync(PID_FILE, child.pid.toString());

  if (detach) {
    child.unref();
  }

  console.log("RSOS SUPERVISOR STARTED PID:", child.pid);
}

function stop() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("NOT RUNNING");
    return;
  }

  const pid = parseInt(fs.readFileSync(PID_FILE).toString());

  try {
    process.kill(pid);
    fs.unlinkSync(PID_FILE);
    console.log("RSOS STOPPED PID:", pid);
  } catch (e) {
    console.log("STOP FAILED:", e.message);
  }
}

function status() {
  if (!fs.existsSync(PID_FILE)) return "STOPPED";

  const pid = fs.readFileSync(PID_FILE).toString();
  return `RUNNING PID ${pid}`;
}

module.exports = { start, stop, status };
