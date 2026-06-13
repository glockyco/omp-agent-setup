import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extractZip from "extract-zip";
import { type UpdateImpeccableResult, updateImpeccableFromBundle } from "./impeccable-update.ts";

const IMPECCABLE_BUNDLE_URL = "https://impeccable.style/api/download/bundle/universal";

export interface UpdateImpeccableRemoteOptions {
	repoRoot: string;
	bundleUrl?: string;
}

export async function updateImpeccableFromRemote(
	options: UpdateImpeccableRemoteOptions,
): Promise<UpdateImpeccableResult> {
	const workspace = await mkdtemp(join(tmpdir(), "omp-impeccable-update-"));
	try {
		const zipPath = join(workspace, "impeccable.zip");
		const bundleRoot = join(workspace, "bundle");
		await mkdir(bundleRoot, { recursive: true });
		const response = await fetch(options.bundleUrl ?? IMPECCABLE_BUNDLE_URL);
		if (!response.ok) {
			throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
		}
		await Bun.write(zipPath, await response.arrayBuffer());
		await extractZip(zipPath, { dir: bundleRoot });
		return await updateImpeccableFromBundle({ repoRoot: options.repoRoot, bundleRoot });
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}
