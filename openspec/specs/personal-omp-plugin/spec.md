# personal-omp-plugin Specification

## Purpose
Define the versioned personal OMP capability bundle that OMP's plugin manager installs from the `glockyco` marketplace without mutating unrelated OMP-owned state.

## Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, general-purpose mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout. Private mutable state SHALL be limited to the vault-access contract and SHALL remain outside the installed payload.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** every shipped always-applied rule, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, the vault tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** every declared extension module loads without import or registration errors

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

The always-applied policy SHALL contain only personal deviations: host-native interface verification, atomic commit checkpoints with task-owned staging, no implicit push, checks after a push, questions in Plannotator, structured commit transport, causal commit bodies, and durable storage for lasting work. It SHALL NOT route writing tasks to Simplified Technical English.

Detailed commit instructions SHALL stay in their skill.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy does not route technical or scientific writing to an STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance

#### Scenario: Preserve lasting work

- **WHEN** a fresh session loads the manager-installed personal plugin
- **THEN** its personal policy directs work that should outlive the session into its repository, the notes vault or a synced documents folder
- **AND** it forbids storing that work in temporary directories because the system deletes files there

### Requirement: Single source for the OpenSpec workflow

The plugin SHALL be the only tracked source of generated OpenSpec adapters. Consumers SHALL NOT track identical generated commands or skills, because separate formatting regimes create conflicting owners. Repository-specific overrides MAY replace an exposed command or skill only for a local deviation. Commands SHALL use the stable `personal:` namespace, with generated skill names and generator-owned files unchanged.

#### Scenario: Working in any repository

- **WHEN** a session starts in a repository that uses the workflow
- **THEN** the OpenSpec commands and skills are available from the plugin
- **AND** the repository tracks no copy of them
- **AND** workflow commands are exposed as `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`

#### Scenario: Repository-specific override

- **WHEN** a repository defines a command or skill whose exposed name matches one the plugin provides
- **THEN** the repository's definition takes effect in that repository
- **AND** the plugin's definition remains in effect everywhere else
- **AND** the override expresses a repository-specific deviation rather than duplicating generated adapters

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

Native Linux, macOS and Windows CI SHALL compare payload adapters byte for byte with the centrally pinned npm generator without Nix or checkout mutation. Generator changes SHALL fail the release gate until reviewed and committed. Native regeneration SHALL keep the generator as sole writer. Consumers SHALL NOT use adapter freshness as artifact validation.

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

The repository SHALL publish marketplace `glockyco` with plugin `personal` and runtime identity `personal@glockyco`. Its catalog SHALL identify a self-contained plugin payload, an explicit semantic release version, and an LSP configuration contained within that payload. The payload SHALL declare every runtime extension module through its OMP package manifest.

#### Scenario: Document native installation and upgrade

- **WHEN** a maintainer follows the documented runtime delivery procedure
- **THEN** installation uses `omp plugin marketplace add glockyco/omp-agent-setup` followed by `omp plugin install --scope user personal@glockyco`
- **AND** upgrade uses `omp plugin marketplace update glockyco` followed by `omp plugin upgrade --scope user personal@glockyco` and a fresh OMP session
- **AND** runtime publication neither requires nor exposes a Nix plugin package output, while independent shared OpenSpec validation remains available

#### Scenario: Install the published personal plugin

- **WHEN** the documented user-scoped marketplace installation runs in a fresh OMP profile
- **THEN** OMP lists one enabled personal marketplace release at the advertised version
- **AND** its payload resolves from the plugin manager's installed cache, not a mutable repository checkout

#### Scenario: Consume shared OpenSpec validation

- **WHEN** a Nix repository consumes `lib.openspecCheck` from this repository
- **THEN** it can continue strict and archive-completeness validation through that independently pinned interface
- **AND** runtime plugin installation does not depend on that Nix input or a default plugin package

### Requirement: Isolated complete release verification

The release gate SHALL validate the catalog and demonstrate install, complete runtime discovery and upgrade under isolated temporary profiles on Linux, macOS and native Windows. It SHALL use no provider credentials or model requests, leave real OMP state unchanged and clean its owned state. All platforms SHALL retain positive and negative capability/upgrade controls, using a verified official binary selected by one reviewed tag and six-digest pin.

