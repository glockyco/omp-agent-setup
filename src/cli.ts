import { spawn } from "node:child_process";
import { lstat, readlink, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planBinLink } from "./bin-link.ts";
import {
	isUsableSourceEntry,
	probeBinState,
	resolveBunBinPath,
	resolveOmpSourceEntry,
} from "./bin-link-runtime.ts";
import {
	isBinLinkUnhealthy,
	runBootstrap,
	summarizeReport,
	unhealthyPatchExecutions,
	unhealthyPluginSteps,
} from "./bootstrap.ts";
import { updateImpeccableFromRemote } from "./impeccable-update-runtime.ts";
import { auditFleet, renderReport } from "./lsp-audit.ts";
import { discoverRepos, makeDefsResolver, makePathResolver, realFs } from "./lsp-audit-runtime.ts";
import { LOCAL_MANAGED_SKILLS } from "./managed-skills.ts";
import { resolveOmpScopeRoot } from "./patches-runtime.ts";
import { loadManifest } from "./plugins-runtime.ts";
import { checkSkillLoader, ompDirectSmoke, ompExtensionSmoke, scanLog } from "./verify.ts";
import { makeRealSkillLoader, readLogFile, realRunner } from "./verify-runtime.ts";

const VERIFY_MODEL = process.env.OMP_VERIFY_MODEL ?? "openai-codex/gpt-5.5";

export const REQUIRED_SKILLS = ["plannotator-review", ...LOCAL_MANAGED_SKILLS];

function repoRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

