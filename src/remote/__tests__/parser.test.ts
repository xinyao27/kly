import { describe, expect, test } from "bun:test";
import { isRemoteRef, parseRemoteRef } from "../parser";

describe("parseRemoteRef", () => {
  describe("basic formats", () => {
    test("user/repo → default main branch", () => {
      expect(parseRemoteRef("user/repo")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("github.com/user/repo → strips domain", () => {
      expect(parseRemoteRef("github.com/user/repo")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("https://github.com/user/repo → strips protocol and domain", () => {
      expect(parseRemoteRef("https://github.com/user/repo")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("http://github.com/user/repo → strips http protocol", () => {
      expect(parseRemoteRef("http://github.com/user/repo")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("user/repo.git → strips .git suffix", () => {
      expect(parseRemoteRef("user/repo.git")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });
  });

  describe("version tags", () => {
    test("user/repo@v1.0.0 → semver tag", () => {
      expect(parseRemoteRef("user/repo@v1.0.0")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "v1.0.0",
      });
    });

    test("user/repo@v0.1.0-beta.1 → prerelease tag", () => {
      expect(parseRemoteRef("user/repo@v0.1.0-beta.1")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "v0.1.0-beta.1",
      });
    });

    test("user/repo@1.0.0 → version without v prefix", () => {
      expect(parseRemoteRef("user/repo@1.0.0")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "1.0.0",
      });
    });

    test("user/repo@v2 → major version only", () => {
      expect(parseRemoteRef("user/repo@v2")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "v2",
      });
    });
  });

  describe("branch names", () => {
    test("user/repo@main → explicit main branch", () => {
      expect(parseRemoteRef("user/repo@main")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("user/repo@master → master branch", () => {
      expect(parseRemoteRef("user/repo@master")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "master",
      });
    });

    test("user/repo@develop → develop branch", () => {
      expect(parseRemoteRef("user/repo@develop")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "develop",
      });
    });

    test("user/repo@feature/new-feature → branch with slash", () => {
      expect(parseRemoteRef("user/repo@feature/new-feature")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "feature/new-feature",
      });
    });

    test("user/repo@fix/bug-123 → branch with numbers", () => {
      expect(parseRemoteRef("user/repo@fix/bug-123")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "fix/bug-123",
      });
    });
  });

  describe("commit SHA", () => {
    test("user/repo@abc1234 → short commit SHA", () => {
      expect(parseRemoteRef("user/repo@abc1234")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "abc1234",
      });
    });

    test("user/repo@a1b2c3d4e5f6 → longer commit SHA", () => {
      expect(parseRemoteRef("user/repo@a1b2c3d4e5f6")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "a1b2c3d4e5f6",
      });
    });
  });

  describe("combined formats", () => {
    test("github.com/user/repo@v1.0.0 → domain + version", () => {
      expect(parseRemoteRef("github.com/user/repo@v1.0.0")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "v1.0.0",
      });
    });

    test("https://github.com/user/repo@develop → full URL + branch", () => {
      expect(parseRemoteRef("https://github.com/user/repo@develop")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "develop",
      });
    });

    test("user/repo.git@v1.0.0 → .git suffix + version", () => {
      expect(parseRemoteRef("user/repo.git@v1.0.0")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "v1.0.0",
      });
    });
  });

  describe("edge cases", () => {
    test("trims whitespace", () => {
      expect(parseRemoteRef("  user/repo  ")).toEqual({
        owner: "user",
        repo: "repo",
        ref: "main",
      });
    });

    test("handles hyphenated names", () => {
      expect(parseRemoteRef("my-org/my-repo")).toEqual({
        owner: "my-org",
        repo: "my-repo",
        ref: "main",
      });
    });

    test("handles numeric names", () => {
      expect(parseRemoteRef("user123/repo456")).toEqual({
        owner: "user123",
        repo: "repo456",
        ref: "main",
      });
    });

    test("single character names", () => {
      expect(parseRemoteRef("a/b")).toEqual({
        owner: "a",
        repo: "b",
        ref: "main",
      });
    });
  });

  describe("invalid inputs", () => {
    test("empty string → null", () => {
      expect(parseRemoteRef("")).toBeNull();
    });

    test("single segment → null", () => {
      expect(parseRemoteRef("repo")).toBeNull();
    });

    test("too many segments → null", () => {
      expect(parseRemoteRef("a/b/c")).toBeNull();
    });

    test("starts with hyphen → null", () => {
      expect(parseRemoteRef("-user/repo")).toBeNull();
    });

    test("ends with hyphen → null", () => {
      expect(parseRemoteRef("user-/repo")).toBeNull();
    });

    test("contains invalid characters → null", () => {
      expect(parseRemoteRef("user$/repo")).toBeNull();
    });

    test("empty owner → null", () => {
      expect(parseRemoteRef("/repo")).toBeNull();
    });

    test("empty repo → null", () => {
      expect(parseRemoteRef("user/")).toBeNull();
    });
  });
});

describe("isRemoteRef", () => {
  describe("local paths (should return false)", () => {
    test("./file.ts → local relative", () => {
      expect(isRemoteRef("./file.ts")).toBe(false);
    });

    test("../file.ts → local parent relative", () => {
      expect(isRemoteRef("../file.ts")).toBe(false);
    });

    test("/abs/path.ts → local absolute", () => {
      expect(isRemoteRef("/abs/path.ts")).toBe(false);
    });

    test("path with backslash → Windows path", () => {
      expect(isRemoteRef("src\\file.ts")).toBe(false);
    });
  });

  describe("remote refs (should return true)", () => {
    test("user/repo → remote", () => {
      expect(isRemoteRef("user/repo")).toBe(true);
    });

    test("user/repo@v1.0.0 → remote with version", () => {
      expect(isRemoteRef("user/repo@v1.0.0")).toBe(true);
    });

    test("github.com/user/repo → remote with domain", () => {
      expect(isRemoteRef("github.com/user/repo")).toBe(true);
    });

    test("https://github.com/user/repo → remote with full URL", () => {
      expect(isRemoteRef("https://github.com/user/repo")).toBe(true);
    });
  });

  describe("ambiguous cases", () => {
    test("file.ts (no ./) → treated as invalid remote, returns false", () => {
      expect(isRemoteRef("file.ts")).toBe(false);
    });

    test("src/file.ts → looks like path but could be remote", () => {
      // This is ambiguous - src/file.ts could be user/repo format
      // but "file.ts" is not a valid GitHub repo name (contains dot)
      expect(isRemoteRef("src/file.ts")).toBe(false);
    });
  });
});
