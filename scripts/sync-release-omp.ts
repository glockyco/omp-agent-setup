import { writeFile } from "node:fs/promises";
import { OMP_PIN_PATH, type OmpPin, pinFromSums, validateTag } from "./omp-pin.ts";

/** Refresh the tag and all six checksums together, without metadata or credentials. */
export async function syncReleaseOmp(
	tag: unknown,
	outputPath = OMP_PIN_PATH,
	request: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<OmpPin> {
	const selected = validateTag(tag);
	const url = `https://github.com/can1357/oh-my-pi/releases/download/${selected}/SHA256SUMS.txt`;
	const response = await request(url, {
		credentials: "omit",
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) throw new Error(`OMP release checksums failed: HTTP ${response.status}`);
	const pin = pinFromSums(selected, await response.text());
	await writeFile(outputPath, `${JSON.stringify(pin, null, 2)}\n`);
	return pin;
}

/** Normalize Bun's optional forwarded separator without changing caller arguments. */
export async function syncReleaseOmpCommand(
	args: readonly string[],
	outputPath = OMP_PIN_PATH,
	request: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<string> {
	const offset = args[0] === "--" ? 1 : 0;
	if (args.length !== offset + 1) throw new Error("usage: bun run sync:release-omp -- vX.Y.Z");
	const pin = await syncReleaseOmp(args[offset], outputPath, request);
	return `Updated .omp-version to ${pin.tag}; review all six asset digests before committing.`;
}

if (import.meta.main) {
	try {
		console.log(await syncReleaseOmpCommand(process.argv.slice(2)));
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
