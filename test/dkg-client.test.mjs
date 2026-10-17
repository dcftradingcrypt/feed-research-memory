import test from 'node:test';
import assert from 'node:assert/strict';
import { DkgClient, latestRevisions, readMemory, readPackets, MEMORY_RECORD_LIMIT } from '../src/dkg.mjs';
import { NS } from '../src/model.mjs';

const record = { name: 'feed-test', root: 'urn:test:record', quads: [
  { subject: 'urn:test:record', predicate: `${NS}digest`, object: '"fixed"' },
  { subject: 'urn:test:record', predicate: `${NS}ingestedAt`, object: '"now"' },
] };

test('the API origin contract rejects a silently discarded path prefix', () => {
  assert.throws(() => new DkgClient({ url: 'http://127.0.0.1:9200/prefix' }), /without a path prefix/);
});

test('an unchanged record avoids a second mutation and preserves first ingestion time', async () => {
  const requests = [];
  const client = new DkgClient({ fetchImpl: async (url, init) => {
    requests.push([url.pathname, init.method]);
    return Response.json({ quads: record.quads.map((q) => q.predicate === `${NS}ingestedAt` ? { ...q, object: '"yesterday"' } : q) });
  } });
  const result = await client.ensure('example', record, { ignoreIngestedAt: true });
  assert.equal(result.outcome, 'unchanged');
  assert.deepEqual(requests.map(([, method]) => method), ['GET', 'GET']);
});

test('a lost creation response is reconciled by reading the same deterministic KA', async () => {
  let stored = false;
  let mutations = 0;
  const client = new DkgClient({ fetchImpl: async (_url, init) => {
    if (init.method === 'POST') { mutations++; stored = true; throw new Error('Lost response'); }
    return stored ? Response.json({ quads: record.quads }) : new Response('', { status: 404 });
  } });
  assert.equal((await client.ensure('example', record)).outcome, 'reconciled');
  assert.equal(mutations, 1);
});

test('mismatched existing content is not silently overwritten', async () => {
  let mutations = 0;
  const client = new DkgClient({ fetchImpl: async (_url, init) => {
    if (init.method === 'POST') mutations++;
    return Response.json({ quads: [] });
  } });
  await assert.rejects(() => client.ensure('example', record), /does not match/);
  assert.equal(mutations, 0);
});

test('current inbox chooses latest ingestion while history remains available', () => {
  const revisions = [
    { identity: 'a', root: 'urn:a:2', ingestedAt: '2026-10-17T12:00:00Z' },
    { identity: 'b', root: 'urn:b:1', ingestedAt: '2026-10-17T11:00:00Z' },
    { identity: 'a', root: 'urn:a:1', ingestedAt: '2026-10-17T10:00:00Z' },
  ];
  assert.deepEqual(latestRevisions(revisions).map((r) => r.root), ['urn:a:2', 'urn:b:1']);
  assert.equal(revisions.length, 3);
});

test('capacity limits fail explicitly instead of returning a truncated research history', async () => {
  const client = { query: async () => Array(MEMORY_RECORD_LIMIT + 1).fill({}) };
  await assert.rejects(() => readMemory(client, 'example'), /no partial result/);
  await assert.rejects(() => readPackets(client, 'example'), /no partial result/);
});
