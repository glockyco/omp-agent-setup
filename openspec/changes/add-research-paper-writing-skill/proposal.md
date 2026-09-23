## Why

The personal OMP plugin supports finding and verifying research evidence but has no dedicated guidance for drafting and reviewing a research paper. The existing Research Paper Writing Skills package provides a concrete outline-first writing workflow, section guides, and claim-to-evidence review that fit this need without designing another writing method.

## What Changes

- Add the complete `research-paper-writing` skill package by Master-cai to the immutable personal OMP plugin, including its `SKILL.md`, supporting references and examples, and bundled agent metadata. Preserve its writing guidance rather than replacing it with a shortened or generalized rewrite.
- Retain the upstream license notice and attribution. Record that permission to redistribute embedded third-party source material remains unverified. The user chose the complete package despite this risk.
- Verify that a wrapped OMP session discovers the packaged skill and can use its section-specific guides without changing existing evidence, OpenSpec, or commit workflows.
- Do not add the separate AI4SE reporting skill, new reporting standards, an installer, or runtime downloads.

## Capabilities

### New Capabilities

- `research-paper-writing`: Discoverable, complete paper-writing guidance for outline-first drafting, section revision, claim-to-evidence review, and skeptical self-review.

### Modified Capabilities

None. The existing plugin contract already permits additional declared skills.

## Impact

The plugin payload gains one skill directory and its source license notice. Package-shape checks and a real wrapped-session discovery smoke must cover it. The workstation's existing plugin pin will need a separately authorized downstream update to expose a published plugin revision. This change does not update that pin or authorize publication or activation.
