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

describe("du", () => {
  it("reports size of a single file operand in KB", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("not a dir"));
    safeRead.mockResolvedValueOnce("a".repeat(1024));

    const result = await dispatch(db, "du", ["file.txt"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("1\tfile.txt\n");
  });

  it("recurses directories bottom-up with cumulative sizes", async () => {
    listGroupFiles.mockResolvedValueOnce(["a.txt", "sub/"]);
    safeRead.mockResolvedValueOnce("a".repeat(1024)); // a.txt = 1 KB
    listGroupFiles.mockResolvedValueOnce(["b.txt"]);
    safeRead.mockResolvedValueOnce("b".repeat(1024)); // sub/b.txt = 1 KB

    const result = await dispatch(db, "du", ["."], ctx, "");

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trimEnd().split("\n");

    expect(lines).toHaveLength(2);

    expect(lines[0]).toBe("1\tsub");

    expect(lines[1]).toBe("2\t.");
  });

  it("shows only summary line with -s", async () => {
    listGroupFiles.mockResolvedValueOnce(["a.txt", "sub/"]);
    safeRead.mockResolvedValueOnce("a".repeat(1024));
    listGroupFiles.mockResolvedValueOnce(["b.txt"]);
    safeRead.mockResolvedValueOnce("b".repeat(1024));

    const result = await dispatch(db, "du", ["-s", "."], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("2\t.\n");
  });

  it("uses tab separator between size and path", async () => {
    listGroupFiles.mockResolvedValueOnce([]);

    const result = await dispatch(db, "du", ["."], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toMatch(/^\d+\t\.\n$/u);
  });

  it("reports an error for a missing path", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("not found"));
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "du", ["missing"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toBe("du: missing: No such file or directory");
  });
});
