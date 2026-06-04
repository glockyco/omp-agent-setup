import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	ANTHROPIC_DROP_CONTEXT_1M_BETA,
	CONVERT_TO_LLM_CONTENT_GUARD,
	OMP_PATCHES,
	type Patch,
	planPatch,
	TREE_SELECTOR_CUSTOM_MESSAGE_GUARD,
} from "../src/patches.ts";
import {
	applyPatches,
	patchTargetPath,
	patchTargetPaths,
	resolveOmpInstallRoot,
	resolveOmpScopeRoot,
} from "../src/patches-runtime.ts";

const SAMPLE_PATCH: Patch = {
	id: "test-patch",
	package: "pi-coding-agent",
	targetRelative: "src/sample.ts",
	description: "Test patch.",
	anchor: 'const x = "old";',
	replacement: 'const x = "new";',
	appliedSignature: 'const x = "new";',
};

async function writeFixture(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content);
}

describe("planPatch", () => {
	test("apply when anchor present exactly once and signature absent", () => {
		const plan = planPatch(SAMPLE_PATCH, '// header\nconst x = "old";\n// footer\n');
		expect(plan.kind).toBe("apply");
		if (plan.kind === "apply") {
			expect(plan.nextContent).toBe('// header\nconst x = "new";\n// footer\n');
		}
	});

	test("skip-already-applied wins over anchor presence", () => {
		// Anchor IS a substring of the file but the signature is too —
		// already-applied check runs first, so we never re-write.
		const patch: Patch = {
			...SAMPLE_PATCH,
			anchor: 'const x = "old";',
			appliedSignature: "ALREADY_APPLIED_MARKER",
		};
		const plan = planPatch(patch, 'const x = "old";\n// ALREADY_APPLIED_MARKER\n');
		expect(plan.kind).toBe("skip-already-applied");
	});

	test("skip-anchor-missing when neither anchor nor signature present", () => {
		const plan = planPatch(SAMPLE_PATCH, "// no relevant content\n");
		expect(plan.kind).toBe("skip-anchor-missing");
	});

	test("error-anchor-ambiguous when anchor matches more than once", () => {
		const plan = planPatch(SAMPLE_PATCH, 'const x = "old";\nconst x = "old";\n');
		expect(plan.kind).toBe("error-anchor-ambiguous");
		if (plan.kind === "error-anchor-ambiguous") {
			expect(plan.matchCount).toBe(2);
		}
	});

	test("anchor with embedded whitespace must match the file exactly", () => {
		const patch: Patch = {
			...SAMPLE_PATCH,
			anchor: '\tconst x = "old";',
			appliedSignature: '\tconst x = "new";',
			replacement: '\tconst x = "new";',
		};
		// File has the right text but the WRONG indent (spaces instead of tab).
		const plan = planPatch(patch, '    const x = "old";\n');
		expect(plan.kind).toBe("skip-anchor-missing");
	});
});

describe("CONVERT_TO_LLM_CONTENT_GUARD", () => {
	const unpatched = [
		"function transform(messages) {",
		"\treturn messages",
		"\t\t.map((m): Message | undefined => {",
		"\t\t\tswitch (m.role) {",
		'\t\t\t\tcase "custom":',
		'\t\t\t\tcase "hookMessage": {',
		'\t\t\t\t\tconst content = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;',
		'\t\t\t\t\tconst role = "user";',
		"\t\t\t\t\tconst attribution = m.attribution;",
		"\t\t\t\t\treturn {",
		"\t\t\t\t\t\trole,",
		"\t\t\t\t\t\tcontent,",
		"\t\t\t\t\t\tattribution,",
		"\t\t\t\t\t\ttimestamp: m.timestamp,",
		"\t\t\t\t\t};",
		"\t\t\t\t}",
		"\t\t\t}",
		"\t\t});",
		"}",
		"",
	].join("\n");

	test("applies cleanly against an unpatched file", () => {
		const plan = planPatch(CONVERT_TO_LLM_CONTENT_GUARD, unpatched);
		expect(plan.kind).toBe("apply");
		if (plan.kind === "apply") {
			expect(plan.nextContent).toContain(CONVERT_TO_LLM_CONTENT_GUARD.appliedSignature);
			// Sanity: the unpatched-form unique line is gone.
			expect(plan.nextContent).not.toContain(
				'const content = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;',
			);
		}
	});

	test("re-running planner against the patched output is a no-op", () => {
		const first = planPatch(CONVERT_TO_LLM_CONTENT_GUARD, unpatched);
		expect(first.kind).toBe("apply");
		if (first.kind !== "apply") return;
		const second = planPatch(CONVERT_TO_LLM_CONTENT_GUARD, first.nextContent);
		expect(second.kind).toBe("skip-already-applied");
	});

	test("included in OMP_PATCHES", () => {
		expect(OMP_PATCHES.map(p => p.id)).toContain(CONVERT_TO_LLM_CONTENT_GUARD.id);
	});
});

