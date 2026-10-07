"""Isolated release gate for the personal marketplace plugin.

Installs a candidate release tree with the real OMP plugin manager into a
disposable profile and observes what a fresh OMP process actually loads:
commands and system prompt through RPC mode, language-server selection
through the processes an interactive session starts. No provider credential,
model request, or real OMP state is involved. The `release-gate` flake check
runs this with the locked OMP; run it by hand with

    OMP_BIN=$(command -v omp) python3 tests/release_gate.py
"""

import json
import os
import pty
import select
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
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
POLICY_HEADING = "# Personal policy"
LANGUAGE_SERVERS = ["marksman", "markdown-oxide", "Microsoft.CodeAnalysis.LanguageServer", "svelteserver"]

# Variables that would select another profile, agent directory or provider.
LEAKING_PREFIXES = ("PI_", "OMP_")
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
    binary = os.environ.get("OMP_BIN")
    if not binary:
        raise SystemExit("OMP_BIN must name the OMP executable under test")
    return binary


class Profile:
    """A disposable OMP home with a candidate release tree and a work directory."""

    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix="personal-release-gate-"))
        self.home = self.root / "home"
        self.work = self.root / "work"
        self.bin = self.root / "bin"
        self.release = self.root / "release"
        for path in (self.home / ".omp" / "agent", self.work, self.bin):
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
        shutil.rmtree(self.root, ignore_errors=True)

    def environment(self, path=None):
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in LEAKING_NAMES and not key.startswith(LEAKING_PREFIXES)
        }
        env.update(
            HOME=str(self.home),
            XDG_CONFIG_HOME=str(self.home / ".config"),
            XDG_DATA_HOME=str(self.home / ".local" / "share"),
            XDG_CACHE_HOME=str(self.home / ".cache"),
            XDG_STATE_HOME=str(self.home / ".local" / "state"),
            TMPDIR=str(self.root),
            TERM="xterm-256color",
            PATH=path if path is not None else f"{self.bin}{os.pathsep}{os.environ.get('PATH', '')}",
            PI_SKIP_VERSION_CHECK="1",
        )
        return env

    def omp(self, *args, check=True):
        result = subprocess.run(
            [omp_binary(), *args],
            cwd=self.work,
            env=self.environment(),
            capture_output=True,
            text=True,
            timeout=120,
        )
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

    def language_server_probes(self, names):
        for name in names:
            probe = self.bin / name
            probe.write_text(f'#!/bin/sh\necho "{name} $*" >> "{self.lsp_log}"\nexec sleep 30\n')
            probe.chmod(0o755)


