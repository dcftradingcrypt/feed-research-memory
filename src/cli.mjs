#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseFeed } from './feed.mjs';
import { sourceRecord, observationRecord, annotationRecord, packetRecord } from './model.mjs';
import { DkgClient, latestRevisions, readMemory, readPackets } from './dkg.mjs';

const HELP = `feed-research-memory — one-shot research workflow in DKG Working Memory

create-graph <id>
import <feed.xml> --source <canonical-feed-url> --graph <exact-context-graph-id>
inbox --graph <id> [--contains <text>] [--status <status>] [--limit <n>]
history --graph <id> --identity <entry-identity>
annotate --graph <id> --revision <revision-URI> --actor <name> --status <status>
         [--tag <tag> ...] [--note <research-note>]
packet --graph <id> --revision <revision-URI> ... --actor <name> --title <title>
       [--question <research-question>] [--answer <research-answer>]
packets --graph <id>
recall --graph <id> --packet <packet-URI>
read --graph <id> --name <KA-name>

Environment: DKG_API_URL (default http://127.0.0.1:9200), DKG_AUTH_TOKEN.
All results are JSON. Sources are local RSS 2.0 / Atom 1.0 files; this CLI does
not fetch feeds or linked pages. It never finalizes, shares, publishes or schedules.
`;

const required = (values, name) => {
  if (!values[name]?.trim()) throw new Error(`--${name} is required.`);
  return values[name];
};

export async function run(argv, { client, output = (data) => process.stdout.write(`${JSON.stringify(data, null, 2)}\n`) } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    graph: { type: 'string' }, source: { type: 'string' }, contains: { type: 'string' }, status: { type: 'string' },
    identity: { type: 'string' }, revision: { type: 'string', multiple: true }, tag: { type: 'string', multiple: true },
    actor: { type: 'string' }, note: { type: 'string' }, title: { type: 'string' }, question: { type: 'string' },
    answer: { type: 'string' }, packet: { type: 'string' }, name: { type: 'string' }, limit: { type: 'string', default: '50' },
    help: { type: 'boolean', short: 'h' },
  } });
  const command = positionals[0];
  if (!command || values.help || command === 'help') { output({ help: HELP }); return; }
  const dkg = client || new DkgClient({ url: process.env.DKG_API_URL, token: process.env.DKG_AUTH_TOKEN });
  if (command === 'create-graph') {
    if (!positionals[1]?.trim()) throw new Error('A Context Graph id is required.');
    output(await dkg.createGraph(positionals[1]));
    return;
  }
  const graph = required(values, 'graph');
  if (command === 'import') {
    if (!positionals[1]) throw new Error('A feed XML path is required.');
    const info = await stat(positionals[1]);
    if (info.size > 5 * 1024 * 1024) throw new Error('Feed is larger than the 5 MiB import limit.');
    const feed = parseFeed(await readFile(positionals[1], 'utf8'), required(values, 'source'));
    if (feed.entries.length > 1000) throw new Error('Feed exceeds the 1000-entry import limit.');
    const current = new Map(latestRevisions(await readMemory(dkg, graph)).map((record) => [record.identity, record]));
    const results = [];
    for (const entry of feed.entries) {
      const record = sourceRecord(feed, entry);
      const result = await dkg.ensure(graph, record, { ignoreIngestedAt: true });
      const previous = current.get(record.identity);
      if (previous?.root !== record.root) {
        const observation = observationRecord(record, previous?.currentObservation?.root || null);
        await dkg.ensure(graph, observation);
        current.set(record.identity, { ...record, currentObservation: observation, isCurrent: true });
        result.observation = observation.root;
      }
      results.push(result);
    }
    output({ graph, feed: feed.source, format: feed.format, entries: results });
    return;
  }
  if (command === 'read') {
    const result = await dkg.quads(graph, required(values, 'name'));
    if (!result) throw new Error('Knowledge Asset not found.');
    output(result); return;
  }
  if (command === 'packets') { output(await readPackets(dkg, graph)); return; }
  const revisions = await readMemory(dkg, graph);
  if (command === 'inbox') {
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('--limit must be an integer from 1 to 1000.');
    const phrase = values.contains?.toLocaleLowerCase();
    const selected = latestRevisions(revisions).filter((record) =>
      (!values.status || record.research.status === values.status) &&
      (!phrase || [record.title, record.summary, record.research.note, ...record.research.tags].some((value) => value.toLocaleLowerCase().includes(phrase))));
    output({ graph, totalMatches: selected.length, entries: selected.slice(0, limit) }); return;
  }
  if (command === 'history') {
    const identity = required(values, 'identity');
    output({ graph, identity, revisions: revisions.filter((record) => record.identity === identity) }); return;
  }
  if (command === 'annotate' || command === 'packet') {
    if (!values.revision?.length) throw new Error('At least one --revision is required.');
    const selected = values.revision.map((root) => {
      const record = revisions.find((revision) => revision.root === root);
      if (!record) throw new Error(`Source revision was not found in this WM graph: ${root}.`);
      return record;
    });
    const actor = required(values, 'actor');
    let record;
    if (command === 'annotate') {
      if (selected.length !== 1) throw new Error('Annotate exactly one source revision per command.');
      record = annotationRecord(selected[0], { status: required(values, 'status'), tags: values.tag, note: values.note, actor });
    } else {
      record = packetRecord(selected, { title: required(values, 'title'), actor, question: values.question, answer: values.answer });
    }
    output({ ...await dkg.ensure(graph, record), graph, record: Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'quads')) });
    return;
  }
  if (command === 'recall') {
    const root = required(values, 'packet');
    const packet = (await readPackets(dkg, graph)).find((record) => record.root === root);
    if (!packet) throw new Error('Research packet not found.');
    const evidence = packet.sources.map((citation) => {
      const record = revisions.find((revision) => revision.root === citation.root && revision.digest === citation.digest);
      if (!record) throw new Error(`Pinned evidence is missing or changed: ${citation.root}.`);
      return record;
    });
    output({ graph, memoryLayer: 'Working Memory', packet, evidence }); return;
  }
  throw new Error(`Unknown command: ${command}. Run --help for commands.`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
