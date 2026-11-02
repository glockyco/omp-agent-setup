# Proposal

## Why

The compare-options skill asked the agent to look at every screenshot for defects such as a stray line break. Tiles of three different widths passed that check and went live on The Bloodline's About page with a ragged right edge, which the person had to point out. The check named defects but not composition, and comparisons showed one desktop width where the layout also changed on phones.

## What Changes

- Step 7 of the compare-options skill asks for screenshots at a phone width and at every width where the layout changes.
- Step 7 names composition checks: repeated items of different sizes, edges that don't line up with the column or panel around them, and a layout that breaks at a width where it changes.
- Release the change as 0.11.11.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: comparisons show options at a phone width and every width where the layout changes, and the agent checks their composition before showing them.

## Impact

Comparisons carry more screenshots, and the agent catches uneven sizes and misaligned edges before the person sees them.
