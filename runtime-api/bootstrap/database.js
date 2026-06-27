const { Pool } = require("pg");

const db = new Pool({
  host: process.env.DB_HOST || "rsos-postgres",
  port: 5432,
  user: process.env.DB_USER || "rsos",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "rsos_runtime"
});

module.exports = { db };
