import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

const { executeUpdateMemory } = await import("./update-memory.js");
const { writeGroupFile } = await import("../../../storage/writeGroupFile.js");

describe("executeUpdateMemory", () => {
  it("writes memory content to MEMORY.md and returns confirmation", async () => {
    (writeGroupFile as jest.Mock<any>).mockResolvedValue(undefined);
    const mockDb: any = {};

    const result = await executeUpdateMemory(
      mockDb,
      { content: "# User Preferences\n- Prefers dark mode" },
      "test-group",
    );

    expect(result).toBe("Memory updated successfully.");
    expect(writeGroupFile).toHaveBeenCalledWith(
      mockDb,
      "test-group",
      "MEMORY.md",
      "# User Preferences\n- Prefers dark mode",
    );
  });
});
