import { jest } from "@jest/globals";
import { fetchAutoRefreshInterval } from "./fetchAutoRefreshInterval.js";
import type { ShadowClawDatabase } from "../../../db/db.js";

describe("fetchAutoRefreshInterval", () => {
  it("returns 0 when database reference is null", async () => {
    expect(await fetchAutoRefreshInterval(null)).toBe(0);
  });

  it("fetches, parses, and bounds interval from database config", async () => {
    const mockDb = {} as ShadowClawDatabase;
    const mockGetConfig = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue("120");

    const result = await fetchAutoRefreshInterval(mockDb, mockGetConfig as any);
    expect(result).toBe(120);
    expect(mockGetConfig).toHaveBeenCalledWith(
      mockDb,
      "pages_auto_refresh_interval",
    );
  });

  it("returns 0 on database read errors", async () => {
    const mockDb = {} as ShadowClawDatabase;
    const mockGetConfig = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error("DB Error"));

    const result = await fetchAutoRefreshInterval(mockDb, mockGetConfig as any);
    expect(result).toBe(0);
  });
});
