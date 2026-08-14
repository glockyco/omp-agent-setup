import os
from pathlib import Path
import re
import unittest


PLUGIN_ROOT = Path(os.environ.get("PERSONAL_PLUGIN_DIR", Path(__file__).parents[1]))
ROOT = PLUGIN_ROOT / "skills" / "simplified-technical-english"
EXPECTED = {
    *("1.{}".format(index) for index in range(1, 15)),
    *("2.{}".format(index) for index in range(1, 3)),
    *("3.{}".format(index) for index in range(1, 8)),
    *("4.{}".format(index) for index in range(1, 6)),
    *("5.{}".format(index) for index in range(1, 6)),
    *("6.{}".format(index) for index in range(1, 7)),
    *("7.{}".format(index) for index in range(1, 4)),
    *("8.{}".format(index) for index in range(1, 8)),
    *("9.{}".format(index) for index in range(1, 5)),
}


class SteTraceabilityTests(unittest.TestCase):
    def test_rule_inventory_contains_exactly_53_expected_identifiers(self):
        rules = (ROOT / "references" / "rules.md").read_text()
        rows = re.findall(r"^\| (\d+\.\d+) \|", rules, re.MULTILINE)
        self.assertEqual(len(rows), 53)
        self.assertEqual(len(set(rows)), 53)
        self.assertEqual(set(rows), EXPECTED)

    def test_every_checklist_rule_citation_resolves(self):
        checklist = (ROOT / "references" / "checklist.md").read_text()
        citations = set(re.findall(r"\b[1-9]\.\d+\b", checklist))
        self.assertTrue(citations)
        self.assertEqual(citations - EXPECTED, set())

    def test_audit_status_records_official_copy_without_claiming_compliance(self):
        standard = (ROOT / "references" / "standard.md").read_text()
        skill = (ROOT / "SKILL.md").read_text()
        self.assertIn(
            "https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf",
            standard,
        )
        self.assertIn(
            "d1f4ea9e7cd6e46b47aa9057209f99e78c0e9cfc4e27a5b07895b05c1a166431",
            standard,
        )
        self.assertIn(
            "Rule-paraphrase audit: verified against the official Issue 9 rule statements",
            standard,
        )
        self.assertIn("audit-status: verified-against-official-issue-9", skill)
        self.assertIn("neither the official PDF nor the complete controlled dictionary", standard)
        self.assertIn("Do not claim ASD-STE100 compliance", skill)


if __name__ == "__main__":
    unittest.main()
