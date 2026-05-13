import { describe, expect, test } from "bun:test";
import { backupSafeName, expandAndNormalize, expandHome, isPathInside } from "../src/paths.ts";

describe("expandHome", () => {
	test("expands a bare tilde", () => {
		expect(expandHome("~", "/Users/test")).toBe("/Users/test");
	});

	test("expands tilde-prefixed paths", () => {
		expect(expandHome("~/foo/bar", "/Users/test")).toBe("/Users/test/foo/bar");
	});

	test("leaves absolute paths unchanged", () => {
		expect(expandHome("/etc/hosts", "/Users/test")).toBe("/etc/hosts");
	});

	test("leaves relative paths unchanged", () => {
		expect(expandHome("foo/bar", "/Users/test")).toBe("foo/bar");
	});

	test("does not expand ~user prefixes", () => {
		expect(expandHome("~root/config", "/Users/test")).toBe("~root/config");
	});
});

describe("expandAndNormalize", () => {
	test("collapses redundant separators after expansion", () => {
		expect(expandAndNormalize("~//.omp/agent//", "/Users/test")).toBe("/Users/test/.omp/agent/");
	});
});

describe("backupSafeName", () => {
	test("encodes a typical config path", () => {
		expect(backupSafeName("/Users/test/.omp/agent/config.yml")).toBe(
			"Users__test___omp__agent__config_yml",
		);
	});

	test("rejects relative paths", () => {
		expect(() => backupSafeName("relative/path")).toThrow(/absolute path/);
	});

	test("encodes unusual characters reversibly", () => {
		const encoded = backupSafeName("/a b");
		expect(encoded).toBe("ax20b");
	});

	test("paths that differ only in dots vs slashes do not collide", () => {
		const a = backupSafeName("/foo.bar");
		const b = backupSafeName("/foo/bar");
		expect(a).not.toBe(b);
	});
});

describe("isPathInside", () => {
	test("identical paths count as inside", () => {
		expect(isPathInside("/foo/bar", "/foo/bar")).toBe(true);
	});

	test("nested paths count as inside", () => {
		expect(isPathInside("/foo", "/foo/bar/baz")).toBe(true);
	});

	test("sibling prefixes are not inside", () => {
		expect(isPathInside("/foo", "/foobar")).toBe(false);
	});

	test("unrelated paths are not inside", () => {
		expect(isPathInside("/foo", "/bar")).toBe(false);
	});

	test("trailing slashes do not affect the check", () => {
		expect(isPathInside("/foo/", "/foo/bar")).toBe(true);
	});
});