#### Scenario: Observe the complete installed surface

- **WHEN** the gate verifies a candidate release from its installed cache
- **THEN** it observes every extension factory, the commit and vault tools, every skill and support asset, always-applied policy, each workflow command exactly once and every LSP override
- **AND** a list or doctor result alone does not satisfy runtime verification
- **AND** deterministic executable probes prove configuration selection, not real language-server protocol or native-browser acceptance
- **AND** no platform skips a positive or negative capability/upgrade control because its Unix process or terminal fixture is unavailable

#### Scenario: Provision an isolated official runtime

- **WHEN** setup provisions the selected release gate runtime
- **THEN** it downloads only the host asset from its fixed release URL, verifies the pinned digest before execution and uses the absolute executable
- **AND** setup does not fetch release metadata, require a GitHub token, run a PATH/registry-changing installer, or depend on Nix or a contributor's OMP
- **AND** partial setup removes everything it created and final CI cleanup runs after successful setup even if later gates fail
- **AND** Windows home, application-data and temporary roots remain isolated

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

The plugin SHALL ship an always-applied plain-prose rule, separate from the personal policy, for the prose an agent writes in documentation, comments, docstrings, notebooks, commit messages and chat. It SHALL ask for what the reader needs, in the reader's words, without filler or hedging, and SHALL exclude semicolons between clauses, typographic quotes, em and en dashes, ellipses, arrows, section signs, bold lead-ins and slogans.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the plain-prose rule beside the personal policy
- **AND** the personal policy text is unchanged

#### Scenario: Explain a setting to a player

- **WHEN** an agent writes help text for a setting in a game mod
- **THEN** the rule directs it to say what the setting does for the player in the words players use
- **AND** to leave out cases the player does not need, such as a broken weapon slot

### Requirement: Prose rule exemptions

The plain-prose rule SHALL leave the punctuation of code, grammars, quotations, and manuscripts such as papers and theses unchanged. It SHALL NOT route writing to a skill or prescribe a controlled language.

#### Scenario: Read the exemptions

- **WHEN** OMP loads the plugin rules
- **THEN** the plain-prose rule names code, grammars, quotations and manuscripts as exempt
- **AND** it routes no writing task to a skill

### Requirement: Documentation rule

The plugin SHALL ship a separate always-applied rule for repository documentation, including READMEs, guides, runbooks and agent instructions. Documentation SHALL describe the current state, refer facts to their source and keep evidence, history and longer rationale in change records. Finished one-time procedures SHALL be deleted. Plans changing documentation SHALL name reader needs rather than content to copy.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule
- **AND** documentation for people describes the system and addresses its reader without describing a person such as the owner, user or maintainer
- **AND** agent instructions phrase what needs a person's decision as an instruction
- **AND** a README opens with what the project does and for whom, then setup and use, then further reading
- **AND** the README points to specs, docs and agent instructions instead of repeating them
- **AND** notes in the personal notes vault retain dates, history and decision owners under the vault's own conventions

#### Scenario: Edit a vault note

- **WHEN** an agent records a reversed decision in a note of the notes vault
- **THEN** the documentation rule does not ask it to remove the date, the earlier choice or who decided

#### Scenario: Introduce a repository

- **WHEN** an agent writes the opening of a README for a plugin that serves one person's vault
- **THEN** the rule directs it to say what the plugin does and for which vault, without calling anyone the owner or the user

#### Scenario: Rewrite a README

- **WHEN** an agent rewrites a README that mixes setup with release procedures and internals
- **THEN** the rule directs it to keep what a reader needs to understand, set up and use the project, and to point to where the procedures and internals live

### Requirement: Native repository hooks

Repository development and Git hooks SHALL use the pinned native toolchain on Linux, macOS and Windows without Nix. Hooks SHALL retain staged formatting, type checks, commit-message validation, frozen installation and the fast `check:local` pre-push gate. They SHALL use installed tools without fetching missing executables. Every PR SHALL run complete CI on all three hosts, with both test sets and the unchanged complete-suite coverage floor.

