# Verification of the offline teaching lab

Checked on 18 October 2026 JST, using Python 3.12.14.

- The author's 14 standard-library unit tests passed.
- A separate AI agent reran those 14 tests and the documented CLI successfully.
- That reviewer independently exercised 12 additional boundary tests. All passed.
- The documented synthetic bundle yields one candidate and `1250000` raw units.
- The author checked deterministic CLI JSON output.
- A separate editorial review checked the article against ERC-20, ERC-721,
  Ethereum JSON-RPC, the known prior DeFiHackLabs article, and the lab's limits.

The independent boundary checks included keeping a valid candidate while
skipping a malformed log, input/configuration errors, all five identity fields,
distinct log indices, repeat ingestion within one invocation, and conflicting
positive candidates or receipt snapshots. Documentation was then narrowed to
describe skipped records, admitted positive candidates, and argparse errors
accurately. No parser changes followed these tests.

These are actual local executions on invented data. They are not human review,
live transaction verification, an audit, blockchain inclusion/finality proof,
payment confirmation, or evidence that the article has been selected.
