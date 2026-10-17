# Feed Research Memory

A one-shot RSS/Atom research inbox for OriginTrail DKG v10 Working Memory. An agent imports a local feed, selects evidence, records its research status and notes, and recalls a research packet with citations to the exact source revisions it used.

The public repository is [dcftradingcrypt/feed-research-memory](https://github.com/dcftradingcrypt/feed-research-memory). A versioned GHCR CLI image and its digest-bound GitHub build provenance are being prepared; see [CONTAINER.md](CONTAINER.md) for Docker installation and verification. Actual container publication/verification, npm publication and integration-registry acceptance remain pending. See [SUBMISSION.md](SUBMISSION.md) for release status. No bounty award or payment is claimed.

## What it does

- Parses local RSS 2.0 and Atom 1.0 XML files, including relative links and ordinary feed provenance fields.
- Gives each entry a stable identity within its canonical feed URL. A digest of the normalized source fields identifies its revision; unchanged reimports reuse the same Knowledge Asset (KA), while changed fields produce a separate revision.
- Records `unread`, `researching`, `selected` or `dismissed` status, tags, an actor label and notes as separate research annotations.
- Builds a question/answer packet citing selected revision URNs, digests and source URLs. Recall checks the cited source records against their stored digests and fails if pinned evidence is missing or inconsistent.
- Uses only the node's public HTTP API. Every KA remains an open WM draft: the CLI does not finalize, SHARE, PUBLISH, register a Context Graph on a chain, fetch feeds/articles or run a background schedule.

## Run from a checkout

Use Node.js **22.13.0 or newer** and a separately provisioned DKG v10 node. The local verification target is the published DKG **10.0.24** runtime. The CLI does not install or initialize that node.

```sh
npm ci --ignore-scripts
npm test
node src/cli.mjs --help
```

Set `DKG_API_URL` to the node's HTTP origin; the default is `http://127.0.0.1:9200`. Supply `DKG_AUTH_TOKEN` through your operator's secret environment mechanism. Do not put the token in command arguments, a feed file, a committed environment file or a demonstration recording. The token must authorize access to the intended project's Context Graph.

The following commands use the included fictional benchmark feed. Its `example.org` URLs are citation identifiers and are never fetched.

```sh
node src/cli.mjs create-graph rss-research
node src/cli.mjs import test/fixtures/research.atom \
  --source https://research.example.org/feed.atom --graph rss-research
node src/cli.mjs inbox --graph rss-research --contains memory --limit 20
```

Use the exact Context Graph ID recognized by your node; `rss-research` is the example's local ID. `create-graph` explicitly sets `register:false`. If the graph already exists, select and inspect it rather than repeatedly creating it.

Copy a `root` value from the JSON inbox into a shell variable, then annotate the precise version you inspected:

```sh
node src/cli.mjs annotate --graph rss-research --revision "$REVISION" \
  --actor 'Research agent A' --status selected --tag memory \
  --note 'This source reports memory usage relevant to our 192 MiB budget.'
node src/cli.mjs history --graph rss-research --identity "$ENTRY_IDENTITY"
```

`REVISION` is the complete `urn:feed-research-memory:revision:...` value; `ENTRY_IDENTITY` is the entry's `identity` value. These are record identifiers, not credentials. To bind a research finding to one or more exact sources:

```sh
node src/cli.mjs packet --graph rss-research \
  --revision "$REVISION_A" --revision "$REVISION_B" \
  --actor 'Research agent A' --title 'Memory versus speed' \
  --question 'Which method fits a 192 MiB memory budget?' \
  --answer 'The fictional feed reports A at 128 MiB and B at 256 MiB; A fits.'
node src/cli.mjs packets --graph rss-research
node src/cli.mjs recall --graph rss-research --packet "$PACKET"
```

Use revision roots from the imported Atom feed for `REVISION_A` and `REVISION_B`; use the packet command's `record.root` for `PACKET`. A second agent session can run the recall command using an authorized connection to the same WM scope. That demonstrates recall on one node; it does not demonstrate SWM sharing or replication between nodes. Actor names are operator-supplied labels, not verified identities or signatures.

All successful commands emit JSON. Failures exit nonzero and print a short error. To inspect one KA's returned quads:

```sh
node src/cli.mjs read --graph rss-research --name "$KA_NAME"
node src/cli.mjs inbox --graph rss-research --status selected
```

## Inputs, revisions and limits

`import` requires a local XML path and an absolute HTTP(S) `--source` URL. Obtain that file separately using an authorized source and preserve any upstream licence obligations. This CLI records feed-supplied attribution and URLs; it does not determine the feed's licence or prove that its contents are true.

The source digest covers normalized parsed fields, including the canonical feed URL, feed title, entry identity, links, text, author, dates and categories. It is **not a digest of the original XML bytes**. Whitespace/format changes that parse identically need not produce a revision. Ingestion time is excluded, so replay does not create another source KA. A changed entry shares a stable entry identity with its earlier revisions; history retains those revisions.

Annotations and packets are new records. Status is selected from the latest annotation for that exact revision, ordered by recorded time and then record URI. A newer source revision starts unread; it does not silently inherit an earlier revision's conclusion. This is application-level revision tracking, not a seal preventing an authorized node operator from changing WM.

Separate feed-observation events track which revision was most recently imported for an entry. An A → B → A reimport makes A current again without duplicating its source record or changing its original capture time. Identical consecutive imports add no observation. This tracks local observations of the files supplied to the CLI; it does not poll or establish the current state of a remote feed.

| Limit | Behavior |
| --- | --- |
| Feed file | Maximum 5 MiB per import |
| Entries | Maximum 1,000 per import |
| Inbox display | `--limit` from 1 to 1,000; default 50 |
| Query capacity | Maximum 10,000 records in each category per Context Graph: source revisions, feed observations, research annotations and packets |

Above the query capacity the reader fails explicitly instead of returning an apparently complete partial inbox. These are reader limits, not a storage quota enforced on all node writes. Imports are sequential and are not one multi-KA transaction. If an import stops after some entries, inspect its result/error and reimport the same file: deterministic names and content readback reconcile already written source records. Concurrent writers are not serialized by this CLI; conflicting observation heads make reads fail rather than silently choosing a current version. Keep one importer per project during a run.

## WM identifiers and trust

Source/annotation/packet `root` values are integration-owned RDF URNs. A successful create can also return the node's WM `assertionUri`. Neither is presented as a finalized or published DKG UAL. The CLI never requests sealing or author-attestation preparation (`finalize:false`), and makes no on-chain verification claim. Packet recall checks content consistency; it is not a truth assessment, licence check or model-generated answer.

## Verification and release

```sh
npm test
# Against an already running isolated node, with DKG_API_URL and
# DKG_AUTH_TOKEN_FILE set to a private UTF-8 bearer-token file:
npm run test:integration
```

Unit tests exercise parsing, revisions and the HTTP client. Unlike the normal CLI's token environment variable, the integration test reads the bearer token privately from `DKG_AUTH_TOKEN_FILE`; an encrypted node token file cannot be passed unchanged. Use your node's supported authentication interface or a trusted local runner to provision that private test input without logging it. The test creates a fresh Context Graph and leaves its WM records in that isolated node; it does not initialize or stop the node. Normal CI runs unit tests only. See the test/demo evidence supplied with a release for the exact version and topology actually exercised.

An isolated verification harness may use the real 10.0.24 daemon, its HTTP routes and Oxigraph WM storage with a **mock chain and a separate transport-only preload** that binds P2P to loopback, disables discovery and denies peer connections. That harness is outside this integration package. Such evidence covers the public HTTP/WM workflow; it does not establish stock node networking, live-chain behavior, sealing, SWM or replication. Normal operators connect this CLI to their own node without that preload.

[DESIGN.md](DESIGN.md) explains the research workflow and promotion path. [SECURITY.md](SECURITY.md) declares network and write authority. The prepared GHCR workflow builds a nonroot, one-shot Node 24 CLI from an exact version tag, tests its JSON help without a network, then publishes and attests the image digest. [CONTAINER.md](CONTAINER.md) documents the host-node connection and read-only feed mount. It has not yet been executed or independently verified. The separate manual npm workflow remains dormant, with its account/trusted-publisher requirements recorded in [SUBMISSION.md](SUBMISSION.md).

## Maintainer and support

The named maintainer is [dcftradingcrypt](https://github.com/dcftradingcrypt). The maintainer commits to supporting this integration for **at least six months after its approved OriginTrail integration-registry PR is merged**, including the documented research workflow and compatibility fixes within that scope.

The public support route is [dcftradingcrypt/feed-research-memory/issues](https://github.com/dcftradingcrypt/feed-research-memory/issues). Report reproducible functional problems with the CLI and DKG version, commands, expected behavior and sanitized output. Keep credentials and private feed data out of public reports.

## Licence

Apache-2.0; see [LICENSE](LICENSE). Imported source material keeps its own rights and licence terms.
