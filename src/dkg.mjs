import { NS, RDF, hash } from './model.mjs';

const terms = (quads, ignored = new Set()) => [...new Set(quads
  .filter((q) => !ignored.has(q.predicate))
  .map(({ subject, predicate, object }) => JSON.stringify([subject, predicate, object])))].sort();

export class DkgClient {
  constructor({ url = 'http://127.0.0.1:9200', token = '', timeout = 20_000, fetchImpl = fetch } = {}) {
    this.url = new URL(url);
    if (!['http:', 'https:'].includes(this.url.protocol)) throw new Error('DKG API URL must use HTTP(S).');
    if (this.url.username || this.url.password || this.url.search || this.url.hash) throw new Error('DKG API URL must not contain credentials, query or fragment.');
    if (this.url.pathname !== '/') throw new Error('DKG API URL must be an origin without a path prefix.');
    this.token = token;
    this.timeout = timeout;
    this.fetch = fetchImpl;
  }

  async request(path, { method = 'GET', body, notFound = false } = {}) {
    const response = await this.fetch(new URL(path, this.url), {
      method,
      headers: { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.timeout),
      redirect: 'error',
    });
    if (response.status === 404 && notFound) return null;
    if (!response.ok) throw new Error(`DKG ${method} ${path.split('?')[0]} returned HTTP ${response.status}.`);
    return response.json();
  }

  createGraph(id) {
    // Explicitly local metadata: never register a graph on a blockchain.
    return this.request('/api/context-graph/create', { method: 'POST', body: { id, name: id, register: false } });
  }

  async quads(graph, name) {
    const base = `/api/knowledge-assets/${encodeURIComponent(name)}`;
    const query = `?contextGraphId=${encodeURIComponent(graph)}`;
    // The WM quads route returns an empty array even for an unknown KA.
    // Consult the descriptor route to distinguish absence from an empty draft.
    const descriptor = await this.request(`${base}${query}`, { notFound: true });
    if (!descriptor) return null;
    return this.request(`${base}/wm/quads${query}`);
  }

  async ensure(graph, record, { ignoreIngestedAt = false } = {}) {
    const ignored = new Set(ignoreIngestedAt ? [`${NS}ingestedAt`] : []);
    const matches = (value) => value && JSON.stringify(terms(value.quads, ignored)) === JSON.stringify(terms(record.quads, ignored));
    const previous = await this.quads(graph, record.name);
    if (previous) {
      if (!matches(previous)) throw new Error(`Existing KA ${record.name} does not match this record. Inspect it before retrying.`);
      return { name: record.name, outcome: 'unchanged', root: record.root };
    }
    let created;
    try {
      created = await this.request('/api/knowledge-assets', {
        method: 'POST', body: { contextGraphId: graph, name: record.name, quads: record.quads, finalize: false },
      });
    } catch (error) {
      // A lost response is ambiguous. Read the same deterministic KA before any retry.
      const observed = await this.quads(graph, record.name).catch(() => null);
      if (matches(observed)) return { name: record.name, root: record.root, outcome: 'reconciled' };
      throw error;
    }
    const observed = await this.quads(graph, record.name);
    if (!matches(observed)) throw new Error(`DKG did not return the complete expected WM content for ${record.name}.`);
    return { name: record.name, root: record.root, assertionUri: created.assertionUri, outcome: 'created' };
  }

  async query(graph, sparql) {
    const result = await this.request('/api/query', { method: 'POST', body: { contextGraphId: graph, view: 'working-memory', sparql } });
    if (result.result?.type !== 'bindings' || !Array.isArray(result.result.bindings)) throw new Error('Unexpected DKG query response.');
    return result.result.bindings;
  }
}

