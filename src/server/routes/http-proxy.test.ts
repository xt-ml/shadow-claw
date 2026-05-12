import { jest } from "@jest/globals";

describe("http-proxy-routes", () => {
  let routes: Map<string, any>;
  let handleProxyRequestMock: any;

  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;

        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
      setHeader: jest.fn().mockImplementation((key: any, val: any) => {
        res.headers[key] = val;

        return res;
      }),
    };

    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    handleProxyRequestMock = jest.fn();

    jest.unstable_mockModule("../utils/proxy-helpers.js", () => ({
      handleProxyRequest: handleProxyRequestMock,
    }));

    const { registerHttpProxyRoutes } = await import("./http-proxy.js");

    const app = {
      all: jest.fn((path: any, handler: any) => {
        routes.set(String(path), handler);
      }),
    };

    registerHttpProxyRoutes(app as any, { verbose: false });
  });

  it("handles /proxy with url query param", async () => {
    const handler = routes.get("/^\\/proxy(\\/(.*))?$/");
    const req = {
      method: "GET",
      query: { url: "https://example.com" },
      headers: { "x-test": "value" },
      params: [undefined, undefined],
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://example.com",
        method: "GET",
        headers: req.headers,
      }),
    );
  });

  it("handles /proxy with url in body", async () => {
    const handler = routes.get("/^\\/proxy(\\/(.*))?$/");
    const req = {
      method: "POST",
      body: {
        url: "https://example.com",
        method: "PUT",
        headers: { "x-custom": "123", Authorization: "Bearer 123" },
      },
      headers: {},
      query: {},
      params: [undefined, undefined],
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://example.com",
        method: "PUT",
        headers: req.body.headers,
        forwardAuth: true,
      }),
    );
  });

  it("handles /proxy/<url> path-based target", async () => {
    const handler = routes.get("/^\\/proxy(\\/(.*))?$/");
    const req = {
      method: "GET",
      query: { other: "abc" },
      params: ["/https://example.com", "https://example.com"],
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://example.com?other=abc",
      }),
    );
  });

  it("handles /telegram/bot<token>/sendMessage", async () => {
    const handler = routes.get(
      "/^\\/telegram\\/((?:bot.*)|(?:file\\/bot.*))$/",
    );

    const req = {
      method: "POST",
      params: ["bot123:abc/sendMessage"],
      query: {},
      headers: { "content-type": "application/json" },
      body: { text: "hello" },
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://api.telegram.org/bot123:abc/sendMessage",
        method: "POST",
        body: JSON.stringify(req.body),
      }),
    );
  });

  it("handles /git-proxy/<host>/<path>", async () => {
    const handler = routes.get("/^\\/git-proxy\\/(.*)/");
    const req = {
      method: "GET",
      params: ["github.com/user/repo.git/info/refs"],
      query: { service: "git-upload-pack" },
      headers: { authorization: "Bearer token" },
      [Symbol.asyncIterator]: jest.fn<any>(() => ({
        next: jest.fn<any>().mockResolvedValue({ done: true }),
      })),
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl:
          "https://github.com/user/repo.git/info/refs?service=git-upload-pack",
        forwardAuth: true,
      }),
    );
  });
});
