# Security and authority declaration

This document describes the implemented CLI. It is not a security audit or a declaration of a published registry trust tier.

## Credentials and network egress

The CLI reads `DKG_AUTH_TOKEN` from its environment and sends it as a bearer token to `DKG_API_URL` (default `http://127.0.0.1:9200`). It does not prompt for third-party credentials, read wallet files, request private keys or create signatures. It does not deliberately log authorization headers or the token. The operator must choose a trusted endpoint and use HTTPS for a remote node; the configured origin receives the token and imported research data. HTTP redirects are rejected.

Runtime egress is only to that configured DKG HTTP(S) origin. Feed/article URLs, PROV/schema/vocabulary IRIs and source citation links are stored as data and are not fetched. Local XML files must already exist. No feed polling, link preview, model provider, telemetry or remote code loading is implemented. npm installation and GitHub release jobs have their own registry/CI network traffic and are not runtime feed egress.

For a registry entry, the local loopback DKG node needs no additional external-host declaration. If distributing a configuration that uses a remote DKG node, declare its actual host and the configured-host policy accurately; do not claim loopback-only behavior for that configuration.

## Exact HTTP authority

| Operation | Purpose and authority |
| --- | --- |
| `POST /api/context-graph/create` | Creates local project/Context Graph metadata with `register:false`. |
| `POST /api/knowledge-assets` | Creates source, observation, annotation or packet WM drafts with `finalize:false`. |
| `GET /api/knowledge-assets/{name}` | Reads a KA descriptor to distinguish a missing asset from an existing empty WM draft. |
| `GET /api/knowledge-assets/{name}/wm/quads` | Reads one named KA's WM quads for comparison/readback. |
| `POST /api/query` | Executes integration-defined SELECT queries against the caller's `working-memory` view. This HTTP POST is a read, not a SPARQL update. |

The CLI does not invoke finalize/seal, SHARE, PUBLISH, graph registration, staking, endorsement or voting operations. It never requests an EIP-712 author attestation. The node remains responsible for authenticating the bearer token, authorizing the caller's graph/scope, and placing WM data. An operator should use an appropriately scoped token; the client does not provision or revoke node authority.

## Untrusted data and retained information

Feed text is untrusted evidence. It is stored as RDF literals/JSON and is never evaluated as code or rendered as active HTML by the CLI. An agent consuming it should treat source instructions as quoted data rather than instructions to operate tools. Source claims, actor notes and packet answers are distinct records. The CLI does not certify authorship, truth or licences; obtain permission to retain and use imported material.

The XML parser does not fetch external resources. A file import is limited to 5 MiB and 1,000 entries. Readers fail explicitly above 10,000 records in each of the source, observation, annotation and packet categories per Context Graph. These controls bound the supported workflow; they are not a claim of resistance to every hostile XML/resource-exhaustion input. The parser retains a document tree and text in memory.

WM is local to the selected node and its authorized agent scope, not necessarily private from its operator or backups. Source text, canonical URLs, dates, actor labels, notes and answers are intentionally stored. Do not import secrets or include them in source URLs or research text. A URL is provenance data, not a safe place for access tokens. `--actor` labels are self-described; timestamps and status are not authenticated attestations.

There is no deletion command. Source revisions, observations, annotations and packets persist according to node storage/retention policy. Reimporting a changed source preserves its earlier version. Local revision/digest conventions do not prevent a sufficiently authorized actor from changing open WM drafts. Inspect conflicting records rather than forcing an overwrite. Run one importer per project; concurrent callers are not serialized.

## Package and test boundaries

The package has no `preinstall`, `install` or `postinstall` script. Its runtime dependency is pinned in `package-lock.json`. A local production dependency audit on **2026-10-17** exited successfully with zero advisories at every severity for the current lock (`saxes@6.0.0`, `xmlchars@2.2.0`). This is a dated package-advisory check, not an external code review or a provenance attestation. Release preparation must repeat `npm audit --omit=dev` and inspect the final packed file list; dependency or advisory changes can alter that result.

A local verification daemon may use a mock chain and a separate transport-only harness to bind P2P to loopback, disable discovery and deny peer connections. The integration itself uses the unmodified public HTTP API and does not import internal DKG packages. The harness is not shipped or required by normal users. Such testing is not evidence of stock P2P behavior, live-chain safety or SWM replication.

## Reporting

The named maintainer is [dcftradingcrypt](https://github.com/dcftradingcrypt), with a commitment to at least six months of support after the approved OriginTrail registry PR is merged. The public functional-issue route is [dcftradingcrypt/feed-research-memory/issues](https://github.com/dcftradingcrypt/feed-research-memory/issues). Do not post live credentials or private feed data in a public report. This support commitment does not imply that a bounty has been accepted or an npm release published.
