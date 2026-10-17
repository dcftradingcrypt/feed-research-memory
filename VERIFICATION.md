# Local verification — 2026-10-17

This is local implementation evidence, not a public release, accepted registry entry, award or payment receipt.

## Exercised runtime

The tests used the published `@origintrail-official/dkg@10.0.24` daemon and its real public HTTP routes and Oxigraph-worker Working Memory store. Its installed `build-info.json` identifies commit `fffef7dd9993f8016c595f525397da440e72a15b` (build time 2026-10-14). The separately inspected current documentation/source head was `7210ccda86ab845ec3161957ed42d2b5c5e02489`; it is not presented as the tested runtime build.

An outside-package test preload restricted P2P to IPv4 loopback, disabled discovery/relay behavior and denied peer connections. The HTTP API bound to loopback. The node used a mock chain, synthetic public test keys, and disabled publishing, telemetry and updates. The preload did not replace the HTTP routes, agent memory logic or store. This proves a local HTTP/WM workflow, not stock P2P, live-chain anchoring, SWM replication or finalized UALs. No user wallet, funded chain or paid language-model service was used.

## Checks completed

- **20 unit tests passed:** RSS/Atom parsing and source attribution, anchored citations, XHTML text boundaries, deterministic source revisions, research annotations/packets, capacity failure, API URL validation and HTTP readback/idempotency behavior.
- **One real-node integration workflow passed:** import, unchanged replay, a changed entry with the same GUID, Unicode/quote/newline notes, a cited question/answer packet, later source changes, recall of the original pinned evidence, and A → B → A current-revision tracking. Causal observation heads handle timestamp ties without rewriting source capture times.
- **Independent real-data acceptance passed:** twenty selected items from the actual official Node.js blog RSS snapshot were imported. The agent compared the newest feed-labelled LTS and Current announcements, stored an interpretation and an exact-source packet, then recalled both citations. Two repeated imports remained unchanged. The Unicode/quote/newline note read back exactly and retained its research status.
- **Production dependency audit passed:** `npm audit --omit=dev --json` returned exit 0 and zero advisories for the checked lock (`saxes@6.0.0`, `xmlchars@2.2.0`). Recheck the final release artifact when publishing.

The original Node.js feed snapshot contained 1,062 entries. The independent check transparently retained the first twenty, with original item fields and channel metadata, to stay within the documented 1,000-entry import limit. The comparison concerns feed metadata only; it makes no claim about unprovided article bodies or later live updates. The separate evidence bundle contains acquisition/selection digests, the acceptance script, the actual result JSON and sanitized node readiness proof.

## Recorded walkthrough

[Replay the actual captured session](demo/replay.html) or inspect [the asciicast recording](demo/session.cast) and [capture metadata](demo/recording-metadata.json). The recording contains thirteen real CLI commands and their actual local-node responses over approximately 13.5 seconds. Pause or seek to inspect full JSON output. The two benchmark reports are explicitly fictional fixtures; the HTTP execution and store are real. The recording shows import, unchanged replay, agent triage, notes, a question/answer packet, correction, old-evidence recall, history and source reversion. It is not a video or a claim that fictional URLs were fetched.

Package installation/bin smoke evidence is retained separately with the release-preparation bundle. The public source repository is [dcftradingcrypt/feed-research-memory](https://github.com/dcftradingcrypt/feed-research-memory). The named maintainer, **dcftradingcrypt**, commits to at least six months of support after the approved OriginTrail registry PR is merged. Actual npm publication/provenance and registry submission remain pending; see [SUBMISSION.md](SUBMISSION.md). Local verification does not establish registry acceptance or a reward receipt.
