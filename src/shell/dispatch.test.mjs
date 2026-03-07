import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../storage/deleteGroupDirectory.mjs", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../storage/deleteGroupFile.mjs", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/listGroupFiles.mjs", () => ({
  listGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../storage/writeGroupFile.mjs", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("./safeRead.mjs", () => ({ safeRead: jest.fn() }));

import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.crypto = {
  subtle: {
    digest: jest.fn().mockImplementation(async (algo, data) => {
      return new Uint8Array(algo === "SHA-256" ? 32 : 20).buffer;
    }),
  },
};

describe("dispatch.mjs", () => {
  let dispatch;
  let deleteGroupDirectory;
  let deleteGroupFile;
  let listGroupFiles;
  let safeRead;
  let writeGroupFile;

  beforeEach(async () => {
    jest.resetModules();

    safeRead = (await import("./safeRead.mjs")).safeRead;
    listGroupFiles = (await import("../storage/listGroupFiles.mjs"))
      .listGroupFiles;

    writeGroupFile = (await import("../storage/writeGroupFile.mjs"))
      .writeGroupFile;

    deleteGroupFile = (await import("../storage/deleteGroupFile.mjs"))
      .deleteGroupFile;

    deleteGroupDirectory = (await import("../storage/deleteGroupDirectory.mjs"))
      .deleteGroupDirectory;

    dispatch = (await import("./dispatch.mjs")).dispatch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const db = {};
  const ctx = {
    groupId: "test-group",
    cwd: ".",
    env: { PWD: "/workspace" },
  };

  describe("echo", () => {
    it("should echo arguments", async () => {
      const result = await dispatch(db, "echo", ["hello", "world"], ctx, "");
      expect(result.stdout).toBe("hello world\n");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("printf", () => {
    it("should format strings", async () => {
      const result = await dispatch(
        db,
        "printf",
        ["hello %s", "world"],
        ctx,
        "",
      );

      expect(result.stdout).toBe("hello world");
    });

    it("should handle no arguments", async () => {
      const result = await dispatch(db, "printf", [], ctx, "");
      expect(result.stdout).toBe("");
    });
  });

  describe("cat", () => {
    it("should read from stdin if no args", async () => {
      const result = await dispatch(db, "cat", [], ctx, "input data");
      expect(result.stdout).toBe("input data");
    });

    it("should read files", async () => {
      safeRead.mockResolvedValueOnce("file content");

      const result = await dispatch(db, "cat", ["file.txt"], ctx, "");
      expect(result.stdout).toBe("file content");
      expect(safeRead).toHaveBeenCalled();
    });

    it("should return error if file not found", async () => {
      safeRead.mockResolvedValueOnce(null);

      const result = await dispatch(db, "cat", ["missing.txt"], ctx, "");
      expect(result.stderr).toContain("No such file");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("head", () => {
    it("should return first 10 lines by default", async () => {
      const input = Array(15)
        .fill(0)
        .map((_, i) => `line ${i + 1}`)
        .join("\n");

      const result = await dispatch(db, "head", [], ctx, input);
      const lines = result.stdout.trim().split("\n");
      expect(lines.length).toBe(10);
      expect(lines[0]).toBe("line 1");
      expect(lines[9]).toBe("line 10");
    });

    it("should respect -n flag", async () => {
      const input = "1\n2\n3\n4\n5";
      const result = await dispatch(db, "head", ["-n", "3"], ctx, input);
      expect(result.stdout).toBe("1\n2\n3\n");
    });
  });

  describe("tail", () => {
    it("should return last 10 lines by default", async () => {
      const input = Array(15)
        .fill(0)
        .map((_, i) => `line ${i + 1}`)
        .join("\n");

      const result = await dispatch(db, "tail", [], ctx, input);
      const lines = result.stdout.trim().split("\n");
      expect(lines.length).toBe(10);
      expect(lines[0]).toBe("line 6");
      expect(lines[9]).toBe("line 15");
    });

    it("should respect -n flag", async () => {
      const input = "1\n2\n3\n4\n5";
      const result = await dispatch(db, "tail", ["-n", "3"], ctx, input);
      expect(result.stdout).toBe("3\n4\n5");
    });
  });

  describe("ls", () => {
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
  });

  describe("mkdir", () => {
    it("should create a .keep file in the new directory", async () => {
      await dispatch(db, "mkdir", ["newdir"], ctx, "");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "newdir/.keep",
        "",
      );
    });
  });

  describe("touch", () => {
    it("should create an empty file if it does not exist", async () => {
      safeRead.mockResolvedValueOnce(null);

      await dispatch(db, "touch", ["newfile.txt"], ctx, "");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "newfile.txt",
        "",
      );
    });

    it("should not overwrite if file exists", async () => {
      safeRead.mockResolvedValueOnce("existing content");

      await dispatch(db, "touch", ["existing.txt"], ctx, "");

      expect(writeGroupFile).not.toHaveBeenCalled();
    });
  });

  describe("cp", () => {
    it("should copy file content", async () => {
      safeRead.mockResolvedValueOnce("content");

      await dispatch(db, "cp", ["src.txt", "dst.txt"], ctx, "");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "dst.txt",
        "content",
      );
    });

    it("should fail if source does not exist", async () => {
      safeRead.mockResolvedValueOnce(null);

      const result = await dispatch(db, "cp", ["src.txt", "dst.txt"], ctx, "");

      expect(result.stderr).toContain("No such file");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("mv", () => {
    it("should move file (copy then delete)", async () => {
      safeRead.mockResolvedValueOnce("content");

      await dispatch(db, "mv", ["src.txt", "dst.txt"], ctx, "");

      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "dst.txt",
        "content",
      );

      expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "src.txt");
    });
  });

  describe("rm", () => {
    it("should delete a file", async () => {
      await dispatch(db, "rm", ["file.txt"], ctx, "");

      expect(deleteGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "file.txt",
      );
    });

    it("should delete a directory with -r", async () => {
      await dispatch(db, "rm", ["-r", "subdir"], ctx, "");

      expect(deleteGroupDirectory).toHaveBeenCalledWith(
        db,
        "test-group",
        "subdir",
      );
    });

    it("should not fail with -f if file missing", async () => {
      deleteGroupFile.mockRejectedValueOnce(new Error("missing"));

      const result = await dispatch(db, "rm", ["-f", "missing.txt"], ctx, "");
      expect(result.exitCode).toBe(0);
    });

    it("should call deleteGroupFile for simple rm", async () => {
      const ctx = { env: {}, groupId: "test-group", cwd: "." };
      const db = {};

      await dispatch(db, "rm", ["file.txt"], ctx, "");

      expect(deleteGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "file.txt",
      );
      expect(deleteGroupDirectory).not.toHaveBeenCalled();
    });

    it("should call deleteGroupDirectory for rm -r", async () => {
      const ctx = { env: {}, groupId: "test-group", cwd: "." };
      const db = {};

      await dispatch(db, "rm", ["-r", "my_dir"], ctx, "");

      expect(deleteGroupDirectory).toHaveBeenCalledWith(
        db,
        "test-group",
        "my_dir",
      );

      expect(deleteGroupFile).not.toHaveBeenCalled();
    });

    it("should call deleteGroupDirectory for rm -rf", async () => {
      const ctx = { env: {}, groupId: "test-group", cwd: "." };
      const db = {};

      await dispatch(db, "rm", ["-rf", "my_dir"], ctx, "");

      expect(deleteGroupDirectory).toHaveBeenCalledWith(
        db,
        "test-group",
        "my_dir",
      );
    });

    it("should not fail if -f is provided and deletion throws", async () => {
      const ctx = { env: {}, groupId: "test-group", cwd: "." };
      const db = {};

      deleteGroupFile.mockRejectedValue(new Error("File not found"));

      const result = await dispatch(db, "rm", ["-f", "missing.txt"], ctx, "");

      expect(result.exitCode).toBe(0);
    });
  });

  describe("date", () => {
    it("should return an ISO date string", async () => {
      const result = await dispatch(db, "date", [], ctx, "");
      expect(new Date(result.stdout.trim()).toISOString()).toEqual(
        result.stdout.trim(),
      );
    });
  });

  describe("env", () => {
    it("should list environment variables", async () => {
      const result = await dispatch(db, "env", [], ctx, "");
      expect(result.stdout).toContain("PWD=/workspace");
    });
  });

  describe("export", () => {
    it("should set environment variables", async () => {
      const myCtx = { ...ctx, env: { ...ctx.env } };

      await dispatch(db, "export", ["FOO=bar"], myCtx, "");

      expect(myCtx.env.FOO).toBe("bar");
    });
  });

  describe("sleep", () => {
    it("should wait (mocked timer)", async () => {
      jest.useFakeTimers();

      const promise = dispatch(db, "sleep", ["0.1"], ctx, "");
      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result.exitCode).toBe(0);

      jest.useRealTimers();
    });
  });

  describe("seq", () => {
    it("should generate sequence with end", async () => {
      const result = await dispatch(db, "seq", ["3"], ctx, "");
      expect(result.stdout).toBe("1\n2\n3\n");
    });

    it("should generate sequence with start and end", async () => {
      const result = await dispatch(db, "seq", ["2", "4"], ctx, "");
      expect(result.stdout).toBe("2\n3\n4\n");
    });

    it("should generate sequence with step", async () => {
      const result = await dispatch(db, "seq", ["1", "2", "5"], ctx, "");
      expect(result.stdout).toBe("1\n3\n5\n");
    });
  });

  describe("wc", () => {
    it("should count lines, words, chars", async () => {
      const result = await dispatch(
        db,
        "wc",
        [],
        ctx,
        "hello world\nnext line",
      );

      expect(result.stdout).toBe("2 4 21\n");
    });

    it("should handle trailing newline in wc", async () => {
      const result = await dispatch(db, "wc", [], ctx, "hello world\n");

      expect(result.stdout).toBe("1 2 12\n");
    });
  });

  describe("grep", () => {
    it("should filter lines", async () => {
      const result = await dispatch(
        db,
        "grep",
        ["hello"],
        ctx,
        "hello\nworld\nhello again",
      );

      expect(result.stdout).toBe("hello\nhello again\n");
    });

    it("should exit 1 if no matches", async () => {
      const result = await dispatch(
        db,
        "grep",
        ["missing"],
        ctx,
        "hello\nworld",
      );

      expect(result.exitCode).toBe(1);
    });
  });

  describe("sort", () => {
    it("should sort lines alphabetically", async () => {
      const result = await dispatch(db, "sort", [], ctx, "c\na\nb");
      expect(result.stdout).toBe("a\nb\nc\n");
    });

    it("should sort numerically with -n", async () => {
      const result = await dispatch(db, "sort", ["-n"], ctx, "10\n2\n1");
      expect(result.stdout).toBe("1\n2\n10\n");
    });

    it("should reverse order with -r", async () => {
      const result = await dispatch(db, "sort", ["-r"], ctx, "a\nb\nc");
      expect(result.stdout).toBe("c\nb\na\n");
    });

    it("should unique with -u", async () => {
      const result = await dispatch(db, "sort", ["-u"], ctx, "a\na\nb");
      expect(result.stdout).toBe("a\nb\n");
    });
  });

  describe("uniq", () => {
    it("should remove consecutive duplicates", async () => {
      const result = await dispatch(db, "uniq", [], ctx, "a\na\nb\na");
      expect(result.stdout).toBe("a\nb\na");
    });
  });

  describe("tr", () => {
    it("should delete characters with -d", async () => {
      const result = await dispatch(
        db,
        "tr",
        ["-d", "aeiou"],
        ctx,
        "hello world",
      );

      expect(result.stdout).toBe("hll wrld");
    });

    it("should translate characters", async () => {
      const result = await dispatch(db, "tr", ["abc", "ABC"], ctx, "aabbcc");
      expect(result.stdout).toBe("AABBCC");
    });
  });

  describe("cut", () => {
    it("should cut fields with default delimiter (tab)", async () => {
      const input = "a\tb\tc\n1\t2\t3";
      const result = await dispatch(db, "cut", ["-f", "2"], ctx, input);
      expect(result.stdout).toBe("b\n2");
    });

    it("should respect delimiter flag -d", async () => {
      const input = "a,b,c\n1,2,3";
      const result = await dispatch(
        db,
        "cut",
        ["-d", ",", "-f", "1,3"],
        ctx,
        input,
      );

      expect(result.stdout).toBe("a,c\n1,3");
    });
  });

  describe("sed", () => {
    it("should substitute text", async () => {
      const result = await dispatch(
        db,
        "sed",
        ["s/foo/bar/"],
        ctx,
        "foo items",
      );

      expect(result.stdout).toBe("bar items");
    });

    it("should handle global substitution", async () => {
      const result = await dispatch(db, "sed", ["s/foo/bar/g"], ctx, "foo foo");
      expect(result.stdout).toBe("bar bar");
    });
  });

  describe("awk", () => {
    it("should print fields", async () => {
      const result = await dispatch(
        db,
        "awk",
        ["{print $2}"],
        ctx,
        "first second third",
      );

      expect(result.stdout).toBe("second\n");
    });
  });

  describe("base64", () => {
    it("should encode base64", async () => {
      const result = await dispatch(db, "base64", [], ctx, "hello");
      expect(result.stdout).toBe(btoa("hello") + "\n");
    });

    it("should decode base64", async () => {
      const result = await dispatch(db, "base64", ["-d"], ctx, btoa("hello"));
      expect(result.stdout).toBe("hello");
    });
  });

  describe("jq", () => {
    it("should filter json with .", async () => {
      const result = await dispatch(db, "jq", ["."], ctx, '{"a":1}');
      expect(JSON.parse(result.stdout)).toEqual({ a: 1 });
    });

    it("should filter json field", async () => {
      const result = await dispatch(db, "jq", [".a"], ctx, '{"a":1}');
      expect(JSON.parse(result.stdout)).toBe(1);
    });

    it("should handle keys", async () => {
      const result = await dispatch(db, "jq", [".keys"], ctx, '{"a":1, "b":2}');
      expect(JSON.parse(result.stdout)).toEqual(["a", "b"]);
    });
  });

  describe("tee", () => {
    it("should write to file and stdout", async () => {
      const result = await dispatch(db, "tee", ["out.txt"], ctx, "hello");
      expect(result.stdout).toBe("hello");
      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "test-group",
        "out.txt",
        "hello",
      );
    });
  });

  describe("xargs", () => {
    it("should run command with arguments from stdin", async () => {
      // runSingle is used, which we might need to mock if it's not working in tests
      // For now let's see if we can just test the dispatch call
      const result = await dispatch(db, "xargs", ["echo"], ctx, "a\nb\nc");
      expect(result.stdout).toBe("a b c\n");
    });
  });

  describe("rev", () => {
    it("should reverse lines", async () => {
      const result = await dispatch(db, "rev", [], ctx, "abc\ndef");
      expect(result.stdout).toBe("cba\nfed");
    });
  });

  describe("basename", () => {
    it("should return basename", async () => {
      const result = await dispatch(
        db,
        "basename",
        ["/foo/bar/baz.txt"],
        ctx,
        "",
      );

      expect(result.stdout).toBe("baz.txt\n");
    });

    it("should remove suffix", async () => {
      const result = await dispatch(
        db,
        "basename",
        ["/foo/bar/baz.txt", ".txt"],
        ctx,
        "",
      );

      expect(result.stdout).toBe("baz\n");
    });
  });

  describe("dirname", () => {
    it("should return dirname", async () => {
      const result = await dispatch(
        db,
        "dirname",
        ["/foo/bar/baz.txt"],
        ctx,
        "",
      );

      expect(result.stdout).toBe("/foo/bar\n");
    });

    it("should return . for relative file", async () => {
      const result = await dispatch(db, "dirname", ["file.txt"], ctx, "");
      expect(result.stdout).toBe(".\n");
    });
  });
});

// describe("dispatch.mjs - rm command", () => {
//   let dispatch;
//   let deleteGroupFile;
//   let deleteGroupDirectory;

//   beforeEach(async () => {
//     jest.resetModules();

//     const deleteGroupFileModule =
//       await import("../storage/deleteGroupFile.mjs");

//     deleteGroupFile = deleteGroupFileModule.deleteGroupFile;

//     const deleteGroupDirectoryModule =
//       await import("../storage/deleteGroupDirectory.mjs");

//     deleteGroupDirectory = deleteGroupDirectoryModule.deleteGroupDirectory;

//     const dispatchModule = await import("./dispatch.mjs");

//     dispatch = dispatchModule.dispatch;
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   it("should call deleteGroupFile for simple rm", async () => {
//     const ctx = { env: {}, groupId: "test-group", cwd: "." };
//     const db = {};

//     await dispatch(db, "rm", ["file.txt"], ctx, "");

//     expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "file.txt");
//     expect(deleteGroupDirectory).not.toHaveBeenCalled();
//   });

//   it("should call deleteGroupDirectory for rm -r", async () => {
//     const ctx = { env: {}, groupId: "test-group", cwd: "." };
//     const db = {};

//     await dispatch(db, "rm", ["-r", "my_dir"], ctx, "");

//     expect(deleteGroupDirectory).toHaveBeenCalledWith(
//       db,
//       "test-group",
//       "my_dir",
//     );

//     expect(deleteGroupFile).not.toHaveBeenCalled();
//   });

//   it("should call deleteGroupDirectory for rm -rf", async () => {
//     const ctx = { env: {}, groupId: "test-group", cwd: "." };
//     const db = {};

//     await dispatch(db, "rm", ["-rf", "my_dir"], ctx, "");

//     expect(deleteGroupDirectory).toHaveBeenCalledWith(
//       db,
//       "test-group",
//       "my_dir",
//     );
//   });

//   it("should not fail if -f is provided and deletion throws", async () => {
//     const ctx = { env: {}, groupId: "test-group", cwd: "." };
//     const db = {};

//     deleteGroupFile.mockRejectedValue(new Error("File not found"));

//     const result = await dispatch(db, "rm", ["-f", "missing.txt"], ctx, "");

//     expect(result.exitCode).toBe(0);
//   });
// });
