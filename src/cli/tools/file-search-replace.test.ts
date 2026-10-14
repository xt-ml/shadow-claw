import { describe, expect, it, jest } from "@jest/globals";

import { fileSearchReplace, readStdin, main } from "./file-search-replace.js";

describe("readStdin", () => {
  it("joins stdin chunks and trims the result", async () => {
    const stdin = (async function* () {
      yield Buffer.from(" replacement ");
      yield Buffer.from("value\n");
    })();

    await expect(readStdin(stdin)).resolves.toBe("replacement value");
  });
});

describe("fileSearchReplace", () => {
  it("replaces all matches with a prepended explicit value", async () => {
    const readFileImpl = jest.fn<any>().mockResolvedValue("a cat and a cat");
    const writeFileImpl = jest.fn<any>().mockResolvedValue(undefined);

    await fileSearchReplace(["cat", "notes.txt", "> ", "dog"], {
      readFileImpl,
      writeFileImpl,
      logImpl: jest.fn(),
    });

    expect(writeFileImpl).toHaveBeenCalledWith(
      "notes.txt",
      "a > dog and a > dog",
      "utf8",
    );
  });

  it("reads the replacement from stdin when omitted", async () => {
    const readFileImpl = jest.fn<any>().mockResolvedValue("hello world");
    const writeFileImpl = jest.fn<any>().mockResolvedValue(undefined);
    const stdin = (async function* () {
      yield Buffer.from("universe\n");
    })();

    await fileSearchReplace(["world", "greeting.txt"], {
      readFileImpl,
      writeFileImpl,
      stdin,
      logImpl: jest.fn(),
    });

    expect(writeFileImpl).toHaveBeenCalledWith(
      "greeting.txt",
      "hello universe",
      "utf8",
    );
  });

  it("rejects invalid arguments before reading a file", async () => {
    const readFileImpl = jest.fn<any>();

    await expect(
      fileSearchReplace(["only-pattern"], { readFileImpl }),
    ).rejects.toThrow("at least a search pattern and file path");
    expect(readFileImpl).not.toHaveBeenCalled();
  });

  it("propagates invalid regular expressions", async () => {
    const readFileImpl = jest.fn<any>();

    await expect(
      fileSearchReplace(["[", "notes.txt"], { readFileImpl }),
    ).rejects.toThrow(SyntaxError);
    expect(readFileImpl).not.toHaveBeenCalled();
  });

  it("joins string chunks in readStdin", async () => {
    const stdin = (async function* () {
      yield "  non-buffer ";
      yield "chunk \n";
    })();

    await expect(readStdin(stdin)).resolves.toBe("non-buffer chunk");
  });

  it("main() replaces content when valid arguments are passed", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fsr-test-"));
    const tempFile = path.join(tempDir, "replace-target.txt");
    await fs.writeFile(tempFile, "apple and orange and apple", "utf8");

    const origLength = process.argv.length;
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      process.argv.push("apple", tempFile, "", "banana");
      await main();
      const updated = await fs.readFile(tempFile, "utf8");
      expect(updated).toBe("banana and orange and banana");
    } finally {
      process.argv.length = origLength;
      logSpy.mockRestore();
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
