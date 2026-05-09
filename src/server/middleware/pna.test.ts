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

  it("sets Access-Control-Allow-Private-Network header if requested", () => {
    req.headers["access-control-request-private-network"] = "true";
    const middleware = createPnaMiddleware(logger, false);
    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Private-Network",
      "true",
    );
    expect(next).toHaveBeenCalled();
  });

  it("does not set header if not requested", () => {
    const middleware = createPnaMiddleware(logger, false);
    middleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("logs if verbose is true", () => {
    req.headers["access-control-request-private-network"] = "true";
    const middleware = createPnaMiddleware(logger, true);
    middleware(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(
      "VERBOSE",
      expect.stringContaining("Allowing Private Network Access"),
    );
  });
});
