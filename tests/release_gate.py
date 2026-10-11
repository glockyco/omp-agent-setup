"""Isolated release gate for the personal marketplace plugin.

Installs a candidate release tree with the real OMP plugin manager into a
disposable profile and observes what a fresh OMP process actually loads:
commands and system prompt through RPC mode, language-server selection
through the processes an interactive session starts. No provider credential,
model request, or real OMP state is involved. Run through the native launcher:

    bun run check:installed-release
"""

import json
import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
import threading

if os.name != "nt":
    import pty
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[1]
CATALOG = Path(".omp-plugin") / "marketplace.json"
PAYLOAD = "plugin"
PLUGIN_ID = "personal@glockyco"
PACKAGE = "@glockyco/personal-omp-plugin"

COMMANDS = ["opsx-apply", "opsx-archive", "opsx-explore", "opsx-propose", "opsx-sync", "opsx-update"]
ANNOTATION_COMMANDS = ["plannotator-annotate", "plannotator-cancel", "plannotator-last"]
SKILLS = [
    "commit-policy",
    "openspec-apply-change",
    "openspec-archive-change",
    "openspec-explore",
    "openspec-propose",
    "openspec-sync-specs",
    "openspec-update-change",
    "research-evidence",
    "research-paper-writing",
]
RULE_HEADINGS = {"personal-policy": "# Personal policy", "plain-prose": "# Plain prose"}
LANGUAGE_SERVERS = ["marksman", "markdown-oxide", "Microsoft.CodeAnalysis.LanguageServer", "svelteserver"]

# Variables that would select another profile, agent directory or provider.
LEAKING_PREFIXES = ("PI_", "OMP_", "ANTHROPIC_", "OPENAI_", "GEMINI_", "GOOGLE_", "AZURE_",
                    "AWS_", "OPENROUTER_", "XAI_", "GROQ_", "MISTRAL_", "COHERE_", "DEEPSEEK_")
LEAKING_NAMES = {
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "XAI_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
    "HOMEDRIVE",
    "HOMEPATH",
}

# RPC and interactive sessions need a selectable model. This one is local and
# unreachable, so any accidental model request fails instead of reaching a provider.
MODELS_YML = """providers:
  release-gate:
    baseUrl: http://127.0.0.1:9/v1
    api: openai-completions
    auth: none
    models:
      - id: unreachable
"""
# Start language servers with the session so their selection becomes observable.
CONFIG_YML = """lsp:
  lazy: false
  shared: false
"""


def omp_binary():
    binary = os.environ.get("OMP_BIN", "")
    if not Path(binary).is_absolute() or not Path(binary).is_file():
        raise SystemExit("OMP_BIN must name an absolute OMP executable under test")
    return binary




