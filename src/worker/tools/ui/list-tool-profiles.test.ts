import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

const { executeListToolProfiles } = await import("./list-tool-profiles.js");
const { getConfig } = await import("../../../db/getConfig.js");

describe("executeListToolProfiles", () => {
  const mockDb: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists default profile when no custom profiles in DB", async () => {
    (getConfig as jest.Mock<any>).mockResolvedValue(null);

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: __builtin_default]");
    expect(result).toContain("Tools:");
  });

  it("includes custom profiles when stored in DB as JSON string or array", async () => {
    const customProfiles = [
      {
        id: "coding",
        name: "Coding Profile",
        enabledToolNames: ["bash", "read_file", "write_file"],
      },
    ];
    (getConfig as jest.Mock<any>).mockResolvedValue(
      JSON.stringify(customProfiles),
    );

    const result = await executeListToolProfiles(mockDb);
    expect(result).toContain("[Profile ID: __builtin_default]");
    expect(result).toContain("[Profile ID: coding] Coding Profile");
    expect(result).toContain("Tools: bash, read_file, write_file");
  });
});
