import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OMP_ASSETS, type OmpPin } from "../scripts/omp-pin.ts";
import { syncReleaseOmp, syncReleaseOmpCommand } from "../scripts/sync-release-omp.ts";

const scratch: string[] = [];
const selected = "v18.8.8";
const assets = Object.fromEntries(
	OMP_ASSETS.map((name, index) => [name, `sha256:${(index + 1).toString(16).repeat(64)}`]),
) as OmpPin["assets"];
const expected: OmpPin = { tag: selected, assets };
const sums = OMP_ASSETS.map(
	(name, index) => `${assets[name].slice(7)}  ${index % 2 ? "*" : ""}${name}`,
).join("\n");

function fixture(checksums = sums): {
	root: string;
	pinPath: string;
	sumsPath: string;
	old: string;
} {
	const root = mkdtempSync(join(tmpdir(), "personal omp pin update "));
	scratch.push(root);
	const pinPath = join(root, ".omp-version");
	const sumsPath = join(root, "SHA256SUMS.txt");
	const old = `${JSON.stringify({ tag: "v18.8.6", assets }, null, 2)}\n`;
	writeFileSync(pinPath, old);
	writeFileSync(sumsPath, checksums);
	return { root, pinPath, sumsPath, old };
}

afterEach(() => {
	for (const root of scratch.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("updater makes one fixed unauthenticated request and writes the complete six-asset JSON pin", async () => {
	const files = fixture(`${sums}\n${"a".repeat(64)}  unrelated-official-asset.tar.gz\n`);
	const calls: { url: string; init?: RequestInit }[] = [];
	const pin = await syncReleaseOmp(selected, files.pinPath, async (url, init) => {
		calls.push({ url, init });
		return new Response(readFileSync(files.sumsPath, "utf8"));
	});
	expect(calls).toHaveLength(1);
	expect(calls[0]?.url).toBe(
		"https://github.com/can1357/oh-my-pi/releases/download/v18.8.8/SHA256SUMS.txt",
	);
	expect([...new Headers(calls[0]?.init?.headers).entries()]).toEqual([]);
	expect(calls[0]?.init?.credentials).toBe("omit");
	expect(pin).toEqual(expected);
	expect(readFileSync(files.pinPath, "utf8")).toBe(`${JSON.stringify(expected, null, 2)}\n`);
	expect(Object.keys(JSON.parse(readFileSync(files.pinPath, "utf8")).assets)).toEqual([
		"omp-darwin-arm64",
		"omp-darwin-x64",
		"omp-linux-arm64",
		"omp-linux-x64",
		"omp-windows-arm64.exe",
		"omp-windows-x64.exe",
	]);
});

test.each([{ args: [selected] }, { args: ["--", selected] }])(
	"command updates the complete pin with explicit arguments: %j",
	async ({ args }) => {
		const files = fixture();
		const supplied = [...args];
		const calls: string[] = [];
		const message = await syncReleaseOmpCommand(args, files.pinPath, async url => {
			calls.push(url);
			return new Response(sums);
		});
		expect(args).toEqual<readonly string[]>(supplied);
		expect(calls).toEqual([
			`https://github.com/can1357/oh-my-pi/releases/download/${selected}/SHA256SUMS.txt`,
		]);
		expect(message).toBe(
			`Updated .omp-version to ${selected}; review all six asset digests before committing.`,
		);
		expect(readFileSync(files.pinPath, "utf8")).toBe(`${JSON.stringify(expected, null, 2)}\n`);
	},
);

test.each([
	["missing", sums.split("\n").slice(0, -1).join("\n")],
	["duplicate", `${sums}\n${sums.split("\n")[0]}\n`],
	["malformed digest", sums.replace(assets["omp-linux-x64"].slice(7), "g".repeat(64))],
	["truncated digest", sums.replace(assets["omp-windows-arm64.exe"].slice(7), "deadbeef")],
])("%s required checksum leaves the existing pin byte-for-byte unchanged", async (_name, text) => {
	const files = fixture(text);
	let requests = 0;
	await expect(
		syncReleaseOmp(selected, files.pinPath, async () => {
			requests++;
			return new Response(readFileSync(files.sumsPath, "utf8"));
		}),
	).rejects.toThrow();
	expect(requests).toBe(1);
	expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
});

test.each([403, 404, 503])(
	"HTTP %s retains the old pin without parsing the response",
	async status => {
		const files = fixture();
		let requests = 0;
		await expect(
			syncReleaseOmp(selected, files.pinPath, async () => {
				requests++;
				return new Response(readFileSync(files.sumsPath, "utf8"), { status });
			}),
		).rejects.toThrow(`HTTP ${status}`);
		expect(requests).toBe(1);
		expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
	},
);

test("network failure retains the existing pin", async () => {
	const files = fixture();
	let requests = 0;
	await expect(
		syncReleaseOmp(selected, files.pinPath, async () => {
			requests++;
			throw new Error("fixture network failure");
		}),
	).rejects.toThrow("fixture network failure");
	expect(requests).toBe(1);
	expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
});

test("response read failure retains the existing pin", async () => {
	const files = fixture();
	await expect(
		syncReleaseOmp(
			selected,
			files.pinPath,
			async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error("fixture response failure"));
						},
					}),
				),
		),
	).rejects.toThrow("fixture response failure");
	expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
});

test.each(["latest", "", "18.8.8", "v18.8", "v18.8.8/other", "v18.8.8?token=secret", null, 18])(
	"invalid tag %s is refused before any request or write",
	async tag => {
		const files = fixture();
		let requests = 0;
		await expect(
			syncReleaseOmp(tag, files.pinPath, async () => {
				requests++;
				return new Response(readFileSync(files.sumsPath, "utf8"));
			}),
		).rejects.toThrow();
		expect(requests).toBe(0);
		expect(readFileSync(files.pinPath, "utf8")).toBe(files.old);
	},
);

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
