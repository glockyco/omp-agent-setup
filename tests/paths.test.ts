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
			"Users_2ftest_2f_2eomp_2fagent_2fconfig_2eyml",
		);
	});

	test("rejects relative paths", () => {
		expect(() => backupSafeName("relative/path")).toThrow(/absolute path/);
	});

	test("encodes unusual characters reversibly", () => {
		expect(backupSafeName("/a b")).toBe("a_20b");
	});

	test("paths that differ only in dots vs slashes do not collide", () => {
		expect(backupSafeName("/foo.bar")).not.toBe(backupSafeName("/foo/bar"));
	});

	test("paths containing underscores do not collide with separator-encoded paths", () => {
		// Previous encoding mapped `/` to `__` and `_` passed through, so
		// `/foo/bar` and `/foo__bar` both encoded to `foo__bar`.
		expect(backupSafeName("/foo/bar")).not.toBe(backupSafeName("/foo__bar"));
	});

	test("paths containing dots do not collide with underscore-bearing paths", () => {
		// Previous encoding mapped `.` to `_` and `_` passed through, so
		// `/foo.bar` and `/foo_bar` both encoded to `foo_bar`.
		expect(backupSafeName("/foo.bar")).not.toBe(backupSafeName("/foo_bar"));
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
