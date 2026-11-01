import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Execute the same self-contained validator consumers receive, without copying its contract. */
export function workflowGate(root: string): string {
	const workflow = readFileSync(join(root, ".github/workflows/openspec.yml"), "utf8");
	const script = workflow.match(/<<'OPENSPEC_GATE'\n([\s\S]*?)\n {10}OPENSPEC_GATE/);
	if (!script?.[1]) throw new Error("Reusable OpenSpec workflow has no artifact validator.");
	return script[1]
		.split("\n")
		.map(line => line.replace(/^ {10}/, ""))
		.join("\n");
}

export async function checkOpenSpec(
	repository: string,
	workspace = repository,
	root = ".",
	cli = join(repository, "node_modules/@fission-ai/openspec/bin/openspec.js"),
): Promise<number> {
	const script = workflowGate(repository);
	for (const prospective of ["0", "1"]) {
		const child = Bun.spawn(["node", "--input-type=module", "--eval", script], {
			cwd: workspace,
			env: {
				...process.env,
				GITHUB_WORKSPACE: workspace,
				OPENSPEC_ROOT: root,
				OPENSPEC_CLI: cli,
				OPENSPEC_PROSPECTIVE: prospective,
				CI: "1",
				OPENSPEC_TELEMETRY: "0",
			},
			stdout: "inherit",
			stderr: "inherit",
		});
		const code = await child.exited;
		if (code !== 0) return code;
	}
	return 0;
}

if (import.meta.main) process.exitCode = await checkOpenSpec(join(import.meta.dir, ".."));
