import { jest } from "@jest/globals";
import { createRequestLoggerMiddleware } from "./request-logger.js";

describe("request-logger-middleware", () => {
  let logger: any;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    logger = { log: jest.fn() };
    req = {
      method: "GET",
      originalUrl: "/test",
      headers: {},
      socket: { remoteAddress: "1.2.3.4" },
      query: {},
      body: {},
    };
    res = {
      statusCode: 200,
      getHeader: jest.fn(() => "-"),
      on: jest.fn((event, cb: any) => {
        if (event === "finish") {
          res.finishCb = cb;
        }
      }),
    };
    next = jest.fn();
  });

  it("logs the incoming request", () => {
    const middleware = createRequestLoggerMiddleware(logger, false);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("--> GET /test ip=1.2.3.4"),
    );
    expect(next).toHaveBeenCalled();
  });

  it("resolves client IP from x-forwarded-for", () => {
    req.headers["x-forwarded-for"] = "5.6.7.8";
    const middleware = createRequestLoggerMiddleware(logger, false);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("ip=5.6.7.8"),
    );
  });

  it("redacts telegram bot tokens in URL", () => {
    req.originalUrl = "/telegram/bot123:abc/sendMessage";
    const middleware = createRequestLoggerMiddleware(logger, false);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("/telegram/bot[REDACTED]/sendMessage"),
    );
  });

  it("logs preflight OPTIONS details", () => {
    req.method = "OPTIONS";
    req.headers["access-control-request-method"] = "POST";
    req.headers["access-control-request-headers"] = "Content-Type";
    const middleware = createRequestLoggerMiddleware(logger, false);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("[Preflight]"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("request-method=POST"),
    );
  });

  it("logs request completion on finish", () => {
    const middleware = createRequestLoggerMiddleware(logger, false);
    middleware(req, res, next);

    res.statusCode = 404;
    res.finishCb();

    expect(logger.log).toHaveBeenCalledWith(
      "DEFAULT",
      expect.stringContaining("<-- GET /test 404"),
    );
  });

  it("logs verbose details if enabled", () => {
    req.query = { q: "search" };
    req.body = { key: "value" };
    const middleware = createRequestLoggerMiddleware(logger, true);
    middleware(req, res, next);

    res.finishCb();

    expect(logger.log).toHaveBeenCalledWith("VERBOSE", "    Query:", req.query);
    expect(logger.log).toHaveBeenCalledWith("VERBOSE", "    Body keys:", [
      "key",
    ]);
  });
});