def windows_processes():
    system = Path(os.environ["SystemRoot"]) / "System32"
    script = (
        "$ErrorActionPreference='Stop'; "
        "@(Get-CimInstance Win32_Process | ForEach-Object { "
        "[pscustomobject]@{pid=$_.ProcessId; parent=$_.ParentProcessId; "
        "created=$_.CreationDate.ToUniversalTime().ToString('o')} }) | ConvertTo-Json -Compress"
    )
    result = subprocess.run(
        [str(system / "WindowsPowerShell/v1.0/powershell.exe"), "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if result.returncode:
        raise AssertionError(f"owned process query failed: {result.stderr}")
    return {int(row["pid"]): row for row in json.loads(result.stdout or "[]")}


class OwnedTree:
    """Creation-qualified Windows descendants or one Unix process group."""

    def __init__(self, pid):
        self.pid = pid
        self.identities = {}
        self.remember()

    def remember(self):
        if os.name != "nt":
            return
        rows = windows_processes()
        root = rows.get(self.pid)
        if not self.identities and root:
            self.identities[self.pid] = root["created"]
        pending = {pid for pid, created in self.identities.items()
                   if pid in rows and rows[pid]["created"] == created}
        while pending:
            children = {pid for pid, row in rows.items() if row["parent"] in pending
                        and pid not in self.identities}
            for pid in children:
                self.identities[pid] = rows[pid]["created"]
            pending = children

    def survivors(self):
        rows = windows_processes()
        return [pid for pid, created in self.identities.items()
                if pid in rows and rows[pid]["created"] == created]

    def taskkill(self, pid, force):
        if pid not in self.survivors():
            return
        args = [str(Path(os.environ["SystemRoot"]) / "System32/taskkill.exe"), "/PID", str(pid), "/T"]
        if force:
            args.append("/F")
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            output = (result.stdout + result.stderr).strip()
            lowered = output.lower()
            alive = pid in self.survivors()
            reasons = re.findall(r"Reason:\s*([^\r\n]+)", output, re.IGNORECASE) or [output]
            expected = all("can only be terminated forcefully" in reason.lower() or
                           "child processes of this process were still running" in reason.lower()
                           for reason in reasons) and "denied" not in lowered
            if not force and expected:
                return
            if not alive and ("not found" in lowered or "no running instance" in lowered):
                return
            raise AssertionError(f"owned tree termination failed: {output}")

    def stop(self, grace=1.0, reap_root=None):
        if os.name == "nt":
            self.remember()
            for pid in self.survivors():
                self.taskkill(pid, False)
            time.sleep(grace)
            for pid in self.survivors():
                self.taskkill(pid, True)
            if self.survivors():
                raise AssertionError("owned Windows subprocess tree survived force termination")
        else:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                if reap_root is not None:
                    reap_root()
                try:
                    try:
                        os.killpg(self.pid, sig)
                    except PermissionError:
                        # Darwin reports EPERM for a group containing only an
                        # unreaped root; retry only after our handle reaps it.
                        if reap_root is None or reap_root() is None:
                            raise
                        os.killpg(self.pid, sig)
                except ProcessLookupError:
                    return
                if sig == signal.SIGTERM:
                    time.sleep(grace)


def stop_spawned_process(process, tree=None, grace=1.0):
    """Keep query failures visible, but still stop a live, handle-owned root."""
    try:
        (tree or OwnedTree(process.pid)).stop(grace, None if os.name == "nt" else process.poll)
    except BaseException:
        alive = process.isalive() if hasattr(process, "isalive") else process.poll() is None
        if alive and os.name == "nt":
            result = subprocess.run(
                [str(Path(os.environ["SystemRoot"]) / "System32/taskkill.exe"),
                 "/PID", str(process.pid), "/T", "/F"],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15, creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if result.returncode:
                raise AssertionError(f"emergency owned-root termination failed: {result.stdout}{result.stderr}")
        raise


class Terminal:
    """Continuously drains Unix PTY or native ConPTY while observing OMP."""

    def __init__(self, argv, cwd, env):
        self.output = bytearray()
        self.read_error = None
        self.main = None
        self.process = None
        self.tree = None
        try:
            if os.name == "nt":
                from winpty import PtyProcess
                from winpty.enums import Backend
                self.process = PtyProcess.spawn(argv, cwd=str(cwd), env=env, backend=Backend.ConPTY)
            else:
                self.main, secondary = pty.openpty()
                try:
                    self.process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=secondary,
                                                    stdout=secondary, stderr=secondary, start_new_session=True)
                finally:
                    os.close(secondary)
            self.tree = OwnedTree(self.process.pid)
            self.reader = threading.Thread(target=self._drain, daemon=True)
            self.reader.start()
        except BaseException:
            if self.process is not None:
                try:
                    stop_spawned_process(self.process, self.tree, 0)
                finally:
                    self._close_handles()
                    if os.name != "nt":
                        self.process.wait(timeout=10)
            elif self.main is not None:
                os.close(self.main)
            raise

    def _drain(self):
        try:
            while True:
                chunk = self.process.read(65536).encode() if os.name == "nt" else os.read(self.main, 65536)
                if not chunk:
                    break
                self.output.extend(chunk)
                del self.output[:-65536]
        except EOFError:
            pass
        except OSError as error:
            # Unix PTYs report EIO when the last slave handle closes.
            if os.name == "nt" or error.errno != 5:
                self.read_error = error
        except Exception as error:
            self.read_error = error

    def alive(self):
        return self.process.isalive() if os.name == "nt" else self.process.poll() is None

    def _close_handles(self):
        if os.name == "nt":
            # pywinpty's isalive() sets closed before close() can release sockets.
            self.process.fileobj.close()
            self.process._server.close()
            self.process.pty.cancel_io()
            self.process._thread.join(timeout=10)
            if self.process._thread.is_alive():
                raise AssertionError("ConPTY reader failed to release its terminal")
            del self.process.pty
            self.process.closed = True
        elif self.main is not None:
            os.close(self.main)
            self.main = None

    def close(self):
        try:
            stop_spawned_process(self.process, self.tree)
            if os.name != "nt":
                self.process.wait(timeout=10)
            self.reader.join(timeout=10)
            if self.reader.is_alive():
                raise AssertionError("terminal output did not drain after owned-tree termination")
            if self.read_error:
                raise AssertionError(f"terminal output failed: {self.read_error}")
        finally:
            self._close_handles()


class Profile:
    """A disposable OMP home with a candidate release tree and a work directory."""

    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix="personal release gate "))
        try:
            self._prepare()
        except BaseException:
            self.close()
            raise

    def _prepare(self):
        self.home = self.root / "home"
        self.work = self.root / "work"
        self.bin = self.root / "bin"
        self.release = self.root / "release"
        self.temp = self.root / "temp"
        self.bun = shutil.which("bun")
        if not self.bun:
            raise AssertionError("the pinned development Bun is required for release probes")
        for path in (self.home / ".omp" / "agent", self.work, self.bin, self.temp,
                     self.home / "AppData/Roaming", self.home / "AppData/Local"):
            path.mkdir(parents=True)
        (self.home / ".omp" / "agent" / "models.yml").write_text(MODELS_YML)
        (self.home / ".omp" / "agent" / "config.yml").write_text(CONFIG_YML)
        shutil.copytree(REPOSITORY / CATALOG.parent, self.release / CATALOG.parent)
        shutil.copytree(REPOSITORY / PAYLOAD, self.release / PAYLOAD, symlinks=True)
        # A Nix check reads the repository from the read-only store; the
        # candidate copy must stay editable for version bumps and damage.
        for path in [self.release, *self.release.rglob("*")]:
            path.chmod(path.stat().st_mode | 0o200)
        self.lsp_log = self.root / "lsp.log"

    def close(self):
        shutil.rmtree(self.root)

    def environment(self, path=None):
        env = {
            key: value
            for key, value in os.environ.items()
            if key.upper() not in LEAKING_NAMES and not key.upper().startswith(LEAKING_PREFIXES)
        }
        env.update(
            HOME=str(self.home),
            USERPROFILE=str(self.home),
            APPDATA=str(self.home / "AppData/Roaming"),
            LOCALAPPDATA=str(self.home / "AppData/Local"),
            TEMP=str(self.temp),
            TMP=str(self.temp),
            XDG_CONFIG_HOME=str(self.home / ".config"),
            XDG_DATA_HOME=str(self.home / ".local" / "share"),
            XDG_CACHE_HOME=str(self.home / ".cache"),
            XDG_STATE_HOME=str(self.home / ".local" / "state"),
            TMPDIR=str(self.temp),
            TERM="xterm-256color",
            PATH=path if path is not None else f"{self.bin}{os.pathsep}{os.environ.get('PATH', '')}",
            PI_SKIP_VERSION_CHECK="1",
            PYTHONUTF8="1",
            RELEASE_GATE_LSP_LOG=str(self.lsp_log),
        )
        return env

    def omp(self, *args, check=True):
        process = subprocess.Popen(
            [omp_binary(), *args], cwd=self.work, env=self.environment(),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            encoding="utf-8", errors="replace", start_new_session=os.name != "nt",
        )
        tree = None
        try:
            tree = OwnedTree(process.pid)
            stdout, stderr = process.communicate(timeout=120)
            result = subprocess.CompletedProcess(process.args, process.returncode, stdout, stderr)
        finally:
            try:
                stop_spawned_process(process, tree, 0 if process.poll() is not None else 1)
                process.wait(timeout=10)
            finally:
                process.stdout.close()
                process.stderr.close()
        if check and result.returncode != 0:
            raise AssertionError(f"omp {' '.join(args)} failed: {result.stdout}{result.stderr}")
        return result

    def set_version(self, version):
        catalog_path = self.release / CATALOG
        catalog = json.loads(catalog_path.read_text())
        for entry in catalog["plugins"]:
            entry["version"] = version
        catalog_path.write_text(json.dumps(catalog, indent="\t") + "\n")
        manifest_path = self.release / PAYLOAD / "package.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["version"] = version
        manifest_path.write_text(json.dumps(manifest, indent="\t") + "\n")

    def install(self):
        self.omp("plugin", "marketplace", "add", str(self.release))
        self.omp("plugin", "install", "--scope", "user", PLUGIN_ID)

    def upgrade(self):
        self.omp("plugin", "marketplace", "update", "glockyco")
        self.omp("plugin", "upgrade", "--scope", "user", PLUGIN_ID)

    def installed(self):
        listing = json.loads(self.omp("plugin", "list", "--json").stdout)
        return [
            (entry, plugin["id"])
            for plugin in listing.get("marketplace", [])
            for entry in plugin.get("entries", [])
        ]

    def probe_path(self, name):
        return self.bin / (name + (".exe" if os.name == "nt" else ""))

    def restricted_path(self):
        paths = [str(self.bin), str(Path(omp_binary()).parent)]
        paths.extend([str(Path(os.environ["SystemRoot"]) / "System32")] if os.name == "nt"
                     else ["/bin", "/usr/bin"])
        return os.pathsep.join(paths)

    def language_server_probes(self, names):
        executable = self.root / ("lsp-probe.exe" if os.name == "nt" else "lsp-probe")
        if not executable.exists():
            source = self.root / "lsp-probe.ts"
            source.write_text(
                'import { appendFileSync } from "node:fs";\n'
                'import { basename } from "node:path";\n'
                'appendFileSync(process.env.RELEASE_GATE_LSP_LOG!, JSON.stringify({'
                'name: basename(process.execPath).replace(/\\.exe$/i, ""), '
                'args: process.argv.slice(2)}) + "\\n");\n'
                'setInterval(() => {}, 1000);\n'
            )
            result = subprocess.run([self.bun, "build", "--compile", str(source), "--outfile", str(executable)],
                                    env=self.environment(), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
            if result.returncode:
                raise AssertionError(f"native LSP probe compilation failed: {result.stdout}{result.stderr}")
        for name in names:
            probe = self.probe_path(name)
            probe.unlink(missing_ok=True)
            os.link(executable, probe)
            if os.name != "nt":
                probe.chmod(0o755)


def rpc_observe(profile):
    """Returns commands/prompt from a bounded, continuously drained fresh RPC session."""
    process = subprocess.Popen(
        [omp_binary(), "--mode", "rpc", "--no-ui"], cwd=profile.work, env=profile.environment(),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        encoding="utf-8", errors="replace",
        start_new_session=os.name != "nt",
    )
    tree = None
    frames = []
    lines = queue.Queue()
    stderr = []

    def drain(stream, sink):
        try:
            for line in stream:
                sink(line)
        finally:
            if stream is process.stdout:
                lines.put(None)

    readers = [threading.Thread(target=drain, args=(process.stdout, lines.put), daemon=True),
               threading.Thread(target=drain, args=(process.stderr, stderr.append), daemon=True)]
    for reader in readers:
        reader.start()

    def response(identifier=None):
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=min(0.25, max(0.001, deadline - time.monotonic())))
            except queue.Empty:
                continue
            if line is None:
                break
            try:
                frame = json.loads(line)
            except json.JSONDecodeError:
                continue
            frames.append(frame)
            if (identifier is None and frame.get("type") == "ready") or (
                    identifier is not None and frame.get("id") == identifier):
                if frame.get("success") is False:
                    raise AssertionError(f"RPC {identifier} failed: {frame}")
                return frame.get("data", {})
        raise AssertionError(f"no RPC {identifier or 'ready'} response; stderr: {''.join(stderr)[-2000:]}")

    def send(identifier, kind):
        process.stdin.write(json.dumps({"id": identifier, "type": kind}) + "\n")
        process.stdin.flush()
        return response(identifier)

    try:
        tree = OwnedTree(process.pid)
        response()
        commands = send("commands", "get_available_commands")["commands"]
        prompt = "\n".join(send("state", "get_state").get("systemPrompt", []))
    finally:
        process.stdin.close()
        try:
            stop_spawned_process(process, tree)
            process.wait(timeout=10)
            for reader in readers:
                reader.join(timeout=10)
                if reader.is_alive():
                    raise AssertionError("RPC output did not drain after tree termination")
        finally:
            process.stdout.close()
            process.stderr.close()
    errors = [frame for frame in frames if "error" in str(frame.get("type", "")).lower()]
    return commands, prompt, errors


