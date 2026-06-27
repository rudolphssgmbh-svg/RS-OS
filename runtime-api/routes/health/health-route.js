function handleHealthRoute(req, res, send) {
  return send(res, 200, {
    status: "ok",
    service: "rsos-runtime-api",
    database: "connected"
  });
}

module.exports = { handleHealthRoute };
