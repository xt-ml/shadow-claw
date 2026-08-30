import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

const { executeWriteFile } = await import("./write-file.js");
const { writeGroupFile } = await import("../../../storage/writeGroupFile.js");

describe("executeWriteFile", () => {
  it("writes file content and returns summary", async () => {
    (writeGroupFile as jest.Mock<any>).mockResolvedValue(undefined);
    const mockDb: any = {};
    const result = await executeWriteFile(
      mockDb,
      { path: "src/main.ts", content: "console.log('hi');" },
      "test-group",
    );

    expect(result).toBe("Written 18 bytes to src/main.ts");
    expect(writeGroupFile).toHaveBeenCalledWith(
      mockDb,
      "test-group",
      "src/main.ts",
      "console.log('hi');",
    );
  });
});
