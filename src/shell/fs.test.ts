import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

jest.unstable_mockModule("../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/deleteGroupFile.js", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/listGroupFiles.js", () => ({
  listGroupFiles: jest.fn(() => Promise.resolve([])),
}));

jest.unstable_mockModule("../storage/createGroupDirectory.js", () => ({
  createGroupDirectory: jest.fn(),
}));

const { ShadowClawFileSystem, createFileSystem } = await import("./fs.js");
const { writeGroupFile } = await import("../storage/writeGroupFile.js");
const { deleteGroupFile } = await import("../storage/deleteGroupFile.js");
const { createGroupDirectory } =
  await import("../storage/createGroupDirectory.js");
const { listGroupFiles } = await import("../storage/listGroupFiles.js");
const { InMemoryFs } = await import("just-bash");

describe("ShadowClawFileSystem", () => {
  const db: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("mkdir", () => {
    it("persists a new directory to group storage when inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.mkdir("/home/user/it works");

      expect(createGroupDirectory).toHaveBeenCalledWith(
        db,
        groupId,
        "it works",
      );
    });

    it("persists nested directories to group storage", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.mkdir("/home/user/parent/child", { recursive: true });

      expect(createGroupDirectory).toHaveBeenCalledWith(
        db,
        groupId,
        "parent/child",
      );
    });

    it("does not persist directories outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.mkdir("/tmp/scratch");

      expect(createGroupDirectory).not.toHaveBeenCalled();
    });
  });

  describe("writeFile", () => {
    it("persists file content to group storage when inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.writeFile("/home/user/hello.txt", "hello");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "hello.txt",
        expect.anything(),
      );
    });

    it("does not persist files outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.writeFile("/tmp/scratch.txt", "data");

      expect(writeGroupFile).not.toHaveBeenCalled();
    });
  });

  describe("mv", () => {
    it("persists moved file under destination directory path", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockImplementation(async (path: string) => {
          if (path === "/home/user/test") {
            return { isDirectory: () => true } as any;
          }

          return { isDirectory: () => false } as any;
        });
      const readSpy = jest
        .spyOn(InMemoryFs.prototype, "readFile")
        .mockResolvedValue("pdf-data" as any);

      await fs.mv("/home/user/file.pdf", "/home/user/test");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "test/file.pdf",
        expect.anything(),
      );
      expect(deleteGroupFile).toHaveBeenCalledWith(db, groupId, "file.pdf");

      statSpy.mockRestore();
      readSpy.mockRestore();
    });

    it("does not delete source when destination persistence fails", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockResolvedValue({ isDirectory: () => false } as any);
      const readBufferSpy = jest
        .spyOn(InMemoryFs.prototype, "readFileBuffer")
        .mockRejectedValue(new Error("bytes read failed"));
      const readSpy = jest
        .spyOn(InMemoryFs.prototype, "readFile")
        .mockRejectedValue(new Error("read failed"));

      await fs.mv("/home/user/file.pdf", "/home/user/test/file.pdf");

      expect(deleteGroupFile).not.toHaveBeenCalled();

      statSpy.mockRestore();
      readBufferSpy.mockRestore();
      readSpy.mockRestore();
    });

    it("preserves binary bytes when moving files", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockResolvedValue({ isDirectory: () => false } as any);
      const readBufferSpy = jest
        .spyOn(InMemoryFs.prototype, "readFileBuffer")
        .mockResolvedValue(Uint8Array.from([0x78, 0xef, 0x00, 0xff]) as any);

      await fs.mv("/home/user/file.pdf", "/home/user/test/file.pdf");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "test/file.pdf",
        expect.any(Uint8Array),
      );

      statSpy.mockRestore();
      readBufferSpy.mockRestore();
    });
  });

  describe("createFileSystem", () => {
    it("materializes empty directories from storage into shell fs", async () => {
      const listMock = listGroupFiles as unknown as jest.Mock;
      listMock.mockImplementation(async (...args: any[]) => {
        const dir = args[2] as string;
        if (dir === ".") {
          return ["test/", "file.bin"];
        }

        return [];
      });

      const mkdirSyncSpy = jest
        .spyOn(InMemoryFs.prototype as any, "mkdirSync")
        .mockImplementation(() => {});

      await createFileSystem(db, groupId);

      expect(mkdirSyncSpy).toHaveBeenCalledWith("/home/user/test", {
        recursive: true,
      });

      mkdirSyncSpy.mockRestore();
    });
  });
});
