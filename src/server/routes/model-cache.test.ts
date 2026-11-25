import { jest } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { registerModelCacheRoutes } from "./model-cache.js";

function httpGet(options: {
  port: number;
  path: string;
  headers?: Record<string, string>;
}): Promise<{
  status: number;
  text: string;
  json: any;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: options.port,
        path: options.path,
        method: "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: any = text;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({
            status: res.statusCode || 0,
            text,
            json,
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function startTestServer(app: express.Express): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  return await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        port: addr.port,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

describe("model-cache routes", () => {
  let tmpDir: string;
  let transformersDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sc-model-cache-route-"));
    transformersDir = path.join(tmpDir, "transformers-cli");
    await fs.mkdir(transformersDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("serves status and cached model files with byte Range support", async () => {
    const targetFile = path.join(
      tmpDir,
      "hf/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx",
    );
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, Buffer.from("0123456789ABCDEF"));

    const app = express();
    registerModelCacheRoutes(app, {
      cacheDir: tmpDir,
      transformersCacheDir: transformersDir,
      shared: true,
    });

    const srv = await startTestServer(app);
    try {
      const statusRes = await httpGet({
        port: srv.port,
        path: "/model-cache/status",
      });
      expect(statusRes.status).toBe(200);
      expect(statusRes.json.shared).toBe(true);
      expect(statusRes.json.fileCount).toBe(1);
      expect(statusRes.json.totalBytes).toBe(16);

      const fullRes = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx",
      });
      expect(fullRes.status).toBe(200);
      expect(fullRes.text).toBe("0123456789ABCDEF");
      expect(fullRes.headers["accept-ranges"]).toBe("bytes");

      const rangeRes = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx",
        headers: { Range: "bytes=2-5" },
      });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers["content-range"]).toBe("bytes 2-5/16");
      expect(rangeRes.text).toBe("2345");
    } finally {
      await srv.close();
    }
  });

  it("falls back to CLI transformersCacheDir and rejects traversal paths", async () => {
    const cliFile = path.join(
      transformersDir,
      "onnx-community/gemma-4-E2B-it-ONNX/tokenizer.json",
    );
    await fs.mkdir(path.dirname(cliFile), { recursive: true });
    await fs.writeFile(cliFile, '{"vocab":[]}');

    const app = express();
    registerModelCacheRoutes(app, {
      cacheDir: tmpDir,
      transformersCacheDir: transformersDir,
      allowUpstreamFetch: false,
    });

    const srv = await startTestServer(app);
    try {
      const hitRes = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/tokenizer.json",
      });
      expect(hitRes.status).toBe(200);
      expect(hitRes.text).toBe('{"vocab":[]}');

      const badRes = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/org/repo/resolve/main/..%2fsecret.txt",
      });
      expect(badRes.status).toBe(400);
    } finally {
      await srv.close();
    }
  });

  it("populates disk cache atomically on cache miss via upstream fetch", async () => {
    const upstreamBytes = Buffer.from("upstream-bytes");
    const fetchMock = jest.fn<typeof fetch>(async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/octet-stream",
          "content-length": String(upstreamBytes.byteLength),
        }),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(upstreamBytes));
            controller.close();
          },
        }),
      } as unknown as Response;
    });

    const app = express();
    registerModelCacheRoutes(app, {
      cacheDir: tmpDir,
      fetchFn: fetchMock,
    });

    const srv = await startTestServer(app);
    try {
      const first = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/demo/resolve/main/weights.bin",
      });
      expect(first.status).toBe(200);
      expect(first.text).toBe("upstream-bytes");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const second = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/demo/resolve/main/weights.bin",
      });
      expect(second.status).toBe(200);
      expect(second.text).toBe("upstream-bytes");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await srv.close();
    }
  });

  it("falls back across additionalTransformersCacheDirs without hitting upstream", async () => {
    const legacyDir = path.join(tmpDir, "legacy-assets-transformers");
    const legacyFile = path.join(
      legacyDir,
      "onnx-community/Qwen3-0.6B-ONNX/config.json",
    );
    await fs.mkdir(path.dirname(legacyFile), { recursive: true });
    await fs.writeFile(legacyFile, '{"architectures":["Qwen3"]}');

    const app = express();
    registerModelCacheRoutes(app, {
      cacheDir: tmpDir,
      transformersCacheDir: transformersDir,
      additionalTransformersCacheDirs: [legacyDir],
      allowUpstreamFetch: false,
    });

    const srv = await startTestServer(app);
    try {
      const res = await httpGet({
        port: srv.port,
        path: "/model-cache/hf/onnx-community/Qwen3-0.6B-ONNX/resolve/main/config.json",
      });
      expect(res.status).toBe(200);
      expect(res.text).toBe('{"architectures":["Qwen3"]}');
    } finally {
      await srv.close();
    }
  });
});