#### Scenario: Commit from a native Windows client

- **WHEN** a native Windows Git client invokes the installed repository hooks after documented setup
- **THEN** formatting/type checks and commit-message validation run without a Nix shell or WSL
- **AND** a failed applicable hook prevents the Git operation
- **AND** pre-push covers toolchain, lint, types, dead code, release version, deterministic unit tests, adapter freshness and strict artifact validation

#### Scenario: Native Bun has no optional executable alias

- **WHEN** the installed pinned Bun is available as `bun.exe` or `bun` without a separate `bunx` alias
- **THEN** hook installation and npm-bin hook commands use Bun's built-in `x --no-install` subcommand without fetching a tool or adding a host alias
- **AND** real commit-message validation remains authoritative and missing required native tools stay visible failures

#### Scenario: Push runs from a Git hook environment

- **WHEN** the pre-push hook inherits Git's repository-local environment variables
- **THEN** its native child receives the correctly sanitized environment and runs frozen installation plus the fast local gate, without network audit or installed-release download/terminal checks
- **AND** sanitization does not depend on POSIX shell substitution or mutate the parent environment
- **AND** every PR still runs the complete gate, including audit and installed-release checks, on all three CI hosts
- **AND** the local unit selector excludes real OpenSpec/commitlint/lefthook/Git command fixtures and compiled executable launchers, while preserving their complete CI and installed-cache coverage
- **AND** real external-toolchain and process-lifecycle integration tests retain explicit 30 s case budgets

#### Scenario: A loaded native workstation pushes a change

- **WHEN** the standard-user host has an endpoint scanner or other live sessions affecting external-toolchain timing
- **THEN** pre-push runs the deterministic unit set without executing real-toolchain integration fixtures
- **AND** the same PR still exercises every integration fixture with explicit 30 s case budgets and unchanged complete-suite coverage on Linux, macOS and Windows

### Requirement: Notes vault skills

The plugin SHALL ship a `notes` skill and a `weekly-review` skill for the personal Obsidian vault `notes`. The `notes` skill SHALL direct agents to the vault's conventions note before they change the vault, and SHALL state how to reach, change and commit the vault from any working directory. The `weekly-review` skill SHALL direct agents to the vault's review checklist note. Neither skill SHALL restate the conventions or the checklist.

#### Scenario: Discover the skills

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `notes` and `weekly-review` skills are discoverable

#### Scenario: Change a convention

- **WHEN** a convention changes in the vault's conventions note
- **THEN** agents follow the changed convention without a plugin release

### Requirement: Project handoff rule

The plugin SHALL ship an always-applied handoff rule for papers, projects, supervisions, talks and topics in the notes vault. Agents SHALL link work through Workbench or find the matching note by repository URL, and read the note before work. Vault changes and commits SHALL follow the notes skill without duplicating its instructions.

#### Scenario: Start a repository session

- **WHEN** OMP starts with the manager-installed personal plugin in a repository without loading the notes skill
- **THEN** its system prompt contains the Project handoff rule
- **AND** the rule directs the agent to link the session through the `workbench` tool, or to search the notes vault for the repository URL without the tool, and to read the matching note before work
- **AND** Workbench returns the item's note with its `Resume here:` line, steps, waiting follow-ups and repository work
- **AND** a session started in the item's repository uses its existing link
- **AND** without the tool, the matching note is found by its `links` containing the repository URL

#### Scenario: Work moves to another item

- **WHEN** a session's work moves from one item to another
- **THEN** the rule directs the agent to link the session to the other item with the `workbench` tool

### Requirement: Handoff line and the places of its facts

Before finishing, agents SHALL write a new `Resume here:` line that says where each piece of work in progress stands, in a sentence or two each, without finished work, work not started yet, or steps, decisions, commits and checks that the note, Git or Workbench already show. Agents SHALL give every other fact of the old line its place in a change, an issue, a task, a `#waiting` task or the Notes, or leave it out as history.

#### Scenario: Finish work with a matching note