def capability_findings(commands, prompt, errors):
    """Names every declared capability that a fresh session does not expose."""
    findings = []
    names = [command["name"] for command in commands]
    for command in COMMANDS:
        count = names.count(f"personal:{command}")
        if count != 1:
            findings.append(f"command personal:{command} registered {count} times")
        if command in names:
            findings.append(f"command {command} registered under a bare alias")
    for command in ANNOTATION_COMMANDS:
        sources = [entry.get("source") for entry in commands if entry["name"] == command]
        if sources != ["extension"]:
            findings.append(f"annotation command {command} not registered once by the extension")
    if "xd://personal_commit" not in prompt:
        findings.append("commit tool personal_commit not registered")
    skills_block = prompt.split("<skills>", 1)[-1].split("</skills>", 1)[0]
    for skill in SKILLS:
        if f"- {skill}:" not in skills_block:
            findings.append(f"skill {skill} not discovered")
    for rule, heading in RULE_HEADINGS.items():
        if heading not in prompt:
            findings.append(f"always-applied rule {rule} not in the system prompt")
    findings.extend(f"extension error: {error}" for error in errors)
    return findings


def language_servers_started(profile, path=None, settle=4.0, deadline=40.0):
    """Observe actual OMP executable selection through a native terminal."""
    profile.lsp_log.unlink(missing_ok=True)
    terminal = Terminal([omp_binary()], profile.work, profile.environment(path))
    started = time.monotonic()
    first_spawn = None
    try:
        while time.monotonic() - started < deadline:
            if first_spawn is None and profile.lsp_log.exists():
                first_spawn = time.monotonic()
            if first_spawn is not None and time.monotonic() - first_spawn >= settle:
                break
            if not terminal.alive():
                raise AssertionError(f"OMP terminal exited early: {terminal.output.decode(errors='replace')[-2000:]}")
            terminal.tree.remember()
            time.sleep(0.2)
        else:
            raise AssertionError(f"LSP observation timed out: {terminal.output.decode(errors='replace')[-2000:]}")
    finally:
        terminal.close()
    servers = {}
    for line in profile.lsp_log.read_text().splitlines():
        row = json.loads(line)
        servers[row["name"]] = row["args"]
    return servers


