import { afterEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type * as VaultModule from "../plugin/extensions/vault.ts";

// PERSONAL_PLUGIN_DIR selects an installed release at run time, so the module
// path cannot be static; the default is the source payload.
const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "plugin");
const { createKeystore, runProcess } = (await import(
	pathToFileURL(join(pluginRoot, "extensions", "vault.ts")).href
)) as typeof VaultModule;

const homes: string[] = [];
afterEach(() => {
	for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe("OS keystore", () => {
	test.skipIf(process.platform !== "win32" && process.platform !== "darwin")(
		"stores, returns and removes an unlock entry without plaintext on disk",
		async () => {
			const home = mkdtempSync(join(tmpdir(), "vault-keystore-"));
			homes.push(home);
			const keystore = createKeystore(process.platform, home, runProcess);
			// A unique account name keeps parallel CI runs and the real vaults apart.
			const vault = `test-${randomBytes(4).toString("hex")}`;
			const data = JSON.stringify({ key: randomBytes(64).toString("base64"), issued: 1, expires: 2 });
			try {
				await keystore.write(vault, data);
				expect(await keystore.read(vault)).toBe(data);
				const cacheFile = join(home, ".omp", "vault", "cache", `${vault}.dpapi`);
				if (process.platform === "win32") expect(readFileSync(cacheFile, "utf8")).not.toContain("key");
				else expect(existsSync(cacheFile)).toBe(false);
			} finally {
				await keystore.remove(vault);
			}
			expect(await keystore.read(vault)).toBeUndefined();
		},
		60_000,
	);
});
