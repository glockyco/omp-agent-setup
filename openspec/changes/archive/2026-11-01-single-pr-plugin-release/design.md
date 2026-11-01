# Design

## Context

See proposal.md for the motivation. The installed-release gate already installs the candidate into an isolated profile and checks capability discovery and rule presence in the system prompt. It does not establish actual host UI behavior.

## Goals / Non-Goals

Keep one review boundary for release implementation, version bumps and accepted OpenSpec contracts. Do not change runtime delivery, CI coverage, generated adapters or historical archives. Host scheduling belongs to nix-config.

## Decisions

- Archive the completed change in its release pull request so accepted specs and implementation merge together. Publication and host rollout remain outside tracked implementation tasks because they happen after review.
- Use existing isolated installed-release CI for routine release acceptance. Repeating it manually on both hosts adds no distinct contract evidence.
- Retain actual host UI acceptance when visual behavior changes because isolated capability probes do not observe that interface.
- Keep immutable release tags and forward-version rollback so installed version detection stays meaningful.
- Align AGENTS.md check wording with CI path classification without changing workflows or duplicating contributor guidance in README.

## Risks / Trade-offs

Hourly host rollout is independent of release completion. A host upgrade problem remains a host-operations issue rather than a reason to defer archiving a verified implementation. Visual changes still require their distinct host UI acceptance.