def rpc_observe(profile):
    """Returns (commands, system prompt, extension error notices) of a fresh RPC session."""
    process = subprocess.Popen(
        [omp_binary(), "--mode", "rpc", "--no-ui"],
        cwd=profile.work,
        env=profile.environment(),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    frames = []

    def send(frame):
        process.stdin.write(json.dumps(frame) + "\n")
        process.stdin.flush()

    def response(identifier):
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            line = process.stdout.readline()
            if not line:
                break
            try:
                frame = json.loads(line)
            except json.JSONDecodeError:
                continue
            frames.append(frame)
            if frame.get("id") == identifier:
                if frame.get("success") is False:
                    raise AssertionError(f"RPC {identifier} failed: {frame}")
                return frame.get("data", {})
        raise AssertionError(f"no RPC {identifier} response; stderr: {process.stderr.read()[-2000:]}")

    try:
        response_ready = None
        while response_ready is None:
            line = process.stdout.readline()
            if not line:
                raise AssertionError(f"RPC session ended early: {process.stderr.read()[-2000:]}")
            frame = json.loads(line)
            if frame.get("type") == "ready":
                response_ready = frame
        send({"id": "commands", "type": "get_available_commands"})
        commands = response("commands")["commands"]
        send({"id": "state", "type": "get_state"})
        prompt = "\n".join(response("state").get("systemPrompt", []))
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
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
    if POLICY_HEADING not in prompt:
        findings.append("always-applied rule personal-policy not in the system prompt")
    findings.extend(f"extension error: {error}" for error in errors)
    return findings


def language_servers_started(profile, path=None, settle=4.0, deadline=40.0):
    """Starts an interactive session in a pseudo-terminal and returns the servers it spawns."""
    profile.lsp_log.unlink(missing_ok=True)
    main, secondary = pty.openpty()
    process = subprocess.Popen(
        [omp_binary()],
        cwd=profile.work,
        env=profile.environment(path),
        stdin=secondary,
        stdout=secondary,
        stderr=secondary,
        start_new_session=True,
    )
    os.close(secondary)
    started = time.monotonic()
    first_spawn = None
    try:
        while time.monotonic() - started < deadline:
            readable, _, _ = select.select([main], [], [], 0.2)
            if readable:
                try:
                    os.read(main, 65536)
                except OSError:
                    break
            if first_spawn is None and profile.lsp_log.exists():
                first_spawn = time.monotonic()
            if first_spawn is not None and time.monotonic() - first_spawn >= settle:
                break
            if process.poll() is not None:
                break
    finally:
        # On macOS an exiting process waits until its unread terminal output
        # drains, so reaping it while the main side stays open and unread
        # never returns. Closing the main side first discards that output.
        os.close(main)
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
    if not profile.lsp_log.exists():
        return {}
    servers = {}
    for line in profile.lsp_log.read_text().splitlines():
        name, _, args = line.partition(" ")
        servers[name] = args
    return servers


def language_server_findings(servers):
    """Checks the selection that the personal LSP overrides must produce in the full fixture."""
    findings = []
    if "marksman" in servers:
        findings.append("Marksman is active although the personal overrides disable it")
    if "markdown-oxide" not in servers:
        findings.append("Markdown Oxide was not selected")
    if servers.get("Microsoft.CodeAnalysis.LanguageServer") != "--stdio --autoLoadProjects":
        findings.append(f"Roslyn override not applied: {servers.get('Microsoft.CodeAnalysis.LanguageServer')}")
    if "svelteserver" not in servers:
        findings.append("Svelte was not selected by svelte.config.js")
    return findings


def full_language_fixture(profile):
    (profile.work / ".git").mkdir(exist_ok=True)
    (profile.work / "README.md").write_text("# Fixture\n")
    (profile.work / "svelte.config.js").write_text("export default {};\n")
    (profile.work / "fixture.csproj").write_text("<Project />\n")
    profile.language_server_probes(LANGUAGE_SERVERS)


def payload_files(root):
    return sorted(
        str(path.relative_to(root))
        for path in root.rglob("*")
        if path.is_file() and path.name != ".lsp.json"
    )


class InstalledRelease(unittest.TestCase):
    """The candidate release installs, loads completely, and runs from the installed cache."""

    @classmethod
    def setUpClass(cls):
        cls.profile = Profile()
        cls.profile.install()
        cls.version = json.loads((REPOSITORY / CATALOG).read_text())["plugins"][0]["version"]

    @classmethod
    def tearDownClass(cls):
        cls.profile.close()

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
        self.assertTrue(os.access(path / "skills/research-evidence/scripts/fetch_pdf.py", os.X_OK))
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
        (self.profile.bin / "Microsoft.CodeAnalysis.LanguageServer").unlink(missing_ok=True)
        restricted = os.pathsep.join([str(self.profile.bin), str(Path(omp_binary()).parent), "/bin", "/usr/bin"])
        servers = language_servers_started(self.profile, path=restricted)
        self.assertIn("markdown-oxide", servers)
        self.assertNotIn("svelteserver", servers)
        self.assertNotIn("Microsoft.CodeAnalysis.LanguageServer", servers)
        self.assertNotIn("marksman", servers)

    def test_behavior_tests_pass_against_the_installed_cache(self):
        path = self.install_path()
        env = {**os.environ, "PERSONAL_PLUGIN_DIR": str(path)}
        bun = subprocess.run(
            ["bun", "test", *(str(test) for test in sorted((REPOSITORY / "tests").glob("*.test.ts")) if test.name != "release-tree.test.ts")],
            cwd=REPOSITORY,
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(bun.returncode, 0, bun.stdout + bun.stderr)
        python = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(REPOSITORY / "tests"), "-p", "test_*.py"],
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(python.returncode, 0, python.stdout + python.stderr)


class LostCapabilities(unittest.TestCase):
    """Negative controls: each damaged candidate must fail on the capability it lost."""

    def setUp(self):
        self.profile = Profile()

    def tearDown(self):
        self.profile.close()

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

    def test_missing_skill_asset_is_visible_in_the_cache(self):
        asset = Path("skills/research-paper-writing/references/introduction.md")
        (self.profile.release / PAYLOAD / asset).unlink()
        self.profile.install()
        [(entry, _)] = self.profile.installed()
        self.assertNotIn(str(asset), payload_files(Path(entry["installPath"])))
        self.assertIn(str(asset), payload_files(REPOSITORY / PAYLOAD))

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
        self.profile.set_version("0.0.1")
        self.profile.install()
        self.profile.set_version("0.0.2")

    def tearDown(self):
        self.profile.close()

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
    print(subprocess.run([omp_binary(), "--version"], capture_output=True, text=True).stdout.strip())
    unittest.main(verbosity=2)
