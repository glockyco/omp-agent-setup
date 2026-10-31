## MODIFIED Requirements

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
