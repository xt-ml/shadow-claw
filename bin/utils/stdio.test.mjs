import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("bin/utils/stdio.mjs", () => {
  let readStdin;
  let readInputOrStdin;
  let writeOutput;
  let tmpDir;

  beforeAll(async () => {
    const mod = await import("./stdio.mjs");
    readStdin = mod.readStdin;
    readInputOrStdin = mod.readInputOrStdin;
    writeOutput = mod.writeOutput;
  });

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-stdio-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("readStdin", () => {
    it("returns null when isTTY is true and not forced", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("some text");
          this.push(null);
        },
      });
      mockStdin.isTTY = true;

      const result = await readStdin({ stdin: mockStdin, force: false });
      expect(result).toBeNull();
    });

    it("reads content from stream when isTTY is false", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("piped text content\n");
          this.push(null);
        },
      });
      mockStdin.isTTY = false;

      const result = await readStdin({ stdin: mockStdin });
      expect(result).toBe("piped text content");
    });

    it("reads content from stream when force is true even if isTTY is true", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("forced stream content");
          this.push(null);
        },
      });
      mockStdin.isTTY = true;

      const result = await readStdin({ stdin: mockStdin, force: true });
      expect(result).toBe("forced stream content");
    });
  });

  describe("readInputOrStdin", () => {
    it("returns explicit argument when stdin is TTY", async () => {
      const mockStdin = new Readable({
        read() {
          this.push(null);
        },
      });
      mockStdin.isTTY = true;

      const result = await readInputOrStdin("my argument", {
        stdin: mockStdin,
      });
      expect(result).toBe("my argument");
    });

    it("reads stdin when argument is '-'", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("from stdin");
          this.push(null);
        },
      });
      mockStdin.isTTY = true;

      const result = await readInputOrStdin("-", { stdin: mockStdin });
      expect(result).toBe("from stdin");
    });

    it("reads stdin when argument is omitted and stdin is piped", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("piped prompt");
          this.push(null);
        },
      });
      mockStdin.isTTY = false;

      const result = await readInputOrStdin("", { stdin: mockStdin });
      expect(result).toBe("piped prompt");
    });

    it("combines argument and stdin when both are provided and stdin is piped", async () => {
      const mockStdin = new Readable({
        read() {
          this.push("document content");
          this.push(null);
        },
      });
      mockStdin.isTTY = false;

      const result = await readInputOrStdin("summarize this:", {
        stdin: mockStdin,
      });
      expect(result).toBe("summarize this:\n\ndocument content");
    });
  });

  describe("writeOutput", () => {
    it("writes to file when output option is specified", async () => {
      const targetFile = path.join(tmpDir, "sub", "output.txt");
      await writeOutput("Hello file output", { output: targetFile });

      const content = await readFile(targetFile, "utf8");
      expect(content).toBe("Hello file output\n");
    });

    it("serializes objects as JSON when writing to file", async () => {
      const targetFile = path.join(tmpDir, "output.json");
      await writeOutput({ success: true, count: 42 }, { output: targetFile });

      const content = await readFile(targetFile, "utf8");
      expect(JSON.parse(content)).toEqual({ success: true, count: 42 });
    });
  });
});
