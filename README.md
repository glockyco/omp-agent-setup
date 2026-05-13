# OMP Agent Setup

Version-controlled global setup for Oh My Pi / OMP agent tooling on this workstation.

This repository is the source of truth. The deployed runtime lives under `~/.omp/agent` and is managed from this repository.

## What this manages

- Global OMP agent instructions: `AGENTS.md` -> `~/.omp/agent/AGENTS.md`
- Superpowers bootstrap extension: `extensions/superpowers-bootstrap.ts` -> `~/.omp/agent/extensions/superpowers-bootstrap.ts`
- OMP config managed settings in `~/.omp/agent/config.yml`
- Local editable plugin checkouts recorded in `manifests/plugins.yml`

Local plugin checkouts stay in their own repositories:

- Superpowers: `~/Projects/superpowers`
- Plannotator: `~/Projects/plannotator`

## Quickstart on a new machine

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
scripts/bootstrap.sh
scripts/verify.sh
```

The bootstrap script is intentionally conservative: it snapshots existing OMP config files, links managed files, updates the managed OMP config keys, and clones missing plugin checkouts from the manifest.

## Managed OMP config

The setup uses OMP-native paths and direct local extension paths while Superpowers and Plannotator are being adapted locally. It also keeps the existing high-control interaction defaults and switches compaction to an 80% threshold instead of a fixed token threshold so the same config is safe across models with different context windows:

```yaml
extensions:
  - ~/Projects/plannotator/apps/pi-extension
  - ~/.omp/agent/extensions/superpowers-bootstrap.ts
skills:
  customDirectories:
    - ~/Projects/superpowers/skills
    - ~/Projects/plannotator/apps/pi-extension/skills
ask:
  timeout: 0
compaction:
  strategy: handoff
  thresholdPercent: 80
  thresholdTokens: -1
  handoffSaveToDisk: true
  enabled: true
contextPromotion:
  enabled: false
memory:
  backend: "off"
```

`scripts/bootstrap.sh` preserves unrelated OMP settings instead of replacing the whole config file.

## Updating local plugin adaptations

Use the `omp-local` branch in each plugin fork for OMP-specific adaptation work. Do not encode OMP version numbers in branch names.

```bash
git -C ~/Projects/superpowers status --short --branch
git -C ~/Projects/plannotator status --short --branch
```

Before changing plugin code, ensure the working tree state is understood. After plugin changes, run plugin-local checks where available and then `scripts/verify.sh` here.

## Verification

Run:

```bash
scripts/verify.sh
```

The verifier checks:

- direct OMP operation without extensions;
- OMP smoke prompt with configured extensions;
- Superpowers skill discovery;
- Plannotator skill discovery;
- Superpowers behavior on a small app prompt.

`/plannotator-status` still needs to be checked in an interactive OMP session when Plannotator command loading changes.

## Rollback

Bootstrap snapshots are written under `backups/` in this repository. To rollback manually, copy the relevant snapshot back to its original path, then rerun `scripts/verify.sh`.

Managed symlinks can be removed directly:

```bash
rm ~/.omp/agent/AGENTS.md
rm ~/.omp/agent/extensions/superpowers-bootstrap.ts
```

Then restore `~/.omp/agent/config.yml` from a backup.

## Plugin docs

- Superpowers: `~/Projects/superpowers/README.md`
- Plannotator: `~/Projects/plannotator/README.md`
- Plannotator OMP/Pi extension: `~/Projects/plannotator/apps/pi-extension/README.md`