describe("TREE_SELECTOR_CUSTOM_MESSAGE_GUARD", () => {
	const unpatched = [
		'\t\t\tcase "custom_message": {',
		"\t\t\t\tconst content =",
		'\t\t\t\t\ttypeof entry.content === "string"',
		"\t\t\t\t\t\t? entry.content",
		"\t\t\t\t\t\t: entry.content",
		'\t\t\t\t\t\t\t\t.filter((c): c is { type: "text"; text: string } => c.type === "text")',
		"\t\t\t\t\t\t\t\t.map(c => c.text)",
		'\t\t\t\t\t\t\t\t.join("");',
		"\t\t\t\tresult = render(content);",
		"\t\t\t\tbreak;",
		"\t\t\t}",
		"",
	].join("\n");

	test("applies cleanly against an unpatched file", () => {
		const plan = planPatch(TREE_SELECTOR_CUSTOM_MESSAGE_GUARD, unpatched);
		expect(plan.kind).toBe("apply");
		if (plan.kind === "apply") {
			expect(plan.nextContent).toContain(TREE_SELECTOR_CUSTOM_MESSAGE_GUARD.appliedSignature);
			// Sanity: the unguarded form is gone.
			expect(plan.nextContent).not.toContain("\t\t\t\t\t\t: entry.content\n");
		}
	});

	test("re-running planner against the patched output is a no-op", () => {
		const first = planPatch(TREE_SELECTOR_CUSTOM_MESSAGE_GUARD, unpatched);
		expect(first.kind).toBe("apply");
		if (first.kind !== "apply") return;
		const second = planPatch(TREE_SELECTOR_CUSTOM_MESSAGE_GUARD, first.nextContent);
		expect(second.kind).toBe("skip-already-applied");
	});

	test("included in OMP_PATCHES", () => {
		expect(OMP_PATCHES.map(p => p.id)).toContain(TREE_SELECTOR_CUSTOM_MESSAGE_GUARD.id);
	});
});

describe("ANTHROPIC_DROP_CONTEXT_1M_BETA", () => {
	const unpatched = [
		"const claudeCodeAgentBetaDefaults = [",
		ANTHROPIC_DROP_CONTEXT_1M_BETA.anchor,
		'\t"context-management-2025-06-27",',
		"] as const;",
		"",
	].join("\n");

	test("targets pi-ai providers/anthropic.ts", () => {
		expect(ANTHROPIC_DROP_CONTEXT_1M_BETA.package).toBe("pi-ai");
		expect(ANTHROPIC_DROP_CONTEXT_1M_BETA.targetRelative).toBe("src/providers/anthropic.ts");
	});

	test("applies cleanly and removes the context-1m beta", () => {
		const plan = planPatch(ANTHROPIC_DROP_CONTEXT_1M_BETA, unpatched);
		expect(plan.kind).toBe("apply");
		if (plan.kind === "apply") {
			expect(plan.nextContent).toContain(ANTHROPIC_DROP_CONTEXT_1M_BETA.appliedSignature);
			// The retired beta string is gone from the array...
			expect(plan.nextContent).not.toContain('"context-1m-2025-08-07"');
			// ...while the neighbouring betas are preserved.
			expect(plan.nextContent).toContain('"claude-code-20250219"');
			expect(plan.nextContent).toContain('"interleaved-thinking-2025-05-14"');
		}
	});

	test("re-running planner against the patched output is a no-op", () => {
		const first = planPatch(ANTHROPIC_DROP_CONTEXT_1M_BETA, unpatched);
		expect(first.kind).toBe("apply");
		if (first.kind !== "apply") return;
		const second = planPatch(ANTHROPIC_DROP_CONTEXT_1M_BETA, first.nextContent);
		expect(second.kind).toBe("skip-already-applied");
	});

	test("included in OMP_PATCHES", () => {
		expect(OMP_PATCHES.map(p => p.id)).toContain(ANTHROPIC_DROP_CONTEXT_1M_BETA.id);
	});
});

describe("resolveOmpInstallRoot", () => {
	test("uses $BUN_INSTALL when set", () => {
		const root = resolveOmpInstallRoot({ BUN_INSTALL: "/opt/bun" } as NodeJS.ProcessEnv, "/home/me");
		expect(root).toBe("/opt/bun/install/global/node_modules/@oh-my-pi/pi-coding-agent");
	});

	test("falls back to ~/.bun when $BUN_INSTALL is unset", () => {
		const root = resolveOmpInstallRoot({} as NodeJS.ProcessEnv, "/home/me");
		expect(root).toBe("/home/me/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent");
	});
});

