## Context

The plugin exposes three authored personal skills and one short always-applied policy. OMP injects the policy body into every session, but it exposes only each skill name and description until the model reads the skill. The six OpenSpec skills and their paired commands are generator-owned payload and must remain byte-exact with OpenSpec 1.9.0.

The existing commit tool deliberately transports a structured message without staging or pushing. The research helper already uses metadata-backed open-access discovery and ordered PDF fallbacks. The STE skill already separates its main workflow from detailed references.

## Goals / Non-Goals

**Goals:**

- Keep the global policy short while making STE routing and atomic commit checkpoints explicit.
- Put detailed behavior in the three authored skills and their references.
- Preserve task-owned staging as a separate Git operation from structured commit transport.
- Keep research optimized for everyday computer-science evidence work.
- Verify deterministic plugin, tool, retrieval, and traceability behavior without a model-backed activation harness.

**Non-Goals:**

- Modify generated OpenSpec skills or commands.
- Add systematic-review procedures or broad domain-database catalogs.
- Add a skill-activation evaluation suite.
- Make `personal_commit` stage or push changes.
- Claim ASD-STE100 compliance without qualified human review.

## Decisions

### Use the always-applied policy as a router

The policy will require the model to read `skill://simplified-technical-english` before it writes or materially revises covered technical prose. It will also require an atomic commit after each coherent, verified unit of multi-step engineering work.

Detailed prose categories, staging rules, amendment rules, and examples remain in the skills. This keeps permanent prompt weight low and leaves one canonical instruction for each subject.

**Alternative:** Depend only on broader skill descriptions. Rejected because ordinary coding requests often contain no explicit writing or commit intent, although both activities occur during the task.

**Alternative:** Copy STE and commit guidance into every related skill. Rejected because it duplicates policy and would require changes to generator-owned OpenSpec skills.

### Treat commits as verified causal checkpoints

A checkpoint is ready when one coherent unit has truthful, independently useful behavior and its applicable checks pass. The agent stages only changes owned by that unit, inspects the staged diff, and calls `personal_commit`. It does not wait for the complete multi-step change when an earlier unit already meets this boundary.

A later coherent correction or improvement receives a new commit by default. Amend remains appropriate when the user requests it or when the immediate commit does not yet represent a complete atomic action. This preserves rollback points and the development story without allowing broken or misleading checkpoint commits.

The agent never stages unrelated or user-owned changes. If mixed ownership cannot be separated safely, it delays the checkpoint. Pushing always requires an explicit user request.

**Alternative:** Add staging parameters to `personal_commit`. Rejected because staging is a repository-content decision, while the tool is a narrow message and commit transport.

**Alternative:** Commit only after the complete change. Rejected because late decomposition loses causal boundaries and creates large, hard-to-review work trees.

### Cover software prose and keep technical tokens protected

The skill description will name plans, specifications, commit text, comments, docstrings, CLI text, errors, and agent instructions as triggers. `references/use-cases.md` will hold category-specific details.

Comments and docstrings are prose, but identifiers, commands, paths, quotations, and other technical tokens inside them remain protected. Agents do not rewrite unrelated comments.

**Alternative:** Apply STE to all source-file contents. Rejected because source code is protected technical text and unrelated comment churn has no value.

### Keep research conditional without adding workflow modes

The full evidence workflow remains the default for paper searches, evidence claims, and paper characterization. A short conditional rule lets DOI verification and bibliography cleanup skip search, acquisition, and full-text reading when those steps cannot affect the requested metadata result.

Repository bibliography conventions take precedence. Existing BibTeX rules become fallback defaults only. When a paper supports a claim, the skill uses a concise evidence record that connects the claim to the read location, relevant method or data, result, and limitations. It omits inapplicable fields instead of producing boilerplate.

The source guidance remains focused on OpenAlex, DBLP, Crossref, publishers, and papers for computer science and adjacent technical literature. Other domain sources are used only when the task or repository requires them. No systematic-review workflow is added.

**Alternative:** Add several formal research modes. Rejected because the everyday distinction is only whether the request needs evidence characterization or metadata maintenance.

### Preserve the current acquisition order

The helper first uses DOI and open-access metadata to discover an official publisher-hosted open-access PDF. When none exists, it continues to Sci-Hub, then green open access, arXiv, and manual access. It does not spend an agent interaction interpreting a paywalled publisher page.

The existing PDF-byte validation, source reporting, and explicit Unpaywall identity remain unchanged.

**Alternative:** Move Sci-Hub after manuscript sources. Rejected because the preferred fallback is the published version when it is available there.

### Keep generated workflow payload immutable

No task may edit `plugin/skills/openspec-*` or `plugin/commands/opsx-*`. The existing generator freshness check remains the sole source-of-truth check for those files.

## Risks / Trade-offs

- [Frequent commits can capture an invalid intermediate state] → Require a coherent unit and applicable passing checks before each checkpoint.
- [Autonomous staging can include user work] → Require task ownership and staged-diff inspection; delay when ownership cannot be separated safely.
- [A short routing rule can become permanent prompt bloat] → Keep only routing and safety boundaries globally; retain detailed guidance in skills.
- [Metadata-only research can skip evidence needed for a claim] → Enter the full workflow whenever the request includes characterization or evidentiary use.
- [Sci-Hub and official sources are both incomplete] → Keep ordered fallbacks, validate PDF bytes, and report attempted source classes on failure.

## Migration Plan

1. Update the four accepted capability contracts when the change is later synced or archived.
2. Revise only the three authored skills, their relevant references, and `personal-policy.md`.
3. Update deterministic tests only where the policy, tool, helper, package, or traceability contract changes.
4. Run `nix develop --command bun run ci` and `nix flake check` in `omp-agent-setup`.
5. Publish the reviewed plugin revision and advance only the `personal-omp-plugin` input in `nix-darwin`.
6. Run the workstation build gates and the real wrapped-session smoke before activation is considered complete.
7. Roll back by restoring the previous Nix generation or the previous plugin input revision. No mutable OMP state migration is required.