- **WHEN** a session finishes work on a paper, project, supervision, talk or topic with a matching vault note
- **THEN** the rule directs the agent to write a new `Resume here:` line that says where each piece of work in progress stands, in a sentence or two each, without finished work, work not started yet, or steps, decisions, commits and checks that the note, Git or Workbench already show
- **AND** to give every fact of the old line that the new line leaves out its place in a change, an issue, a task, a `#waiting` task or the Notes, or to leave it out when it is history or Git, the repository or Workbench already show it
- **AND** to follow the notes skill to change and commit the vault

#### Scenario: The old line carries another session's work

- **WHEN** the old line holds a constraint and steps that another session wrote, such as content a developer asked to keep unpublished
- **THEN** the rule directs the agent to place them as it places its own facts
- **AND** the new line mentions that work only where it is still in progress

### Requirement: Handoff without a matching note

Agents SHALL skip the handoff when no vault note matches the work.

#### Scenario: Work without a matching note

- **WHEN** no note exists for the work
- **THEN** the rule directs the agent to skip both reading and updating the handoff

### Requirement: Persona trials skill

The plugin SHALL ship a `persona-trials` skill for checking material or a product with agents that act as the people who will use it. The skill SHALL cover choosing between trials that read the material and trials that use the real thing, keeping agents free of the author's assumptions, finding what the trial environment provides that real users lack, protecting shared state, and confirming findings. It SHALL work on every native host platform.

#### Scenario: Discover the skill

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `persona-trials` skill is discoverable

#### Scenario: Plan a trial

- **WHEN** an agent plans persona trials for install instructions, a website, a research artifact or a document
- **THEN** the skill tells it what each agent may see, how to describe a persona without the author's suspicions, and which findings to confirm independently before acting on them

#### Scenario: Report trial results in research

- **WHEN** persona trial results could appear in a paper, a thesis or another research report
- **THEN** the skill states that the results are not evidence about real users and must not be reported as a user study

### Requirement: Scoped vault runtime state

The plugin SHALL keep vault profiles, approvals, cached unlock keys, `bw` data and delivery files beneath `~/.omp/vault/` only as specified by vault-access. It SHALL NOT write unrelated OMP state, store credentials in the payload, install Bitwarden, or create a second delivery owner.

#### Scenario: Load without Bitwarden

- **WHEN** the manager-installed plugin loads with no `bw` on PATH
- **THEN** all extension factories and non-vault capabilities remain discoverable
- **AND** the vault capability explains its missing host prerequisite only when used
- **AND** loading does not create a logged-in profile or prompt for credentials

#### Scenario: Installed vault capability verification

- **WHEN** the isolated release gate loads the installed candidate
- **THEN** it verifies vault tool registration from the installed cache without a real vault or provider credential
- **AND** every vault state path stays within the redirected disposable home
- **AND** absence or damage of the vault extension fails the gate

### Requirement: Compare options skill

The plugin SHALL ship a `compare-options` skill for deciding text that players see and visible design choices in game projects. The skill SHALL have the agent draft two to four options that differ in structure, drawn from how strong references handle the same situation, and ask which one to ship beside the current version and a way to reject all of them, with one option marked as recommended and its reason. Options SHALL state game behaviour only as observed in the running game.

#### Scenario: Discover the skill

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `compare-options` skill is discoverable

#### Scenario: Word text inside other work

- **WHEN** an agent writes the player-facing text of a known game issue while fixing a data error
- **THEN** the skill directs it to present options with a marked recommendation in Plannotator before the text ships

### Requirement: Checked recommendations

The `compare-options` skill SHALL have the agent check every option against the project's written reader-text rules and the wording earlier answers approved, say in the comparison which rule or approved wording an option breaks and which one decides between options, and recommend the option it judges best with a reason that is true of the option.

#### Scenario: Recommend a heading

- **WHEN** an agent recommends one of several headings for a known issue and earlier answers approved headings of one pattern
- **THEN** the comparison says which headings break that pattern

### Requirement: Elements the reader needs

The `compare-options` skill SHALL have the agent ask of every element and sentence in the options whether the reader needs it on that page and what they can do with it, and offer an option without an element the reader may not need.

#### Scenario: Question an added element

- **WHEN** a comparison covers an element that an agent or a model reviewer added, such as a line in a link preview
- **THEN** the options include leaving it out

