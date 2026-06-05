const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "change-me";

const tenant_id =
  process.env.RSOS_AUTONOMOUS_WORKER_TENANT ||
  "tenant-rudolph";

function createToken() {
  return jwt.sign(
    {
      operator_id: "autonomous-worker",
      role: "runtime_admin",
      tenant_id
    },
    JWT_SECRET,
    {
      expiresIn: "1h"
    }
  );
}

async function workerTick() {
  const token = createToken();

  try {
    const response = await fetch(
      "http://127.0.0.1:8080/runtime/worker/run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (result.worker !== "idle") {
      console.log(new Date().toISOString(), JSON.stringify(result));
    }
  } catch (err) {
    console.error("Worker tick failed:", err.message);
  }
}

console.log("RS OS Autonomous Worker started");

setInterval(workerTick, 5000);
workerTick();
