# Design

## Context

See `proposal.md` for the migration motivation. This is fleet change 0; archive order is 0 → 1 → 2 → 3 → 4. Changes 1 and 3 consume the release commands below only after owner-authorized publication.

Verified repository facts:

- `plugin/package.json` is private, version `0.1.0`, with two `omp.extensions` entries: `personal-commit.ts` and `plannotator.ts`. Runtime modules have no package dependencies.
- `plugin/` contains nine skills (three authored plus six generated), six generated command files, always-applied `rules/personal-policy.md`, and `lsp/lsp.json`. The LSP file disables Marksman and supplies Markdown Oxide, Roslyn, and Svelte overrides.
- `flake.nix:43-65` exports the runtime directory as `packages.personal-omp-plugin` and `packages.default`; `:122-161` independently exports `lib.openspecCheck`. Existing checks reference the runtime derivation. Its `cp -R . "$out"` also copies `plugin/tests/`, despite the accepted development-payload separation contract.
- README and AGENTS currently describe immutable-store delivery, a wrapper with `--extension` and `--plugin-dir`, downstream runtime pins, and activation. `.github/workflows/ci.yml` already runs Nix flake checks and the locked development-shell Bun gate on Linux and Apple Silicon macOS.
- `add-plannotator-visual-feedback` owns annotation semantics and an open platform/browser acceptance gate. Its design explicitly says POSIX process groups support Darwin/Linux and native Windows hosting is unsupported. `retire-legacy-planning-archive` owns archive disposition and removal; `add-research-paper-writing-skill` owns the complete vendored writing skill and its unresolved third-party redistribution rights. This change modifies none of their deltas or artifacts.

Upstream references read on 2026-10-07:

