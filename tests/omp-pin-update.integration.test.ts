import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncReleaseOmpCommand } from "../scripts/sync-release-omp.ts";

setDefaultTimeout(30_000);
const selected = "v18.8.8";
const scratch: string[] = [];
function fixture(): { root: string; pinPath: string; old: string } {
	const root = mkdtempSync(join(tmpdir(), "personal omp pin entrypoint "));
	scratch.push(root);
	const pinPath = join(root, ".omp-version");
	const old = readFileSync(join(import.meta.dir, "..", ".omp-version"), "utf8");
	writeFileSync(pinPath, old);
	return { root, pinPath, old };
}
afterEach(() => {
	for (const root of scratch.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([
	{ args: [] },
	{ args: ["latest"] },
	{ args: ["--", "latest"] },
	{ args: [selected, "--output", "other.json"] },
])("CLI refuses missing, invalid, or extra arguments: %j", async ({ args }) => {
	const files = fixture();
	let requests = 0;
	await expect(
		syncReleaseOmpCommand(args, files.pinPath, async () => {
			requests++;
			throw new Error("invalid command must not request checksums");
		}),
	).rejects.toThrow();
	expect(requests).toBe(0);
	const child = Bun.spawn(
		[process.execPath, join(import.meta.dir, "../scripts/sync-release-omp.ts"), ...args],
		{ cwd: files.root, stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, status] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(status).toBe(1);
	expect(stdout).toBe("");
	expect(stderr).not.toBe("");
	expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
});
