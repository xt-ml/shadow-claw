/** @jest-environment node */
import { jest } from "@jest/globals";

describe("cors-middleware", () => {
  let corsMock: any;
  let logger: any;

  beforeEach(async () => {
    jest.resetModules();
    corsMock = jest.fn((options: any) => (req: any, _res: any, next: any) => {
      // Helper to exercise the origin function
      if (options.origin) {
        options.origin(req.headers.origin, (err: any, allowed: any) => {
          if (err) {
            return next(err);
          }

          if (allowed) {
            return next();
          }
        });
      } else {
        next();
      }
    });

    jest.unstable_mockModule("cors", () => ({
      default: corsMock,
    }));

    logger = { log: jest.fn(), error: jest.fn() };
  });

  async function getMiddleware(config: any, verbose: boolean = false) {
    const { createCorsMiddleware } = await import("./cors.js");

    return createCorsMiddleware(config, logger, verbose);
  }

  it("allows requests with no origin header", async () => {
    const config = { corsMode: "localhost", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const req = { headers: {} };
    const res = {} as any;
    const next = jest.fn() as any;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows all origins if corsMode is 'all'", async () => {
    const config = { corsMode: "all", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const req = { headers: { origin: "https://evil.com" } };
    const res = {} as any;
    const next = jest.fn() as any;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows explicit origins from allowlist", async () => {
    const config = {
      corsMode: "localhost",
      allowedOrigins: new Set(["https://trusted.com"]),
    };
    const middleware = await getMiddleware(config);
    const req = { headers: { origin: "https://trusted.com" } };
    const res = {} as any;
    const next = jest.fn() as any;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows localhost and 127.0.0.1", async () => {
    const config = { corsMode: "localhost", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const next = jest.fn() as any;

    middleware(
      { headers: { origin: "http://localhost:3000" } },
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();

    middleware(
      { headers: { origin: "http://127.0.0.1:3000" } },
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("allows github.com and github.io", async () => {
    const config = { corsMode: "localhost", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const next = jest.fn() as any;

    middleware(
      { headers: { origin: "https://xt-ml.github.io" } },
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks unknown origins in localhost mode", async () => {
    const config = { corsMode: "localhost", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const req = { headers: { origin: "https://unknown.com" } };
    const next = jest.fn() as any;

    middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as any).message).toBe("Localhost only");
  });

  it("allows private IPs in private mode", async () => {
    const config = { corsMode: "private", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const next = jest.fn() as any;

    middleware(
      { headers: { origin: "http://192.168.1.100" } },
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks unknown origins in private mode", async () => {
    const config = { corsMode: "private", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config);
    const req = { headers: { origin: "https://unknown.com" } };
    const next = jest.fn() as any;

    middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as any).message).toBe(
      "Private network policy",
    );
  });

  it("logs verbose messages if enabled", async () => {
    const config = { corsMode: "all", allowedOrigins: new Set() };
    const middleware = await getMiddleware(config, true);
    const req = { headers: { origin: "https://example.com" } };
    const next = jest.fn() as any;

    middleware(req, {} as any, next);
    expect(logger.log).toHaveBeenCalledWith(
      "VERBOSE",
      expect.stringContaining("Allowed"),
    );
  });
});
