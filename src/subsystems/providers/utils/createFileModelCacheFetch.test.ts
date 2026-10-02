/** @jest-environment node */
import { jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFileModelCacheFetch,
  parseModelFileUrl,
} from "./createFileModelCacheFetch.js";

describe("createFileModelCacheFetch", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "model-cache-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("parseModelFileUrl", () => {
    it("parses standard Hugging Face resolve URLs", () => {
      const url =
        "https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX/resolve/main/tokenizer.json";
      const result = parseModelFileUrl(url);
      expect(result).toEqual({
        repoId: "onnx-community/gemma-4-E4B-it-ONNX",
        revision: "main",
        filePath: "tokenizer.json",
      });
    });

    it("parses subfolder and raw URLs", () => {
      const url =
        "https://hf-mirror.com/onnx-community/gemma-4-E4B-it-ONNX/raw/main/onnx/model_q4f16.onnx";
      const result = parseModelFileUrl(url);
      expect(result).toEqual({
        repoId: "onnx-community/gemma-4-E4B-it-ONNX",
        revision: "main",
        filePath: "onnx/model_q4f16.onnx",
      });
    });

    it("returns null for non-model URLs", () => {
      expect(
        parseModelFileUrl("https://huggingface.co/api/models/test"),
      ).toBeNull();
      expect(parseModelFileUrl("invalid-url")).toBeNull();
    });
  });

  describe("fileModelCacheFetch execution", () => {
    it("bypasses non-GET and explicit Range requests to nativeFetch", async () => {
      const mockNativeFetch = jest.fn(async () => new Response("ok"));
      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      // POST method bypass
      await fetchFn("https://huggingface.co/foo/bar/resolve/main/config.json", {
        method: "POST",
      });
      expect(mockNativeFetch).toHaveBeenCalledTimes(1);

      // Explicit Range header bypass
      await fetchFn("https://huggingface.co/foo/bar/resolve/main/config.json", {
        headers: { Range: "bytes=0-0" },
      });
      expect(mockNativeFetch).toHaveBeenCalledTimes(2);
    });

    it("downloads fresh file to .part and renames to target upon completion", async () => {
      const fileData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockNativeFetch = jest.fn(
        async () =>
          new Response(fileData, {
            status: 200,
            headers: { "Content-Length": "5" },
          }),
      );

      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      const url =
        "https://huggingface.co/onnx-community/test-model/resolve/main/tokenizer.json";
      const response = await fetchFn(url);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Length")).toBe("5");

      const body = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(body)).toEqual([1, 2, 3, 4, 5]);

      const targetPath = path.join(
        tempDir,
        "onnx-community/test-model/tokenizer.json",
      );
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.existsSync(`${targetPath}.part`)).toBe(false);
      expect(fs.readFileSync(targetPath)).toEqual(Buffer.from([1, 2, 3, 4, 5]));
    });

    it("resumes partial download using Range request when .part exists", async () => {
      const targetPath = path.join(
        tempDir,
        "onnx-community/test-model/tokenizer.json",
      );
      const partPath = `${targetPath}.part`;
      fs.mkdirSync(path.dirname(partPath), { recursive: true });

      // Simulate partial download interrupted after 3 bytes
      fs.writeFileSync(partPath, Buffer.from([10, 20, 30]));

      let passedHeaders: any = null;
      const mockNativeFetch = jest.fn(async (_url: any, init: any) => {
        passedHeaders = init?.headers;
        // Remaining 2 bytes from offset 3
        return new Response(new Uint8Array([40, 50]), {
          status: 206,
          headers: {
            "Content-Range": "bytes 3-4/5",
            "Content-Length": "2",
          },
        });
      });

      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      const url =
        "https://huggingface.co/onnx-community/test-model/resolve/main/tokenizer.json";
      const response = await fetchFn(url);

      expect(mockNativeFetch).toHaveBeenCalledTimes(1);
      expect(passedHeaders?.get?.("Range") || passedHeaders?.["Range"]).toBe(
        "bytes=3-",
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Length")).toBe("5");

      // Verify the stream yields the complete 5 bytes (3 replayed + 2 incoming)
      const body = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(body)).toEqual([10, 20, 30, 40, 50]);

      // Verify target file is finalized with full content
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.existsSync(partPath)).toBe(false);
      expect(fs.readFileSync(targetPath)).toEqual(
        Buffer.from([10, 20, 30, 40, 50]),
      );
    });

    it("handles server returning 200 on Range request by restarting from byte 0", async () => {
      const targetPath = path.join(
        tempDir,
        "onnx-community/test-model/tokenizer.json",
      );
      const partPath = `${targetPath}.part`;
      fs.mkdirSync(path.dirname(partPath), { recursive: true });
      fs.writeFileSync(partPath, Buffer.from([99, 99]));

      // Server ignores Range and returns full 200
      const mockNativeFetch = jest.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3, 4]), {
            status: 200,
            headers: { "Content-Length": "4" },
          }),
      );

      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      const url =
        "https://huggingface.co/onnx-community/test-model/resolve/main/tokenizer.json";
      const response = await fetchFn(url);

      const body = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(body)).toEqual([1, 2, 3, 4]);
      expect(fs.readFileSync(targetPath)).toEqual(Buffer.from([1, 2, 3, 4]));
    });

    it("handles 416 Range Not Satisfiable by unlinking .part and retrying from byte 0", async () => {
      const targetPath = path.join(
        tempDir,
        "onnx-community/test-model/tokenizer.json",
      );
      const partPath = `${targetPath}.part`;
      fs.mkdirSync(path.dirname(partPath), { recursive: true });
      fs.writeFileSync(partPath, Buffer.from([99, 99, 99, 99, 99]));

      let attempt = 0;
      const mockNativeFetch = jest.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 416,
            statusText: "Range Not Satisfiable",
          });
        }
        return new Response(new Uint8Array([7, 8, 9]), {
          status: 200,
          headers: { "Content-Length": "3" },
        });
      });

      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      const url =
        "https://huggingface.co/onnx-community/test-model/resolve/main/tokenizer.json";
      const response = await fetchFn(url);

      expect(mockNativeFetch).toHaveBeenCalledTimes(2);
      const body = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(body)).toEqual([7, 8, 9]);
      expect(fs.readFileSync(targetPath)).toEqual(Buffer.from([7, 8, 9]));
    });

    it("returns stream directly if target file is already complete on disk", async () => {
      const targetPath = path.join(
        tempDir,
        "onnx-community/test-model/tokenizer.json",
      );
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, Buffer.from([11, 22, 33]));

      const mockNativeFetch = jest.fn();
      const fetchFn = createFileModelCacheFetch({
        cacheDir: tempDir,
        nativeFetch: mockNativeFetch as any,
      });

      const url =
        "https://huggingface.co/onnx-community/test-model/resolve/main/tokenizer.json";
      const response = await fetchFn(url);

      expect(mockNativeFetch).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Length")).toBe("3");
      const body = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(body)).toEqual([11, 22, 33]);
    });
  });
});
