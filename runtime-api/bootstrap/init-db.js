async function initDb(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_objects (
      object_id TEXT PRIMARY KEY,
      runtime_type TEXT NOT NULL,
      state TEXT NOT NULL,
      priority TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      tenant_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      object_id TEXT,
      message TEXT,
      audit_hash TEXT,
      previous_hash TEXT,
      tenant_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_execution_jobs (
      job_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      result_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("Database initialized");
}

module.exports = { initDb };