async function cmdBootstrap(_args: string[]): Promise<number> {
	const report = await runBootstrap({ repoRoot: repoRoot() });
	console.log(summarizeReport(report));
	const patchUnhealthy = unhealthyPatchExecutions(report.patchExecutions).length > 0;
	const binUnhealthy =
		(report.binLink !== undefined && isBinLinkUnhealthy(report.binLink)) ||
		(report.plansBinLink !== undefined && isBinLinkUnhealthy(report.plansBinLink));
	const pluginUnhealthy = unhealthyPluginSteps(report.pluginSteps).length > 0;
	return patchUnhealthy || binUnhealthy || pluginUnhealthy ? 1 : 0;
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
			customDirectories: [join(home, "Projects", "plannotator", "apps", "pi-extension", "skills")],
			requiredSkillNames: REQUIRED_SKILLS,
			loader: makeRealSkillLoader(),
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

	console.log("\n==> omp-plans CLI smoke");
	const plansSmoke = Bun.spawnSync({
		cmd: ["bun", join(repoRoot(), "src", "plans-cli.ts"), "--help"],
		stdout: "pipe",
		stderr: "pipe",
	});
	if (plansSmoke.exitCode === 0) {
		console.log("  ok   omp-plans --help");
	} else {
		console.error("FAIL: omp-plans --help exited nonzero");
		failures++;
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
	const checks = managedAgentChecks(agentDir);
	let issues = 0;
	for (const [path, label, expected] of checks) {
		const status = await classifyManagedCheck(path, expected);
		switch (status.kind) {
			case "ok":
				console.log(`  ok   ${label}`);
				break;
			case "ok-symlink":
				console.log(`  ok   ${label} -> ${status.target}`);
				break;
			case "dangling-symlink":
				console.log(`  WARN ${label} -> ${status.target} (dangling)`);
				issues++;
				break;
			case "not-symlink":
				console.log(`  WARN: ${label} exists but is not a symlink`);
				issues++;
				break;
			case "missing":
				console.log(`  MISS ${label}`);
				issues++;
				break;
		}
	}
	const binPath = resolveBunBinPath();
	const expectedBinTarget = resolveOmpSourceEntry(resolveOmpScopeRoot());
	const binPlan = planBinLink({
		binPath,
		desiredTarget: expectedBinTarget,
		current: await probeBinState(binPath),
		sourceUsable: await isUsableSourceEntry(expectedBinTarget),
	});
	if (binPlan.kind === "skip-up-to-date") {
		console.log(`  ok   omp bin -> ${expectedBinTarget}`);
	} else {
		console.log(`  WARN omp bin: ${binPlan.kind} (expected source entry ${expectedBinTarget})`);
		issues++;
	}
	const plansBinPath = join(dirname(binPath), "omp-plans");
	const plansSource = join(repoRoot(), "src", "plans-cli.ts");
	const plansPlan = planBinLink({
		binPath: plansBinPath,
		desiredTarget: plansSource,
		current: await probeBinState(plansBinPath),
		sourceUsable: await isUsableSourceEntry(plansSource),
	});
	if (plansPlan.kind === "skip-up-to-date") {
		console.log(`  ok   omp-plans bin -> ${plansSource}`);
	} else {
		console.log(`  WARN omp-plans bin: ${plansPlan.kind}`);
		issues++;
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

type ManagedAgentCheck = [path: string, label: string, expected: "symlink" | "file"];

export type ManagedCheckStatus =
	| { kind: "ok" }
	| { kind: "ok-symlink"; target: string }
	| { kind: "dangling-symlink"; target: string }
	| { kind: "not-symlink" }
	| { kind: "missing" };

/**
 * Classify one managed-agent-dir check so `cmdDoctor` only has to format the
 * result.
 *
 * A symlink counts as healthy only when its target resolves. `executeLinkPlan`
 * creates links without verifying the source exists, so a managed name that was
 * registered before its payload landed produces a link that `lstat` reports as
 * a perfectly good symlink while every reader of it fails with ENOENT. Probing
 * the target with `stat` (which follows the link) is what separates the two.
 */
export async function classifyManagedCheck(
	path: string,
	expected: "symlink" | "file",
): Promise<ManagedCheckStatus> {
	let target: string;
	try {
		const entry = await lstat(path);
		if (!entry.isSymbolicLink()) {
			return expected === "symlink" ? { kind: "not-symlink" } : { kind: "ok" };
		}
		target = await readlink(path);
	} catch {
		return { kind: "missing" };
	}
	try {
		await stat(path);
	} catch {
		return { kind: "dangling-symlink", target };
	}
	return { kind: "ok-symlink", target };
}

export function managedAgentChecks(agentDir: string): ManagedAgentCheck[] {
	return [
		[join(agentDir, "AGENTS.md"), "AGENTS.md", "symlink"],
		[join(agentDir, "extensions", "omp-session-env.ts"), "omp-session-env.ts", "symlink"],
		[join(agentDir, "lsp.json"), "lsp.json", "symlink"],
		...LOCAL_MANAGED_SKILLS.map(
			skillName =>
				[
					join(agentDir, "skills", skillName),
					`skills/${skillName}`,
					"symlink",
				] satisfies ManagedAgentCheck,
		),
		[join(agentDir, "config.yml"), "config.yml", "file"],
	];
}

async function cmdUpdateImpeccable(_args: string[]): Promise<number> {
	const result = await updateImpeccableFromRemote({ repoRoot: repoRoot() });
	const oldVersion = result.oldVersion ?? "none";
	console.log(`Impeccable skill updated: ${oldVersion} -> ${result.newVersion}`);
	console.log("Review the git diff, then run 'bun run bootstrap' and 'bun run verify'.");
	return 0;
}

async function cmdUpdatePlugin(name: "plannotator"): Promise<number> {
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

async function cmdAuditLsp(args: string[]): Promise<number> {
	const projectsDir = args.find(a => !a.startsWith("--")) ?? join(homedir(), "Projects");
	const includeDormant = args.includes("--include-dormant");
	const parseErrors: Array<{ path: string; message: string }> = [];
	const defsFor = makeDefsResolver(undefined, err => parseErrors.push(err));
	const repos = discoverRepos({ projectsDir });
	const now = new Date();
	let reports = auditFleet(repos, defsFor, realFs, makePathResolver(), now);
	if (!includeDormant) reports = reports.filter(r => r.activity !== "dormant");
	process.stdout.write(renderReport(reports, now));
	if (parseErrors.length > 0) {
		// Surfaced after the report so the user always sees coverage first,
		// then sees what the audit could not honor and why. Non-zero exit so
		// CI gates can pick the problem up.
		process.stderr.write(`\nMalformed override files (ignored by the audit):\n`);
		for (const e of parseErrors) {
			process.stderr.write(`  - ${e.path}: ${e.message}\n`);
		}
		return 1;
	}
	return 0;
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
	"audit-lsp": cmdAuditLsp,
	"install-lsp": cmdInstallLsp,
	"update-impeccable": cmdUpdateImpeccable,
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
	try {
		return await handler(rest);
	} catch (error) {
		// Several handlers reject on operational failures (`runGit`, `captureGit`,
		// child-process spawn errors). Normalize: every command exits the same
		// way — one stable error line, non-zero code — instead of dumping a
		// stack trace for some commands and a clean diagnostic for others.
		const message = error instanceof Error ? error.message : String(error);
		console.error(`${command}: ${message}`);
		return 1;
	}
}

if (import.meta.main) {
	const exitCode = await main();
	process.exit(exitCode);
}

export { main };
