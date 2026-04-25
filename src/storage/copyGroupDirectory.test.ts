import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn() as any;
const mockWriteFileHandle = jest.fn() as any;

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: mockWriteFileHandle,
}));

const { copyGroupDirectory } = await import("./copyGroupDirectory.js");

describe("copyGroupDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("copies nested files into the target group directory", async () => {
    const copiedFile = new File(["hello"], "photo.png", {
      type: "image/png",
    });

    const sourceAttachmentsDir: any = {
      entries: async function* () {
        yield [
          "photo.png",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const sourceRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return sourceAttachmentsDir;
        }

        throw new Error(`Unexpected source dir: ${name}`);
      }),
    };

    const targetAttachmentsDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const targetRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return targetAttachmentsDir;
        }

        throw new Error(`Unexpected target dir: ${name}`);
      }),
    };

    (mockGetGroupDir as any)
      .mockResolvedValueOnce(sourceRoot)
      .mockResolvedValueOnce(targetRoot);

    await copyGroupDirectory({} as any, "tg:src", "tg:dst", "attachments");

    expect(targetRoot.getDirectoryHandle).toHaveBeenCalledWith("attachments", {
      create: true,
    });
    expect(targetAttachmentsDir.getFileHandle).toHaveBeenCalledWith(
      "photo.png",
      { create: true },
    );
    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
  });
});
