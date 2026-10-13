# personal-omp-plugin Specification

## Purpose
Define the versioned personal OMP capability bundle that OMP's plugin manager installs from the `glockyco` marketplace without mutating unrelated OMP-owned state.

## Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** every shipped always-applied rule, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** both declared extension modules load without import or registration errors

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **AND** no repository provides a command of the same exposed name
- **THEN** each generated workflow command is invocable under its marketplace name
- **AND** command and skill assets resolve from the installed release rather than a source checkout

### Requirement: Runtime independence

Loading the installed release SHALL NOT require a global Bun, npm, Python, .NET, or Homebrew installation. OMP's own runtime SHALL load the declared modules without plugin dependency installation. External capability executables SHALL remain host-owned prerequisites, not installers or aliases shipped by the plugin.

#### Scenario: Load from an isolated environment

- **WHEN** OMP starts with the manager-installed release and a restricted executable path
- **THEN** plugin discovery succeeds and performs no dependency installation

#### Scenario: Optional server executable is absent

- **WHEN** a project matches Roslyn's declared root markers but `Microsoft.CodeAnalysis.LanguageServer` does not resolve
- **THEN** the personal Roslyn definition is not selected and no Roslyn startup is attempted
- **AND** the plugin does not install or substitute a language server

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: host-native interface verification, regular atomic commit checkpoints with task-owned staging and no implicit push, structured commit transport, and causal commit bodies. It SHALL NOT route writing tasks to Simplified Technical English.

The policy SHALL keep detailed commit instructions in their skill instead of duplicating them globally.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy does not route technical or scientific writing to an STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance

### Requirement: Single source for the OpenSpec workflow

The plugin SHALL be the only tracked source of the generated OpenSpec workflow adapters. A repository that consumes the workflow SHALL NOT track its own copy of a generated command or skill.

A repository MAY still define a command or skill of the same exposed name to override the plugin's, and SHALL do so only to express a repository-specific deviation. Marketplace command entry points SHALL use the stable `personal:` plugin namespace; generated skill names SHALL remain unchanged. The generator-owned files SHALL NOT be rewritten merely to rename their marketplace entry points.

Rationale: identical generated files committed into repositories with their own formatting regimes acquire two owners and diverge. The plugin manager supplies command identity without creating another generated-adapter convention.

#### Scenario: Working in any repository

- **WHEN** a session starts in a repository that uses the workflow
- **THEN** the OpenSpec commands and skills are available from the plugin
- **AND** the repository tracks no copy of them
- **AND** workflow commands are exposed as `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`

#### Scenario: Repository-specific override

- **WHEN** a repository defines a command or skill whose exposed name matches one the plugin provides
- **THEN** the repository's definition takes effect in that repository
- **AND** the plugin's definition remains in effect everywhere else

#### Scenario: Repository-specific capabilities are unaffected

- **WHEN** a repository defines a skill or rule that the plugin does not provide
- **THEN** it remains tracked in that repository and keeps working

### Requirement: Workflow commands register once

Each generated workflow command SHALL register exactly once under its stable `personal:` marketplace namespace. It SHALL NOT also register under a bare alias or a name derived from the installation or package location.

The manager installation SHALL deliver LSP overrides and extension modules without a second explicit plugin-root or extension load. Consumers SHALL NOT combine marketplace installation with the retired wrapper flags or copied workflow adapters.

#### Scenario: Loading the workstation configuration

- **WHEN** upstream OMP starts after user-scoped installation of `personal@glockyco`
- **THEN** each workflow command appears once in the command list under its marketplace name
- **AND** no command appears under a bare alias or a name derived from the package location

#### Scenario: LSP overrides still apply

- **WHEN** upstream OMP starts after user-scoped installation of `personal@glockyco`
- **AND** a project matches an overridden server's root markers
- **AND** that server's binary resolves
- **THEN** the override is in effect without `--plugin-dir` or a user-owned copy of the override file

### Requirement: Generated adapter freshness

The repository SHALL verify in its own native Linux, macOS, and Windows CI that the generated OpenSpec commands and skills in the plugin payload match the centrally pinned npm OpenSpec generator without requiring Nix. An OpenSpec update SHALL fail the release gate until generated changes are reviewed and committed.

Verification SHALL compare the payload rather than any repository-level adapter directory, and SHALL leave the working tree unchanged. Consumers SHALL NOT run this repository's adapter-freshness check as their artifact-validation gate. The native regeneration command SHALL preserve the generator as the only writer of these payload paths.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the pinned OpenSpec package would rewrite a generated command or skill in the payload
- **THEN** the release gate fails and identifies the generated adapter drift