### Requirement: Open decisions named in chat

The `compare-options` skill SHALL have the agent name the open decision, its options and the recommendation in chat beside the comparison's link.

#### Scenario: Wait for an answer

- **WHEN** a comparison is open for a person
- **THEN** the agent's message names the decision, the options and the recommendation besides the link

### Requirement: References written by people

The `compare-options` skill SHALL have the agent model wording on text that people wrote, such as large game wikis, look at how the game itself shows a thing for a visible design choice, take only structure from other game projects whose text agents wrote, and show only references that answer the decision's question.

#### Scenario: Draft a page another project has

- **WHEN** an agent drafts a site's About page and another game project in the vault has one
- **THEN** the skill directs it to take that page's structure and to model the wording on pages that people wrote

### Requirement: Options shown in place

The `compare-options` skill SHALL have the agent keep a comparison to what its decision needs, show each option in place with screenshots of the real page at the same widths, and look at every screenshot for layout defects before showing it.

#### Scenario: Stray line break

- **WHEN** a screenshot shows a line that wraps although the layout has room for it
- **THEN** the skill directs the agent to fix or point out the break before it opens the comparison

### Requirement: Comparison decisions in the notes vault

The `compare-options` skill SHALL have the agent record each decision under the Notes of the vault item it belongs to, as the rule or wording that now holds, and SHALL change an existing record on the same subject instead of adding another. A record SHALL hold one exact example, where the decision applies, the person's words when they say more than the choice, the date and the comparison's file, and SHALL leave out the options, how the comparison went and the agent's inferences.

#### Scenario: Record a decision

- **WHEN** a person answers a comparison
- **THEN** the skill directs the agent to record the rule or wording that now holds with one exact example, where it applies, the person's words when they say more than the choice, the date and the comparison's file under the Notes of the vault item the decision belongs to
- **AND** to leave out the options, how the comparison went and its own inferences

#### Scenario: An answer changes an earlier decision

- **WHEN** an answer changes a subject that an earlier record covers
- **THEN** the skill directs the agent to change that record and say what changed and when

### Requirement: Earlier decisions as evidence

The `compare-options` skill SHALL have the agent read earlier decisions from any project before drafting each decision. Decisions, specs and agent-written designs SHALL count as evidence that can be wrong or out of date.

#### Scenario: Prepare the next decision

- **WHEN** an agent prepares a new comparison
- **THEN** the skill directs it to search the vault for earlier decisions, also from other projects, and to say what transfers and what does not

### Requirement: Rounds after a rejection

The `compare-options` skill SHALL have the agent, when an answer rejects its options, change what the answer names, look for the same problem elsewhere on the page, and keep what earlier answers approved unless the new answer changes it.

#### Scenario: One sentence rejected

- **WHEN** an answer calls one sentence of the recommended option irrelevant
- **THEN** the next round leaves that sentence out, asks the same of the page's other sentences and keeps the parts that earlier answers approved

### Requirement: Subagents return options

A subagent whose work includes text players see or a visible design choice SHALL receive the path of the `compare-options` skill and SHALL return that text as options without committing, pushing or deploying it.

#### Scenario: Delegate work that includes player-facing text

- **WHEN** an agent hands a subagent work that includes player-facing text
- **THEN** the skill directs it to give the subagent the skill's path
- **AND** the subagent returns the text as options and does not commit, push or deploy it

### Requirement: Compare options rule

The plugin SHALL ship an always-applied rule that sends text players see and visible design choices in game projects through the `compare-options` skill before they ship, including posts about the games, such as Ko-fi gallery items, and text written inside other work or by subagents.

#### Scenario: Load the rule

- **WHEN** OMP starts a session or a subagent with the manager-installed personal plugin in any working directory
- **THEN** the system prompt carries the compare-options rule

#### Scenario: Write a gallery item

- **WHEN** an agent drafts the title and description of a Ko-fi gallery item about a game project
- **THEN** the rule directs it to the `compare-options` skill before the item is posted

### Requirement: Follow-up questions in Plannotator

