/// <reference lib="dom" />

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("service-worker fetch proxy", () => {
  let fetchListener: ((event: any) => void) | null = null;
  let messageListener: ((event: any) => void) | null = null;
  let networkFetch: jest.Mock;

  const imageBytes = new Uint8Array([255, 216, 255, 217]);

  class TestHeaders {
    private readonly values: Record<string, string>;

    constructor(init?: Record<string, string>) {
      this.values = {};
      for (const [key, value] of Object.entries(init ?? {})) {
        this.values[key.toLowerCase()] = value;
      }
    }

    forEach(callback: (value: string, key: string) => void) {
      for (const [key, value] of Object.entries(this.values)) {
        callback(value, key);
      }
    }

    get(name: string): string | null {
      return this.values[name.toLowerCase()] ?? null;
    }
  }

  class TestResponse {
    readonly headers: TestHeaders;
    readonly status: number;
    private readonly _bodySource: any;

    constructor(body?: any, init?: any) {
      this.status = init?.status ?? 200;
      this.headers =
        init?.headers instanceof TestHeaders
          ? init.headers
          : new TestHeaders(init?.headers);
      this._bodySource = body;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      if (
        this._bodySource &&
        typeof this._bodySource.arrayBuffer === "function"
      ) {
        return await this._bodySource.arrayBuffer();
      }

      if (this._bodySource instanceof Uint8Array) {
        return (this._bodySource.buffer as ArrayBuffer).slice(0);
      }

      if (this._bodySource instanceof ArrayBuffer) {
        return this._bodySource.slice(0);
      }

      if (typeof this._bodySource === "string") {
        return new Uint8Array(
          Array.from(this._bodySource).map((char) => char.charCodeAt(0) & 0xff),
        ).buffer;
      }

      return new ArrayBuffer(0);
    }

    async text(): Promise<string> {
      if (typeof this._bodySource === "string") {
        return this._bodySource;
      }

      const buffer = await this.arrayBuffer();

      return String.fromCharCode(...new Uint8Array(buffer));
    }
  }

  beforeEach(async () => {
    jest.resetModules();
    fetchListener = null;
    messageListener = null;

    Object.defineProperty(globalThis, "Response", {
      configurable: true,
      writable: true,
      value: TestResponse,
    });

    networkFetch = jest.fn(
      async () =>
        new TestResponse("network-fallback", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: networkFetch,
    });

    const fileHandle = {
      getFile: jest.fn(async () => ({
        arrayBuffer: async () => new Uint8Array(imageBytes).buffer,
        size: imageBytes.length,
        type: "image/jpeg",
      })),
    };
    const groupDir = {
      getDirectoryHandle: jest.fn(async () => {
        throw new DOMException("NotFound", "NotFoundError");
      }),
      getFileHandle: jest.fn(async (name: string) => {
        if (name === "image.jpg") {
          return fileHandle;
        }

        throw new DOMException("NotFound", "NotFoundError");
      }),
    };
    const groupsDir = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "br-main") {
          return groupDir;
        }

        throw new DOMException("NotFound", "NotFoundError");
      }),
    };
    const appRootDir = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "groups") {
          return groupsDir;
        }

        throw new DOMException("NotFound", "NotFoundError");
      }),
    };
    const rootDir = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "shadowclaw") {
          return appRootDir;
        }

        throw new DOMException("NotFound", "NotFoundError");
      }),
    };

    Object.defineProperty(globalThis.navigator, "storage", {
      configurable: true,
      value: {
        getDirectory: jest.fn(async () => rootDir),
      },
    });

    const clients = {
      matchAll: jest.fn(async () => []),
    };

    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: {
        clients,
        addEventListener: jest.fn(
          (type: string, handler: (event: any) => void) => {
            if (type === "fetch") {
              fetchListener = handler;
            } else if (type === "message") {
              messageListener = handler;
            }
          },
        ),
      },
    });

    await import("./fetch-proxy.js");
    expect(fetchListener).toBeTruthy();
  });

  function dispatchFetch(request: any): Promise<Response> {
    if (!fetchListener) {
      throw new Error("fetch listener was not registered");
    }

    let responsePromise: Promise<Response> | null = null;
    fetchListener({
      request,
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    if (!responsePromise) {
      throw new Error("fetch event did not call respondWith");
    }

    return responsePromise;
  }

  function dispatchFetchIntercept(request: any): Promise<Response> | null {
    if (!fetchListener) {
      throw new Error("fetch listener was not registered");
    }

    let responsePromise: Promise<Response> | null = null;
    fetchListener({
      request,
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    return responsePromise;
  }

  function createWorkspaceImageRequest(overrides?: Record<string, unknown>) {
    return {
      url: `${globalThis.location.origin}/files/br%3Amain/image.jpg`,
      method: "GET",
      mode: "cors",
      destination: "image",
      headers: new TestHeaders(),
      ...overrides,
    };
  }

  it("serves image bytes for same-origin /files workspace route requests", async () => {
    const request = createWorkspaceImageRequest();

    const response = await dispatchFetch(request);
    const bodyBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Array.from(bodyBytes)).toEqual(Array.from(imageBytes));
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("does not intercept workspace-route navigation/document requests", async () => {
    const navigationRequest = createWorkspaceImageRequest({
      method: "GET",
      mode: "navigate",
      destination: "document",
    });

    const response = dispatchFetchIntercept(navigationRequest);

    expect(response).toBeNull();
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("serves bytes for no-cors image requests (iframe/img-like shape)", async () => {
    const request = createWorkspaceImageRequest({
      mode: "no-cors",
      destination: "image",
    });

    const response = await dispatchFetch(request);
    const bodyBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Array.from(bodyBytes)).toEqual(Array.from(imageBytes));
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("serves bytes when destination is empty for non-navigation GET requests", async () => {
    const request = createWorkspaceImageRequest({
      destination: "",
    });

    const response = await dispatchFetch(request);
    const bodyBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Array.from(bodyBytes)).toEqual(Array.from(imageBytes));
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("does not claim or intercept bypass requests (such as HF CDN downloads) so the browser handles them natively", async () => {
    const hfCdnRequest = {
      url: "https://us.aws.cdn.hf.co/onnx-community/gemma-3-1b-it-ONNX-GQA/model_quantized.onnx_data",
      method: "GET",
      mode: "cors",
      destination: "fetch",
      headers: new TestHeaders(),
    };

    const response = dispatchFetchIntercept(hfCdnRequest);
    expect(response).toBeNull();
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("handles proxy configuration messages and proxies cross-origin requests", async () => {
    expect(messageListener).toBeTruthy();

    // Enable proxy via message
    messageListener!({
      data: {
        type: "set-proxy-config",
        payload: {
          useProxy: true,
          proxyUrl: "/proxy",
        },
      },
    } as any);

    const crossOriginPostRequest = {
      url: "https://api.external.com/v1/resource",
      method: "POST",
      mode: "cors",
      destination: "fetch",
      headers: new TestHeaders({ Authorization: "Bearer token" }),
      clone: () => ({
        text: async () => JSON.stringify({ key: "val" }),
      }),
    };

    const response = await dispatchFetch(crossOriginPostRequest);
    expect(response.status).toBe(200);
    expect(networkFetch).toHaveBeenCalledWith(
      `${globalThis.location.origin}/proxy/https://api.external.com/v1/resource`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("handles legacy set-use-proxy message and direct fetch when proxy disabled", async () => {
    messageListener!({
      data: {
        type: "set-use-proxy",
        payload: {
          useProxy: false,
        },
      },
    } as any);

    const crossOriginGetRequest = {
      url: "https://api.external.com/v1/data",
      method: "GET",
      mode: "cors",
      destination: "fetch",
      headers: new TestHeaders(),
    };

    const response = await dispatchFetch(crossOriginGetRequest);
    expect(response.status).toBe(200);
    expect(networkFetch).toHaveBeenCalledWith(crossOriginGetRequest);
  });
});
