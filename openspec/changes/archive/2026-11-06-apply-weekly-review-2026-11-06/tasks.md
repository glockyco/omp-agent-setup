# Tasks

## 1. Skills and checks

- [x] 1.1 Append the approved one-topic announcement sentence to step 1 of `plugin/skills/compare-options/SKILL.md`.
- [x] 1.2 Replace the 15-minute exclusion bullet in `plugin/skills/notes/SKILL.md` with the approved distinction between other editors' recent changes and the current session's finished edits.
- [x] 1.3 Raise the version to 0.11.12 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`.
- [x] 1.4 Run `openspec validate apply-weekly-review-2026-11-06 --strict` and `bun run check:local` successfully, then commit the implementation locally on main.
- [x] 1.5 Update comparison lookup and decision records, current-state vault editing, and deliberate todo changes in the skills, rules and spec delta.
- [x] 1.6 Strictly validate the expanded change, run `bun run check:local` and unit tests, and commit the approved additions.

## 2. Authorized release

- [x] 2.1 Archive this change and sync its accepted specs in the release pull request.

After this implementation archive, push the release pull request and obtain all required CI contexts, including the complete native release gate. Then merge the reviewed pull request and tag `v0.11.12` on its reviewed release commit. These publication steps are authorized and their results belong to the pull request and tag.
