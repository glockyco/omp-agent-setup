## Context

See `proposal.md` for motivation. OMP 17.2.15 defines `marksman` for `.md` and `.markdown` files with `.marksman.toml` and `.git` roots. It does not define Markdown Oxide. OMP merges personal server entries onto its defaults, accepts `disabled = true` for a built-in server, and requires a command, file types, and root markers for a new server.

The workstation repository owns language-server executables. This repository owns only the immutable personal overrides needed to select them.

## Goals / Non-Goals

**Goals:**

- Keep exactly one primary Markdown server when both executables are present.
- Preserve the representative Markdown diagnostics and navigation contract.
- Keep the override minimal and removable if OMP later adopts the same default.

**Non-Goals:**

- Package or install Markdown Oxide.
- Retain a Marksman command alias or fallback.
- Change non-Markdown language servers.

## Decisions

### Disable the built-in server explicitly

Add `marksman.disabled = true`. Removing the Marksman executable from the workstation currently prevents auto-detection, but explicit disablement preserves one-server behavior if a project later provides its own `marksman` binary.

Alternative rejected: rely only on executable absence. Project-local binaries take precedence during OMP resolution and could silently reactivate the old server.

### Define Markdown Oxide as a new server

Add `markdown-oxide` with:

- command `markdown-oxide`;
- no arguments;
- file types `.md` and `.markdown`;
- root markers `.moxide.toml`, `.obsidian`, and `.git`;
- the existing two-second Markdown warmup timeout.

The explicit configuration is necessary because OMP has no built-in Markdown Oxide entry. `.moxide.toml` and `.obsidian` select its native project forms; `.git` preserves ordinary repository Markdown coverage.

Alternative rejected: install a `marksman` wrapper that invokes Markdown Oxide. That preserves a false server identity, couples incompatible command-line interfaces, and leaves obsolete configuration in place.

### Verify behavior through the owning surfaces

The plugin package-shape check asserts both server declarations and the absence of executable payloads. The representative Markdown LSP smoke runs with the workstation-provided Markdown Oxide binary because only the combined surfaces can prove diagnostics, definition, references, and rename.

A plugin release is published only after both repository gates and that live smoke pass. The workstation then advances the plugin pin and executable in one change.

## Risks / Trade-offs

- [Markdown Oxide handles a Markdown construct differently] → Exercise the fixed representative project before publishing the plugin revision.
- [A future OMP release adds a matching built-in definition] → Remove the redundant new-server entry only after the built-in passes the same smoke; retain explicit Marksman disablement until Marksman leaves OMP defaults.
- [The plugin revision is consumed without the executable] → Publish the plugin first, but advance its downstream pin only in the commit that provides Markdown Oxide.
