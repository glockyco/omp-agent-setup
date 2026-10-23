## Context

The vault syncs through Obsidian Sync to Korolev, the Mac and a phone. Only Korolev's copy is a Git repository, which pushes to the private `glockyco/notes` and never pulls. Its pre-commit hook runs gitleaks. OMP's `vault://` protocol reaches the vault through Obsidian's command-line interface from any working directory once `vault.enabled` is set. On Windows, OMP resolves `obsidian` to `Obsidian.exe`, which answers command-line requests over the pipes OMP opens, so no redirector is needed.

## Decisions

The skills point to `Conventions.md` and `Weekly review.md` in the vault and restate nothing from them. Those notes change during weekly reviews, and a copy in the plugin would need a release for each change.

The `notes` skill names both access paths, `vault://notes/` and the vault folder on each host, because `vault://` works only while Obsidian runs. It tells agents to rename and create typed notes through Obsidian's command line, which updates links and applies templates, and to treat checkboxes in `Templates/` as template content.

Vault commits are pushed right after committing. The vault is a backup with one writer, so an unpushed commit protects nothing. This is the only exception to the push rule, and the skill states it.

The weekly review reads omp sessions through the archive helper of OMP's eval tool, which exposes past sessions with their recaps. The skill groups proposals by checklist step and applies only accepted ones.

The documentation rule names the vault as out of scope instead of the skill overriding the rule, because always-applied rules otherwise win over skill text.

## Risks / Trade-offs

- A host without `vault.enabled` or without a running Obsidian falls back to the folder path. The skill names both.
- Sessions started before gitleaks was installed cannot commit to the vault, because the hook fails closed. A restarted OMP host process has the updated PATH.
