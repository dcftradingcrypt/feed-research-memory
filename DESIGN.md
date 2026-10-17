# Feed Research Memory — design brief

## Problem and research workflow

Research agents repeatedly receive the same feed entries and revised versions of earlier findings. A plain text import loses the distinction between a source's current contents, an agent's interpretation, and the precise evidence behind a past answer. Feed Research Memory gives a project a small, inspectable research inbox in DKG v10 Working Memory (WM).

The target user is an agent carrying out a literature or release-monitoring task, with an operator supplying an authorized RSS 2.0 or Atom 1.0 file. The agent invokes a one-shot CLI, inspects the inbox, assigns research status and notes, selects exact revisions and creates a cited research packet. A later agent session recalls that packet and its evidence through the node. The integration does not call a language model; the connected agent supplies the question, interpretation and answer. No external model account is necessary for the deterministic workflow.

This advances the LLM-Wiki/autoresearch direction through attributable source-to-finding continuity. It is deliberately source-specific rather than a generic memory wrapper: normalized feed revision tracking, exact-version citations and research status are its working capability. It is distinct from an arXiv paper search/downloader, a GitHub PR importer or a notebook-cell exporter. Registry acceptance and distinctness remain committee judgments.

## Layers, primitives and public interface

All records live within a project-scoped **Context Graph** and the authenticated caller's WM scope. Each source revision, feed observation, research annotation and packet is represented by a **Knowledge Asset** written through the public node HTTP API. The CLI creates local Context Graph metadata with `register:false` and creates KAs with `finalize:false`. It uses no internal DKG package, direct store access or node patch as part of the integration.

The integration touches **WM only**. A Curator retains authority over any later SHARE or PUBLISH. There is no endorsement/voting interface and no attempt to bypass the Curator model. Status tags such as `selected` express an agent's research workflow; they do not mean endorsed, consensus-verified or published.

The vocabulary follows Context Graph, Knowledge Asset, Working Memory, Curator, SHARE and PUBLISH. Integration-specific classes describe source revisions, annotations and packets. Their `https://w3id.org/feed-research-memory/` vocabulary IRIs are identifiers only; no registered redirect, hosted vocabulary or dereferencing service is claimed. Record roots use `urn:feed-research-memory:...`. The node can return a WM `assertionUri`; this integration does not invent a finalized or published **UAL** for those open drafts.

## Data and revision model

| Record | Identity and purpose |
| --- | --- |
| Source revision | Stable entry identity = SHA-256 of canonical feed URL plus entry ID/GUID/link. Revision digest = SHA-256 of serialized normalized source fields. The record points to the stable entry with PROV-O `specializationOf`. |
| Feed observation | An event identifying the imported revision and predecessor observation. Its digest includes entry identity, predecessor and revision. A return to a known revision reuses its source record; identical consecutive imports add no event. |
| Research annotation | A separate event referring to one exact source revision, with explicit actor label, time, status, tags and note. Its digest includes event data and time. |
| Research packet | A question/answer artifact with title, actor and exact revision citations: revision root, source digest, source ID, feed URL and article URL where present. |

Normalization preserves feed and entry titles, source URL, entry ID, link, text, author, publication/update dates and categories. The revision digest covers these fields, not raw XML bytes or local ingestion time. Unchanged reimport therefore reuses its KA and original capture time; changed parsed fields create a new revision under the same entry identity. This preserves history through additional records rather than replacing earlier evidence. WM remains mutable at node level: these conventions are not cryptographic sealing.

The reader checks stored source JSON against its digest. Packet recall requires every cited exact revision/digest to remain available and fails on missing or inconsistent evidence. This checks integrity of the application's records, not factual accuracy or source authenticity. An actor label is supplied by the operator/agent and is not an authenticated identity claim.

The latest annotation by time, then URI, supplies the displayed state for that revision. A new source revision starts unread. The unique observation-chain head selects the current imported revision, preserving first capture times: A → B → A records A's return without duplicating source data. Conflicting heads fail explicitly rather than choosing by clock; entries without observations fall back to first-ingested ordering. This represents local imports, not remote feed polling. Source text and notes stay separate so a quoted claim is not silently converted into an agent's finding. A packet's answer is agent-authored and can be reassessed while its evidence references remain available.

## Operational boundaries and engineering

The CLI reads local XML and contacts only the configured DKG HTTP(S) origin. It does not fetch feeds, articles, images, schemas or vocabulary IRIs. The operator controls acquisition of files and the DKG bearer token. No install hooks, remote code loading, background daemon, paid model, chain publication or scheduling is part of the package.

An import is bounded at 5 MiB and 1,000 entries. Inbox display is bounded at 1,000 rows. Readers fetch at most 10,001 matching records in each source, observation, annotation or packet category and fail when its separate 10,000-record capacity is exceeded; they do not silently truncate research evidence. This is a small-project design and not a server-enforced storage quota. Imports perform sequential per-KA operations; a partially completed import is reconciled by reimporting the same deterministic source revisions. Concurrent callers are not transactionally serialized. Full readback verifies a newly created record and attempts to reconcile a lost create response before any retry.

Proportionate unit tests cover feed semantics, normalized revision identity, exact-version annotations/citations, content comparison and HTTP error handling. Release verification must also exercise the actual public HTTP API against a local v10 node. A transport-isolated mock-chain daemon can provide real route/WM/Oxigraph evidence without a financial transaction; the separate harness must be disclosed and must stay outside this integration. It is not proof of ordinary network discovery, peer replication, sealed attestations or live-chain behavior. A recorded walkthrough or live endpoint remains a submission requirement independent of unit-test success.

## Promotion path and context-oracle readiness

The implemented destination is WM. A future, separately authorized Curator workflow can review a packet, check source rights and factual support, select its complete source/annotation closure, then use the node's supported lifecycle to finalize and SHARE that evidence into **Shared Working Memory**. That implementation must preserve the original revision identifiers and map them to real lifecycle/UAL references returned by the node. It must report partial failures and require the relevant authority; changing a research status must never perform SHARE implicitly.

Promotion to **Verifiable Memory** would be a further explicit decision using an appropriately configured node, approved signer and publication budget. Any on-chain commitments and their self-attested, endorsed or consensus-verified grade must be recorded accurately. This CLI implements none of those steps. The promotion proposal is a documented path, not a shipped feature or an authorization to sign or spend.

For downstream context oracles, a research packet already identifies the question, attributed answer, exact source revisions/digests and canonical citations. A future consumer can require a promoted packet's actual UALs, sufficient verification grade, freshness policy and cited closure before using the answer. The present WM packet is draft research input and must not satisfy such a verified-oracle policy by itself.

## Distribution and maintenance

The intended install kind is `cli`; `publicInterfacesUsed` is `http-api`. The public source repository is [dcftradingcrypt/feed-research-memory](https://github.com/dcftradingcrypt/feed-research-memory). Its named maintainer, **dcftradingcrypt**, commits to at least six months of support after the approved OriginTrail registry PR is merged. The release must pin the actual source commit and a published package version with provenance and the declared authority posture. The prepared GHCR image provides a one-shot CLI with manual Docker installation; actual publication and digest-bound provenance verification remain pending. Equivalent-registry eligibility is a committee decision, and this is separate from npm publication, which is also pending. [SUBMISSION.md](SUBMISSION.md) tracks those release steps and the completed demo evidence.

Scope reference: [OriginTrail DKG v10 Round1 call](https://github.com/OriginTrail/dkg/blob/7210ccda86ab845ec3161957ed42d2b5c5e02489/docs/active-now/dkg-v10-bounty.md), especially §§5–10.
