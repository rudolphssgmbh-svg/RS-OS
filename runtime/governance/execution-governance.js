const crypto = require("crypto");

class ExecutionGovernance {
  hashExecution(execution) {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(execution))
      .digest("hex");
  }

  signExecution(execution) {
    return {
      executionId: execution.executionId,
      graphId: execution.graphId,
      status: execution.status,
      hash: this.hashExecution(execution),
      signedAt: new Date().toISOString(),
      governanceStatus: "SIGNED"
    };
  }

  verifyExecution(execution, signature) {
    const hash = this.hashExecution(execution);

    return {
      executionId: execution.executionId,
      valid: hash === signature.hash,
      expectedHash: signature.hash,
      actualHash: hash,
      verifiedAt: new Date().toISOString()
    };
  }
}

module.exports = ExecutionGovernance;
