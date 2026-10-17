import { createHash } from 'node:crypto';

export const NS = 'https://w3id.org/feed-research-memory/';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const SCHEMA = 'https://schema.org/';
export const PROV = 'http://www.w3.org/ns/prov#';
export const STATUSES = ['unread', 'researching', 'selected', 'dismissed'];
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const literal = (value) => JSON.stringify(String(value));
const triple = (subject, predicate, object) => ({ subject, predicate, object });

/** The digest covers source fields, never the local ingestion timestamp. */
export function sourceRecord(feed, entry, ingestedAt = new Date().toISOString()) {
  const source = {
    feedUrl: feed.source,
    feedTitle: feed.title,
    id: entry.id,
    url: entry.url,
    title: entry.title,
    summary: entry.summary,
    author: entry.author,
    published: entry.published,
    updated: entry.updated,
    categories: entry.categories,
  };
  const identity = hash(JSON.stringify([feed.source, entry.id]));
  const digest = hash(JSON.stringify(source));
  const root = `urn:feed-research-memory:revision:${identity}:${digest}`;
  const entity = `urn:feed-research-memory:entry:${identity}`;
  const name = `feed-${identity.slice(0, 20)}-${digest.slice(0, 20)}`;
  const fields = { ...source, sourceId: source.id, digest, identity, root, entity, name, ingestedAt };
  const quads = [
    triple(root, `${RDF}type`, `${NS}SourceRevision`),
    triple(root, `${PROV}specializationOf`, entity),
    triple(root, `${PROV}wasDerivedFrom`, source.feedUrl),
    triple(root, `${NS}identity`, literal(identity)),
    triple(root, `${NS}digest`, literal(digest)),
    triple(root, `${NS}sourceId`, literal(source.id)),
    triple(root, `${NS}feedUrl`, literal(source.feedUrl)),
    triple(root, `${SCHEMA}name`, literal(source.title)),
    triple(root, `${SCHEMA}description`, literal(source.summary)),
    triple(root, `${NS}ingestedAt`, literal(ingestedAt)),
  ];
  if (source.url) quads.push(triple(root, `${SCHEMA}url`, source.url));
  if (source.author) quads.push(triple(root, `${SCHEMA}author`, literal(source.author)));
  if (source.published) quads.push(triple(root, `${SCHEMA}datePublished`, literal(source.published)));
  if (source.updated) quads.push(triple(root, `${SCHEMA}dateModified`, literal(source.updated)));
  for (const category of source.categories) quads.push(triple(root, `${SCHEMA}keywords`, literal(category)));
  // The complete normalized record makes source fields and digest reproducible.
  quads.push(triple(root, `${NS}sourceJson`, literal(JSON.stringify(source))));
  return { ...fields, quads };
}

export function annotationRecord(revision, { status, tags = [], note = '', actor, at = new Date().toISOString() }) {
  if (!STATUSES.includes(status)) throw new Error(`Status must be one of: ${STATUSES.join(', ')}.`);
  if (!actor?.trim()) throw new Error('An explicit research actor is required.');
  const normalizedTags = [...new Set(tags.map((v) => v.trim()).filter(Boolean))].sort();
  const data = { revision: revision.root, identity: revision.identity, status, tags: normalizedTags, note, actor: actor.trim(), at };
  const digest = hash(JSON.stringify(data));
  const root = `urn:feed-research-memory:annotation:${digest}`;
  return {
    ...data, root, name: `research-${digest.slice(0, 40)}`,
    quads: [
      triple(root, `${RDF}type`, `${NS}ResearchAnnotation`),
      triple(root, `${PROV}wasDerivedFrom`, revision.root),
      triple(root, `${NS}identity`, literal(revision.identity)),
      triple(root, `${NS}annotationJson`, literal(JSON.stringify(data))),
      triple(root, `${NS}recordedAt`, literal(at)),
    ],
  };
}

export function observationRecord(revision, predecessor = null, at = new Date().toISOString()) {
  // The predecessor is the prior observation event, not the prior content digest.
  // This distinguishes A→B→A→B while giving an ambiguous retry the same event id.
  const digest = hash(JSON.stringify([revision.identity, predecessor, revision.root]));
  const root = `urn:feed-research-memory:observation:${digest}`;
  const data = { identity: revision.identity, revision: revision.root, predecessor, at };
  return {
    ...data, root, name: `observed-${digest.slice(0, 40)}`,
    quads: [
      triple(root, `${RDF}type`, `${NS}FeedObservation`),
      triple(root, `${PROV}wasDerivedFrom`, revision.root),
      triple(root, `${NS}observationJson`, literal(JSON.stringify(data))),
      ...(predecessor ? [triple(root, `${PROV}wasInformedBy`, predecessor)] : []),
    ],
  };
}

export function packetRecord(revisions, { title, actor, question = '', answer = '', at = new Date().toISOString() }) {
  if (!title?.trim() || !actor?.trim()) throw new Error('A packet title and research actor are required.');
  if (!revisions.length) throw new Error('Select at least one source revision.');
  const sources = [...new Map(revisions.map((r) => [r.root, r])).values()]
    .sort((a, b) => a.root.localeCompare(b.root))
    .map(({ root, identity, digest, title, url, feedUrl, sourceId }) => ({ root, identity, digest, title, url, feedUrl, sourceId }));
  const data = { title: title.trim(), actor: actor.trim(), question, answer, at, sources };
  const digest = hash(JSON.stringify(data));
  const root = `urn:feed-research-memory:packet:${digest}`;
  return {
    ...data, root, name: `packet-${digest.slice(0, 40)}`,
    quads: [
      triple(root, `${RDF}type`, `${NS}ResearchPacket`),
      triple(root, `${SCHEMA}name`, literal(data.title)),
      triple(root, `${NS}packetJson`, literal(JSON.stringify(data))),
      ...sources.map((source) => triple(root, `${PROV}wasDerivedFrom`, source.root)),
    ],
  };
}
