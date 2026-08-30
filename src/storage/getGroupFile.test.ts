import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: jest.fn(),
}));

const { getGroupFile } = await import("./getGroupFile.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");

describe("getGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves native File object from nested directory structure", async () => {
    const mockFile = new File(["test data"], "report.pdf", {
      type: "application/pdf",
    });
    const fileHandle: any = {
      getFile: (jest.fn() as any).mockResolvedValue(mockFile),
    };
    const subDir: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };
    const rootDir: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(subDir),
    };

    (getGroupDir as any).mockResolvedValue(rootDir);
    (parsePath as any).mockReturnValue({
      dirs: ["docs"],
      filename: "report.pdf",
    });

    const result = await getGroupFile({} as any, "group-1", "docs/report.pdf");

    expect(getGroupDir).toHaveBeenCalledWith({}, "group-1");
    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("docs");
    expect(subDir.getFileHandle).toHaveBeenCalledWith("report.pdf");
    expect(fileHandle.getFile).toHaveBeenCalled();
    expect(result).toBe(mockFile);
  });

  it("retrieves native File from root workspace directory", async () => {
    const mockFile = new File(["hello"], "README.md");
    const fileHandle: any = {
      getFile: (jest.fn() as any).mockResolvedValue(mockFile),
    };
    const rootDir: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    (getGroupDir as any).mockResolvedValue(rootDir);
    (parsePath as any).mockReturnValue({ dirs: [], filename: "README.md" });

    const result = await getGroupFile({} as any, "group-2", "README.md");

    expect(rootDir.getFileHandle).toHaveBeenCalledWith("README.md");
    expect(result).toBe(mockFile);
  });
});
