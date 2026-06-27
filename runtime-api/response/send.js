function send(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://app.rudolph-buchhaltung.de",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });

  res.end(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

module.exports = { send };
