# Design

## Context

See `proposal.md` for the motivation. The adapter copies one UTF-8 document to `snapshot.md` in a private temporary folder and runs `plannotator annotate <snapshot> --json` in the session's working directory. These Plannotator facts shape the approach. They were checked against 0.28.40 with the snapshot in the macOS temporary folder and a repository as the working directory:

- A single HTML page renders raw in a sandboxed frame. Files beside and below the page load through the asset route. References above the page's folder and root-relative references do not load.
- Markdown images resolve from the document's own folder, not the working directory. They load from any local path, including `../` and absolute paths.
- Markdown, MDX and text files have an Edit Mode that saves to disk. Raw HTML is read-only.
- Annotate does not accept image files. Region comments exist only on images in Markdown documents, and their feedback cites the image reference as written.
- `--json` emits `annotated`, `dismissed` or `approved`, with additive `target`, `annotationCount` and `nothingToSend` keys. Done without comments emits `annotated` with a placeholder sentence and `nothingToSend: true`.
- Plannotator's history files each review under the document's name and path. Every adapter review is therefore a separate `snapshot.md` entry.

## Goals / Non-Goals

**Goals:**

- Show pages, standalone images and embedded images as they appear beside their source.
- Keep the source unwritten and the reviewed bytes identified.

**Non-Goals:**

- Folder targets, several files in one review, URLs, the Inbox, an agent tool, plan mode or approval.
- Stable snapshot paths that would let Plannotator's history connect review rounds.

## Decisions

### Keep private copies

Annotating the source in place would load every asset and connect Plannotator's history across rounds. It would also let Markdown Edit Mode write to the source and show files that change while the review is open. The adapter keeps the private copy and widens what it holds.

### Copy a page's whole folder

Pages load assets through paths that only a browser resolves, such as CSS `url()`, `srcset` and script fetches, so parsing references would miss some. Plannotator limits a single page to its own folder, so a copy of that folder holds everything the page can load. The copy takes regular files and folders, skips symbolic links and special files, and keeps the page's file name. Files get mode 0600 and folders 0700. The walk lists the folder before copying and stops at 64 MiB or 2,000 files, reporting the bound and suggesting a folder of the page's own.

Pages must be valid UTF-8, like text documents, because Plannotator reads the page as text.

Alternative: annotate pages in place, since Plannotator never writes raw HTML. Rejected because the review would show files that change while it is open, and one command would follow two snapshot rules.

### Copy only the images a document references

A Markdown document's folder may be a repository root, so copying it has no useful bound. The snapshot copies the local files named by inline images, image reference definitions and `<img src>` attributes when their path ends in an accepted image type. Paths resolve from the document's folder. The copy mirrors their layout beneath the snapshot folder from the deepest folder that contains the document and every copied image, so `../` references keep working. The document stays `snapshot.md` within that layout, so every text type still renders as Markdown. URLs, data URIs and absolute paths are not copied, and absolute paths keep loading from their live location. Missing files stay missing. Copied images count toward the same bound as page folders.

### Wrap a standalone image in Markdown

A generated `snapshot.md` holds only the image. The image keeps its name when the name uses only letters, digits, `.`, `_` and `-`, and becomes `image.<extension>` otherwise, so the reference needs no escaping. Markdown rather than HTML, because region comments exist only in Markdown documents. The accepted types are the ones Plannotator serves that common browsers display: PNG, JPEG, GIF, WebP, SVG, BMP, ICO and AVIF. Plannotator also serves TIFF, which only Safari displays.

### Identify every copied file

When a snapshot holds more than the document, its hash covers a manifest of relative paths and file hashes. The feedback names the copied scope: the page folder and its file count, the referenced images and their count, or the original image. The stale-source check rebuilds the manifest from the source. A changed, missing or added file in a page folder, or a changed or missing referenced image, produces the existing warning.

### Treat nothing to send as no feedback

`nothingToSend: true` produces the existing notice for empty feedback and starts no turn. Other additive keys are ignored. `approved` remains an error because the adapter never passes `--gate`.

### Keep this adapter instead of the official OMP plugin

`@plannotator/pi-extension` runs in OMP and handles these file types, folders, several files at once and Ask this session. Its defaults contradict this plugin's contract. Its agent tool is on by default, `omp --plan` starts Plannotator's plan mode, it adds review and plan commands, and it annotates the source in place with Edit Mode. Its `/plannotator-annotate` and `/plannotator-last` would also collide with this plugin's commands. Widening the adapter keeps the narrow surface.

## Risks / Trade-offs

- A page in a large folder cannot be reviewed. The error names the bound and the remedy.
- Symbolic links inside a page folder do not render, unlike an in-place review. Generated review pages rarely contain them.
- Plannotator's version diff and path-keyed draft recovery do not connect review rounds, because each snapshot path is new. Feedback still identifies each snapshot by hash.
- Markdown images written in syntax the adapter does not parse do not render, as before this change.
- A later Plannotator could widen a single page's asset scope beyond its folder. The copy would then omit files that an in-place review shows.
- Region comments need Plannotator 0.28.30 or later. Korolev's 0.28.7 shows images without them.

## Migration Plan

The change ships in the next plugin release through the release steps in `AGENTS.md`. It migrates no data. Rollback publishes the previous content as a newer version.
