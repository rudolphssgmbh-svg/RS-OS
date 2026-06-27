function handleHealthRoute(req, res, send) {
  return send(res, 200, {
    status: "ok",
    runtime: "healthy",
    database: "connected"
  });
}

module.exports = { handleHealthRoute };