export const MEMORY_RECORD_LIMIT = 10000;
const recordsQuery = (type, property) => `SELECT ?root ?json WHERE { GRAPH ?g { ?root <${RDF}type> <${NS}${type}> ; <${NS}${property}> ?json . } } LIMIT ${MEMORY_RECORD_LIMIT + 1}`;
function withinCapacity(rows, kind) {
  if (rows.length > MEMORY_RECORD_LIMIT) throw new Error(`This Context Graph exceeds the ${MEMORY_RECORD_LIMIT} ${kind} limit. Use a smaller research Context Graph; no partial result was returned.`);
  return rows;
}
// DKG's Oxigraph HTTP bindings use canonical RDF terms for literals, including
// their surrounding quotes; sourceJson is a JSON document inside that literal.
function bindingText(value) {
  return value.startsWith('"') ? JSON.parse(value) : value;
}

export async function readMemory(client, graph) {
  const sources = withinCapacity(await client.query(graph, `SELECT ?root ?json ?digest ?identity ?at WHERE { GRAPH ?g { ?root <${RDF}type> <${NS}SourceRevision> ; <${NS}sourceJson> ?json ; <${NS}digest> ?digest ; <${NS}identity> ?identity ; <${NS}ingestedAt> ?at . } } LIMIT ${MEMORY_RECORD_LIMIT + 1}`), 'source revisions');
  const annotations = withinCapacity(await client.query(graph, recordsQuery('ResearchAnnotation', 'annotationJson')), 'research annotations');
  const observations = withinCapacity(await client.query(graph, recordsQuery('FeedObservation', 'observationJson')), 'feed observations')
    .map((row) => ({ ...JSON.parse(bindingText(row.json)), root: row.root }));
  const revisions = sources.map((row) => {
    const source = JSON.parse(bindingText(row.json));
    const digest = bindingText(row.digest);
    if (hash(JSON.stringify(source)) !== digest) throw new Error(`Source digest mismatch for ${row.root}.`);
    return { ...source, sourceId: source.id, root: row.root, digest, identity: bindingText(row.identity), ingestedAt: bindingText(row.at) };
  });
  const events = annotations.map((row) => ({ ...JSON.parse(bindingText(row.json)), root: row.root }));
  const observationHeads = new Map();
  for (const identity of new Set(observations.map((event) => event.identity))) {
    const history = observations.filter((event) => event.identity === identity);
    const predecessors = new Set(history.map((event) => event.predecessor).filter(Boolean));
    const heads = history.filter((event) => !predecessors.has(event.root));
    if (heads.length !== 1) throw new Error(`Conflicting observation history for entry ${identity}. Imports into a Context Graph must be serialized.`);
    if (!revisions.some((revision) => revision.identity === identity && revision.root === heads[0].revision)) throw new Error(`Current observed source is missing for entry ${identity}.`);
    observationHeads.set(identity, heads[0]);
  }
  for (const revision of revisions) {
    const relevant = events.filter((event) => event.revision === revision.root)
      .sort((a, b) => b.at.localeCompare(a.at) || b.root.localeCompare(a.root));
    revision.research = relevant[0] || { status: 'unread', tags: [], note: '', actor: null, at: null };
    revision.annotationHistory = relevant;
    revision.currentObservation = observationHeads.get(revision.identity) || null;
    revision.isCurrent = revision.currentObservation ? revision.currentObservation.revision === revision.root : undefined;
  }
  return revisions.sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt) || b.root.localeCompare(a.root));
}

export function latestRevisions(revisions) {
  const grouped = new Map();
  for (const revision of revisions) {
    if (!grouped.has(revision.identity)) grouped.set(revision.identity, []);
    grouped.get(revision.identity).push(revision);
  }
  const newest = (a, b) => b.ingestedAt.localeCompare(a.ingestedAt) || b.root.localeCompare(a.root);
  return [...grouped.values()].map((versions) => versions.find((record) => record.isCurrent) || [...versions].sort(newest)[0])
    .sort((a, b) => (b.currentObservation?.at || b.ingestedAt).localeCompare(a.currentObservation?.at || a.ingestedAt) || b.root.localeCompare(a.root));
}

export async function readPackets(client, graph) {
  return withinCapacity(await client.query(graph, recordsQuery('ResearchPacket', 'packetJson')), 'research packets')
    .map((row) => ({ ...JSON.parse(bindingText(row.json)), root: row.root }));
}
