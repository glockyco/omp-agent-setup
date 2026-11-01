# Proposal

## Why

The notes skill said only Korolev's copy of the vault is a Git repository and that each session commits its own changes there. Sessions on the Mac could not commit at all, and edits from other sessions and from Obsidian waited until a Korolev session happened to include them, so they had no backup in Git. The vault is the backup of everything a session records, and no machine should be special.

## What Changes

- The notes skill says both machines keep a Git clone, and a session commits all pending changes after a rebase pull, except files changed in the last 15 minutes, which may still be in work.
- It names how a rebase pull handles the same edit arriving on both clones, and that `git push` on Korolev needs Tern's desktop session.
- Archive `vault-show-usernames`, which both hosts run.
- Release the change as 0.11.9.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the notes skill commits all pending vault changes from either machine.

## Impact

Sessions on upgraded hosts commit and push pending vault changes wherever they run. The Mac clone needs nix-config's `add-mac-vault-clone`, which installs `gitleaks` and `lefthook` there.