The `compare-options` skill SHALL have the agent ask a question that comes up while it applies an answer, such as a fact that changes the approved option, as a new comparison in Plannotator instead of in chat.

#### Scenario: A fact changes the approved option

- **WHEN** a lab run made while applying an answer shows that the approved option's claim does not hold
- **THEN** the skill directs the agent to open a new comparison in Plannotator before the change ships

### Requirement: Approved changes to the conventions note

The `notes` skill SHALL have agents propose a change to the vault's conventions note in Plannotator and make it only once approved, never as a side effect of other work. It SHALL have them describe a plugin's behavior in the plugin's README.

#### Scenario: A plugin upgrade suggests a convention

- **WHEN** an agent upgrading a plugin finds behavior it would describe in the conventions note
- **THEN** the skill directs it to describe the behavior in the plugin's README
- **AND** to propose any change to the conventions note in Plannotator before making it

### Requirement: Questions in Plannotator

The personal policy SHALL have agents ask for decisions, approvals and answers in Plannotator, as question cards with a marked recommendation in a Markdown file opened with the `plannotator` tool. It SHALL allow chat only when Plannotator cannot open, naming the file.

#### Scenario: A decision comes up during work

- **WHEN** an agent needs the person's decision
- **THEN** the personal policy directs it to write the question as a question card with a marked recommendation and open the file in Plannotator

### Requirement: Checks after a push

The personal policy SHALL have agents wait for the checks of a push and fix or report a failure.

#### Scenario: A pushed branch fails its checks

- **WHEN** an agent has pushed and a check fails
- **THEN** the personal policy directs it to fix the failure or report it

### Requirement: Notes hold current decisions

The `notes` skill SHALL say that vault notes keep dates and who decided what, as the vault's conventions note describes for Notes. It SHALL NOT say that Notes sections keep history.

#### Scenario: A decision recorded in an item's Notes changes

- **WHEN** an agent records a changed decision in an item's Notes
- **THEN** the skill directs it to the conventions note's form for Notes instead of to a history of entries

### Requirement: Windows terminal cleanup verifies process exit

The Windows release gate SHALL accept an unsupported-operation termination refusal only when the creation-qualified owned process disappears within a bounded wait. A surviving target, access denial, unknown termination error or process-query failure SHALL remain a gate failure.

#### Scenario: Termination races with process exit

- **WHEN** Windows refuses to terminate an already-exiting owned process with an unsupported-operation reason
- **THEN** cleanup waits briefly for that process identity to disappear and succeeds only after observing its exit
- **AND** it does not terminate a new process that reuses the PID

#### Scenario: Refused target remains alive

- **WHEN** the owned process remains after the bounded wait or Windows reports a different unexpected failure
- **THEN** cleanup fails with the original termination diagnostic

#### Scenario: Process observation fails

- **WHEN** the process query fails during the bounded exit wait
- **THEN** cleanup reports that failure rather than assuming the process exited

### Requirement: Vault commits from either machine

The `notes` skill SHALL have agents commit all pending vault changes, not only their own, on whichever machine they work, after a pull with rebase, and push right away. It SHALL have them leave out files changed in the last 15 minutes, because another session or Obsidian may still be editing them.

#### Scenario: Another session left changes

- **WHEN** an agent commits the vault while another session's edit from an hour ago is pending
- **THEN** the commit includes that edit

#### Scenario: A file is still in work

- **WHEN** a pending file changed five minutes ago
- **THEN** the agent leaves it out of the commit

### Requirement: Efficient Windows release ownership queries

Windows installed-release verification SHALL query process ownership without starting a subprocess for each snapshot. It SHALL retain fresh creation-qualified PID and parent identities, fail visibly on unavailable ownership data and preserve every release scenario, coverage floor, observation deadline and cleanup assertion.

#### Scenario: Repeated ownership snapshots

- **WHEN** Windows release verification observes a native process tree repeatedly
- **THEN** the query starts no shell or process-query subprocess
- **AND** reused PIDs cannot inherit cached creation identities

#### Scenario: Ownership query fails

- **WHEN** native enumeration fails or required ownership identities are unavailable
- **THEN** verification reports failure instead of declaring the owned process tree absent
