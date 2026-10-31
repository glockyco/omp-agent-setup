# Design

## Context

See `proposal.md`. The official plugin was evaluated in OMP 18.10.4 on 2026-10-31 in a throwaway profile. Annotate, the reply picker, the agent tool and Ask this session worked. With both plugins installed, this plugin's `/plannotator-annotate` and `/plannotator-last` shadow the official ones.

## Goals / Non-Goals

**Goals:**

- Leave annotation to the official plugin with no command shadowing it.

**Non-Goals:**

- Installing or configuring the official plugin from this plugin. The payload installs no host software.
- Restricting the official plugin's agent tool, plan mode or review commands.

## Decisions

### Remove the adapter instead of renaming its commands

Renamed commands would keep a second review lifecycle with fewer features and the confusing feedback header. Removing the adapter leaves one lifecycle.

### Hosts install the official plugin first

The release notes and README tell hosts to install `@plannotator/pi-extension` before upgrading. nix-config owns that step and `~/.plannotator/config.json`, which turns sharing off.

### Keep Plannotator's default feedback text

The official prompt ends with "Please address the annotation feedback above." Agents are meant to act on annotations, so no prompt override is configured.

## Risks / Trade-offs

- A review left open across `/new` delivers its feedback into the new session. Reviewers send or close a review before switching, and an upstream option to hold or drop late feedback can be requested.
- The official plugin runs its server inside OMP and installs about 370 MB per host. Its version is pinned at installation.
- Korolev loads plugins only in Tern desktop sessions, so its acceptance runs there.

## Migration Plan

1. Install `@plannotator/pi-extension` on each host through nix-config.
2. Release this change and upgrade each host.
3. Roll back by reinstalling the previous release, whose adapter commands then shadow the official ones again.
