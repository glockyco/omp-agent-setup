"""Exercise real Git diffs, including filenames that cannot be line-split."""

import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "classify_ci_paths.py"
SPEC = importlib.util.spec_from_file_location("classify_ci_paths", SCRIPT)
CLASSIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CLASSIFIER)


class CiPathClassification(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.git("init", "--quiet")
        self.git("config", "user.email", "ci@example.invalid")
        self.git("config", "user.name", "CI fixture")
        self.put("README.md")
        self.put("runtime.ts")
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, stderr=subprocess.PIPE).decode().strip()

    def put(self, path, content="fixture\n"):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def commit(self):
        self.git("add", "--all")
        self.git("-c", "core.hooksPath=", "commit", "--quiet", "--allow-empty", "-m", "fixture")
        return self.git("rev-parse", "HEAD")

    def required(self):
        return CLASSIFIER.native_required("pull_request", self.base, self.commit(), self.root)

    def test_markdown_and_all_openspec_artifacts_skip(self):
        unusual = "nested/new line\nquoted name.md" if os.name != "nt" else "nested/spaced name.md"
        for path in ["guide.markdown", unusual, "openspec/config.yaml", "openspec/data.bin"]:
            self.put(path)
        self.assertFalse(self.required())

    def test_unknown_paths_and_case_are_conservative(self):
        for path in ["unknown", "UPPER.MD", ".github/workflows/ci.yml", "openspec-other/data.yaml"]:
            with self.subTest(path=path):
                self.put(path)
                self.assertTrue(self.required())
                (self.root / path).unlink()
                self.commit()

    def test_complete_diff_not_just_last_commit_or_first_page(self):
        self.put("first-commit.ts")
        self.commit()
        for index in range(350):
            self.put(f"docs/{index}.md")
        self.assertTrue(self.required())

    def test_runtime_deletion_runs(self):
        (self.root / "runtime.ts").unlink()
        self.assertTrue(self.required())

    def test_markdown_deletion_skips(self):
        (self.root / "README.md").unlink()
        self.assertFalse(self.required())

    def test_runtime_rename_to_markdown_runs(self):
        self.git("mv", "runtime.ts", "runtime.md")
        self.assertTrue(self.required())

    def test_markdown_rename_to_runtime_runs(self):
        self.git("mv", "README.md", "README.ts")
        self.assertTrue(self.required())

    def test_markdown_rename_skips(self):
        self.git("mv", "README.md", "guide.markdown")
        self.assertFalse(self.required())

    def test_merge_base_excludes_unrelated_base_changes(self):
        self.put("guide.md")
        head = self.commit()
        self.git("checkout", "--quiet", "--detach", self.base)
        self.put("base-only.ts")
        newer_base = self.commit()
        self.assertFalse(CLASSIFIER.native_required("pull_request", newer_base, head, self.root))

    def test_non_pr_events_always_run_without_git(self):
        for event in ["push", "workflow_dispatch", "schedule", "unknown"]:
            with self.subTest(event=event):
                self.assertTrue(CLASSIFIER.native_required(event, cwd=self.root / "absent"))

    def test_missing_commits_raise(self):
        with self.assertRaises(ValueError):
            CLASSIFIER.native_required("pull_request", cwd=self.root)

    def test_git_failure_cannot_publish_skip(self):
        output = self.root / "output"
        result = subprocess.run(
            [os.sys.executable, str(SCRIPT)], cwd=self.root, capture_output=True,
            env={**os.environ, "EVENT_NAME": "pull_request", "BASE_SHA": "missing", "HEAD_SHA": self.base,
                 "GITHUB_OUTPUT": str(output)},
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
