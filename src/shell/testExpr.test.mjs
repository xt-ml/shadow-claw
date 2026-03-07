import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../storage/groupFileExists.mjs", () => ({
  groupFileExists: jest.fn(),
}));

jest.unstable_mockModule("../storage/listGroupFiles.mjs", () => ({
  listGroupFiles: jest.fn(),
}));

const { testExpr } = await import("./testExpr.mjs");
const { groupFileExists } = await import("../storage/groupFileExists.mjs");
const { listGroupFiles } = await import("../storage/listGroupFiles.mjs");

describe("testExpr.mjs", () => {
  const db = {};
  const ctx = { groupId: "test-group" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("unary operators", () => {
    it("should test file existence with -f", async () => {
      groupFileExists.mockResolvedValueOnce(true);

      const result = await testExpr(db, ["-f", "file.txt"], ctx);
      expect(result.exitCode).toBe(0);
    });

    it("should test directory existence with -d", async () => {
      listGroupFiles.mockResolvedValueOnce(["file.txt"]);

      const result = await testExpr(db, ["-d", "subdir"], ctx);
      expect(result.exitCode).toBe(0);
    });

    it("should fail directory test if listGroupFiles throws", async () => {
      listGroupFiles.mockRejectedValueOnce(new Error("missing"));

      const result = await testExpr(db, ["-d", "missing"], ctx);
      expect(result.exitCode).toBe(1);
    });

    it("should test empty string with -z", async () => {
      expect((await testExpr(db, ["-z", ""], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["-z", "abc"], ctx)).exitCode).toBe(1);
    });

    it("should test non-empty string with -n", async () => {
      expect((await testExpr(db, ["-n", "abc"], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["-n", ""], ctx)).exitCode).toBe(1);
    });
  });

  describe("binary operators", () => {
    it("should test string equality with =", async () => {
      expect((await testExpr(db, ["a", "=", "a"], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["a", "=", "b"], ctx)).exitCode).toBe(1);
    });

    it("should test numeric equality with -eq", async () => {
      expect((await testExpr(db, ["10", "-eq", "10"], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["10", "-ne", "10"], ctx)).exitCode).toBe(1);
    });

    it("should test numeric comparison with -lt, -gt", async () => {
      expect((await testExpr(db, ["5", "-lt", "10"], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["10", "-gt", "5"], ctx)).exitCode).toBe(0);
    });

    it("should test numeric comparison with -le, -ge", async () => {
      expect((await testExpr(db, ["5", "-le", "5"], ctx)).exitCode).toBe(0);
      expect((await testExpr(db, ["10", "-ge", "10"], ctx)).exitCode).toBe(0);
    });
  });

  describe("negation", () => {
    it("should negate expression with !", async () => {
      expect((await testExpr(db, ["!", "a", "=", "b"], ctx)).exitCode).toBe(0);
    });
  });
});