describe("resolveOmpScopeRoot", () => {
	test("uses $BUN_INSTALL when set", () => {
		const root = resolveOmpScopeRoot({ BUN_INSTALL: "/opt/bun" } as NodeJS.ProcessEnv, "/home/me");
		expect(root).toBe("/opt/bun/install/global/node_modules/@oh-my-pi");
	});

	test("falls back to ~/.bun when $BUN_INSTALL is unset", () => {
		const root = resolveOmpScopeRoot({} as NodeJS.ProcessEnv, "/home/me");
		expect(root).toBe("/home/me/.bun/install/global/node_modules/@oh-my-pi");
	});

	test("resolveOmpInstallRoot is the pi-coding-agent child of the scope root", () => {
		const env = { BUN_INSTALL: "/opt/bun" } as NodeJS.ProcessEnv;
		expect(resolveOmpInstallRoot(env, "/home/me")).toBe(
			join(resolveOmpScopeRoot(env, "/home/me"), "pi-coding-agent"),
		);
	});
});

describe("applyPatches (filesystem-backed)", () => {
	test("applies, then on a second run reports skip-already-applied", async () => {
		const workdir = await mkdtemp(join(tmpdir(), "omp-patches-"));
		try {
			const targetPath = join(workdir, SAMPLE_PATCH.package, "src", "sample.ts");
			await writeFixture(targetPath, '// header\nconst x = "old";\n// footer\n');

			const first = await applyPatches([SAMPLE_PATCH], workdir);
			expect(first).toMatchObject([{ kind: "apply" }]);
			expect(await readFile(targetPath, "utf8")).toContain('const x = "new";');

			const second = await applyPatches([SAMPLE_PATCH], workdir);
			expect(second).toMatchObject([{ kind: "skip-already-applied" }]);
		} finally {
			await rm(workdir, { recursive: true, force: true });
		}
	});

	test("reports skip-target-missing when the target file does not exist", async () => {
		const workdir = await mkdtemp(join(tmpdir(), "omp-patches-"));
		try {
			const results = await applyPatches([SAMPLE_PATCH], workdir);
			expect(results).toMatchObject([{ kind: "skip-target-missing" }]);
		} finally {
			await rm(workdir, { recursive: true, force: true });
		}
	});

	test("reports skip-anchor-missing when the file exists but the anchor is gone", async () => {
		const workdir = await mkdtemp(join(tmpdir(), "omp-patches-"));
		try {
			const targetPath = join(workdir, SAMPLE_PATCH.package, "src", "sample.ts");
			await writeFixture(targetPath, "// totally unrelated content\n");
			const results = await applyPatches([SAMPLE_PATCH], workdir);
			expect(results).toMatchObject([{ kind: "skip-anchor-missing" }]);
		} finally {
			await rm(workdir, { recursive: true, force: true });
		}
	});

	test("reports error-anchor-ambiguous without mutating the file", async () => {
		const workdir = await mkdtemp(join(tmpdir(), "omp-patches-"));
		try {
			const targetPath = join(workdir, SAMPLE_PATCH.package, "src", "sample.ts");
			const original = 'const x = "old";\nconst x = "old";\n';
			await writeFixture(targetPath, original);
			const results = await applyPatches([SAMPLE_PATCH], workdir);
			expect(results).toMatchObject([{ kind: "error-anchor-ambiguous", matchCount: 2 }]);
			expect(await readFile(targetPath, "utf8")).toBe(original);
		} finally {
			await rm(workdir, { recursive: true, force: true });
		}
	});

	test("write errors surface as error-write", async () => {
		const failingIO = {
			async read(path: string) {
				return await readFile(path, "utf8");
			},
			async write() {
				throw new Error("disk full");
			},
		};
		const workdir = await mkdtemp(join(tmpdir(), "omp-patches-"));
		try {
			const targetPath = join(workdir, SAMPLE_PATCH.package, "src", "sample.ts");
			await writeFixture(targetPath, 'const x = "old";\n');
			const results = await applyPatches([SAMPLE_PATCH], workdir, failingIO);
			expect(results).toMatchObject([{ kind: "error-write" }]);
		} finally {
			await rm(workdir, { recursive: true, force: true });
		}
	});
});

describe("patchTargetPaths", () => {
	test("resolves <scopeRoot>/<package>/<targetRelative>", () => {
		const paths = patchTargetPaths(OMP_PATCHES, "/scope");
		expect(paths).toContain("/scope/pi-coding-agent/src/session/messages.ts");
		expect(paths).toContain("/scope/pi-ai/src/providers/anthropic.ts");
	});
});

describe("patchTargetPath", () => {
	test("joins scope root, package, and target relative", () => {
		expect(patchTargetPath(ANTHROPIC_DROP_CONTEXT_1M_BETA, "/scope")).toBe(
			"/scope/pi-ai/src/providers/anthropic.ts",
		);
		expect(patchTargetPath(SAMPLE_PATCH, "/scope")).toBe("/scope/pi-coding-agent/src/sample.ts");
	});
});
