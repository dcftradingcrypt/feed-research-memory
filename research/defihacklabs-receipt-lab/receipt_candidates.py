"""Offline ERC-20 Transfer candidate extraction, not payment verification."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re


# Ethereum Keccak-256 of Transfer(address,address,uint256), not NIST SHA3-256.
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def fixed_hex(value, size):
    if not isinstance(value, str) or not re.fullmatch(
        r"0x[0-9a-fA-F]{%d}" % (size * 2), value
    ):
        raise ValueError("invalid_fixed_hex")
    return value.lower()


def quantity(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)", value
    ):
        raise ValueError("invalid_quantity")
    return int(value, 16)


def topic_address(value):
    value = fixed_hex(value, 32)
    if value[2:26] != "0" * 24:
        raise ValueError("nonzero_address_padding")
    return "0x" + value[26:]


def candidates(document, chain_id, tx_hash, token, recipient):
    """Expectations are caller supplied; document.chain_id is an untrusted label."""
    chain = quantity(chain_id)
    tx_hash, token, recipient = (
        fixed_hex(tx_hash, 32), fixed_hex(token, 20), fixed_hex(recipient, 20)
    )
    if chain <= 0 or int(tx_hash, 16) == 0 or int(token, 16) == 0 or int(recipient, 16) == 0:
        raise ValueError("zero_expected_identifier")
    if not isinstance(document, dict) or quantity(document.get("chain_id")) != chain:
        raise ValueError("chain_id_mismatch")
    receipts = document.get("receipts")
    if not isinstance(receipts, list):
        raise ValueError("receipts_must_be_list")
    counts, found, receipt_headers = Counter(), {}, set()
    for receipt in receipts:
        try:
            if not isinstance(receipt, dict):
                raise ValueError("invalid_receipt")
            if fixed_hex(receipt.get("transactionHash"), 32) != tx_hash:
                counts["other_transaction"] += 1
                continue
            status = quantity(receipt.get("status"))
            block_hash = fixed_hex(receipt.get("blockHash"), 32)
            block_number = quantity(receipt.get("blockNumber"))
            if status not in (0, 1) or int(block_hash, 16) == 0:
                raise ValueError("invalid_receipt")
            logs = receipt.get("logs")
            if not isinstance(logs, list):
                raise ValueError("logs_must_be_list")
        except ValueError:
            counts["invalid_receipt"] += 1
            continue
        receipt_headers.add((status, block_hash, block_number))
        if len(receipt_headers) > 1:
            raise ValueError("conflicting_receipt_snapshots")
        if status != 1:
            counts["failed_transaction"] += 1
            continue
        for log in logs:
            try:
                if not isinstance(log, dict):
                    raise ValueError("invalid_log")
                if log.get("removed", False) is not False:
                    counts["removed_or_invalid_flag"] += 1
                    continue
                if (fixed_hex(log.get("transactionHash"), 32) != tx_hash
                        or fixed_hex(log.get("blockHash"), 32) != block_hash
                        or quantity(log.get("blockNumber")) != block_number):
                    raise ValueError("log_receipt_mismatch")
                index = quantity(log.get("logIndex"))
                emitter = fixed_hex(log.get("address"), 20)
                topics = log.get("topics")
                if not isinstance(topics, list) or len(topics) != 3:
                    counts["not_erc20_shape"] += 1
                    continue
                if fixed_hex(topics[0], 32) != TRANSFER:
                    counts["other_event"] += 1
                    continue
                sender, receiver = topic_address(topics[1]), topic_address(topics[2])
                units = int(fixed_hex(log.get("data"), 32), 16)
                if emitter != token or receiver != recipient:
                    counts["other_token_or_recipient"] += 1
                    continue
                if units == 0 or sender == receiver:
                    counts["zero_or_self_transfer"] += 1
                    continue
            except ValueError:
                counts["invalid_log"] += 1
                continue
            key = (chain, tx_hash, token, recipient, index)
            row = {"chain_id": chain, "transaction_hash": tx_hash, "token": token,
                   "recipient": recipient, "log_index": index, "from": sender,
                   "raw_units": str(units), "block_hash": block_hash}
            if key in found:
                if found[key] != row:
                    raise ValueError("conflicting_duplicate_log")
                counts["duplicate"] += 1
            else:
                found[key] = row
    rows = [found[key] for key in sorted(found)]
    return {"kind": "offline_candidates_only", "candidates": rows,
            "candidate_raw_units": str(sum(int(row["raw_units"]) for row in rows)),
            "skipped": dict(sorted(counts.items()))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    for name in ("chain-id", "tx-hash", "token", "recipient"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    try:
        result = candidates(json.loads(args.input.read_text()), args.chain_id,
                            args.tx_hash, args.token, args.recipient)
    except (ValueError, OSError) as error:
        print(json.dumps({"kind": "invalid_input", "error": str(error)}, sort_keys=True))
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
