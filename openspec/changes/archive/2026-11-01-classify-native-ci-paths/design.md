# Design

## Context

The existing matrix exposes three required native contexts. The nix-config check workflow supplies a simple complete-diff changes-job pattern. Shared OpenSpec runs independently.

## Goals / Non-Goals

Select native work conservatively without reducing its checks. Do not alter installed-release behavior, Nix checks or the shared OpenSpec workflow.

## Decisions

Use a changes job with a full checkout and the PR base/head merge-base diff. Disable rename detection and use NUL-delimited bytes so deletions and both rename endpoints are classified without filename quoting or API pagination limits. Only openspec/ and exact lowercase Markdown suffixes are exempt. Unknown paths and non-PR events require native CI.

Use three static native jobs with explicit existing context names. Share their identical steps with a YAML anchor. Run dependent jobs on classifier failure and fail their first step instead of silently skipping required checks. A missing classifier output also fails closed.

Execute Python regression tests in the changes job before publishing outputs. Keep shared OpenSpec independent of classification. Coordinate AGENTS wording with ReleaseProcedure rather than editing its owned file.

## Risks / Trade-offs

Static jobs retain individual required skipped contexts at the cost of three small job declarations. Full history avoids truncated PR file lists. A failed classifier occupies runners briefly to establish failing required contexts.
