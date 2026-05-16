import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
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

const { ShadowClawFileSystem } = await import("./fs.js");
const { writeGroupFile } = await import("../storage/writeGroupFile.js");
const { createGroupDirectory } =
  await import("../storage/createGroupDirectory.js");

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
});
