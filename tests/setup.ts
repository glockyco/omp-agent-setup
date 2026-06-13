/**
 * Test-suite-wide preload. Runs once before any test file.
 *
 * Forces `Bun.which("omp")` to return null so the test suite behaves as if
 * `omp` is not installed — regardless of the dev machine's PATH.
 *
 * All other `Bun.which` lookups pass through unchanged.
 */
const realWhich = Bun.which.bind(Bun);

// biome-ignore lint/suspicious/noExplicitAny: monkey-patching the Bun built-in
(Bun as any).which = (cmd: string, options?: { PATH?: string; cwd?: string }) => {
	if (cmd === "omp") return null;
	return realWhich(cmd, options);
};
