import { describe, it, expect, jest } from "@jest/globals";
import { resolveFrontmatterToggle } from "./resolveFrontmatterToggle.js";

describe("resolveFrontmatterToggle", () => {
  it("returns true when db is null or invalid transaction function", async () => {
    const result1 = await resolveFrontmatterToggle(null, "some_key");
    expect(result1).toBe(true);

    const result2 = await resolveFrontmatterToggle({} as any, "some_key");
    expect(result2).toBe(true);
  });

  it("returns boolean result based on config value", async () => {
    const mockDb = { transaction: jest.fn() } as any;
    const getConfigFn = jest
      .fn<(db: any, key: string) => Promise<string>>()
      .mockResolvedValue("false");

    const result = await resolveFrontmatterToggle(
      mockDb,
      "test_key",
      getConfigFn as any,
    );
    expect(getConfigFn).toHaveBeenCalledWith(mockDb, "test_key");
    expect(result).toBe(false);
  });

  it("returns true when getConfig throws an error", async () => {
    const mockDb = { transaction: jest.fn() } as any;
    const getConfigFn = jest
      .fn<(db: any, key: string) => Promise<string>>()
      .mockRejectedValue(new Error("DB Error"));

    const result = await resolveFrontmatterToggle(
      mockDb,
      "test_key",
      getConfigFn as any,
    );
    expect(result).toBe(true);
  });
});