def language_server_findings(servers):
    """Checks the selection that the personal LSP overrides must produce in the full fixture."""
    findings = []
    if "marksman" in servers:
        findings.append("Marksman is active although the personal overrides disable it")
    if servers.get("markdown-oxide") != []:
        findings.append(f"Markdown Oxide was not selected with exact argv: {servers.get('markdown-oxide')}")
    if servers.get("Microsoft.CodeAnalysis.LanguageServer") != ["--stdio", "--autoLoadProjects"]:
        findings.append(f"Roslyn override not applied: {servers.get('Microsoft.CodeAnalysis.LanguageServer')}")
    if servers.get("svelteserver") != ["--stdio"]:
        findings.append(f"Svelte was not selected by svelte.config.js with exact argv: {servers.get('svelteserver')}")
    return findings


def full_language_fixture(profile):
    (profile.work / ".git").mkdir(exist_ok=True)
    (profile.work / "README.md").write_text("# Fixture\n")
    (profile.work / "svelte.config.js").write_text("export default {};\n")
    (profile.work / "fixture.csproj").write_text("<Project />\n")
    profile.language_server_probes(LANGUAGE_SERVERS)


def payload_files(root):
    return sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path.name != ".lsp.json"
    )


class InstalledRelease(unittest.TestCase):
    """The candidate release installs, loads completely, and runs from the installed cache."""

    @classmethod
    def setUpClass(cls):
        cls.profile = Profile()
        cls.addClassCleanup(cls.profile.close)
        cls.profile.install()
        cls.version = json.loads((REPOSITORY / CATALOG).read_text())["plugins"][0]["version"]


    def install_path(self):
        installed = self.profile.installed()
        self.assertEqual(len(installed), 1, installed)
        entry, identifier = installed[0]
        self.assertEqual(identifier, PLUGIN_ID)
        self.assertEqual(entry["scope"], "user")
        self.assertEqual(entry["version"], self.version)
        return Path(entry["installPath"])

    def test_listed_once_from_the_manager_cache(self):
        path = self.install_path()
        cache = self.profile.home / ".omp" / "plugins" / "cache"
        self.assertTrue(path.is_relative_to(cache), path)

    def test_cache_holds_the_complete_payload(self):
        path = self.install_path()
        self.assertEqual(payload_files(path), payload_files(REPOSITORY / PAYLOAD))
        helper = path / "skills/research-evidence/scripts/fetch_pdf.py"
        self.assertTrue(os.access(helper, os.R_OK), helper)
        if os.name != "nt":
            self.assertTrue(os.access(helper, os.X_OK), helper)
        delivered = json.loads((path / ".lsp.json").read_text())
        declared = json.loads((REPOSITORY / PAYLOAD / "lsp" / "lsp.json").read_text())
        self.assertEqual(delivered["servers"], declared["servers"])

    def test_fresh_session_exposes_every_capability(self):
        commands, prompt, errors = rpc_observe(self.profile)
        self.assertEqual(capability_findings(commands, prompt, errors), [])

    def test_language_server_overrides_select_servers(self):
        full_language_fixture(self.profile)
        servers = language_servers_started(self.profile)
        self.assertEqual(language_server_findings(servers), [], servers)

    def test_executables_without_svelte_or_roslyn_markers_are_not_selected(self):
        profile = Profile()
        self.addCleanup(profile.close)
        profile.install()
        (profile.work / ".git").mkdir()
        (profile.work / "README.md").write_text("# Fixture\n")
        profile.language_server_probes(LANGUAGE_SERVERS)
        servers = language_servers_started(profile, path=profile.restricted_path())
        self.assertEqual(servers.get("markdown-oxide"), [])
        self.assertNotIn("svelteserver", servers)
        self.assertNotIn("Microsoft.CodeAnalysis.LanguageServer", servers)
        self.assertNotIn("marksman", servers)

    def test_svelte_marker_without_its_executable_is_not_selected(self):
        profile = Profile()
        self.addCleanup(profile.close)
        profile.install()
        full_language_fixture(profile)
        profile.probe_path("svelteserver").unlink()
        servers = language_servers_started(profile, path=profile.restricted_path())
        self.assertNotIn("svelteserver", servers)
        self.assertEqual(servers.get("Microsoft.CodeAnalysis.LanguageServer"), ["--stdio", "--autoLoadProjects"])
        self.assertEqual(servers.get("markdown-oxide"), [])
        self.assertNotIn("marksman", servers)

    def test_svelte_and_roslyn_need_their_markers_and_executables(self):
        # package.json alone selects the built-in Svelte server, not the override;
        # a C# marker without the Roslyn executable must not start Roslyn.
        work = self.profile.work
        for name in ("svelte.config.js",):
            (work / name).unlink(missing_ok=True)
        (work / ".git").mkdir(exist_ok=True)
        (work / "README.md").write_text("# Fixture\n")
        (work / "package.json").write_text("{}\n")
        (work / "fixture.csproj").write_text("<Project />\n")
        self.profile.language_server_probes(["marksman", "markdown-oxide", "svelteserver"])
        self.profile.probe_path("Microsoft.CodeAnalysis.LanguageServer").unlink(missing_ok=True)
        restricted = self.profile.restricted_path()
        servers = language_servers_started(self.profile, path=restricted)
        self.assertIn("markdown-oxide", servers)
        self.assertNotIn("svelteserver", servers)
        self.assertNotIn("Microsoft.CodeAnalysis.LanguageServer", servers)
        self.assertNotIn("marksman", servers)

    def test_behavior_tests_pass_against_the_installed_cache(self):
        path = self.install_path()
        env = {**self.profile.environment(), "PERSONAL_PLUGIN_DIR": str(path), "PYTHONDONTWRITEBYTECODE": "1"}
        bun = subprocess.run(
            [self.profile.bun, "test", *(str(REPOSITORY / "tests" / name) for name in (
                "plugin-load.test.ts", "personal-commit.test.ts", "plannotator.test.ts"))],
            cwd=REPOSITORY,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        self.assertEqual(bun.returncode, 0, bun.stdout + bun.stderr)
        python = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(REPOSITORY / "tests"), "-p", "test_*.py"],
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        self.assertEqual(python.returncode, 0, python.stdout + python.stderr)