- [Marketplace](https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md): catalog schema, sources, scopes, cache versions, namespaced discovery, reload boundary, and update behavior.
- [Installer plumbing](https://github.com/can1357/oh-my-pi/blob/main/docs/plugin-manager-installer-plumbing.md): marketplace runtime symlink/lock registration, local-path install → link, manifest extension loading, and package update behavior.
- [LSP config](https://github.com/can1357/oh-my-pi/blob/main/docs/lsp-config.md): marketplace `lspServers`, disabled definitions, project markers, and executable filtering.
- [Extension loading](https://github.com/can1357/oh-my-pi/blob/main/docs/extension-loading.md), [skills](https://github.com/can1357/oh-my-pi/blob/main/docs/skills.md), and [context/rules](https://github.com/can1357/oh-my-pi/blob/main/docs/context-files.md): manifest factories, conventional skills/rules, and source precedence.

These mutable upstream docs describe current behavior, not a permanent version guarantee. The spike below tested the installed 18.6.1 source; release CI must prove its own locked OMP version and downstream sessions must prove the upstream binary they actually run.

## Goals / Non-Goals

**Goals:** One user-scoped, versioned marketplace identity loads the full runtime bundle without wrapper flags or user-file copies; upgrades are deliberate and observable; the shared Nix OpenSpec validator survives independently of runtime delivery.

**Non-goals:** No runtime npm publication, plugin updater daemon, wrapper, dual delivery mode, compatibility aliases, server executables, provider credentials, or changes to annotation/writing behavior. Installing a capability does not prove every host can execute its external tools.

## Isolated spike evidence

### Isolation and executable provenance

All subprocesses ran from an empty temporary work directory, with `HOME`, XDG data/config/cache roots, and launch scratch paths underneath the temporary tree. Provider API-key variables and profile/agent-directory overrides were removed. No model prompt, provider login, real `~/.omp` write, or host activation occurred. The repository's `plugin/` was copied, never changed in place.

The PATH entry initially was `/etc/profiles/per-user/user/bin/omp`, a workstation wrapper. With isolated HOME, this exact command failed:

```text
$ omp plugin list --json
exit=1
No OMP source generation is selected at /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/home/.local/share/omp-dev/current.
Run omp-dev-update to initialize it.
```

Read-only inspection showed the wrapper both requires a live generation and injects the old plugin flags, which would contaminate discovery. Instead, a temporary `bin/omp` symlink selected the same generation's source launcher at `/home/user/.local/share/omp-dev/generations/v18.6.1-qmbdlzi5/checkout/packages/coding-agent/scripts/omp`; `OMP_DEV_LAUNCH_DIR` pointed into scratch. Commands still invoked `omp` through PATH, with no wrapper flags. `omp --version` printed `omp/18.6.1` (exit 0). This was the already-installed patched source generation, **not** a separately downloaded upstream standalone binary; upstream docs agree with the observed manager behavior, but binary-host parity remains a release gate.

The first setup also set absolute `PI_CONFIG_DIR=$HOME/.omp`; that generation produced a duplicated HOME prefix in plugin paths. Its whole disposable HOME was deleted and recreated, `PI_CONFIG_DIR` was unset, and all accepted observations below used the default isolated `$HOME/.omp` layout. Do not copy that absolute override into production instructions.

### Marketplace fixture and exact CLI observations

Let `S=/tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos`. The fixture was a copy at `$S/catalog/plugin` with this catalog at `$S/catalog/.omp-plugin/marketplace.json`:

```json
{
  "name": "glockyco",
  "owner": { "name": "glockyco" },
  "plugins": [{
    "name": "personal",
    "source": "./plugin",
    "version": "0.1.0",
    "lspServers": "./lsp/lsp.json"
  }]
}
```

Actual subprocess commands and observed stdout (all exit 0):

```text
$ omp plugin marketplace add /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog
✔ Added marketplace: /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog
$ omp plugin install personal@glockyco
✔ Installed personal from glockyco (0.1.0)
$ omp plugin list --json
```

The list JSON contained `npm: []`, one marketplace entry with `id: "personal@glockyco"`, `scope: "user"`, version `0.1.0`, and install path `$S/home/.omp/plugins/cache/plugins/glockyco___personal___0.1.0`.

```text
$ omp plugin doctor --json
```

Doctor returned `plugins_directory: ok`, `node_modules: ok`, and `package_manifest: warning / Not created yet`, exit 0. A marketplace-only profile need not have the npm dependency manifest. **List and doctor alone do not prove runtime loading.**

### Provider-free runtime observation

The command was `bun /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/probe.ts`, exit 0. The temporary probe imported and called the actual same-version OMP loaders; it did not use doubles for discovery or extension registration. This is the probe body, with `SRC` denoting the generation's `checkout/packages/coding-agent/src` absolute path (expanded in the actual file):

```typescript
import { loadCapability } from "SRC/discovery/index.ts";
import { discoverAndLoadExtensions } from "SRC/extensibility/extensions/loader.ts";
import { preloadPluginRoots } from "SRC/discovery/helpers.ts";
import { loadConfig } from "SRC/lsp/config.ts";
const cwd = process.cwd();
await preloadPluginRoots(process.env.HOME!, cwd);
for (const cap of ["skills", "rules", "slash-commands"]) {
  const r = await loadCapability(cap, { cwd });
  console.log(JSON.stringify({
    cap,
    items: r.items.map((x: any) => ({
      name: x.name, alwaysApply: x.alwaysApply, path: x.path,
      filePath: x.filePath, provider: x._source?.provider,
    })), warnings: r.warnings,
  }));
}
const e = await discoverAndLoadExtensions([], cwd);
console.log(JSON.stringify({
  extensions: e.extensions.map(x => ({
    path: x.path, tools: [...x.tools.keys()], commands: [...x.commands.keys()],
  })), errors: e.errors,
}));
console.log(JSON.stringify({ lsp: loadConfig(cwd).servers }));
process.exit(0);
```

The observed output, projecting only plugin-owned names from the emitted JSON, was:

```text
skills: commit-policy, openspec-apply-change, openspec-archive-change,
        openspec-explore, openspec-propose, openspec-sync-specs,
        openspec-update-change, research-evidence, research-paper-writing
rules: personal-policy, alwaysApply=true
slash-commands: personal:opsx-apply, personal:opsx-archive,
                personal:opsx-explore, personal:opsx-propose,
                personal:opsx-sync, personal:opsx-update
```

All file-backed items came from the marketplace cache and provider `claude-plugins`. No bare or cache-location-derived workflow name was emitted. The actual extension-registration output was:

```json
{
  "extensions": [
    {
      "path": "<isolated-home>/.omp/plugins/node_modules/@glockyco/personal-omp-plugin/extensions/personal-commit.ts",
      "tools": ["personal_commit"], "commands": []
    },
    {
      "path": "<isolated-home>/.omp/plugins/node_modules/@glockyco/personal-omp-plugin/extensions/plannotator.ts",
      "tools": [],
      "commands": ["plannotator-annotate", "plannotator-last", "plannotator-cancel"]
    }
  ],
  "errors": []
}
```

Paths above are normalized projections of emitted absolute paths, not alternate commands. Skills remained bare named; extension-owned Plannotator commands remained unprefixed.

For configuration selection, the fixture created `.git/`, `svelte.config.js`, and `fixture.csproj` in cwd and put executable no-op probes named `marksman`, `markdown-oxide`, `Microsoft.CodeAnalysis.LanguageServer`, and `svelteserver` on PATH. The emitted LSP configuration selected:

- `markdown-oxide`: command `markdown-oxide`, args `[]`, files `.md,.markdown`, roots `.moxide.toml,.obsidian,.git`, warmup 2000 ms.
- `roslyn-language-server`: command `Microsoft.CodeAnalysis.LanguageServer`, args `--stdio,--autoLoadProjects`, files `.cs,.csx`, roots `*.sln,*.slnx,*.csproj,global.json`.
- `svelte`: roots `svelte.config.js,svelte.config.mjs,svelte.config.ts` (the override, not built-in `package.json`).
- **No `marksman`**, even with its executable and `.git` marker present.

This proves real merge/selection and disabling, not protocol handshakes or diagnostics against real language servers.

### Local package mode and link probe

A separate empty `$S/link-home` used the same runtime probe and project fixtures:

```text
$ omp plugin install /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog/plugin
✔ Linked @glockyco/personal-omp-plugin from /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog/plugin
$ bun /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/probe.ts
exit=0
$ omp plugin list --json
exit=0
$ omp plugin doctor --json
exit=0
$ omp plugin upgrade @glockyco/personal-omp-plugin
exit=1
Failed to upgrade @glockyco/personal-omp-plugin: @glockyco/personal-omp-plugin is linked from a local path; there is nothing to upgrade
$ omp plugin link /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog/plugin
✔ Linked @glockyco/personal-omp-plugin from /tmp/nix-shell.OmVU4U/omp-plugin-spike-zjrkrwos/catalog/plugin
```

The runtime discovered the same nine skills and always-applied rule through `omp-plugins`, both modules with the same registrations and no errors, and six **bare** `opsx-*` command names. However, emitted LSP selection was only built-in Svelte roots (`svelte.config.js,svelte.config.mjs,package.json`) plus **Marksman**, with no Markdown Oxide or Roslyn. Therefore local-package mode loses the entire personal LSP override surface. It also depends on a mutable checkout and offers no upgrade. `list` put it under `npm` as enabled `@glockyco/personal-omp-plugin` version `0.1.1` (the fixture had already been bumped for the upgrade experiment); doctor said `plugin:@glockyco/personal-omp-plugin: ok` despite the missing LSP overrides.

The allowed local-path comparison exercised the npm/git/link runtime provider, not an npm registry publication or Git network install. Upstream installer docs say Git/npm use the same conventional runtime loader; Git upgrades can detect a changed recorded ref/Bun resolution without a version bump, while npm uses published versions. Those Git/npm update observations are **documentation evidence**, not exercised network results. The root repository's development `package.json` is not the runtime plugin manifest, another reason not to advertise a direct repository Git package install.

### Upgrade detection and restricted-PATH correction

Actual commands and output after changing **only disposable fixture files**:

```text
$ omp plugin upgrade personal@glockyco
Upgraded personal@glockyco (user) to 0.1.0
# Set catalog entry and copied plugin/package.json to 0.1.1.
$ omp plugin marketplace update glockyco
✔ Updated marketplace: glockyco
$ omp plugin upgrade
  personal@glockyco (user): 0.1.0 -> 0.1.1
# Set both versions to 0.1.2.
$ omp plugin marketplace update glockyco
✔ Updated marketplace: glockyco
$ omp plugin upgrade --scope user personal@glockyco
Upgraded personal@glockyco (user) to 0.1.2
```

All exited 0; list showed `0.1.1` after the all-plugin upgrade and fresh probe paths showed cache version `0.1.2` after the explicit upgrade. A targeted upgrade reinstalls the catalog version even unchanged; it is not itself a newer-release detector. Upstream `marketplace/manager.ts` confirms all-plugin detection compares explicit catalog versions, semver-newer when valid, and targeted upgrade force-reinstalls. Always refresh the catalog first; never treat `metadata.version` or package version alone as the release signal.

An initial Roslyn-absence attempt removed the fixture executable but still selected the real Roslyn binary from inherited PATH. That result was **not** accepted as binary-absence proof. A second isolated tree `/tmp/nix-shell.OmVU4U/omp-lsp-absence-atiaqs2w` restricted PATH to a temporary directory containing symlinks for `omp`, Bun, `dirname`, `readlink`, `mkdir`, and only `marksman`/`markdown-oxide` no-op probes. `.git` and `fixture.csproj` markers still existed. Its marketplace add/install and the same loader probe all exited 0; emitted extensions still had both modules and `errors: []`; LSP was **only `markdown-oxide`**. Roslyn was absent despite a C# marker, and Marksman remained absent despite its binary. Thus WSL can omit Roslyn executables without a hidden alias, fallback, or plugin-side install.

Both complete temporary trees were removed after observation; existence checks returned false. No spike script remains in the repository.

## Decisions

### 1. Use one marketplace release, not package mode plus copied config

The production catalog keeps the proven fixture shape and adds description, repository/homepage and license metadata without inventing owner contact details. `source: "./plugin"` is relative to the Git marketplace root; `lspServers: "./lsp/lsp.json"` is contained within the plugin root. Keep the source LSP file there: the manager materializes its `.lsp.json` configuration in the installed cache. Retain both `omp.extensions` entries; a catalog alone is not an extension-module manifest.

Exact installation contract for changes 1 and 3, macOS/Linux/Windows alike:

```text
omp plugin marketplace add glockyco/omp-agent-setup
omp plugin install --scope user personal@glockyco
```

Exact update contract:

```text
omp plugin marketplace update glockyco
omp plugin upgrade --scope user personal@glockyco
```

Then exit/restart OMP in Tern. `/reload-plugins` alone does not load new module factories. `omp update` updates upstream OMP, not this plugin. Never combine manager installation with `--extension <plugin>` or `--plugin-dir <plugin>/lsp`; never copy the rule, skills, or commands into user configuration. OMP owns its runtime registry/cache/auth/session state; chezmoi does not render installed plugin contents or lockfiles.

**Alternative rejected:** Git/npm mode plus a user `lsp.json` copy, wrapper flag, or plugin-root shim. The spike proves the missing LSP surface; the workaround would create another owner and violate the fleet clean-cutover decision. All required capabilities load in marketplace mode, so no loading fallback is needed.

### 2. Accept the native marketplace namespace without aliases

Commands are `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`. The namespace is stable plugin identity, not a Nix-store/cache path. Skills remain `openspec-*`; annotation commands remain `/plannotator-*` because they are registered by extension factories.

Update current README/AGENTS and downstream runbooks to describe this cutover. Do **not** edit generator-owned adapter bytes or add bare-name aliases. Explain that stock generated text may refer to `/opsx-*` workflow shorthand while the installed marketplace entry points are `/personal:opsx-*`; skill names and workflow behavior are unchanged. This preserves generator freshness without making a second adapter convention. A repository-specific command/skill override remains supported at the same exposed name, as upstream provider precedence allows.

### 3. Make versions the catalog release signal

The first manager release is proposed as `0.2.0` because delivery and slash-command names break the `0.1.0` contract. `plugin/package.json.version` and the `personal` catalog entry version must match exactly. Root `package.json.version` is development metadata, not an independent release source; keep it aligned in release commits to avoid three apparent versions. Delete the Nix runtime derivation's fourth hard-coded version rather than maintaining it.

Every change to distributed runtime content, catalog LSP semantics, generated adapters, or compatibility requirements bumps the semantic version in the same reviewed release commit; development/docs-only updates need not bump it. The default branch is the installable catalog and must not receive changed runtime content at the same version. After gates pass, the owner explicitly authorizes merging/pushing the release and immutable tag `v0.2.0` (subsequently `vX.Y.Z`). Record commit/tag and versions, never move a published tag. There is no automatic publication, merge, startup auto-upgrade, or npm release job. Targeted upgrade can overwrite the same-version cache, so version discipline is essential, not advisory.

CI checks equality and runtime-diff → newer version against the pull request base and tests a synthetic newer catalog plus unchanged version. `omp plugin upgrade` without a target may partially succeed and ignores its scope flag; release guidance therefore uses only the explicit user-scoped target after catalog refresh.

### 4. Remove only the obsolete flake delivery output

Delete `packages.personal-omp-plugin`, `packages.default`, the source copy/shebang-patching runtime derivation, and default-package consumer instructions. Preserve `lib.openspecCheck` exactly as an independent fleet interface, its `llm-agents` pin, strict/archive checks, and offline-after-fetch behavior. `nix-config` can retain an input to this repository for that library and shared OpenSpec version without pinning the runtime plugin.

Retain the Nix development shell, single Bun toolchain, generator app, freshness check, behavioral tests, Python retrieval fixtures, and OpenSpec validation. Move repository tests from `plugin/tests/` to repository `tests/`; update test relative paths, `PERSONAL_PLUGIN_DIR`, flake sources and any tracked references. Catalog `./plugin` is the copied runtime boundary and must contain no tests/dev caches. Python remains an ordinary host executable for explicitly invoking the research helper, not a requirement for loading the plugin and not a hidden Nix-store shebang. Keep executable permissions and complete writing-skill assets/licenses.

Replace package-shape/default-output checks with checks over the release tree and an actual isolated manager install, using the locked upstream OMP selected by `llm-agents`. The same-version SDK/source loader used by the probe can observe provider-free discovery; expose its path from the locked OMP test environment and reject a CLI/SDK version mismatch rather than fetching a second independent runtime. The package's source exports are available in upstream `package.json`; a standalone-binary session observer using `getAllTools`, `getCommands`, and `getSystemPrompt` adds actual host acceptance without relying only on source loaders. Retain an installed-tree test pass by pointing existing behavior tests at the installed cache, not merely repository source.

### 5. Preserve CI and replace what it proves

Darwin/Linux jobs still use `nix flake check --print-build-logs`, `nix develop --command bun install --frozen-lockfile`, and `nix develop --command bun run ci`. No second Bun setup action or version file. Add catalog/version validation and isolated install/upgrade/discovery checks to the same gates, with temporary HOME/XDG roots, outside-repository cwd, provider-free observation and deterministic fake executables for config selection. Capture exact OMP version and capability identities; reject duplicate commands, absent rule, absent modules, missing skill assets, wrong Svelte/Roslyn overrides, or active Marksman.

Each negative control should fail observably: malformed catalog, mismatched versions, missing extension entry/module, missing command/skill/rule, omitted `lspServers`, and unchanged release version after a runtime edit. The no-provider test does not require network once Nix inputs are fetched; its marketplace source is a temporary local release tree. Native Windows CLI/install/discovery is a downstream real-machine acceptance step owned by change 3; this proposal does not add Windows Bun/Nix CI or weaken the current protected Darwin/Linux contexts.

## Risks / Trade-offs

- **Tested launcher is patched source, not official binary.** → Treat loader results as observed 18.6.1 behavior; run release gates on the locked upstream OMP and fresh upstream standalone sessions in Tern before fleet cutover. Do not claim the source probe already certifies native hosts.
- **Stable command namespace changes entry points.** → Publish it as breaking behavior, update current guidance and tests, and remove old wrapper loading. No aliases or copied adapters.
- **Plugin manager has nontransactional/shared-cache behavior.** → Bump versions, do not mutate runtime state concurrently, retain rollback material and record installed version after each upgrade. Do not assume the old cache survives an upgrade.
- **Native Windows annotation behavior remains unsupported in its active design.** → Change 3 must gate actual annotation/feedback/cancel/navigation/shutdown in the host or obtain an explicit companion revision. No silent WSL executable fallback. This is not a manager loading limitation; both factories did load.
- **Writing-skill third-party permission remains unverified.** → Preserve its attribution/risk and complete files; marketplace publication does not establish redistribution rights.
- **Provider-free selection tests do not prove real LSP operations.** → Host acceptance must run real Markdown diagnostics/definition/references/rename with Marksman also present when possible, plus host-applicable Roslyn/Svelte behavior. WSL excludes Roslyn by executable availability, which the restricted-PATH spike proved.
- **Overlapping active cleanup touches documentation later.** → Do not modify their owned requirements or active directories. Apply their changes with normal subject ownership; this release updates only current delivery/release sections, not the archive disposition or writing/annotation semantics.

## Migration and rollback

1. Implement the catalog/version boundary, relocate tests, replace default-package delivery checks, and rewrite current consumer/release guidance as one coherent change. Keep the old live deployment untouched while the candidate release is tested in disposable profiles.
2. Run both existing gates plus strict change validation; retain adapter freshness and `lib.openspecCheck` consumers. Run a fresh official standalone OMP session in Tern using an isolated candidate marketplace on macOS and Linux/WSL. Owner-assisted prerequisites, if needed, are explicit (Mac sudo password typed by the owner while the agent runs a command in a terminal; provider authentication by the owner). No login is required for the discovery gate.
3. Only after checks pass, get explicit owner authorization for merge/push and release tag. Re-fetch the published Git marketplace into another disposable HOME; prove its advertised version and full capability surface. Record the published commit/tag before nix-config consumes it.
4. Changes 1 and 3 use the exact install commands, verify version/registrations, and restart upstream OMP in Tern; they own removing wrappers and live activation. Windows elevated prerequisites require owner UAC/Administrator credentials; provider logins remain owner-assisted. Preserve old host generations until those host checks pass.
5. For a bad manager release, use a **forward rollback release**: restore the known-good runtime content in a new reviewed higher version, pass gates, publish only with owner authorization, then refresh/upgrade/restart through the same commands. Do not rewrite a release tag, mutate a cached version, restore a Nix wrapper, or rely on old cache retention. During initial unpublished testing, discard the disposable profile; the still-live old deployment remains untouched until its separate cutover succeeds.

## Open questions and ownership

No unresolved install-mode decision or capability-loading fallback remains. Native Windows annotation lifecycle and actual official-binary host sessions remain release risks, not observed successes. No requirement-ownership conflict was written: only `personal-omp-plugin` and `plugin-update-automation` are modified here; fleet validation, structured commits, research evidence, and the three active capability deltas remain unchanged.
