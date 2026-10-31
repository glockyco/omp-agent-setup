# Tasks

## 1. Pages, images and embedded images

- [ ] 1.1 Copy a page's folder into the private snapshot with regular files and folders, private modes, skipped symbolic links and the 64 MiB and 2,000-file bound, then annotate the copied page. Verify with tests for assets beside and below the page, a skipped link, file and folder modes, a non-UTF-8 page, and the bound error launching no review.
- [ ] 1.2 Wrap PNG, JPEG, GIF, WebP, SVG, BMP, ICO and AVIF files in a generated Markdown snapshot with a copy of the image. Verify with tests for the generated reference, a name that becomes `image.<extension>`, and a non-image binary that still fails.
- [ ] 1.3 Copy the local images that a text or Markdown document references by relative path, mirroring their layout from the deepest shared folder. Verify with tests for a sibling image, a `../` image, an image reference definition, an `<img src>` attribute, and URLs, data URIs and absolute paths left uncopied.
- [ ] 1.4 Hash a manifest for snapshots with copied files, name the copied scope in the feedback, and rebuild the manifest for the stale-source warning. Verify with tests for a changed asset, an added page-folder file and a missing referenced image.
- [ ] 1.5 Update the README sections "Annotate a document or response" and "What it changes" for pages, images and the folder bound. Verify that each documented command opens the review the section describes.

## 2. Decisions

- [ ] 2.1 Treat `nothingToSend: true` like empty feedback. Verify with a test that feeds the record Plannotator emits for Done without comments and observes the notice and no message.

## 3. Release checks

- [ ] 3.1 Raise the version in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the runtime commit, then run `bun run ci`. Verify that the native gate passes.
- [ ] 3.2 Run the extension against real Plannotator 0.28.40 on the Mac with a page folder, an image with a region comment, a Markdown document with relative images, and Done without comments. Verify that assets render, feedback returns once and names the copied scope, and Done starts no turn.
- [ ] 3.3 Obtain the Linux, macOS, Windows and shared OpenSpec CI contexts and fresh Tern-managed browser acceptance on Korolev and macbook-pro. Verify that every context passes and that both hosts render a page and an image.

## Workflow follow-up

- Ask before pushing, merging or tagging the release.
- Archive the change after release acceptance and validate the archived spec with `openspec validate --all --strict`.
