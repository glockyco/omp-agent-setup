import { spawn } from "node:child_process";
import { lstat, readlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBootstrap, summarizeReport } from "./bootstrap.ts";
import { loadManifest } from "./plugins.ts";
import {
	checkSkillLoader,
	findExtensionError,
	ompAcceptanceSmoke,
	ompDirectSmoke,
	ompExtensionSmoke,
	scanLog,
} from "./verify.ts";
import { readLogFile, realRunner } from "./verify-runtime.ts";

const VERIFY_MODEL = process.env.OMP_VERIFY_MODEL ?? "openai-codex/gpt-5.5";

const REQUIRED_SKILLS = ["using-superpowers", "brainstorming", "plannotator-review"];

function repoRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

async function cmdBootstrap(_args: string[]): Promise<number> {
	const report = await runBootstrap({ repoRoot: repoRoot() });
	console.log(summarizeReport(report));
	return 0;
}

async function cmdVerify(_args: string[]): Promise<number> {
	let failures = 0;
	const startTime = new Date();

	console.log("\n==> Direct OMP smoke (no skills, no extensions)");
	const direct = await ompDirectSmoke(realRunner, { expected: "DIRECT_OK" });
	process.stdout.write(direct.stdout);
	if (direct.failure) {
		console.error(`FAIL: ${direct.failure}`);
		failures++;
	}

	console.log("\n==> OMP smoke with configured extensions");
	const ext = await ompExtensionSmoke(realRunner, { model: VERIFY_MODEL, expected: "OMP_SMOKE_OK" });
	process.stdout.write(ext.stdout);
	if (ext.failure) {
		console.error(`FAIL: ${ext.failure}`);
		failures++;
	}

	console.log("\n==> Skill discovery via OMP loader");
	try {
		const home = homedir();
		const loader = await checkSkillLoader({
			cwd: process.cwd(),
			customDirectories: [
				join(home, "Projects", "superpowers", "skills"),
				join(home, "Projects", "plannotator", "apps", "pi-extension", "skills"),
			],
			requiredSkillNames: REQUIRED_SKILLS,
		});
		for (const name of REQUIRED_SKILLS) {
			console.log(`  ${loader.missing.includes(name) ? "MISSING" : "ok"}  ${name}`);
		}
		if (loader.missing.length > 0) {
			console.error(`FAIL: missing skills: ${loader.missing.join(", ")}`);
			failures++;
		}
	} catch (error) {
		console.error(`FAIL: skill loader error: ${(error as Error).message}`);
		failures++;
	}

	console.log("\n==> Log scan for new extension errors");
	const logPath = join(homedir(), ".omp", "logs", `omp.${todayLogDate()}.log`);
	const logText = await readLogFile(logPath);
	const findings = scanLog(logText, startTime.toISOString(), [
		/Failed to load extension/,
		/Extension error/,
	]);
	if (findings.length === 0) {
		console.log("  no new extension errors");
	} else {
		for (const finding of findings) {
			console.error(`  ${finding.timestamp} ${finding.level}: ${finding.message}`);
		}
		console.error("FAIL: new extension errors in OMP log");
		failures++;
	}

	const skipAcceptance = process.env.OMP_VERIFY_SKIP_ACCEPTANCE === "1";
	if (!skipAcceptance) {
		console.log("\n==> Superpowers acceptance smoke");
		const acceptance = await ompAcceptanceSmoke(realRunner, {
			model: VERIFY_MODEL,
			prompt: "Let's make a react todo list",
			mentionPatterns: [
				/[Bb]rainstorm/,
				/[Ss]uperpowers/,
				/[Mm]ockups?/,
				/[Dd]iagrams?/,
				/understand.+(intent|requirements|design)/i,
				/before (we|I) (start|code|build|implement)/i,
			],
		});
		process.stdout.write(acceptance.stdout);
		if (acceptance.failure) {
			console.error(`FAIL: ${acceptance.failure}`);
			failures++;
		}
		const errLine = findExtensionError(acceptance.stdout);
		if (errLine) {
			console.error(`FAIL: extension error during acceptance smoke: ${errLine}`);
			failures++;
		}
	} else {
		console.log("\n==> Superpowers acceptance smoke (skipped via OMP_VERIFY_SKIP_ACCEPTANCE=1)");
	}

	if (failures > 0) {
		console.error(`\nVerification failed: ${failures} check(s) failed`);
		return 1;
	}
	console.log(
		"\nVerification complete. Manual: run /plannotator-status in an interactive OMP session.",
	);
	return 0;
}

async function cmdDoctor(_args: string[]): Promise<number> {
	const home = homedir();
	const agentDir = join(home, ".omp", "agent");
	const checks: Array<[string, string, "symlink" | "file"]> = [
		[join(agentDir, "AGENTS.md"), "AGENTS.md", "symlink"],
		[join(agentDir, "extensions", "superpowers-bootstrap.ts"), "superpowers-bootstrap.ts", "symlink"],
		[join(agentDir, "lsp.json"), "lsp.json", "symlink"],
		[join(agentDir, "config.yml"), "config.yml", "file"],
	];
	let issues = 0;
	for (const [path, label, expected] of checks) {
		try {
			const stat = await lstat(path);
			if (expected === "symlink" && !stat.isSymbolicLink()) {
				console.log(`  WARN: ${label} exists but is not a symlink`);
				issues++;
			} else if (stat.isSymbolicLink()) {
				const target = await readlink(path);
				console.log(`  ok   ${label} -> ${target}`);
			} else {
				console.log(`  ok   ${label}`);
			}
		} catch {
			console.log(`  MISS ${label}`);
			issues++;
		}
	}
	const manifestPath = join(repoRoot(), "manifests", "plugins.yml");
	const manifest = await loadManifest(manifestPath, home);
	for (const plugin of manifest.plugins) {
		try {
			await lstat(`${plugin.pathExpanded}/.git`);
			console.log(`  ok   plugin ${plugin.name} at ${plugin.path}`);
		} catch {
			console.log(`  MISS plugin ${plugin.name} at ${plugin.path}`);
			issues++;
		}
	}
	if (issues > 0) {
		console.error(`\nDoctor found ${issues} issue(s).`);
		return 1;
	}
	console.log("\nDoctor: healthy.");
	return 0;
}