#### Scenario: Payload is current

- **WHEN** the pinned generator reproduces the payload exactly
- **THEN** the release gate passes and the working tree is unchanged

#### Scenario: A generated adapter is missing from the payload

- **WHEN** the payload lacks a command or skill the generator produces
- **THEN** the release gate fails

#### Scenario: Native Windows adapter check

- **WHEN** the native Windows contributor or runner checks adapter freshness with the pinned generator
- **THEN** a disposable root reproduces and compares all generated commands and skills without Nix or WSL
- **AND** extra payload adapters and missing generated adapters also fail

### Requirement: Archived change completeness

The repository SHALL reject an archived OpenSpec change that contains an incomplete task. Strict validation SHALL also retain scenario and task-numbering checks for active contracts.

#### Scenario: An incomplete change is archived

- **WHEN** an archived change contains an unchecked task
- **THEN** the plugin release gate fails

### Requirement: Development payload separation

Development tools and repository tests SHALL remain outside the manager-installed runtime plugin payload.

Generated planning adapters SHALL be included in the payload, because OMP needs them at runtime: the payload is their only tracked source, and consuming repositories rely on it to provide the workflow.

The generated payload SHALL be written only by the generator. Repository formatting SHALL NOT rewrite it, so that reproducing it byte for byte remains a meaningful check.

#### Scenario: Inspect the default package

- **WHEN** a personal marketplace release is installed into a disposable OMP profile
- **THEN** its cached plugin tree contains the declared runtime plugin tree including generated workflow adapters
- **AND** excludes repository-only update automation, development tools, and repository tests

#### Scenario: Formatter runs over the repository

- **WHEN** the repository's formatter runs across tracked files
- **THEN** it does not modify the generated payload

### Requirement: Single primary Markdown server

The personal plugin SHALL disable OMP's built-in Marksman definition and SHALL define Markdown Oxide as the only primary server for Markdown files. The plugin SHALL contain configuration only and SHALL NOT install either executable or provide a Marksman alias or fallback.

#### Scenario: Open a Markdown project

- **WHEN** OMP loads the plugin, `markdown-oxide` resolves, and a project matches the declared Markdown root markers
- **THEN** Markdown Oxide starts for `.md` and `.markdown` files
- **AND** diagnostics, definition, references, and rename are available
- **AND** Marksman does not start

#### Scenario: Marksman is also available

- **WHEN** both `markdown-oxide` and `marksman` resolve on `PATH`
- **THEN** the disabled Marksman definition remains inactive
- **AND** Markdown Oxide remains the only primary Markdown server

#### Scenario: Markdown Oxide is missing

- **WHEN** the `markdown-oxide` executable does not resolve
- **THEN** the plugin does not fall back to Marksman
- **AND** it does not install a language server

### Requirement: Native marketplace delivery

The repository SHALL publish marketplace `glockyco` with plugin `personal` and runtime identity `personal@glockyco`. Its catalog SHALL identify a self-contained plugin payload, an explicit semantic release version, and an LSP configuration contained within that payload. The payload SHALL declare both runtime extension modules through its OMP package manifest.

The documented installation SHALL use `omp plugin marketplace add glockyco/omp-agent-setup` followed by `omp plugin install --scope user personal@glockyco`. The documented upgrade SHALL use `omp plugin marketplace update glockyco` followed by `omp plugin upgrade --scope user personal@glockyco`, then a fresh OMP session. Runtime publication SHALL NOT require or expose a Nix plugin package output; the independent shared OpenSpec validator SHALL remain available.

#### Scenario: Install the published personal plugin

- **WHEN** an owner follows the documented user-scoped marketplace installation in a fresh OMP profile
- **THEN** OMP lists one enabled personal marketplace release at the advertised version
- **AND** its payload resolves from the plugin manager's installed cache, not a mutable repository checkout

#### Scenario: Consume shared OpenSpec validation

- **WHEN** a Nix repository consumes `lib.openspecCheck` from this repository
- **THEN** it can continue strict and archive-completeness validation through that independently pinned interface
- **AND** runtime plugin installation does not depend on that Nix input or a default plugin package

### Requirement: Isolated complete release verification

