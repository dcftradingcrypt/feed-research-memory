# ERC-20 payout candidate lab

Read the accompanying [technical article](ARTICLE.md).

Small offline appendix for a technical article. Python 3 standard library only.
All addresses, hashes and receipts in the fixture are synthetic; no live chain
was contacted. The script has no networking, wallet, signature or key functions.

Run from this directory:

```sh
python3 -m unittest -v
python3 receipt_candidates.py synthetic_receipts.json \
  --chain-id 0x539 \
  --tx-hash 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --token 0x1111111111111111111111111111111111111111 \
  --recipient 0x3333333333333333333333333333333333333333
```

The mixed fixture yields **one candidate, 1250000 raw units**, not dollars.
No decimals or exchange rates are fetched or assumed. JSON output is sorted
and deterministic. Value validation or invalid input data exits 2 with a JSON
error. Missing required command-line flags use argparse's normal stderr usage
message and exit 2.

## What this checks

Caller-supplied expected chain, transaction, token contract and recipient are
compared with a saved receipt bundle. `chain_id` is an envelope label for a
previous `eth_chainId` response: transaction receipts do not contain chain ID.
That label is untrusted input, not proof of the node's network.

Only successful, modern status-bearing receipts with non-null block metadata
are considered. Logs must match their receipt's transaction/block metadata.
The emitter must equal the expected token address; topics must contain exactly
the Transfer signature and two zero-padded addresses; data must be exactly one
uint256 word. Removed logs, wrong recipients/assets, malformed padding and
ERC-721's four-topic Transfer shape are excluded. Zero transfers remain valid
ERC-20 events, but add no positive candidate; self-transfers are also excluded.

Within a single invocation, matching events are deduplicated by chain,
transaction hash, token, recipient and log index. Conflicting amounts between
admitted positive candidates, or inconsistent valid receipt headers, fail
instead of silently choosing a snapshot. Excluded malformed, zero, self-transfer
or other-asset records are skipped before positive-candidate deduplication; this
is not validation of the complete receipt or every repeated log identity.
There is no persistent ledger; the caller must also deduplicate across runs.

## What this does not establish

Everything in the input file can be fabricated. This parser authenticates no
RPC response, receipt inclusion or canonical block. It checks no confirmations
or finality and cannot resolve reorganizations. A matching event is not proof
that its emitter is the genuine asset: the caller must independently establish
the correct contract for the correct chain and its behavior. Any contract can
emit a Transfer-shaped event. Syntax does not prove balances changed.

The sum is selected positive inbound event amounts, not the recipient's net
balance change: outgoing transfers, fee/rebase behavior and economic ownership
are outside this lab. Mint events may also match. No source-of-funds, payer,
invoice, work acceptance, asset value, earned income or actual cash receipt is
verified. This is a teaching example, not a payment or accounting system.

## Primary references

- [ERC-20](https://eips.ethereum.org/EIPS/eip-20): Transfer indexing and the zero-value requirement.
- [ERC-721](https://eips.ethereum.org/EIPS/eip-721): token ID is indexed in Transfer.
- [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/): eth_chainId, eth_getTransactionReceipt, log fields, status and removed logs.
- [Solidity ABI events](https://docs.soliditylang.org/en/latest/abi-spec.html#events): signature topic and indexed/non-indexed arguments.

The signature constant uses Ethereum Keccak-256. Python's `hashlib.sha3_256`
implements NIST SHA-3 and must not be substituted for it.
