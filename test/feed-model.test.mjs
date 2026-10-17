import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFeed } from '../src/feed.mjs';
import { sourceRecord, annotationRecord, packetRecord, observationRecord, hash, NS } from '../src/model.mjs';

const source = 'https://research.example.org/feed.atom';
const atom = await readFile(new URL('./fixtures/research.atom', import.meta.url), 'utf8');
const rss = await readFile(new URL('./fixtures/research.rss', import.meta.url), 'utf8');

test('Atom preserves stable ids, relative source citations, authors, times and content', () => {
  const feed = parseFeed(atom, source);
  assert.equal(feed.format, 'atom');
  assert.equal(feed.entries.length, 2);
  assert.equal(feed.entries[0].url, 'https://research.example.org/notes/method-a');
  assert.equal(feed.entries[0].id, 'urn:example:method-a');
  assert.equal(feed.entries[0].author, 'Example Research Team');
  assert.equal(feed.entries[0].published, '2026-10-16T10:00:00.000Z');
  assert.match(feed.entries[1].summary, /^<p>In the fictional benchmark/);
});

test('RSS preserves guid, CDATA description, namespaced author and publication time', () => {
  const entry = parseFeed(rss, 'https://research.example.org/feed.rss').entries[0];
  assert.equal(entry.id, 'urn:example:method-a');
  assert.match(entry.summary, /128 MiB/);
  assert.equal(entry.author, 'Example Research Team');
  assert.equal(entry.published, '2026-10-16T10:00:00.000Z');
});

test('Atom extension names do not replace the native title or entry identity', () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:x="urn:extension"><x:title>Extension feed title</x:title><title>Native feed</title><entry><x:id>wrong</x:id><id>urn:native</id><x:title>Wrong</x:title><title>Native entry</title></entry></feed>';
  const feed = parseFeed(xml, source);
  assert.equal(feed.title, 'Native feed');
  assert.equal(feed.entries[0].id, 'urn:native');
  assert.equal(feed.entries[0].title, 'Native entry');
});

test('Atom feed authors are inherited unless the entry declares its own author', () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><author><name>Feed author</name></author><entry><id>urn:a</id><title>A</title></entry><entry><id>urn:b</id><title>B</title><author><name>Entry author</name></author></entry></feed>';
  const feed = parseFeed(xml, source);
  assert.equal(feed.entries[0].author, 'Feed author');
  assert.equal(feed.entries[1].author, 'Entry author');
});

test('RSS link-level xml:base is used for the canonical source citation', () => {
  const xml = '<rss version="2.0"><channel><title>Research</title><item><guid>item-a</guid><title>A</title><link xml:base="https://papers.example/">paper1</link></item></channel></rss>';
  assert.equal(parseFeed(xml, source).entries[0].url, 'https://papers.example/paper1');
});

test('section citations remain distinct when RSS entries use links as their identity', () => {
  const xml = '<rss version="2.0"><channel><title>Research</title><item><title>Method A</title><link>https://papers.example/article#method-a</link></item><item><title>Method B</title><link>https://papers.example/article#method-b</link></item></channel></rss>';
  const feed = parseFeed(xml, source);
  assert.equal(feed.entries[0].url, 'https://papers.example/article#method-a');
  assert.equal(feed.entries[1].id, 'https://papers.example/article#method-b');
  const records = feed.entries.map((entry) => sourceRecord(feed, entry));
  assert.notEqual(records[0].identity, records[1].identity);
});

test('XHTML summaries retain paragraph and table-cell boundaries', () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>urn:example:xhtml</id><title>Report</title><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Memory:128MiB.</p><p>Time:12ms.</p><table><tr><td>Method</td><td>MiB</td></tr><tr><td>A</td><td>128</td></tr></table></div></content></entry></feed>';
  const summary = parseFeed(xml, source).entries[0].summary;
  assert.match(summary, /Memory:128MiB\.\n+Time:12ms\./);
  assert.match(summary, /Method\tMiB/);
  assert.match(summary, /A\t128/);
});

