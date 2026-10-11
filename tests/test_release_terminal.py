"""Native terminal/owned-tree failure controls; no OMP or provider is required."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from release_gate import OwnedTree, Profile, Terminal, language_servers_started, stop_spawned_process


class TerminalTests(unittest.TestCase):
    def test_completed_conpty_reader_releases_handles_without_cancelling_io(self):
        terminal = Terminal.__new__(Terminal)
        terminal.process = Mock(closed=False)
        reader = terminal.process._thread
        reader.is_alive.return_value = False
        pty_handle = terminal.process.pty
        pty_handle.cancel_io.side_effect = AssertionError("no pending I/O")
        with patch("release_gate.os.name", "nt"):
            terminal._close_handles()
        terminal.process.fileobj.close.assert_called_once()
        terminal.process._server.close.assert_called_once()
        reader.join.assert_called_once_with(timeout=10)
        pty_handle.cancel_io.assert_not_called()
        self.assertFalse(hasattr(terminal.process, "pty"))
        self.assertTrue(terminal.process.closed)

    def test_pending_conpty_reader_is_cancelled_and_joined_before_handle_release(self):
        terminal = Terminal.__new__(Terminal)
        terminal.process = Mock(closed=False)
        reader = terminal.process._thread
        reader.is_alive.side_effect = [True, False]
        pty_handle = terminal.process.pty
        with patch("release_gate.os.name", "nt"):
            terminal._close_handles()
        self.assertEqual(reader.join.call_count, 2)
        pty_handle.cancel_io.assert_called_once()
        self.assertFalse(hasattr(terminal.process, "pty"))
        self.assertTrue(terminal.process.closed)

    def test_live_conpty_reader_failures_remain_visible(self):
        for failure in ("cancel", "join"):
            with self.subTest(failure=failure):
                terminal = Terminal.__new__(Terminal)
                terminal.process = Mock(closed=False)
                reader = terminal.process._thread
                reader.is_alive.return_value = True
                if failure == "cancel":
                    terminal.process.pty.cancel_io.side_effect = OSError("Element not found.")
                with patch("release_gate.os.name", "nt"):
                    with self.assertRaisesRegex(
                        OSError if failure == "cancel" else AssertionError,
                        "Element not found.|ConPTY reader failed",
                    ):
                        terminal._close_handles()
                terminal.process.fileobj.close.assert_called_once()
                terminal.process._server.close.assert_called_once()
                self.assertFalse(terminal.process.closed)

    @unittest.skipIf(os.name == "nt", "Unix process-group reaping")
    def test_exited_unreaped_root_is_reaped_before_group_cleanup(self):
        process = subprocess.Popen([sys.executable, "-c", "pass"], stdout=subprocess.PIPE, start_new_session=True)
        try:
            self.assertEqual(process.stdout.read(), b"")
            stop_spawned_process(process, grace=0)
            self.assertEqual(process.returncode, 0)
        finally:
            process.stdout.close()
            process.wait(timeout=10)

    @unittest.skipIf(os.name == "nt", "Unix process-group reaping")
    def test_group_permission_race_retries_only_after_reaping_our_root(self):
        tree = OwnedTree.__new__(OwnedTree)
        tree.pid = 123
        process = Mock(pid=123)
        process.poll.side_effect = [None, 0]
        with patch("release_gate.os.killpg", side_effect=[PermissionError("zombie group"), ProcessLookupError()]) as kill:
            stop_spawned_process(process, tree, grace=0)
        self.assertEqual(process.poll.call_count, 2)
        self.assertEqual(kill.call_count, 2)
        process.poll.side_effect = [None, None]
        with patch("release_gate.os.killpg", side_effect=PermissionError("denied")) as kill:
            with self.assertRaisesRegex(PermissionError, "denied"):
                stop_spawned_process(process, tree, grace=0)
        kill.assert_called_once()
        process.poll.side_effect = [None, 0]
        with patch("release_gate.os.killpg", side_effect=PermissionError("live group denied")) as kill:
            with self.assertRaisesRegex(PermissionError, "live group denied"):
                stop_spawned_process(process, tree, grace=0)
        self.assertEqual(kill.call_count, 2)

    def test_real_terminal_drains_and_releases_descendant_after_root_exit(self):
        with tempfile.TemporaryDirectory(prefix="terminal tree with spaces ") as directory:
            root = Path(directory)
            heartbeat = root / "heartbeat"
            ready = root / "ready"
            exit_root = root / "exit root"
            child = root / "child.py"
            child.write_text(
                "import pathlib, signal, sys, time\n"
                "if sys.platform != 'win32': signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
                "heartbeat = pathlib.Path(sys.argv[1])\n"
                "print('x' * 262144, flush=True)\n"
                "print('drain complete', flush=True)\n"
                "while True:\n"
                " heartbeat.write_text(str(time.monotonic()))\n"
                " time.sleep(.05)\n"
            )
            parent = root / "parent.py"
            parent.write_text(
                "import os, pathlib, subprocess, sys, time\n"
                "child = subprocess.Popen([sys.executable, sys.argv[1], sys.argv[2]])\n"
                "pathlib.Path(sys.argv[3]).write_text(str(child.pid))\n"
                "while not pathlib.Path(sys.argv[4]).exists(): time.sleep(.05)\n"
                "os._exit(0)\n"
            )
            unrelated = subprocess.Popen(
                [sys.executable, "-c", "import time; time.sleep(60)"],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=os.name != "nt",
            )

            def close_unrelated():
                if unrelated.poll() is None:
                    unrelated.kill()
                unrelated.wait(timeout=10)

            self.addCleanup(close_unrelated)
            terminal = Terminal([sys.executable, str(parent), str(child), str(heartbeat), str(ready), str(exit_root)], root, dict(os.environ))
            try:
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    if ready.exists() and heartbeat.exists() and b"drain complete" in terminal.output:
                        break
                    time.sleep(.05)
                else:
                    self.fail("native terminal failed to drain the fixture output")
                terminal.tree.remember()
                exit_root.touch()
                deadline = time.monotonic() + 10
                while terminal.alive() and time.monotonic() < deadline:
                    time.sleep(.05)
                self.assertFalse(terminal.alive(), "fixture root failed to exit")
            finally:
                terminal.close()
            self.assertFalse(terminal.reader.is_alive())
            self.assertIsNone(unrelated.poll(), "terminal cleanup killed an unrelated session")
            self.assertIn(b"drain complete", terminal.output)
            stopped = heartbeat.read_text()
            time.sleep(.3)
            self.assertEqual(heartbeat.read_text(), stopped, "orphan descendant still runs")
            if os.name == "nt":
                self.assertEqual(terminal.tree.survivors(), [])
                self.assertTrue(terminal.process.fileobj._closed)
            else:
                self.assertIsNone(terminal.main)

    def test_observation_timeout_and_failure_always_close_terminal(self):
        for failure in ("timeout", "exited", "query"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                profile = Mock()
                profile.work = Path(directory)
                profile.lsp_log = profile.work / "lsp.log"
                profile.environment.return_value = {}
                terminal = Mock()
                terminal.output = b"fixture failure"
                terminal.alive.return_value = failure != "exited"
                if failure == "query":
                    terminal.tree.remember.side_effect = AssertionError("query denied")
                with patch("release_gate.Terminal", return_value=terminal), patch("release_gate.omp_binary", return_value=sys.executable):
                    with self.assertRaisesRegex(AssertionError, "timed out|exited early|query denied"):
                        language_servers_started(profile, deadline=.02)
                terminal.close.assert_called_once()

    def test_cli_timeout_releases_owned_tree_and_pipe_handles(self):
        profile = Profile.__new__(Profile)
        profile.work = Path.cwd()
        profile.environment = Mock(return_value={})
        process = Mock(pid=123)
        process.poll.return_value = None
        process.communicate.side_effect = subprocess.TimeoutExpired("fixture OMP", 120)
        tree = Mock()
        with patch("release_gate.subprocess.Popen", return_value=process), patch("release_gate.omp_binary", return_value=sys.executable), patch("release_gate.OwnedTree", return_value=tree), patch("release_gate.stop_spawned_process") as stop:
            with self.assertRaises(subprocess.TimeoutExpired):
                profile.omp("plugin", "install")
        stop.assert_called_once_with(process, tree, 1)
        process.wait.assert_called_once_with(timeout=10)
        process.stdout.close.assert_called_once()
        process.stderr.close.assert_called_once()

    def test_startup_query_failure_stops_spawned_root_and_closes_handles(self):
        process = Mock(pid=123)
        process._thread.is_alive.return_value = False
        target = "winpty.PtyProcess.spawn" if os.name == "nt" else "release_gate.subprocess.Popen"
        with patch(target, return_value=process), patch("release_gate.OwnedTree", side_effect=AssertionError("query denied")), patch("release_gate.stop_spawned_process") as stop:
            with self.assertRaisesRegex(AssertionError, "query denied"):
                Terminal([sys.executable], Path.cwd(), dict(os.environ))
        stop.assert_called_once_with(process, None, 0)
        if os.name == "nt":
            process.fileobj.close.assert_called_once()
            process._server.close.assert_called_once()
            process._thread.join.assert_called_once()
        else:
            process.wait.assert_called_once_with(timeout=10)

    def test_cleanup_failure_still_releases_terminal_handles(self):
        terminal = Terminal.__new__(Terminal)
        terminal.tree = Mock()
        terminal.process = Mock()
        terminal._close_handles = Mock()
        with patch("release_gate.stop_spawned_process", side_effect=AssertionError("termination denied")):
            with self.assertRaisesRegex(AssertionError, "termination denied"):
                terminal.close()
        terminal._close_handles.assert_called_once()

    def test_windows_expected_nonforce_refusal_escalates_but_other_failures_are_visible(self):
        tree = OwnedTree.__new__(OwnedTree)
        tree.survivors = Mock(return_value=[123])
        expected = subprocess.CompletedProcess([], 128, "", "This process can only be terminated forcefully (with /F option).")
        with patch.dict(os.environ, {"SystemRoot": str(Path.cwd())}), patch.object(subprocess, "CREATE_NO_WINDOW", 0, create=True), patch("release_gate.subprocess.run", return_value=expected) as run:
            tree.taskkill(123, False)
            self.assertEqual(run.call_args.args[0][1:], ["/PID", "123", "/T"])
            with self.assertRaisesRegex(AssertionError, "forcefully"):
                tree.taskkill(123, True)
            self.assertEqual(run.call_args.args[0][1:], ["/PID", "123", "/T", "/F"])
            for output in ("Access is denied.", "unknown utility error", "Reason: can only be terminated forcefully\nReason: unknown utility error"):
                run.return_value = subprocess.CompletedProcess([], 5, "", output)
                with self.assertRaisesRegex(AssertionError, "denied|unknown utility error"):
                    tree.taskkill(123, False)
            tree.survivors.return_value = []
            run.reset_mock()
            tree.taskkill(123, True)
            run.assert_not_called()

    def test_windows_creation_identity_prevents_pid_reuse_kill(self):
        tree = OwnedTree.__new__(OwnedTree)
        tree.pid = 10
        tree.identities = {10: "old", 11: "child"}
        rows = {10: {"pid": 10, "parent": 0, "created": "reused"},
                11: {"pid": 11, "parent": 10, "created": "child"}}
        with patch("release_gate.windows_processes", return_value=rows):
            self.assertEqual(tree.survivors(), [11])

    def test_profile_failure_and_environment_remain_scratch_owned(self):
        profile = Profile()
        root = profile.root
        try:
            with patch.dict(os.environ, {"OPENAI_API_KEY": "never leak", "PI_AGENT_DIR": "never leak"}):
                env = profile.environment()
            self.assertNotIn("OPENAI_API_KEY", env)
            self.assertNotIn("PI_AGENT_DIR", env)
            for path in (profile.work, profile.release):
                self.assertTrue(path.is_relative_to(profile.home), path)
            for key in ("HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "TMPDIR", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"):
                self.assertTrue(Path(env[key]).is_relative_to(root), (key, env[key]))
        finally:
            profile.close()
        self.assertFalse(root.exists())
        with tempfile.TemporaryDirectory() as directory:
            failed = Path(directory) / "failed profile"
            failed.mkdir()
            with patch("release_gate.tempfile.mkdtemp", return_value=str(failed)), patch.object(Profile, "_prepare", side_effect=RuntimeError("candidate copy failed")):
                with self.assertRaisesRegex(RuntimeError, "candidate copy failed"):
                    Profile()
            self.assertFalse(failed.exists())
            failed.mkdir()
            with patch("release_gate.tempfile.mkdtemp", return_value=str(failed)), patch.object(Path, "resolve", side_effect=OSError("scratch resolution failed")):
                with self.assertRaisesRegex(OSError, "scratch resolution failed"):
                    Profile()
            self.assertFalse(failed.exists())


# Run the actual helper's __main__ through explicitly addressed Python, with only
# its HTTP boundary replaced. Unknown requests fail, never reach the network.
HELPER_DRIVER = '''import io, json, os, pathlib, runpy, sys, urllib.request
fixture = json.loads(pathlib.Path(os.environ['PDF_FIXTURE']).read_text())
def urlopen(request, timeout):
    url = request.full_url
    with open(os.environ['PDF_CALLS'], 'a') as log: log.write(url + '\\n')
    if url not in fixture: raise AssertionError('unexpected network request: ' + url)
    return io.BytesIO(fixture[url].encode())
urllib.request.urlopen = urlopen
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
'''


class HelperInvocationTests(unittest.TestCase):
    def test_explicit_python_acquires_from_a_cache_path_with_spaces(self):
        payload = Path(os.environ.get("PERSONAL_PLUGIN_DIR", Path(__file__).parents[1] / "plugin"))
        with tempfile.TemporaryDirectory(prefix="installed cache with spaces ") as directory:
            root = Path(directory)
            if os.environ.get("PERSONAL_PLUGIN_DIR"):
                helper = payload / "skills/research-evidence/scripts/fetch_pdf.py"
            else:
                helper = root / "research evidence" / "fetch_pdf.py"
                helper.parent.mkdir()
                shutil.copy2(payload / "skills/research-evidence/scripts/fetch_pdf.py", helper)
            self.assertIn(" ", str(helper), "fixture must execute a path containing spaces")
            fixture = root / "http fixture.json"
            calls = root / "request log"
            output = root / "paper output.pdf"
            api = "https://api.unpaywall.org/v2/10.1000/example?email=writer@example.org"
            fixture.write_text(json.dumps({
                api: json.dumps({"is_oa": True, "oa_locations": [
                    {"host_type": "repository", "version": "acceptedVersion", "url_for_pdf": "https://repository.test/paper.pdf"},
                    {"host_type": "publisher", "version": "publishedVersion", "url_for_pdf": "https://publisher.test/paper.pdf"},
                ]}),
                "https://publisher.test/paper.pdf": "%PDF-publisher fixture",
            }))
            env = {**os.environ, "PDF_FIXTURE": str(fixture), "PDF_CALLS": str(calls), "UNPAYWALL_EMAIL": "writer@example.org", "PYTHONDONTWRITEBYTECODE": "1"}
            argv = [sys.executable, "-c", HELPER_DRIVER, str(helper), "fixture_key", "--doi", "10.1000/example", "--arxiv", "2401.00001", "--out", str(output)]
            result = subprocess.run(argv, env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(output.read_bytes(), b"%PDF-publisher fixture")
            self.assertIn("OA publisher https://publisher.test/paper.pdf", result.stdout)
            self.assertEqual(calls.read_text().splitlines(), [api, "https://publisher.test/paper.pdf"])
            output.unlink()
            calls.unlink()
            env.pop("UNPAYWALL_EMAIL")
            rejected = subprocess.run(argv, env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(rejected.returncode, 2, rejected.stderr)
            self.assertIn("UNPAYWALL_EMAIL", rejected.stderr)
            self.assertFalse(calls.exists())
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
