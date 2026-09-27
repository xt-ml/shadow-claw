import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ShadowClawDatabase } from "../../../db/types.js";

const mockGetConfig = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

const { executeListToolProfiles } = await import("./list-tool-profiles.js");

describe("executeListToolProfiles", () => {
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists default profile when no custom profiles in DB", async () => {
    mockGetConfig.mockResolvedValue(null);

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: __builtin_default]");
    expect(result).toContain("Tools:");
  });

  it("includes custom profiles when stored in DB as JSON string", async () => {
    const customProfiles = [
      {
        id: "coding",
        name: "Coding Profile",
        enabledToolNames: ["bash", "read_file", "write_file"],
      },
    ];
    mockGetConfig.mockResolvedValue(JSON.stringify(customProfiles));

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: __builtin_default]");
    expect(result).toContain("[Profile ID: coding] Coding Profile");
    expect(result).toContain("Tools: bash, read_file, write_file");
  });

  it("handles custom profiles when stored directly as an array in DB", async () => {
    const customProfiles = [
      {
        id: "research",
        name: "Research Profile",
        enabledToolNames: ["web_search"],
      },
    ];
    mockGetConfig.mockResolvedValue(customProfiles);

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: research] Research Profile");
    expect(result).toContain("Tools: web_search");
  });

  it("handles corrupted JSON gracefully", async () => {
    mockGetConfig.mockResolvedValue("{ not valid json");

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: __builtin_default]");
  });
});
