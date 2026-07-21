import { jest } from "@jest/globals";

import { applyAnchorWithRetry } from "./applyAnchorWithRetry";

describe("applyAnchorWithRetry", () => {
  let apply: jest.Mock<() => boolean>;
  let requestAnimationFrameMock: jest.Mock;

  beforeEach(() => {
    apply = jest.fn();
    requestAnimationFrameMock = jest.fn((cb: any) => {
      cb();
    });

    (globalThis as any).requestAnimationFrame = requestAnimationFrameMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should call apply once and return if apply returns true on first attempt", async () => {
    apply.mockReturnValueOnce(true);
    await applyAnchorWithRetry(apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("should call apply up to maxAttempts times if apply always returns false", async () => {
    apply.mockReturnValue(false);
    await applyAnchorWithRetry(apply, 3);
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it("should stop calling apply after it returns true before maxAttempts", async () => {
    apply.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await applyAnchorWithRetry(apply, 3);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("should use default maxAttempts of 3 if not provided", async () => {
    apply.mockReturnValue(false);
    await applyAnchorWithRetry(apply);
    expect(apply).toHaveBeenCalledTimes(3);
  });
});
