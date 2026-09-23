## Context

The plugin package copies `plugin/` into an immutable output. OMP discovers the STE skill from `plugin/skills/simplified-technical-english/`, while `plugin/rules/personal-policy.md` makes its use mandatory for technical prose. The current plugin contract requires both. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:** Remove the discovered skill and the unconditional instruction together; keep the other skills, generated OpenSpec adapters, and commit policy unchanged.

**Non-Goals:** Introduce a replacement writing skill, rewrite archived plans, or change the workstation's plugin pin as part of source removal.

## Decisions

- Delete the entire owned STE skill directory, its dedicated traceability test, and the routing sentence in the policy. Disabling only the routing sentence leaves the broad skill description discoverable and prone to triggering; narrowing the description retains an unwanted maintenance burden.
- Update the plugin-load assertion to require only the remaining personal skills and reject the retired skill. The assertion should verify the packaged discovery boundary, not repeat the former rule inventory.
- Remove current-state STE references from repository guidance and the README, but preserve historical OpenSpec changes and archived plans. Update the accepted `personal-omp-plugin` requirements when syncing this delta. Remove the retired standalone accepted STE spec after confirming the sync behavior; an empty capability shell would falsely imply support.

## Risks / Trade-offs

- Existing immutable generations and running sessions can still expose the skill. Mitigation: publish a reviewed plugin revision, advance the workstation pin in a separate release, activate, and verify a fresh wrapped session.
- Removing the dedicated traceability test drops an audit for rules no longer shipped. Mitigation: retain unrelated plugin and OpenSpec checks, and verify that the package excludes the removed directory.

## Migration Plan

Apply and verify the plugin change first, then publish it under the repository release procedure. Separately update the `personal-omp-plugin` pin in `nix-darwin`, run its release gates, activate, and check the new wrapped session. Rollback selects the previous immutable workstation generation; older sessions remain unchanged until restarted.
