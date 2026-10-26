## Why

The active plugin and repository guidance have retired `omp-plans`, but 17 tracked records still preserve its mandatory workflow under `docs/plans/archive/`. The always-read repository guidance points to that archive, so obsolete instructions remain discoverable beside the OpenSpec source of truth.

## What Changes

- Declare `openspec/` as the only tracked home for current planning and accepted behavior.
- Inventory all 17 archived planning records and every current reference to them.
- Move any unique, verified requirement or technical fact into the accepted spec or current document that owns its subject.
- Remove records that only preserve retired tools, mutable deployment, or completed implementation history.
- Remove the `docs/plans/archive/` pointer from `AGENTS.md` and delete the legacy planning directory after migration.
- Keep the planning boundary in current guidance and review it during this cutover. Do not add a test that scans documentation for retired names.
- Breaking change: repository history no longer ships as browsable planning files. Git history remains the historical record.

## Capabilities

### New Capabilities

- `repository/planning-state`: Defines the sole planning home and verified legacy-record disposition.

### Modified Capabilities

None.

## Impact

The change affects `AGENTS.md`, 17 historical Markdown records, their index, and any current links to them. It does not change tests, packaged plugin behavior, deployment, dependency ownership, or accepted personal capabilities.
