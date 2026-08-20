## Why

The active plugin and repository guidance have retired `omp-plans`, but 17 tracked records still preserve its mandatory workflow under `docs/plans/archive/`. The always-read repository guidance points to that archive, so obsolete instructions remain discoverable beside the OpenSpec source of truth.

## What Changes

- Declare `openspec/` as the only tracked home for current planning and accepted behavior.
- Inventory all 17 archived planning records and every current reference to them.
- Move any unique, verified requirement or technical fact into the accepted spec or current document that owns its subject.
- Remove records that only preserve retired tools, mutable deployment, or completed implementation history.
- Remove the `docs/plans/archive/` pointer from `AGENTS.md` and delete the legacy planning directory after migration.
- Add repository validation that rejects a restored `docs/plans/` tree or current guidance for `omp-plans` and `planning-files`.
- **BREAKING**: repository history no longer ships as browsable planning files. Git history remains the historical record.

## Capabilities

### New Capabilities

- `repository/planning-state`: Defines the sole planning home, legacy-record disposition, and enforcement against restoring the retired convention.

### Modified Capabilities

None.

## Impact

The change affects `AGENTS.md`, repository validation, 17 historical Markdown records, and any current links to them. It does not change the packaged plugin, OMP runtime behavior, deployment, dependency ownership, or accepted personal capabilities.
