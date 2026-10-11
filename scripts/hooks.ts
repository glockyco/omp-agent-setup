export async function runHook(
	command: string[],
	cwd = process.cwd(),
	environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
	const query = Bun.spawn(["git", "rev-parse", "--local-env-vars"], {
		cwd,
		env: environment,
		stdout: "pipe",
		stderr: "inherit",
	});
	const names = await new Response(query.stdout).text();
	const status = await query.exited;
	if (status !== 0) return status;
	const env = { ...environment };
	for (const name of names.trim().split(/\r?\n/)) delete env[name];
	const child = Bun.spawn(command, {
		cwd,
		env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
	return child.exited;
}

if (import.meta.main) {
	const command = process.argv.slice(2);
	if (!command.length) throw new Error("Supply a native hook command and arguments.");
	process.exitCode = await runHook(command);
}
