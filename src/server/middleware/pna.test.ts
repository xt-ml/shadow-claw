/** @jest-environment node */
import { jest } from "@jest/globals";
import { createPnaMiddleware } from "./pna.js";

describe("pna-middleware", () => {
  let logger: any;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    logger = { log: jest.fn() };
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it("sets Access-Control-Allow-Private-Network header if requested explicitly", () => {
    req.headers["access-control-request-private-network"] = "true";
    const middleware = createPnaMiddleware(logger, false);
    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Private-Network",
      "true",
    );
    expect(next).toHaveBeenCalled();
  });

  it("sets Access-Control-Allow-Private-Network header for cross-origin requests", () => {
    req.headers.origin = "https://xt-ml.github.io";
    const middleware = createPnaMiddleware(logger, false);
    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Private-Network",
      "true",
    );
    expect(next).toHaveBeenCalled();
  });

  it("does not set header if neither requested nor origin present", () => {
    const middleware = createPnaMiddleware(logger, false);
    middleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("logs if verbose is true and header is explicitly requested", () => {
    req.headers["access-control-request-private-network"] = "true";
    const middleware = createPnaMiddleware(logger, true);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "VERBOSE",
      expect.stringContaining("Allowing Private Network Access"),
    );
  });
});
