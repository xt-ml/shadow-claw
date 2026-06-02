import { jest } from "@jest/globals";

describe("static-files-middleware", () => {
  let app: any;
  let rootPath: string;
  let fsMock: any;
  let rewriteMock: any;
  let expressMock: any;

  beforeEach(async () => {
    jest.resetModules();

    app = { use: jest.fn() };
    rootPath = "/root";

    fsMock = {
      stat: jest.fn(),
      access: jest.fn(),
      constants: { F_OK: 0 },
    };
    rewriteMock = jest.fn(() => (_req: any, _res: any, next: any) => next());
    expressMock = {
      static: jest.fn(() => (_req: any, _res: any, next: any) => next()),
    };

    jest.unstable_mockModule("node:fs", () => ({ default: fsMock, ...fsMock }));
    jest.unstable_mockModule("express-urlrewrite", () => ({
      default: rewriteMock,
    }));
    jest.unstable_mockModule("express", () => ({ default: expressMock }));
  });

  async function register() {
    const { registerStaticFilesMiddleware } = await import("./static-files.js");
    registerStaticFilesMiddleware(app, rootPath);
  }

  it("registers urlrewrite and static middleware", async () => {
    await register();
    expect(rewriteMock).toHaveBeenCalledWith(
      expect.any(RegExp),
      expect.any(String),
    );
    expect(expressMock.static).toHaveBeenCalledWith(
      rootPath,
      expect.any(Object),
    );
    expect(app.use).toHaveBeenCalled();
  });

  it("sets long cache for WebVM assets", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0]; // The custom middleware

    const req = {
      originalUrl: "/assets/v86.ext2/disk.img",
      url: "/assets/v86.ext2/disk.img",
    };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) =>
      cb(null, { isDirectory: () => false }),
    );

    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  });

  it("sets no-cache for non-WebVM assets", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = { originalUrl: "/index.html", url: "/index.html" };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) =>
      cb(null, { isDirectory: () => false }),
    );

    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
  });

  it("serves files via res.sendFile", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = { originalUrl: "/test.txt", url: "/test.txt" };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) =>
      cb(null, { isDirectory: () => false }),
    );

    middleware(req, res, next);
    expect(res.sendFile).toHaveBeenCalledWith(
      expect.stringContaining("/root/test.txt"),
    );
  });

  it("serves index.html for directories if it exists", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = { originalUrl: "/", url: "/" };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) =>
      cb(null, { isDirectory: () => true }),
    );
    fsMock.access.mockImplementation((_path: string, _mode: any, cb: any) =>
      cb(null),
    );

    middleware(req, res, next);
    expect(res.sendFile).toHaveBeenCalledWith(
      expect.stringContaining("/root/index.html"),
    );
  });

  it("serves SPA shell index for all first-load app route paths", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const appPaths = [
      "/chat",
      "/chat/br%3Amain/",
      "/files",
      "/files/group-1/docs/notes.md",
      "/files/group-1/folder-of-files",
      "/pages",
      "/pages/example.html",
      "/tasks",
      "/tasks/group-1/",
      "/settings",
      "/settings/tool-configuration",
    ];

    for (const appPath of appPaths) {
      const req = {
        method: "GET",
        headers: { accept: "text/html" },
        originalUrl: appPath,
        url: appPath,
      };
      const res = { setHeader: jest.fn(), sendFile: jest.fn() };
      const next = jest.fn();

      fsMock.stat.mockImplementation((_path: string, cb: any) =>
        cb(new Error()),
      );

      middleware(req, res, next);

      expect(res.sendFile).toHaveBeenCalledWith(
        expect.stringContaining("/root/index.html"),
      );
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("does not serve SPA shell for non-HTML missing requests", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = {
      method: "GET",
      headers: { accept: "application/json" },
      originalUrl: "/tasks",
      url: "/tasks",
    };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) => cb(new Error()));

    middleware(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("serves SPA shell for navigation requests even without text/html accept", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = {
      method: "GET",
      headers: {
        accept: "*/*",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
      },
      originalUrl: "/files/br-main/README.md",
      url: "/files/br-main/README.md",
    };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) => cb(new Error()));

    middleware(req, res, next);

    expect(res.sendFile).toHaveBeenCalledWith(
      expect.stringContaining("/root/index.html"),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("does not serve SPA shell for missing image-like /files requests", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = {
      method: "GET",
      headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      originalUrl: "/files/group-1/docs/pic.jpg",
      url: "/files/group-1/docs/pic.jpg",
    };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) => cb(new Error()));

    middleware(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("does not serve SPA shell for missing non-app paths", async () => {
    await register();
    const middleware = app.use.mock.calls[1][0];

    const req = {
      method: "GET",
      headers: { accept: "text/html" },
      originalUrl: "/proxy",
      url: "/proxy",
    };
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    const next = jest.fn();

    fsMock.stat.mockImplementation((_path: string, cb: any) => cb(new Error()));

    middleware(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
