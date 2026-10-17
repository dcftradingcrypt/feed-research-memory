# An offline lab for ERC-20 payout ingestion

**ABI shape, asset identity, and replay safety with reproducible counterexamples**

By **dcftradingcrypt**, prepared by an AI assistant acting for its operator. This original technical tutorial and its synthetic fixtures were produced with AI assistance. No personal audit experience, live attack, real transfer, or newly discovered vulnerability is claimed.

A payout tracker receives a transaction hash, finds a successful receipt, and marks an invoice paid. That shortcut leaves the important questions unanswered: which chain, which asset, which recipient, and which event has already been recorded?

This lab turns those questions into executable checks. Its output is a set of **candidate incoming ERC-20 events**, measured in raw integer units. Moving a candidate into an accounting ledger requires additional evidence described below.

## Start with a counterexample

Imagine a successful receipt containing a `Transfer` log with the expected recipient and a value of 1,000,000. An ingestion script matching only the event signature accepts it. Change just the emitting contract address, keeping every topic and data byte the same. A tracker with a trusted `(chain, token contract)` binding must now ignore it.

All addresses, hashes, blocks, and receipts in this lab are invented. The fixtures describe parser inputs, not observations from a blockchain. DeFiHackLabs already covered deceptive token histories in its [2023 shadow-transactions article](https://defihacklabs.substack.com/p/user-asset-security-lesson-9-the). The contribution here is a compact executable ingestion lab, not a claim to have discovered that threat.

## Bind the evidence before decoding it

An [Ethereum JSON-RPC receipt](https://ethereum.org/developers/docs/apis/json-rpc/#eth_gettransactionreceipt) describes execution, includes logs, and may be absent while a transaction is pending. It does not carry a standard `chainId` field. Capture the endpoint's `eth_chainId` separately, keep that observation with the receipt, and compare it with an independently configured expected chain.

For this lab, a wrapper stores the observed chain and the receipt together. The expected chain, token emitter, recipient, and transaction hash are supplied separately. Supplying identical values on both sides from one untrusted response would defeat the binding.

The parser checks successful execution and the expected transaction hash before considering logs. Success status alone does not establish that an ERC-20 operation succeeded: a call can return `false` without reverting, and a successful transaction can contain no relevant transfer. The parser checks the complete emitting address and recipient, rather than a symbol or shortened address. It retains raw integers; decimal display formatting belongs to a separate, trusted asset configuration.

The receipt's top-level `to` can identify a router or another entry point. The emitter of a particular log identifies the contract that produced that log. These fields answer different questions.

## Check the event's complete ABI shape

[ERC-20](https://eips.ethereum.org/EIPS/eip-20) declares:

```solidity
event Transfer(address indexed _from, address indexed _to, uint256 _value);
```

With a conventional non-anonymous event, that means three topics, including the signature topic, and one 32-byte data word for the amount. Each indexed address must have its 20 bytes in a correctly padded 32-byte word. The [Solidity ABI specification](https://docs.soliditylang.org/en/latest/abi-spec.html#events) explains the event encoding.

[ERC-721](https://eips.ethereum.org/EIPS/eip-721) uses the same event name and argument types but indexes the final integer too. A standard NFT `Transfer` therefore has four topics and no non-indexed amount word. Matching the signature alone cannot distinguish these layouts. The lab requires the ERC-20 layout; it does not guess an amount from a token ID.

A zero amount is also a valid ERC-20 transfer. The positive-payout policy excludes it from candidate income without calling the event invalid. Optional token metadata such as `symbol` and `decimals` is not used to establish asset identity.

## Reproduce the boundary cases

The accompanying Python code uses the standard library. No wallet, RPC account, signing key, package installation, or network access is needed. Run the unit tests, then pass the included fixture to the command-line entry point documented in `README.md`.

The tests change individual facts in otherwise similar inputs:

| Input change | Required outcome |
| --- | --- |
| Expected positive transfer | Return its raw-unit candidate |
| Same bytes from another emitter | Do not count the other token |
| Different full recipient | Do not count the event |
| Wrong observed chain | Reject the input bundle |
| Receipt for another transaction hash | Skip that receipt |
| Four-topic NFT layout | Do not decode it as an ERC-20 amount |
| Bad address padding or wrong data length | Exclude the malformed log |
| Zero-value transfer | Produce no positive candidate |
| Repeated event identifier | Emit the candidate once within this invocation |

A fixture with failure status and fabricated transfer logs tests rejection of inconsistent input. It does not assert that reverted EVM execution leaves those logs in a canonical receipt.

The tests document the included parser's behavior. Passing them does not establish consensus validity, RPC honesty, or correctness for every token implementation.

## Carry event identity into the database

Two genuine transfers may occur in one transaction. Deduplicating by transaction hash alone would collapse them. Conversely, processing one saved receipt twice must not create two credits.

Use a stable event identity including chain, transaction hash, token emitter, recipient, and log index. Enforce uniqueness when committing the candidate to storage. In-memory deduplication inside a single parser call does not replace an atomic database constraint across workers and restarts.

Also preserve block identity alongside the observation. A later ingestion layer needs a defined policy for canonicality, finality, and reorganization rollback. A local JSON parser cannot supply that policy or verify its input's provenance.

## Define what remains unverified

Even a correctly decoded incoming event is insufficient to establish a net balance increase. A self-transfer or another outgoing transfer in the same transaction can cancel the apparent increase. Token implementations, fees, and rebasing behavior may need additional asset-specific treatment.

The lab does not prove that a contract represents a valuable asset, that an RPC response is authentic, that the recipient controls a key, or that the transfer settles a particular invoice. A production pipeline must establish those facts independently, reconcile incoming and outgoing effects where needed, apply finality rules, and bind settlement to the agreed obligation.

The useful boundary is explicit: this small program extracts strictly shaped candidates from supplied evidence. It gives an accounting system a reproducible starting point while leaving the remaining verification obligations visible.

## Sources and reuse

Primary references: [ERC-20](https://eips.ethereum.org/EIPS/eip-20), [ERC-721](https://eips.ethereum.org/EIPS/eip-721), [Solidity ABI events](https://docs.soliditylang.org/en/latest/abi-spec.html#events), and [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/). Related reading: the DeFiHackLabs article linked above. References were checked on 18 October 2026 JST.

The original article may be republished by DeFiHackLabs with attribution to dcftradingcrypt and the AI-assistance disclosure retained. The accompanying original code and synthetic fixtures are provided under the MIT license in `LICENSE`.
