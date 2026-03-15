import { jest } from "@jest/globals";
import { createCtx, createDb, loadDispatchHarness } from "./testHarness.mjs";

let dispatch;
let safeRead;
let listGroupFiles;
let writeGroupFile;
let deleteGroupFile;
let deleteGroupDirectory;
let db;
let ctx;

beforeEach(async () => {
  ({
    dispatch,
    safeRead,
    listGroupFiles,
    writeGroupFile,
    deleteGroupFile,
    deleteGroupDirectory,
  } = await loadDispatchHarness());
  db = createDb();
  ctx = createCtx();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("ls", () => {
  it("no argument", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "dir1",
      "dir2",
      "file1.txt",
      "file2.txt",
      ".hfile1",
    ]);

    const result = await dispatch(db, "ls", [], ctx, "");

    expect(result.stdout).toBe("dir1  dir2  file1.txt  file2.txt\n");
  });

  it("-C column spacing equals 2", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "dir1",
      "dir2",
      "file1.txt",
      "file2.txt",
    ]);

    const result = await dispatch(db, "ls", ["-C"], ctx, "");

    expect(result.stdout).toBe("dir1  dir2  file1.txt  file2.txt\n");
  });

  it("-x column spacing equals 2", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "dir1",
      "dir2",
      "file1.txt",
      "file2.txt",
    ]);

    const result = await dispatch(db, "ls", ["-x"], ctx, "");

    expect(result.stdout).toBe("dir1  dir2  file1.txt  file2.txt\n");
  });

  it("explicit files", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "dir1",
      "dir2",
      "file1.txt",
      "file2.txt",
      ".hfile1",
    ]);

    const result = await dispatch(db, "ls", ["file*"], ctx, "");

    expect(result.stdout).toBe("file1.txt\nfile2.txt\n");
  });

  it("explicit -1", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "dir1",
      "dir2",
      "file1.txt",
      "file2.txt",
      ".hfile1",
    ]);

    const result = await dispatch(db, "ls", ["-1", "file*"], ctx, "");

    expect(result.stdout).toBe("file1.txt\nfile2.txt\n");
  });

  it("should list files", async () => {
    listGroupFiles.mockResolvedValueOnce([
      "file1.txt",
      "file2.txt",
      ".dotfile",
    ]);

    const result = await dispatch(db, "ls", [], ctx, "");

    expect(result.stdout).toBe("file1.txt  file2.txt\n");
  });

  it("should list all files with -a", async () => {
    listGroupFiles.mockResolvedValueOnce(["file1.txt", ".dotfile"]);

    const result = await dispatch(db, "ls", ["-a"], ctx, "");

    expect(result.stdout).toBe("file1.txt  .dotfile\n");
  });

  it("should use one entry per line with -1", async () => {
    listGroupFiles.mockResolvedValueOnce(["file1.txt", "file2.txt"]);

    const result = await dispatch(db, "ls", ["-1"], ctx, "");

    expect(result.stdout).toBe("file1.txt\nfile2.txt\n");
  });

  it("should fail when the directory cannot be listed", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("missing"));

    const result = await dispatch(db, "ls", ["missing"], ctx, "");

    expect(result.stderr).toBe(
      "ls: cannot access 'missing': No such directory",
    );

    expect(result.exitCode).toBe(1);
  });
});
