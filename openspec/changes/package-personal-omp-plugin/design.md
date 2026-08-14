## Context

See `proposal.md` for motivation. The repository currently deploys symlinks from `agent/`, merges mutable OMP configuration, patches an installed OMP source tree, and runs helper code with Bun. OMP 17.2.15 can load a package directory through `--plugin-dir`; sibling `skills/`, `rules/`, extensions declared in `package.json#omp.extensions`, and `lsp.json` are then normal plugin capabilities.

ASD publishes the official ASD-STE100 Issue 9 PDF at a stable public URL. The package keeps a complete 53-rule working paraphrase, records the official PDF checksum, and distinguishes verified traceability from compliance of generated text.

## Goals / Non-Goals

**Goals:**

- Build one immutable plugin directory on Darwin and Linux.
- Make every runtime capability self-contained in the output.
- Preserve the selected personal behavior while removing installer assumptions from the new path.
- Test observable discovery, retrieval, traceability, and real Git-hook behavior.

**Non-Goals:**

- Install or configure OMP, language servers, providers, models, agents, or services.
- Modify OMP-owned authentication, preferences, sessions, caches, or databases.
- Claim that AI output is ASD-STE100 compliant without a qualified human review using the standard and controlled dictionary.
- Remove the legacy installer before the workstation consumes and verifies the package.

## Decisions

### Curated source directory

Add `plugin/` as the source of the package output. This avoids presenting the maintenance CLI's root `package.json` or legacy installer tree as runtime capabilities. The derivation copies only explicit plugin paths and fails if required files are absent.

### Plain-data plugin plus one extension

Rules and skills are Markdown or deterministic helper code. Only `extensions/personal-commit.ts` is loaded as an OMP extension. The extension uses Node filesystem/process primitives already provided by OMP's Bun runtime; it has no package dependencies and imports OMP types only through a type-only ambient declaration during development.

### Commit transport without commitlint

The extension validates the cross-repository structural minimum: Conventional Commit shape, subject length, body presence, literal escaped-newline rejection, and stable wrapping. It does not run commitlint because repository hooks and CI own additional type, scope, and content rules. Calling ordinary `git commit` keeps those hooks authoritative.

### STE source separation

Move the existing paraphrases into `references/rules.md`; keep concise operational guidance in `SKILL.md`, machine-checkable review instructions in `checklist.md`, context in `standard.md`, and examples in `use-cases.md`. `standard.md` records the official Issue 9 URL, SHA-256, audit date, scope, and copyright boundary. A fixture requires exactly 53 identifiers and rejects unresolved checklist citations.

### Consolidated research workflow

Combine the current search, retrieval, and BibTeX guidance. Rewrite the existing retrieval helper into a small standard-library Python program with injected HTTP fixtures for tests. It keeps Sci-Hub parsing, validates `%PDF-`, uses deterministic source precedence, and refuses Unpaywall without `UNPAYWALL_EMAIL`.

### Minimal LSP overlay

Package only overrides demonstrated by the representative smoke matrix. The initial candidate is the Roslyn server replacement plus the Svelte root-marker correction. Unused-language disable lists are omitted because the curated Nix executable path controls availability.

### Independent flake

The plugin flake pins nixpkgs and exports `packages.default` for `aarch64-darwin` and `x86_64-linux`. Checks inspect the package, run deterministic payload tests, and load it with the pinned OMP package where available. The output contains no interpreter closure because runtime scripts use OMP's Bun or explicit Nix test interpreters only during checks.

## Risks / Trade-offs

- The STE relationships are audited against the official Issue 9 PDF, but that verifies traceability only. Generated output still requires a qualified human and the controlled dictionary for a compliance decision.
- Direct `--plugin-dir` loading is deliberate. Installing the package through OMP's mutable plugin manager would duplicate ownership and weaken the Nix pin.
- A broad LSP overlay could suppress valid OMP defaults. The package keeps only scenarios that pass and leaves all other selection to executable availability and built-ins.
- Keeping the legacy deployment until host cutover temporarily duplicates source concepts. The cutover change removes that path after a real wrapped session succeeds.

## Verification Evidence

Evidence recorded on 2026-08-14:

- Official ASD-STE100 Issue 9 PDF: 3,316,157-byte `%PDF-` payload; SHA-256 `d1f4ea9e7cd6e46b47aa9057209f99e78c0e9cfc4e27a5b07895b05c1a166431`; all 53 rule statements audited; 11 paraphrases corrected; PDF not added to the repository.
- Darwin flake checks: package-shape, isolated Bun payload, and isolated Python payload passed with the pinned OMP and nixpkgs inputs.
- Repository tests: 433 tests passed with 97.59% line coverage under pinned Bun 1.3.13; TypeScript, Biome, and Knip checks passed.
- Direct language-server matrix from the pinned nixpkgs input:

| Language | Server | Definition | References | Rename | Diagnostics |
|---|---|---:|---:|---:|---|
| Python | Pyright 1.1.411 | 1 | 3 | 2 documents | push response |
| C# | Roslyn 5.7.0-1.26220.12 | 1 | 2 | 1 document | pull response |
| TypeScript | TypeScript LS 5.3.0 | 1 | 3 | 1 document | push response |
| JavaScript | TypeScript LS 5.3.0 | 1 | 3 | 1 document | push response |
| Svelte | Svelte LS 0.17.31 | 1 | 2 | 1 document | pull response; `svelte.config.ts` root |
| Nix | nixd 2.9.1 | 1 | 1 | 1 document | push response |
| Markdown | Marksman 2026-02-08 | 1 | 2 | 1 document | pull method not supported |
| LaTeX and BibTeX | TexLab 5.25.1 | 1 | 2 | 1 document | push responses for both files |

The C# override is necessary because OMP 17.2.15 provides only OmniSharp by default while the curated package exposes `Microsoft.CodeAnalysis.LanguageServer`. The Svelte override is necessary because OMP 17.2.15 lacks the `svelte.config.ts` root marker. All other language scenarios pass through OMP defaults and need no plugin override.
