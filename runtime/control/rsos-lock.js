const fs = require("fs");
const path = "/tmp/rsos-runtime.lock";

function acquireLock() {
  if (fs.existsSync(path)) {
    throw new Error("RSOS_ALREADY_RUNNING");
  }
  fs.writeFileSync(path, process.pid.toString());
}

function releaseLock() {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

function getLock() {
  if (!fs.existsSync(path)) return null;
  return fs.readFileSync(path).toString();
}

module.exports = { acquireLock, releaseLock, getLock };