class LostCapabilities(unittest.TestCase):
    """Negative controls: each damaged candidate must fail on the capability it lost."""

    def setUp(self):
        self.profile = Profile()
        self.addCleanup(self.profile.close)

    def findings_after(self, damage):
        damage(self.profile.release)
        self.profile.install()
        return capability_findings(*rpc_observe(self.profile))

    def test_malformed_catalog_fails_installation(self):
        (self.profile.release / CATALOG).write_text("{")
        with self.assertRaises(AssertionError):
            self.profile.install()

    def test_missing_extension_entry(self):
        def damage(release):
            manifest_path = release / PAYLOAD / "package.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["omp"]["extensions"] = ["./extensions/personal-commit.ts"]
            manifest_path.write_text(json.dumps(manifest))

        findings = self.findings_after(damage)
        self.assertIn("annotation command plannotator-annotate not registered once by the extension", findings)

    def test_missing_extension_module(self):
        findings = self.findings_after(lambda release: (release / PAYLOAD / "extensions" / "personal-commit.ts").unlink())
        self.assertIn("commit tool personal_commit not registered", findings)

    def test_missing_command(self):
        findings = self.findings_after(lambda release: (release / PAYLOAD / "commands" / "opsx-apply.md").unlink())
        self.assertIn("command personal:opsx-apply registered 0 times", findings)

    def test_missing_skill(self):
        findings = self.findings_after(
            lambda release: shutil.rmtree(release / PAYLOAD / "skills" / "commit-policy")
        )
        self.assertIn("skill commit-policy not discovered", findings)

    def test_missing_rule(self):
        findings = self.findings_after(lambda release: (release / PAYLOAD / "rules" / "personal-policy.md").unlink())
        self.assertIn("always-applied rule personal-policy not in the system prompt", findings)

    def test_missing_plain_prose_rule(self):
        findings = self.findings_after(lambda release: (release / PAYLOAD / "rules" / "plain-prose.md").unlink())
        self.assertIn("always-applied rule plain-prose not in the system prompt", findings)
        self.assertNotIn("always-applied rule personal-policy not in the system prompt", findings)

    def test_missing_skill_asset_is_visible_in_the_cache(self):
        asset = Path("skills/research-paper-writing/references/introduction.md")
        (self.profile.release / PAYLOAD / asset).unlink()
        self.profile.install()
        [(entry, _)] = self.profile.installed()
        self.assertNotIn(asset.as_posix(), payload_files(Path(entry["installPath"])))
        self.assertIn(asset.as_posix(), payload_files(REPOSITORY / PAYLOAD))

    def test_catalog_without_lsp_delivery_keeps_marksman(self):
        catalog_path = self.profile.release / CATALOG
        catalog = json.loads(catalog_path.read_text())
        for entry in catalog["plugins"]:
            entry.pop("lspServers", None)
        catalog_path.write_text(json.dumps(catalog))
        self.profile.install()
        full_language_fixture(self.profile)
        findings = language_server_findings(language_servers_started(self.profile))
        self.assertIn("Marksman is active although the personal overrides disable it", findings)


