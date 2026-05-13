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
import { expandHome } from "./paths.ts";
import {
	type CheckoutStep,
	executeCheckoutSteps,
	loadManifest,
	planPluginCheckout,
} from "./plugins.ts";
import { realGitProbe, realGitRunner } from "./plugins-runtime.ts";
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

	const sourcesToSnapshot = [
		join(agentDir, "config.yml"),
		join(agentDir, "AGENTS.md"),
		join(extensionsDir, "superpowers-bootstrap.ts"),
		join(home, ".omp", "plugins", "package.json"),
		join(home, ".omp", "plugins", "omp-plugins.lock.json"),
	];

	await mkdir(agentDir, { recursive: true });
	await mkdir(extensionsDir, { recursive: true });

	const snapshot = await planSnapshot(sourcesToSnapshot, backupDir);
	await executeSnapshot(snapshot);

	const links = await planManagedLinks([
		{
			source: join(options.repoRoot, "AGENTS.md"),
			destination: join(agentDir, "AGENTS.md"),
		},
		{
			source: join(options.repoRoot, "extensions", "superpowers-bootstrap.ts"),
			destination: join(extensionsDir, "superpowers-bootstrap.ts"),
		},
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

	return { backupDir, snapshot, links, staleSymlinks, configChanged, pluginSteps };
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
	return lines.join("\n");
}
