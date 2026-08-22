import { describe, expect, it, jest } from "@jest/globals";

import { fileSearchReplace, readStdin } from "./file-search-replace.mjs";

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
    const readFileImpl = jest.fn().mockResolvedValue("a cat and a cat");
    const writeFileImpl = jest.fn().mockResolvedValue(undefined);

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
    const readFileImpl = jest.fn().mockResolvedValue("hello world");
    const writeFileImpl = jest.fn().mockResolvedValue(undefined);
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
    const readFileImpl = jest.fn();

    await expect(
      fileSearchReplace(["only-pattern"], { readFileImpl }),
    ).rejects.toThrow("at least a search pattern and file path");
    expect(readFileImpl).not.toHaveBeenCalled();
  });

  it("propagates invalid regular expressions", async () => {
    const readFileImpl = jest.fn();

    await expect(
      fileSearchReplace(["[", "notes.txt"], { readFileImpl }),
    ).rejects.toThrow(SyntaxError);
    expect(readFileImpl).not.toHaveBeenCalled();
  });
});
