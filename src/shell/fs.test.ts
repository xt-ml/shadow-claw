import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/read-group-file.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/read-group-file-bytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

jest.unstable_mockModule("../storage/write-group-file.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/delete-group-file.js", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/delete-group-directory.js", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../storage/list-group-files.js", () => ({
  listGroupFiles: jest.fn(() => Promise.resolve([])),
}));

jest.unstable_mockModule("../storage/create-group-directory.js", () => ({
  createGroupDirectory: jest.fn(),
}));

const { ShadowClawFileSystem, createFileSystem } = await import("./fs.js");
const { readGroupFileBytes } =
  await import("../storage/read-group-file-bytes.js");
const { writeGroupFile } = await import("../storage/write-group-file.js");
const { deleteGroupFile } = await import("../storage/delete-group-file.js");
const { deleteGroupDirectory } =
  await import("../storage/delete-group-directory.js");
const { createGroupDirectory } =
  await import("../storage/create-group-directory.js");
const { listGroupFiles } = await import("../storage/list-group-files.js");
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

  describe("appendFile", () => {
    it("persists appended content to group storage when inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      await fs.appendFile("/home/user/app.log", "log line\n");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "app.log",
        expect.anything(),
      );
    });

    it("does not persist appended content when outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      await fs.appendFile("/tmp/app.log", "log line\n");

      expect(writeGroupFile).not.toHaveBeenCalled();
    });
  });

  describe("cp", () => {
    it("persists copied file to group storage when destination inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockResolvedValue({ isDirectory: () => false } as any);

      await fs.cp("/tmp/file.txt", "/home/user/copied.txt");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "copied.txt",
        expect.anything(),
      );
      statSpy.mockRestore();
    });

    it("does not persist copied file when destination outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      await fs.cp("/home/user/file.txt", "/tmp/copied.txt");

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

    it("loads file contents when reading created file", async () => {
      (readGroupFileBytes as unknown as jest.Mock).mockResolvedValue(
        Uint8Array.from([1, 2, 3]) as any,
      );

      const listMock = listGroupFiles as unknown as jest.Mock;
      listMock.mockImplementation(async (...args: any[]) => {
        const dir = args[2] as string;
        if (dir === ".") {
          return ["hello.txt"];
        }
        return [];
      });

      const fs = await createFileSystem(db, groupId);
      const fileFn = (fs as any).files["/home/user/hello.txt"];
      expect(typeof fileFn).toBe("function");

      const bytes = await fileFn();
      expect(bytes).toEqual(Uint8Array.from([1, 2, 3]));

      // Fallback on read error
      (readGroupFileBytes as unknown as jest.Mock).mockRejectedValueOnce(
        new Error("File read error"),
      );
      const str = await fileFn();
      expect(str).toBe("");
    });
  });

  describe("rm", () => {
    it("deletes file from storage when inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.rm("/home/user/test.txt");

      expect(deleteGroupFile).toHaveBeenCalledWith(db, groupId, "test.txt");
    });

    it("does not delete file from storage when outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.rm("/tmp/test.txt");

      expect(deleteGroupFile).not.toHaveBeenCalled();
    });

    it("silently catches errors when deleteGroupFile throws", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      (deleteGroupFile as unknown as jest.Mock).mockRejectedValueOnce(
        new Error("Failed to delete"),
      );

      await expect(fs.rm("/home/user/test.txt")).resolves.not.toThrow();
    });
  });

  describe("internal path helpers", () => {
    it("handles non-function stat, root dir joining, and workspace prefix root", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      expect((fs as any)._isDirectoryStat({ isDirectory: true })).toBe(true);
      expect((fs as any)._isDirectoryStat({ isDirectory: false })).toBe(false);
      expect((fs as any)._joinPath("/", "hello.txt")).toBe("/hello.txt");
      expect((fs as any)._toDbPath("/home/user")).toBe("");
    });
  });

  describe("mv edge cases", () => {
    it("deletes source when moving to outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.mv("/home/user/file.pdf", "/tmp/file.pdf");

      expect(deleteGroupFile).toHaveBeenCalledWith(db, groupId, "file.pdf");
      expect(writeGroupFile).not.toHaveBeenCalled();
    });

    it("cleans up source directory via deleteGroupDirectory when moving directory within /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      let moved = false;
      const mvSpy = jest
        .spyOn(InMemoryFs.prototype, "mv")
        .mockImplementation(async () => {
          moved = true;
        });
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockImplementation(async (path: string) => {
          if (!moved && path === "/home/user/dirA") {
            return { isDirectory: () => true } as any;
          }
          if (moved && path === "/home/user/dirB") {
            return { isDirectory: () => true } as any;
          }
          throw new Error(`ENOENT: ${path}`);
        });

      await fs.mv("/home/user/dirA", "/home/user/dirB");

      expect(deleteGroupDirectory).toHaveBeenCalledWith(db, groupId, "dirA");
      expect(deleteGroupFile).not.toHaveBeenCalled();
      statSpy.mockRestore();
      mvSpy.mockRestore();
    });

    it("cleans up source directory via deleteGroupDirectory when moving directory outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockImplementation(async (path: string) => {
          if (path === "/home/user/dirA") {
            return { isDirectory: () => true } as any;
          }
          throw new Error(`ENOENT: ${path}`);
        });

      await fs.mv("/home/user/dirA", "/tmp/dirA");

      expect(deleteGroupDirectory).toHaveBeenCalledWith(db, groupId, "dirA");
      statSpy.mockRestore();
    });
  });

  describe("rm directories", () => {
    it("deletes directory from storage via deleteGroupDirectory when inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});
      const statSpy = jest
        .spyOn(InMemoryFs.prototype, "stat")
        .mockResolvedValue({ isDirectory: () => true } as any);

      await fs.rm("/home/user/empty-dir", { recursive: true });

      expect(deleteGroupDirectory).toHaveBeenCalledWith(
        db,
        groupId,
        "empty-dir",
      );
      expect(deleteGroupFile).not.toHaveBeenCalled();
      statSpy.mockRestore();
    });
  });

  describe("createExclusive", () => {
    it("persists an atomically created empty file inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await (fs as any).createExclusive("/home/user/tmp.abc", { mode: 0o600 });

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "tmp.abc",
        expect.anything(),
      );
    });

    it("persists an atomically created directory inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await (fs as any).createExclusive("/home/user/tmp.dir", {
        mode: 0o700,
        directory: true,
      });

      expect(createGroupDirectory).toHaveBeenCalledWith(db, groupId, "tmp.dir");
    });

    it("does not persist createExclusive targets outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await (fs as any).createExclusive("/tmp/tmp.123", { mode: 0o600 });

      expect(writeGroupFile).not.toHaveBeenCalled();
      expect(createGroupDirectory).not.toHaveBeenCalled();
    });
  });

  describe("link", () => {
    it("persists hard-linked destination file inside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.link("/home/user/source.txt", "/home/user/hardlink.txt");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "hardlink.txt",
        expect.anything(),
      );
    });

    it("does not persist hard-linked destination outside /home/user", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.link("/home/user/source.txt", "/tmp/hardlink.txt");

      expect(writeGroupFile).not.toHaveBeenCalled();
    });
  });

  describe("path normalization", () => {
    it("normalizes trailing slashes, dot segments, and parent segments", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.mkdir("/home/user/sub/");
      expect(createGroupDirectory).toHaveBeenCalledWith(db, groupId, "sub");

      await fs.writeFile("/home/user/./sub/../a.txt", "data");
      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        groupId,
        "a.txt",
        expect.anything(),
      );
    });

    it("does not persist paths escaping /home/user via parent traversal", async () => {
      const fs = new ShadowClawFileSystem(db, groupId, {});

      await fs.writeFile("/home/user/../tmp/escape.txt", "escape");
      expect(writeGroupFile).not.toHaveBeenCalled();
    });
  });
});
