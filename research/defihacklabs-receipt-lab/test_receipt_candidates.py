import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

from receipt_candidates import candidates


HERE = Path(__file__).resolve().parent
CHAIN, TX = "0x539", "0x" + "aa" * 32
TOKEN, RECIPIENT = "0x" + "11" * 20, "0x" + "33" * 20


class ReceiptCandidateTests(unittest.TestCase):
    def setUp(self):
        self.document = json.loads((HERE / "synthetic_receipts.json").read_text())

    def parse(self, document=None, **overrides):
        args = dict(chain_id=CHAIN, tx_hash=TX, token=TOKEN, recipient=RECIPIENT)
        args.update(overrides)
        return candidates(self.document if document is None else document, **args)

    def only_log(self, index):
        doc = copy.deepcopy(self.document)
        doc["receipts"][0]["logs"] = [doc["receipts"][0]["logs"][index]]
        return doc

    def test_mixed_fixture_counts_only_one_matching_transfer(self):
        result = self.parse()
        self.assertEqual(result["candidate_raw_units"], "1250000")
        self.assertEqual(len(result["candidates"]), 1)
        self.assertEqual(result["candidates"][0]["log_index"], 0)
        self.assertEqual(result["skipped"], {
            "duplicate": 1, "invalid_log": 3, "not_erc20_shape": 1,
            "other_event": 1, "other_token_or_recipient": 2,
            "removed_or_invalid_flag": 1, "zero_or_self_transfer": 2})

    def test_success_alone_and_wrong_assets_are_not_candidates(self):
        for index in (1, 2, 10):
            with self.subTest(index=index):
                self.assertEqual(self.parse(self.only_log(index))["candidates"], [])
        self.document["receipts"][0]["logs"] = []
        self.assertEqual(self.parse()["candidate_raw_units"], "0")

    def test_erc721_same_signature_is_not_an_erc20_amount(self):
        doc = self.only_log(3)
        self.assertEqual(doc["receipts"][0]["logs"][0]["topics"][0],
                         "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
        self.assertEqual(self.parse(doc)["candidates"], [])

    def test_reverted_receipt_never_counts_even_with_matching_log(self):
        doc = self.only_log(0)
        doc["receipts"][0]["status"] = "0x0"
        self.assertEqual(self.parse(doc)["candidate_raw_units"], "0")

    def test_pending_or_missing_receipt_and_null_index(self):
        doc = self.only_log(0)
        self.document["receipts"] = [None, {}]
        self.assertEqual(self.parse()["candidates"], [])
        doc["receipts"][0]["logs"][0]["logIndex"] = None
        self.assertEqual(self.parse(doc)["candidates"], [])

    def test_zero_and_self_transfer_are_valid_but_not_incoming_candidates(self):
        for index in (5, 8):
            self.assertEqual(self.parse(self.only_log(index))["candidates"], [])

    def test_padding_data_and_removed_flags_are_rejected(self):
        for index in (4, 6, 7, 9):
            with self.subTest(index=index):
                self.assertEqual(self.parse(self.only_log(index))["candidates"], [])
        doc = self.only_log(0)
        doc["receipts"][0]["logs"][0]["removed"] = "false"
        self.assertEqual(self.parse(doc)["candidates"], [])

    def test_wrong_chain_and_wrong_transaction(self):
        with self.assertRaisesRegex(ValueError, "chain_id_mismatch"):
            self.parse(chain_id="0x1")
        self.assertEqual(self.parse(tx_hash="0x" + "cc" * 32)["candidates"], [])

    def test_duplicate_receipts_are_deduplicated(self):
        doc = self.only_log(0)
        doc["receipts"].append(copy.deepcopy(doc["receipts"][0]))
        self.assertEqual(self.parse(doc)["candidate_raw_units"], "1250000")

    def test_conflicting_duplicate_amount_fails_instead_of_first_wins(self):
        doc = self.only_log(0)
        other = copy.deepcopy(doc["receipts"][0]["logs"][0])
        other["data"] = "0x" + format(2, "064x")
        doc["receipts"][0]["logs"].append(other)
        with self.assertRaisesRegex(ValueError, "conflicting_duplicate_log"):
            self.parse(doc)

    def test_conflicting_receipt_snapshot_fails(self):
        doc = self.only_log(0)
        other = copy.deepcopy(doc["receipts"][0])
        other["blockHash"] = "0x" + "ee" * 32
        doc["receipts"].append(other)
        with self.assertRaisesRegex(ValueError, "conflicting_receipt_snapshots"):
            self.parse(doc)

    def test_max_uint256_has_no_float_precision_loss(self):
        doc = self.only_log(0)
        doc["receipts"][0]["logs"][0]["data"] = "0x" + "ff" * 32
        self.assertEqual(self.parse(doc)["candidate_raw_units"], str(2**256 - 1))

    def test_bad_expected_address_and_noncanonical_quantity(self):
        with self.assertRaises(ValueError):
            self.parse(token="0x1234")
        with self.assertRaises(ValueError):
            self.parse(chain_id="0x0539")

    def test_cli_outputs_deterministic_json(self):
        command = [sys.executable, str(HERE / "receipt_candidates.py"),
                   str(HERE / "synthetic_receipts.json"), "--chain-id", CHAIN,
                   "--tx-hash", TX, "--token", TOKEN, "--recipient", RECIPIENT]
        first = subprocess.check_output(command, text=True)
        self.assertEqual(first, subprocess.check_output(command, text=True))
        self.assertEqual(json.loads(first)["kind"], "offline_candidates_only")


if __name__ == "__main__":
    unittest.main()
