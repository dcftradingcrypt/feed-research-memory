import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { DkgClient } from '../src/dkg.mjs';

test('real local DKG: import, retry, revisions, research annotation, packet and pinned recall', { timeout: 120000 }, async () => {
  if (!process.env.DKG_API_URL || !process.env.DKG_AUTH_TOKEN_FILE) throw new Error('Set DKG_API_URL and DKG_AUTH_TOKEN_FILE for an isolated, actual local DKG node.');
  const token = (await readFile(process.env.DKG_AUTH_TOKEN_FILE, 'utf8')).trim();
  const client = new DkgClient({ url: process.env.DKG_API_URL, token });
  const directory = await mkdtemp(join(tmpdir(), 'feed-memory-integration-'));
  const graph = `feed-integration-${Date.now()}`;
  const source = 'https://research.example.org/feed.atom';
  const fixture = await readFile(new URL('./fixtures/research.atom', import.meta.url), 'utf8');
  const path = join(directory, 'research.atom');
  const execute = async (...args) => {
    let result;
    await run(args, { client, output: (value) => { result = value; } });
    return result;
  };
  try {
    await execute('create-graph', graph);
    await writeFile(path, fixture);
    const imported = await execute('import', path, '--source', source, '--graph', graph);
    assert.equal(imported.entries.length, 2);
    assert.ok(imported.entries.every((entry) => entry.outcome === 'created'));
    assert.ok((await execute('import', path, '--source', source, '--graph', graph)).entries.every((entry) => entry.outcome === 'unchanged'));

    const firstInbox = await execute('inbox', '--graph', graph);
    const original = firstInbox.entries.find((entry) => entry.id === 'urn:example:method-a');
    assert.match(original.summary, /128 MiB/);
    assert.equal(original.research.status, 'unread');

    await writeFile(path, fixture.replace('128 MiB', '144 MiB'));
    const update = await execute('import', path, '--source', source, '--graph', graph);
    assert.equal(update.entries.filter((entry) => entry.outcome === 'created').length, 1);
    const secondInbox = await execute('inbox', '--graph', graph, '--contains', '144 MiB');
    const selected = secondInbox.entries[0];
    assert.equal(selected.identity, original.identity);
    assert.notEqual(selected.root, original.root);
    const note = 'Uses "144 MiB" in the revised fictional benchmark.\n日本語の研究メモ: 192 MiB の予算に収まる。';
    await execute('annotate', '--graph', graph, '--revision', selected.root, '--status', 'selected', '--actor', 'Local integration research agent', '--tag', 'memory-budget', '--note', note);
    const annotated = (await execute('inbox', '--graph', graph, '--status', 'selected')).entries[0];
    assert.equal(annotated.research.note, note);
    assert.deepEqual(annotated.research.tags, ['memory-budget']);

    const packet = await execute('packet', '--graph', graph, '--revision', selected.root, '--title', 'Method for a 192 MiB budget', '--actor', 'Local integration research agent', '--question', 'Which fictional method fits the 192 MiB memory budget?', '--answer', 'Method A uses 144 MiB in the selected revision and fits the budget.');
    await writeFile(path, fixture.replace('128 MiB', '160 MiB'));
    await execute('import', path, '--source', source, '--graph', graph);
    const latest = (await execute('inbox', '--graph', graph, '--contains', '160 MiB')).entries[0];
    assert.equal(latest.research.status, 'unread');
    assert.equal(latest.identity, selected.identity);
    const history = await execute('history', '--graph', graph, '--identity', selected.identity);
    assert.equal(history.revisions.length, 3);
    assert.ok(history.revisions.some((entry) => entry.root === original.root));
    const recalled = await execute('recall', '--graph', graph, '--packet', packet.root);
    assert.equal(recalled.memoryLayer, 'Working Memory');
    assert.equal(recalled.evidence[0].root, selected.root);
    assert.equal(recalled.evidence[0].digest, selected.digest);
    assert.match(recalled.evidence[0].summary, /144 MiB/);
    assert.equal(recalled.evidence[0].research.note, note);
    assert.equal(recalled.packet.sources[0].url, 'https://research.example.org/notes/method-a');

    await writeFile(path, fixture.replace('128 MiB', '144 MiB'));
    const reverted = await execute('import', path, '--source', source, '--graph', graph);
    assert.ok(reverted.entries.every((entry) => entry.outcome === 'unchanged'));
    assert.equal(reverted.entries.filter((entry) => entry.observation).length, 1);
    const currentAgain = (await execute('inbox', '--graph', graph, '--contains', '144 MiB')).entries[0];
    assert.equal(currentAgain.root, selected.root);
    assert.equal(currentAgain.research.note, note);
    const identical = await execute('import', path, '--source', source, '--graph', graph);
    assert.ok(identical.entries.every((entry) => entry.outcome === 'unchanged' && !entry.observation));
    assert.equal((await execute('recall', '--graph', graph, '--packet', packet.root)).evidence[0].digest, selected.digest);

    const rssPath = new URL('./fixtures/research.rss', import.meta.url);
    const rssImport = await execute('import', rssPath.pathname, '--source', 'https://research.example.org/feed.rss', '--graph', graph);
    assert.equal(rssImport.entries.length, 1);
    assert.equal(rssImport.entries[0].outcome, 'created');
    process.stdout.write('Verified real DKG WM/store workflow, 3 immutable source revisions, exact Unicode/quote/newline note readback and old-evidence recall after later source changes.\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