test('RSS permalink GUID can supply a citation; opaque GUID does not become a URL', () => {
  const xml = '<rss version="2.0"><channel><item><title>A</title><guid>https://papers.example/a</guid></item><item><title>B</title><guid isPermaLink="false">https://papers.example/b</guid></item></channel></rss>';
  const feed = parseFeed(xml, source);
  assert.equal(feed.entries[0].url, 'https://papers.example/a');
  assert.equal(feed.entries[1].url, '');
});

test('malformed and unsupported documents fail rather than become empty inboxes', () => {
  assert.throws(() => parseFeed('<rss version="2.0"><channel>', source));
  assert.throws(() => parseFeed('<html/>', source), /RSS 2.0 or Atom 1.0/);
  assert.throws(() => parseFeed('<rss version="2.0"><channel><item><title>No identity</title></item></channel></rss>', source), /stable id/);
});

test('unchanged source has a stable KA across imports; edits create a linked revision', () => {
  const feed = parseFeed(atom, source);
  const first = sourceRecord(feed, feed.entries[0], '2026-10-17T10:00:00Z');
  const repeat = sourceRecord(feed, feed.entries[0], '2026-10-18T10:00:00Z');
  const revised = sourceRecord(feed, { ...feed.entries[0], summary: 'Corrected benchmark: 144 MiB.' });
  assert.equal(first.name, repeat.name);
  assert.equal(first.digest, repeat.digest);
  assert.equal(first.identity, revised.identity);
  assert.notEqual(first.digest, revised.digest);
  assert.notEqual(first.root, revised.root);
  assert.equal(first.entity, revised.entity);
  const stored = JSON.parse(JSON.parse(first.quads.find((q) => q.predicate === `${NS}sourceJson`).object));
  assert.equal(hash(JSON.stringify(stored)), first.digest);
});

test('research annotations pin status to the precise source version', () => {
  const feed = parseFeed(atom, source);
  const first = sourceRecord(feed, feed.entries[0]);
  const revised = sourceRecord(feed, { ...feed.entries[0], title: 'Corrected Method A' });
  const annotation = annotationRecord(first, { actor: 'Research agent', status: 'selected', tags: ['memory', 'memory'], note: 'Supports our memory budget question.' });
  assert.equal(annotation.revision, first.root);
  assert.notEqual(annotation.revision, revised.root);
  assert.deepEqual(annotation.tags, ['memory']);
  assert.throws(() => annotationRecord(first, { actor: 'Research agent', status: 'unrecognized' }), /Status/);
});

test('observation identities chain through reversions independently of the first-seen time', () => {
  const feed = parseFeed(atom, source);
  const a = sourceRecord(feed, feed.entries[0]);
  const b = sourceRecord(feed, { ...feed.entries[0], summary: 'Revised benchmark.' });
  const firstA = observationRecord(a);
  const firstB = observationRecord(b, firstA.root);
  const secondA = observationRecord(a, firstB.root);
  const secondB = observationRecord(b, secondA.root);
  assert.notEqual(firstA.root, secondA.root);
  assert.notEqual(firstB.root, secondB.root);
  assert.equal(secondA.root, observationRecord(a, firstB.root).root);
});

test('a research packet preserves canonical citations and exact version digests', () => {
  const feed = parseFeed(atom, source);
  const revisions = feed.entries.map((entry) => sourceRecord(feed, entry));
  const packet = packetRecord([revisions[0], revisions[1], revisions[0]], { title: 'Memory versus speed', actor: 'Research agent', question: 'Which method fits 192 MiB?', answer: 'Method A fits; method B exceeds the budget.' });
  assert.equal(packet.sources.length, 2);
  assert.equal(packet.sources[0].sourceId, revisions[0].sourceId);
  assert.ok(packet.sources.every((citation) => /^[a-f0-9]{64}$/.test(citation.digest)));
  assert.ok(packet.sources.some((citation) => citation.url === 'https://research.example.org/notes/method-a'));
  assert.equal(packet.question, 'Which method fits 192 MiB?');
});
