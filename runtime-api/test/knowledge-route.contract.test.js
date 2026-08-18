'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleKnowledgeRoute
} = require('../routes/knowledge/knowledge-route');

function buildContext({
  method = 'GET',
  url = '/runtime/knowledge',
  path = '/runtime/knowledge',
  body = {},
  scope = 'tenant',
  authTenant = 'tenant-a',
  allowed = true,
  existing = false,
  rows = null
} = {}) {
  const sent = [];
  const queries = [];
  const events = [];

  const db = {
    async query(sql, params) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ sql: normalized, params });

      if (
        normalized.includes('SELECT knowledge_id') &&
        normalized.includes('FROM runtime_knowledge')
      ) {
        return existing
          ? { rows: [{ knowledge_id: params[0] }] }
          : { rows: [] };
      }

      if (normalized.includes('INSERT INTO runtime_knowledge')) {
        return {
          rows: [{
            knowledge_id: params[0],
            tenant_id: params[1],
            object_id: params[2],
            knowledge_type: params[3],
            parent_knowledge_id: params[4],
            title: params[5],
            description: params[6],
            content: params[7],
            source: params[8],
            language_code: params[9],
            version: params[10],
            status: params[11],
            created_by: params[12]
          }]
        };
      }

      if (
        normalized.includes('SELECT *') &&
        normalized.includes('FROM runtime_knowledge')
      ) {
        return { rows: rows || [] };
      }

      if (
        normalized.includes('FROM runtime_knowledge') &&
        normalized.includes('parent_knowledge_id')
      ) {
        return { rows: [] };
      }

      if (normalized.includes('FROM runtime_knowledge')) {
        return { rows: rows || [] };
      }

      throw new Error('UNEXPECTED_QUERY: ' + normalized);
    }
  };

  return {
    sent,
    queries,
    events,
    context: {
      req: { method, url },
      res: {},
      path,
      db,

      send(_res, code, response) {
        sent.push({ code, response });
      },

      requireRole() {
        if (!allowed) {
          return {
            allowed: false,
            code: 403,
            response: { error: 'forbidden' }
          };
        }

        return {
          allowed: true,
          user: {
            scope,
            tenant_id: authTenant,
            operator_id: 'operator-1',
            username: 'tester'
          }
        };
      },

      async readBody() {
        return body;
      },

      async writeEvent(event) {
        events.push(event);
      }
    }
  };
}

test('declines unrelated route', async () => {
  const f = buildContext({
    method: 'GET',
    url: '/runtime/unrelated',
    path: '/runtime/unrelated'
  });

  assert.equal(await handleKnowledgeRoute(f.context), false);
  assert.equal(f.sent.length, 0);
  assert.equal(f.queries.length, 0);
});

test('blocks unauthorized list request', async () => {
  const f = buildContext({ allowed: false });

  assert.equal(await handleKnowledgeRoute(f.context), true);
  assert.equal(f.sent[0].code, 403);
  assert.equal(f.queries.length, 0);
});

test('tenant list is scoped to authenticated tenant', async () => {
  const f = buildContext({
    url: '/runtime/knowledge?tenant_id=tenant-b'
  });

  await handleKnowledgeRoute(f.context);

  assert.deepEqual(f.queries[0].params, ['tenant-a']);
  assert.equal(f.sent[0].code, 200);
  assert.equal(f.sent[0].response.tenant_id, 'tenant-a');
});

test('global list may select explicit tenant', async () => {
  const f = buildContext({
    url: '/runtime/knowledge?tenant_id=tenant-b',
    scope: 'global',
    authTenant: 'system'
  });

  await handleKnowledgeRoute(f.context);

  assert.deepEqual(f.queries[0].params, ['tenant-b']);
  assert.equal(f.sent[0].response.tenant_id, 'tenant-b');
});

