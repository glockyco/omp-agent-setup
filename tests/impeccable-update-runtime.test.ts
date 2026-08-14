import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractZipSecure } from "../src/impeccable-update-runtime.ts";

const SAFE_ZIP =
	"UEsDBBQAAAAIAMBdDl0KPM9PBwAAAAUAAAAPAAAAYnVuZGxlL2ZpbGUudHh0K05MS+UCAFBLAQIUAxQAAAAIAMBdDl0KPM9PBwAAAAUAAAAPAAAAAAAAAAAAAACAAQAAAABidW5kbGUvZmlsZS50eHRQSwUGAAAAAAEAAQA9AAAANAAAAAAA";
const TRAVERSAL_ZIP =
	"UEsDBBQAAAAIAMBdDl0EQPI4CQAAAAcAAAANAAAALi4vZXNjYXBlLnR4dEstTk4sSOUCAFBLAQIUAxQAAAAIAMBdDl0EQPI4CQAAAAcAAAANAAAAAAAAAAAAAACAAQAAAAAuLi9lc2NhcGUudHh0UEsFBgAAAAABAAEAOwAAADQAAAAAAA==";
const SYMLINK_ZIP =
	"UEsDBBQAAAAAAAAAIQB/Y5L8EAAAABAAAAALAAAAYnVuZGxlL2xpbmsuLi8uLi9lc2NhcGUudHh0UEsBAhQDFAAAAAAAAAAhAH9jkvwQAAAAEAAAAAsAAAAAAAAAAAAAAP+hAAAAAGJ1bmRsZS9saW5rUEsFBgAAAAABAAEAOQAAADkAAAAAAA==";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const directory of temporaryDirectories.splice(0)) {
		await rm(directory, { recursive: true, force: true });
	}
});

async function writeFixture(
	encoded: string,
): Promise<{ destination: string; root: string; zip: string }> {
	const root = await mkdtemp(join(tmpdir(), "impeccable-zip-test-"));
	temporaryDirectories.push(root);
	const zip = join(root, "fixture.zip");
	const destination = join(root, "destination");
	await Bun.write(zip, Buffer.from(encoded, "base64"));
	return { destination, root, zip };
}

describe("extractZipSecure", () => {
	test("extracts ordinary files", async () => {
		const fixture = await writeFixture(SAFE_ZIP);

		await extractZipSecure(fixture.zip, fixture.destination);

		expect(await readFile(join(fixture.destination, "bundle", "file.txt"), "utf8")).toBe("safe\n");
	});

	test("rejects a parent-directory traversal without writing outside the destination", async () => {
		const fixture = await writeFixture(TRAVERSAL_ZIP);

		await expect(extractZipSecure(fixture.zip, fixture.destination)).rejects.toThrow(
			"invalid relative path",
		);
		expect(await Bun.file(join(fixture.root, "escape.txt")).exists()).toBe(false);
	});

	test("rejects symbolic-link entries", async () => {
		const fixture = await writeFixture(SYMLINK_ZIP);

		await expect(extractZipSecure(fixture.zip, fixture.destination)).rejects.toThrow("symbolic link");
		expect(await Bun.file(join(fixture.destination, "bundle", "link")).exists()).toBe(false);
	});
});