class Upgrades(unittest.TestCase):
    """Catalog refresh plus the explicit user-scoped upgrade installs a newer release."""

    def setUp(self):
        self.profile = Profile()
        self.addCleanup(self.profile.close)
        self.profile.set_version("0.0.1")
        self.profile.install()
        self.profile.set_version("0.0.2")

    def test_upgrade_installs_the_newer_version_completely(self):
        self.profile.upgrade()
        [(entry, _)] = self.profile.installed()
        self.assertEqual(entry["version"], "0.0.2")
        self.assertIn("0.0.2", entry["installPath"])
        self.assertEqual(capability_findings(*rpc_observe(self.profile)), [])

    def test_forward_rollback_restores_a_bad_release(self):
        # 0.0.2 ships without the rule; the fix republishes known-good content as 0.0.3.
        rule = self.profile.release / PAYLOAD / "rules" / "personal-policy.md"
        good = rule.read_text()
        rule.unlink()
        self.profile.upgrade()
        self.assertIn(
            "always-applied rule personal-policy not in the system prompt",
            capability_findings(*rpc_observe(self.profile)),
        )
        rule.write_text(good)
        self.profile.set_version("0.0.3")
        self.profile.upgrade()
        [(entry, _)] = self.profile.installed()
        self.assertEqual(entry["version"], "0.0.3")
        self.assertEqual(capability_findings(*rpc_observe(self.profile)), [])

    def test_upgrade_keeps_disabled_state_and_settings(self):
        self.profile.omp("plugin", "disable", "--scope", "user", PLUGIN_ID)
        self.profile.omp("plugin", "config", "set", PACKAGE, "release-gate", "kept")
        self.profile.upgrade()
        [(entry, _)] = self.profile.installed()
        self.assertEqual(entry["version"], "0.0.2")
        self.assertIs(entry.get("enabled"), False)
        lock = json.loads((self.profile.home / ".omp" / "plugins" / "omp-plugins.lock.json").read_text())
        self.assertEqual(lock["settings"].get(PACKAGE), {"release-gate": "kept"})
        commands, _, _ = rpc_observe(self.profile)
        # Disabled means intentionally hidden, not lost: enabling restores everything.
        self.assertNotIn("personal:opsx-apply", [command["name"] for command in commands])
        self.profile.omp("plugin", "enable", "--scope", "user", PLUGIN_ID)
        self.assertEqual(capability_findings(*rpc_observe(self.profile)), [])


if __name__ == "__main__":
    # Native launchers enforce the exact official pin; the retained flake supplies its locked OMP.
    unittest.main(verbosity=2)