The release gate SHALL validate the catalog and demonstrate actual install, runtime discovery, and upgrade under a temporary HOME with isolated configuration, data and cache roots on Linux, macOS, and native Windows. It SHALL use no provider credentials or model request, SHALL leave real OMP state unchanged, and SHALL remove its temporary profiles. The gate SHALL keep the selected exact OMP tag and all six platform SHA-256 digests in one reviewed repository pin record, download only the host asset from the fixed release URL, verify its pinned digest before execution, and use its absolute executable. Runtime setup SHALL NOT fetch release metadata, require a GitHub token, run an installer that changes PATH or registry state, or depend on Nix or a contributor's host OMP installation. Failed partial setup SHALL remove everything it created; final CI cleanup SHALL run after successful setup even when later gates fail. Windows home, application-data, and temporary roots SHALL remain isolated as well.

Verification SHALL observe both declared extension factories, the commit tool, all three annotation command registrations, all declared skills and their support assets, the always-applied personal policy, each workflow command exactly once, and every declared LSP override. A list or doctor result alone SHALL NOT satisfy runtime verification. Deterministic executable probes MAY prove configuration selection but SHALL NOT be reported as real language-server protocol or native-browser acceptance. No platform SHALL skip an existing positive or negative capability/upgrade control because its Unix process or terminal fixture is unavailable.

#### Scenario: Complete marketplace release is tested

- **WHEN** the gate installs the candidate catalog into a disposable profile
- **THEN** it observes all declared runtime capabilities from that installed release and no duplicate workflow commands
- **AND** Marksman remains unselected when both Marksman and Markdown Oxide executable probes are available with matching root markers
- **AND** real user OMP state is unchanged and temporary profiles are removed

#### Scenario: Catalog omits the LSP delivery field

- **WHEN** an otherwise valid candidate catalog no longer delivers the personal LSP overrides
- **THEN** the release gate fails on the lost override or active Marksman rather than accepting successful installation

#### Scenario: Capability registration is lost

- **WHEN** a candidate loses a declared extension, skill, rule, command, or required skill support asset
- **THEN** the release gate fails and identifies the missing capability or asset

#### Scenario: Native Windows complete gate

- **WHEN** CI runs the selected official OMP binary and candidate personal release on Windows
- **THEN** actual installation, fresh capability discovery, terminal-observed LSP selection, installed-cache behavior tests, damaged-candidate controls, and upgrade/state preservation execute without WSL or Nix
- **AND** temporary HOME, USERPROFILE, APPDATA, LOCALAPPDATA, and temp roots contain the test's state and are cleaned afterward

#### Scenario: Scratch lies beneath an already configured ancestor

- **WHEN** the gate's scratch directory is nested beneath a directory with its own `.omp` registry
- **THEN** candidate projects and working directories remain beneath the redirected fake HOME so ancestor discovery stops before that foreign registry
- **AND** native version probes execute from the redirected home, the pre-install manager list is empty, and every installed or discovered plugin path belongs to the gate's scratch root
- **AND** no extra configuration marker or environment override is needed and real user plugin state remains unchanged

#### Scenario: Owned scratch has a filesystem alias

- **WHEN** Windows TEMP uses an NTFS short name or a scratch directory is addressed through a symlink or Windows junction
- **THEN** owned profile roots are canonicalized through filesystem realpath before deriving redirected home, work, release and state paths
- **AND** actual cwd matches the redirected home boundary and the real manager discovers the installed candidate exactly once without output deduplication
- **AND** fixture ownership assertions use native filesystem canonical identities rather than raw TEMP spellings, retaining strict containment and case independence
- **AND** failed canonicalization remains visible and partial setup cleans its owned state

#### Scenario: ConPTY output has already drained

- **WHEN** the owned native tree has stopped and its ConPTY reader has already completed
- **THEN** cleanup closes its sockets and terminal handles without cancelling nonexistent I/O
- **AND** cancellation errors on a still-live reader and a reader that cannot join within its bound remain visible failures

#### Scenario: Runtime provisioning uses reviewed platform digests

- **WHEN** the native release gate provisions its selected OMP binary
- **THEN** it reads the tag and host digest from the reviewed six-platform pin and downloads only the fixed asset URL, without a release-metadata request or authentication token
- **AND** a missing or malformed digest fails before download, and a checksum mismatch fails before execution
- **AND** failed setup removes all owned partial state without requiring a success-only final-cleanup step

#### Scenario: Asset stream fails during setup

- **WHEN** the selected asset body is initially errored or fails after delivering binary bytes
- **THEN** setup reports the original stream failure, closes its owned binary handle, and removes every partial binary and disposable profile
- **AND** it does not hang in a stream adapter or attempt to execute the incomplete asset

#### Scenario: A delayed fixture case cannot corrupt another case

