import { jest } from "@jest/globals";

describe("sync.mjs", () => {
  let mockDb;
  let mockPfs;
  let mockOpfsRoot;

  beforeEach(async () => {
    jest.resetModules();

    mockDb = {};

    // Mock LightningFS promises API
    mockPfs = {
      readdir: jest.fn(),
      stat: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
    };

    // OPFS mock handles
    const createMockFileHandle = () => ({
      createWritable: jest.fn().mockResolvedValue({
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      }),
      getFile: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
      kind: "file",
    });

    const createMockDirHandle = () => ({
      getDirectoryHandle: jest
        .fn()
        .mockImplementation(async () => createMockDirHandle()),
      getFileHandle: jest
        .fn()
        .mockImplementation(async () => createMockFileHandle()),
      entries: jest.fn().mockReturnValue([]),
      kind: "directory",
    });

    mockOpfsRoot = createMockDirHandle();

    // Mock dependencies
    jest.unstable_mockModule("../storage/getGroupDir.mjs", () => ({
      getGroupDir: jest.fn().mockResolvedValue(mockOpfsRoot),
    }));

    jest.unstable_mockModule("./git.mjs", () => ({
      initGitFs: jest.fn().mockResolvedValue({ pfs: mockPfs }),
      repoDir: (repo) => `/git/${repo}`,
      ensureDir: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe("syncLfsToOpfs", () => {
    it("copies files from LFS to OPFS and skips .git", async () => {
      const { syncLfsToOpfs } = await import("./sync.mjs");

      // Setup LFS to return some files
      mockPfs.readdir.mockResolvedValueOnce([".git", "README.md"]);
      mockPfs.stat.mockImplementation(async (path) => ({
        isDirectory: () => false,
      }));

      mockPfs.readFile.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

      await syncLfsToOpfs(mockDb, "test-group", "my-repo", "repos/my-repo");

      // Verify readdir was called on the repo path
      expect(mockPfs.readdir).toHaveBeenCalledWith("/git/my-repo");

      // Verify stat was only called for README.md, skipping .git
      expect(mockPfs.stat).toHaveBeenCalledWith("/git/my-repo/README.md");
      expect(mockPfs.stat).not.toHaveBeenCalledWith("/git/my-repo/.git");

      // Verify file was copied to OPFS
      expect(mockPfs.readFile).toHaveBeenCalledWith("/git/my-repo/README.md");
    });
  });

  describe("syncOpfsToLfs", () => {
    it("copies files from OPFS to LFS and skips .git", async () => {
      const { syncOpfsToLfs } = await import("./sync.mjs");

      // We need getDirectoryHandle("repos") -> getDirectoryHandle("my-repo")
      const mockFileHandle = {
        kind: "file",
        getFile: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        }),
      };

      const mockRepoDir = {
        entries: jest.fn().mockReturnValue([
          [".git", { kind: "directory" }],
          ["index.js", { kind: "file" }],
        ]),
        getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
        getDirectoryHandle: jest.fn().mockImplementation(async () => ({
          entries: jest.fn().mockReturnValue([]),
          getFileHandle: jest.fn(),
          getDirectoryHandle: jest.fn(),
        })),
      };

      const mockReposDir = {
        getDirectoryHandle: jest.fn().mockResolvedValue(mockRepoDir),
      };
      mockOpfsRoot.getDirectoryHandle.mockResolvedValue(mockReposDir);

      await syncOpfsToLfs(mockDb, "test-group", "repos/my-repo", "my-repo");

      // Verify it skips .git and writes index.js
      expect(mockPfs.writeFile).toHaveBeenCalledWith(
        "/git/my-repo/index.js",
        expect.any(Uint8Array),
      );

      expect(mockPfs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining(".git"),
        expect.anything(),
      );
    });

    it("reads files through createSyncAccessHandle when available", async () => {
      const { syncOpfsToLfs } = await import("./sync.mjs");

      const syncHandle = {
        getSize: jest.fn(() => 3),
        read: jest.fn((buf) => {
          buf.set([1, 2, 3]);
        }),
        close: jest.fn(),
      };

      const mockFileHandle = {
        kind: "file",
        createSyncAccessHandle: jest.fn().mockResolvedValue(syncHandle),
      };

      const mockRepoDir = {
        entries: jest.fn().mockReturnValue([["bin.dat", { kind: "file" }]]),
        getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
        getDirectoryHandle: jest.fn(),
      };

      const mockReposDir = {
        getDirectoryHandle: jest.fn().mockResolvedValue(mockRepoDir),
      };
      mockOpfsRoot.getDirectoryHandle.mockResolvedValue(mockReposDir);

      await syncOpfsToLfs(mockDb, "test-group", "repos/my-repo", "my-repo");

      expect(mockFileHandle.createSyncAccessHandle).toHaveBeenCalledTimes(1);
      expect(syncHandle.read).toHaveBeenCalledTimes(1);
      expect(syncHandle.close).toHaveBeenCalledTimes(1);
      expect(mockPfs.writeFile).toHaveBeenCalledWith(
        "/git/my-repo/bin.dat",
        expect.any(Uint8Array),
      );
    });
  });
});
