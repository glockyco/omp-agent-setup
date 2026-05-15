import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	executeSnapshot,
	planSnapshot,
	type SnapshotPlan,
	timestampedBackupDirName,
} from "./backup.ts";
import { MANAGED_CONFIG, mergeManagedConfig } from "./config.ts";
import { LOCAL_MANAGED_SKILLS } from "./managed-skills.ts";
import { OMP_PATCHES } from "./patches.ts";
import {
	applyPatches,
	type PatchExecution,
	patchTargetPaths,
	resolveOmpInstallRoot,
} from "./patches-runtime.ts";
import { expandHome } from "./paths.ts";
import { type CheckoutStep, executeCheckoutSteps, planPluginCheckout } from "./plugins.ts";
import { loadManifest, realGitProbe, realGitRunner } from "./plugins-runtime.ts";
import {
	executeLinkPlan,
	executeStaleSymlinkRemoval,
	type LinkPlan,
	planManagedLinks,
	planStaleSymlinkRemoval,
	type StaleSymlinkPlan,
} from "./runtime.ts";

export interface BootstrapOptions {
	repoRoot: string;
	home?: string;
	/** Override agent dir for tests; defaults to `<home>/.omp/agent`. */
	agentDir?: string;
	/** Skip cloning/checkouts when running unit/integration tests. */
	skipPlugins?: boolean;
	/** Skip OMP source patches when running unit/integration tests. */
	skipPatches?: boolean;
	/** Override the installed `@oh-my-pi/pi-coding-agent` root for tests. */
	ompInstallRoot?: string;
	/** Optional override for `manifests/plugins.yml`. */
	manifestPath?: string;
	/** Optional date for timestamped backup dir; defaults to `new Date()`. */
	now?: Date;
}

export interface BootstrapReport {
	backupDir: string;
	snapshot: SnapshotPlan;
	links: LinkPlan;
	staleSymlinks: StaleSymlinkPlan;
	configChanged: boolean;
	pluginSteps: CheckoutStep[];
	patchExecutions: PatchExecution[];
}

/**
 * Idempotent bootstrap orchestrator. Produces a structured report so callers
 * (CLI, tests) can show or assert on what was done.
 */
export async function runBootstrap(options: BootstrapOptions): Promise<BootstrapReport> {
	const home = options.home ?? homedir();
	const agentDir = options.agentDir ?? join(home, ".omp", "agent");
	const extensionsDir = join(agentDir, "extensions");
	const backupDir = join(
		options.repoRoot,
		"backups",
		timestampedBackupDirName(options.now ?? new Date()),
	);

	const ompInstallRoot = options.ompInstallRoot ?? resolveOmpInstallRoot(process.env, home);
	const patchTargets = options.skipPatches ? [] : patchTargetPaths(OMP_PATCHES, ompInstallRoot);
	const sourcesToSnapshot = [
		join(agentDir, "config.yml"),
		join(agentDir, "AGENTS.md"),
		join(agentDir, "lsp.json"),
		join(extensionsDir, "superpowers-bootstrap.ts"),
		...LOCAL_MANAGED_SKILLS.map(skillName => join(agentDir, "skills", skillName)),
		join(home, ".omp", "plugins", "package.json"),
		join(home, ".omp", "plugins", "omp-plugins.lock.json"),
		...patchTargets,
	];
	await mkdir(agentDir, { recursive: true });
	await mkdir(extensionsDir, { recursive: true });

	const snapshot = await planSnapshot(sourcesToSnapshot, backupDir);
	await executeSnapshot(snapshot);

	const links = await planManagedLinks([
		{
			source: join(options.repoRoot, "agent", "AGENTS.md"),
			destination: join(agentDir, "AGENTS.md"),
		},
		{
			source: join(options.repoRoot, "agent", "lsp.json"),
			destination: join(agentDir, "lsp.json"),
		},
		{
			source: join(options.repoRoot, "extensions", "superpowers-bootstrap.ts"),
			destination: join(extensionsDir, "superpowers-bootstrap.ts"),
		},
		...LOCAL_MANAGED_SKILLS.map(skillName => ({
			source: join(options.repoRoot, "agent", "skills", skillName),
			destination: join(agentDir, "skills", skillName),
		})),
	]);
	await executeLinkPlan(links);

	const staleSymlinks = await planStaleSymlinkRemoval(join(agentDir, "skills"));
	await executeStaleSymlinkRemoval(staleSymlinks);

	const configPath = join(agentDir, "config.yml");
	let existingYaml = "";
	try {
		existingYaml = await readFile(configPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const merged = mergeManagedConfig(existingYaml, MANAGED_CONFIG);
	const configChanged = merged !== existingYaml;
	if (configChanged) {
		await mkdir(dirname(configPath), { recursive: true });
		await writeFile(configPath, merged);
	}

	const pluginSteps: CheckoutStep[] = [];
	if (!options.skipPlugins) {
		const manifestPath = options.manifestPath ?? join(options.repoRoot, "manifests", "plugins.yml");
		const manifest = await loadManifest(manifestPath, home);
		for (const plugin of manifest.plugins) {
			const steps = await planPluginCheckout(
				{ ...plugin, pathExpanded: expandHome(plugin.path, home) },
				realGitProbe,
			);
			pluginSteps.push(...steps);
			await executeCheckoutSteps(steps, realGitRunner, realGitProbe);
		}
	}

	const patchExecutions: PatchExecution[] = options.skipPatches
		? []
		: await applyPatches(OMP_PATCHES, ompInstallRoot);

	return {
		backupDir,
		snapshot,
		links,
		staleSymlinks,
		configChanged,
		pluginSteps,
		patchExecutions,
	};
}

export function summarizeReport(report: BootstrapReport): string {
	const lines: string[] = [];
	lines.push(`Backup directory: ${report.backupDir}`);
	const snapshotted = report.snapshot.entries.filter(e => e.kind === "copy").length;
	const skipped = report.snapshot.entries.filter(e => e.kind === "skip").length;
	lines.push(`Snapshot: ${snapshotted} copied, ${skipped} skipped`);
	for (const entry of report.links.entries) {
		if (entry.kind === "skip") continue;
		const dest = "destination" in entry ? entry.destination : "";
		lines.push(`Symlink ${entry.kind}: ${dest}`);
	}
	if (report.staleSymlinks.entries.length > 0) {
		lines.push(`Removed stale legacy-Pi symlinks: ${report.staleSymlinks.entries.length}`);
	}
	lines.push(`Config: ${report.configChanged ? "updated" : "unchanged"}`);
	if (report.pluginSteps.length > 0) {
		lines.push(`Plugin steps: ${report.pluginSteps.length}`);
		for (const step of report.pluginSteps) {
			lines.push(`  - ${step.kind} ${step.plugin.name}`);
		}
	}
	if (report.patchExecutions.length > 0) {
		const summary = summarizePatchExecutions(report.patchExecutions);
		lines.push(`OMP patches: ${summary}`);
		for (const execution of report.patchExecutions) {
			if (execution.kind === "skip-already-applied") continue;
			lines.push(`  - ${execution.kind} ${execution.patch.id} (${execution.targetPath})`);
		}
	}
	return lines.join("\n");
}

function summarizePatchExecutions(executions: readonly PatchExecution[]): string {
	const counts = new Map<PatchExecution["kind"], number>();
	for (const execution of executions) {
		counts.set(execution.kind, (counts.get(execution.kind) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([kind, count]) => `${count} ${kind}`)
		.join(", ");
}