- **WHEN** a native launcher fixture is delayed or fails after another case has completed
- **THEN** its owned scratch and captured environment/request/provision inputs remain independent, and it cannot remove or change the other case's profile, executable identity, or evidence log
- **AND** compiled executable fixtures are prepared once per test file and reused through per-case hardlinks with explicit 30 s case bounds

#### Scenario: Isolated gate fails during a terminal probe

- **WHEN** a capability or terminal observation fails or times out on any supported host
- **THEN** the gate reports the failed capability and releases its owned terminal, subprocess tree, and disposable state
- **AND** it does not declare that scenario skipped or leave a real user-profile installation

### Requirement: Plain prose rule

The plugin SHALL ship an always-applied plain-prose rule, separate from the personal policy, for the prose an agent writes in documentation, comments, docstrings, notebooks, commit messages and chat. The rule SHALL ask for short factual sentences and SHALL exclude semicolons between clauses, typographic quotes and apostrophes, em and en dashes, ellipsis characters, arrows, section signs, bold bullet lead-ins and slogans.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the plain-prose rule beside the personal policy
- **AND** the personal policy text is unchanged

### Requirement: Prose rule exemptions

The plain-prose rule SHALL leave the punctuation of code, grammars, quotations, and manuscripts such as papers and theses unchanged. It SHALL NOT route writing to a skill or prescribe a controlled language.

#### Scenario: Read the exemptions

- **WHEN** OMP loads the plugin rules
- **THEN** the plain-prose rule names code, grammars, quotations and manuscripts as exempt
- **AND** it routes no writing task to a skill

### Requirement: Documentation rule

The plugin SHALL ship an always-applied documentation rule, separate from the personal policy and the plain-prose rule, for repository documentation such as READMEs, guides, runbooks and agent instructions. The rule SHALL require documentation to describe the current state. It SHALL direct facts to their source, evidence and history to the change record, and longer rationale to the change's design. It SHALL require finished one-time procedures to be deleted, and plans that change documentation to name what the reader needs rather than content to copy.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule

### Requirement: Native repository hooks

Repository development and Git hooks SHALL run the pinned native toolchain on Linux, macOS, and Windows without Nix. Hooks SHALL retain staged formatting, type checks, commit-message validation, frozen dependency installation, and the fast `bun run check:local` pre-push gate covering toolchain, lint, types, dead code, release version, deterministic unit tests, OpenSpec adapter freshness and strict artifact validation; they SHALL use installed development tools without fetching a missing executable. Real external-toolchain and process-lifecycle tests SHALL be classified as integration tests, retain explicit 30 s case budgets and run in complete CI rather than pre-push's unit set. Pre-push SHALL omit network audit and installed-release download/terminal checks. Every PR's Linux, macOS and Windows CI SHALL run the complete `bun run ci`, including both test sets with the unchanged complete-suite coverage floor and those checks.

#### Scenario: Commit from a native Windows client

- **WHEN** a native Windows Git client invokes the installed repository hooks after documented setup
- **THEN** formatting/type checks and commit-message validation run without a Nix shell or WSL
- **AND** a failed applicable hook prevents the Git operation

#### Scenario: Native Bun has no optional executable alias

- **WHEN** the installed pinned Bun is available as `bun.exe` or `bun` without a separate `bunx` alias
- **THEN** hook installation and npm-bin hook commands use Bun's built-in `x --no-install` subcommand without fetching a tool or adding a host alias
- **AND** real commit-message validation remains authoritative and missing required native tools stay visible failures

#### Scenario: Push runs from a Git hook environment

- **WHEN** the pre-push hook inherits Git's repository-local environment variables
- **THEN** its native child receives the correctly sanitized environment and runs frozen installation plus the fast local gate, without network audit or installed-release download/terminal checks
- **AND** sanitization does not depend on POSIX shell substitution or mutate the parent environment
- **AND** every PR still runs the complete gate, including audit and installed-release checks, on all three CI hosts
- **AND** the local unit selector excludes real OpenSpec/commitlint/lefthook/Git command fixtures, compiled executable launchers and actual annotation process lifecycle, while preserving their complete CI and installed-cache coverage

#### Scenario: A loaded native workstation pushes a change

- **WHEN** the standard-user host has an endpoint scanner or other live sessions affecting external-toolchain timing
- **THEN** pre-push runs the deterministic unit set without executing real-toolchain integration fixtures
- **AND** the same PR still exercises every integration fixture with explicit 30 s case budgets and unchanged complete-suite coverage on Linux, macOS and Windows