test('POST rejects missing required fields before database write', async () => {
  const f = buildContext({
    method: 'POST',
    body: { title: 'Incomplete knowledge' }
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(f.sent[0].code, 400);
  assert.equal(
    f.sent[0].response.error,
    'missing_required_knowledge_fields'
  );
  assert.equal(f.queries.length, 0);
  assert.equal(f.events.length, 0);
});

test('detail blocks cross-tenant object', async () => {
  const f = buildContext({
    path: '/runtime/knowledge/kn-cross',
    url: '/runtime/knowledge/kn-cross',
    rows: [{
      knowledge_id: 'kn-cross',
      tenant_id: 'tenant-b',
      title: 'Cross tenant'
    }]
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(f.sent[0].code, 403);
  assert.equal(
    f.sent[0].response.error,
    'tenant_scope_violation'
  );
});

test('detail returns 404 for unknown knowledge', async () => {
  const f = buildContext({
    path: '/runtime/knowledge/kn-missing',
    url: '/runtime/knowledge/kn-missing'
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(f.sent[0].code, 404);
  assert.equal(
    f.sent[0].response.error,
    'knowledge_not_found'
  );
});

test('creates tenant-scoped knowledge with object_id and source', async () => {
  const f = buildContext({
    method: 'POST',
    body: {
      knowledge_id: 'kn-001',
      tenant_id: 'tenant-b',
      object_id: 'object-001',
      knowledge_type: 'procedure',
      title: 'Test Procedure',
      content: { step: 1 },
      source: 'verified-source',
      language_code: 'de',
      version: 2,
      status: 'active'
    }
  });

  await handleKnowledgeRoute(f.context);

  const insert = f.queries[1];

  assert.equal(f.sent[0].code, 200);
  assert.equal(insert.params[0], 'kn-001');
  assert.equal(insert.params[1], 'tenant-a');
  assert.equal(insert.params[2], 'object-001');
  assert.equal(insert.params[8], 'verified-source');
  assert.equal(insert.params[10], 2);
  assert.equal(insert.params[12], 'operator-1');

  assert.equal(f.events.length, 1);
  assert.equal(
    f.events[0].event_type,
    'runtime.knowledge.created'
  );
  assert.equal(f.events[0].object_id, 'kn-001');
  assert.equal(f.events[0].tenant_id, 'tenant-a');
});

test('global scope may create for explicit tenant', async () => {
  const f = buildContext({
    method: 'POST',
    scope: 'global',
    authTenant: 'system',
    body: {
      knowledge_id: 'kn-global',
      tenant_id: 'tenant-b',
      knowledge_type: 'policy',
      title: 'Global Created'
    }
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(f.sent[0].code, 200);
  assert.equal(f.queries[1].params[1], 'tenant-b');
  assert.equal(f.events[0].tenant_id, 'tenant-b');
});

test('defaults source language version and status', async () => {
  const f = buildContext({
    method: 'POST',
    body: {
      knowledge_id: 'kn-default',
      knowledge_type: 'note',
      title: 'Defaults'
    }
  });

  await handleKnowledgeRoute(f.context);

  const insert = f.queries[1];

  assert.equal(insert.params[8], 'manual');
  assert.equal(insert.params[9], 'de');
  assert.equal(insert.params[10], 1);
  assert.equal(insert.params[11], 'active');
});

test('serializes non-string content', async () => {
  const f = buildContext({
    method: 'POST',
    body: {
      knowledge_id: 'kn-json',
      knowledge_type: 'evidence',
      title: 'JSON Content',
      content: { alpha: 1, beta: true }
    }
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(
    f.queries[1].params[7],
    JSON.stringify({ alpha: 1, beta: true })
  );
});

test('duplicate knowledge_id is rejected before insert and event', async () => {
  const f = buildContext({
    method: 'POST',
    existing: true,
    body: {
      knowledge_id: 'kn-existing',
      knowledge_type: 'procedure',
      title: 'Duplicate'
    }
  });

  await handleKnowledgeRoute(f.context);

  assert.equal(f.sent[0].code, 409);
  assert.equal(
    f.sent[0].response.error,
    'knowledge_already_exists'
  );
  assert.equal(f.queries.length, 1);
  assert.equal(f.events.length, 0);
});

test('successful create emits event after insert', async () => {
  const sequence = [];

  const f = buildContext({
    method: 'POST',
    body: {
      knowledge_id: 'kn-sequence',
      knowledge_type: 'procedure',
      title: 'Sequence'
    }
  });

  const originalQuery = f.context.db.query;

  f.context.db.query = async (...args) => {
    const result = await originalQuery(...args);

    if (
      String(args[0])
        .replace(/\s+/g, ' ')
        .includes('INSERT INTO runtime_knowledge')
    ) {
      sequence.push('insert');
    }

    return result;
  };

  f.context.writeEvent = async () => {
    sequence.push('event');
  };

  await handleKnowledgeRoute(f.context);

  assert.deepEqual(sequence, ['insert', 'event']);
});

test('knowledge record identity remains distinct from referenced object identity', async () => {
  const f = buildContext({
    method: 'POST',
    body: {
      knowledge_id: 'kn-identity-test',
      object_id: 'domain-object-4711',
      knowledge_type: 'test',
      title: 'Dual identity test'
    }
  });

  await handleKnowledgeRoute(f.context);

  const insert = f.queries[1];

  assert.equal(insert.params[0], 'kn-identity-test');
  assert.equal(insert.params[2], 'domain-object-4711');

  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].object_id, 'kn-identity-test');

  assert.notEqual(
    f.events[0].object_id,
    insert.params[2]
  );
});