async function cmdUpdatePlugin(name: "superpowers" | "plannotator"): Promise<number> {
	const home = homedir();
	const manifestPath = join(repoRoot(), "manifests", "plugins.yml");
	const manifest = await loadManifest(manifestPath, home);
	const plugin = manifest.plugins.find(p => p.name === name);
	if (!plugin) {
		console.error(`Plugin ${name} not in manifest`);
		return 1;
	}
	const path = plugin.pathExpanded;
	console.log(`Updating ${plugin.name} at ${path} (branch ${plugin.branch})`);

	if (!(await runGitOk(["-C", path, "diff", "--quiet"]))) {
		console.error(`Working tree at ${path} has uncommitted changes; commit or stash first.`);
		return 1;
	}
	if (!(await runGitOk(["-C", path, "diff", "--cached", "--quiet"]))) {
		console.error(`Index at ${path} has staged changes; commit or stash first.`);
		return 1;
	}

	await runGit(["-C", path, "fetch", "upstream"]);
	await runGit(["-C", path, "fetch", "origin"]);
	await runGit(["-C", path, "checkout", plugin.branch]);

	const rebaseOk = await runGitOk(["-C", path, "rebase", "upstream/main"]);
	if (!rebaseOk) {
		console.error(
			`Rebase onto upstream/main produced conflicts. Resolve them in ${path}, run 'git rebase --continue', then push --force-with-lease origin ${plugin.branch}.`,
		);
		return 1;
	}

	const head = (await captureGit(["-C", path, "rev-parse", "HEAD"])).trim();
	const upstreamHead = (await captureGit(["-C", path, "rev-parse", "upstream/main"])).trim();
	console.log(`\n${plugin.name} ${plugin.branch} now at ${head} (upstream/main: ${upstreamHead}).`);
	console.log(
		`Run 'bun run verify' and, if green, 'git -C ${path} push --force-with-lease origin ${plugin.branch}'.`,
	);
	console.log(`Update manifests/plugins.yml currentCommit to ${head} once pushed.`);
	return 0;
}

async function runGit(args: string[]): Promise<void> {
	await new Promise<void>((resolveDone, reject) => {
		const child = spawn("git", args, { stdio: "inherit" });
		child.on("close", code => {
			if (code === 0) resolveDone();
			else reject(new Error(`git ${args.join(" ")} exited ${code}`));
		});
		child.on("error", reject);
	});
}

async function runGitOk(args: string[]): Promise<boolean> {
	return await new Promise<boolean>(resolveDone => {
		const child = spawn("git", args, { stdio: "inherit" });
		child.on("close", code => resolveDone(code === 0));
		child.on("error", () => resolveDone(false));
	});
}

async function captureGit(args: string[]): Promise<string> {
	return await new Promise<string>((resolveDone, reject) => {
		const child = spawn("git", args, { stdio: ["ignore", "pipe", "inherit"] });
		let stdout = "";
		child.stdout?.on("data", chunk => {
			stdout += chunk.toString();
		});
		child.on("close", code => {
			if (code === 0) resolveDone(stdout);
			else reject(new Error(`git ${args.join(" ")} exited ${code}`));
		});
		child.on("error", reject);
	});
}

function todayLogDate(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function cmdInstallLsp(_args: string[]): Promise<number> {
	const script = join(repoRoot(), "scripts", "install-lsp.sh");
	return await new Promise<number>((resolveDone, reject) => {
		const child = spawn("bash", [script], { stdio: "inherit" });
		// `code === null` indicates termination by signal (SIGINT, SIGTERM, etc.).
		// Treat that as a failed install so callers cannot mistake an aborted run
		// for a successful one.
		child.on("close", (code, signal) => {
			if (signal !== null && signal !== undefined) {
				console.error(`install-lsp terminated by signal: ${signal}`);
				resolveDone(128);
				return;
			}
			resolveDone(code ?? 1);
		});
		child.on("error", reject);
	});
}

const COMMANDS: Record<string, (args: string[]) => Promise<number>> = {
	bootstrap: cmdBootstrap,
	verify: cmdVerify,
	doctor: cmdDoctor,
	"install-lsp": cmdInstallLsp,
	"update-superpowers": () => cmdUpdatePlugin("superpowers"),
	"update-plannotator": () => cmdUpdatePlugin("plannotator"),
};

async function main(): Promise<number> {
	const [, , command, ...rest] = process.argv;
	if (!command || command === "--help" || command === "-h") {
		const names = Object.keys(COMMANDS).sort().join(", ");
		console.log(`Usage: bun run src/cli.ts <command>\nCommands: ${names}`);
		return command ? 0 : 1;
	}
	const handler = COMMANDS[command];
	if (!handler) {
		console.error(`Unknown command: ${command}`);
		return 2;
	}
	return await handler(rest);
}

if (import.meta.main) {
	const exitCode = await main();
	process.exit(exitCode);
}

export { main };
