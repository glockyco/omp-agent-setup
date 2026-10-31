# Proposal

## Why

Design review needs comments on rendered pages and screenshots, but `/plannotator-annotate` rejects HTML and image files. Its Markdown snapshot also sits alone in a temporary folder, so images that a document references by relative path never load. Plannotator 0.28 reports Done without comments as an `annotated` decision with a placeholder sentence and `nothingToSend: true`, which the adapter delivers as feedback and answers with a model turn.

## What Changes

- `/plannotator-annotate` accepts HTML pages. The snapshot holds a copy of the page's folder, which is the asset root Plannotator gives a single page, so styles, scripts and images beside or below the page render. A folder over the size bound fails with a message instead of a partial copy.
- `/plannotator-annotate` accepts the image types Plannotator serves. The snapshot shows a copy of the image in a generated Markdown document, where Plannotator offers comments on regions of the image.
- Text and Markdown snapshots also copy the local images the document references by relative path, with their relative layout, so they render as they do beside the source.
- A decision that reports nothing to send ends the review like empty feedback, with a notice and no model turn.
- Feedback names what the snapshot copied. The stale-source warning covers every copied file.
- Directories, other binary files and URLs remain unsupported. The commands, local-only refusals, cleanup and exactly-once delivery do not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `omp-visual-feedback`: document annotation accepts HTML pages and images, snapshots carry the files a target displays, the stale-source warning covers them, and nothing-to-send decisions produce no feedback.

## Impact

`plugin/extensions/plannotator.ts`, its unit and integration tests and fixture, the README sections on annotation, and the three version fields for the release. No new dependencies. Both hosts render HTML with their current Plannotator. Region comments on images need Plannotator 0.28.30 or later, which nix-config provides on the Mac. Korolev's 0.28.7 shows images without region comments until it is updated.
