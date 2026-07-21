import { jest } from "@jest/globals";

import { historyState } from "./historyState";

describe("historyState", () => {
  let pushStateMock: jest.Mock;
  let replaceStateMock: jest.Mock;

  beforeEach(() => {
    pushStateMock = jest.fn();
    replaceStateMock = jest.fn();

    Object.defineProperty(window, "history", {
      value: {
        pushState: pushStateMock,
        replaceState: replaceStateMock,
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("pushState path", () => {
    it("should call pushState with the final path when replace is false", () => {
      const finalPath = "/test-path";
      const options = { replace: false };

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledTimes(1);
      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });

    it("should call pushState with the final path when replace is undefined", () => {
      const finalPath = "/test-path";
      const options = {};

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledTimes(1);
      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });
  });

  describe("replaceState path", () => {
    it("should call replaceState with the final path when replace is true", () => {
      const finalPath = "/test-path";
      const options = { replace: true };

      historyState(window.history, finalPath, options);

      expect(replaceStateMock).toHaveBeenCalledTimes(1);
      expect(replaceStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });
  });

  describe("trailing slash handling", () => {
    it("should add trailing slash when useTrailingSlash is true and finalPath does not contain #", () => {
      const finalPath = "/test-path";
      const options = { useTrailingSlash: true };

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledWith({}, "", "/test-path/");
    });

    it("should not add trailing slash when finalPath already ends with /", () => {
      const finalPath = "/test-path/";
      const options = { useTrailingSlash: true };

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });

    it("should not modify path when finalPath contains #", () => {
      const finalPath = "/test-path#section";
      const options = { useTrailingSlash: true };

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });

    it("should not add trailing slash when useTrailingSlash is false", () => {
      const finalPath = "/test-path";
      const options = { useTrailingSlash: false };

      historyState(window.history, finalPath, options);

      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });

    it("should not add trailing slash when useTrailingSlash is undefined", () => {
      const finalPath = "/test-path";

      historyState(window.history, finalPath, {});

      expect(pushStateMock).toHaveBeenCalledWith({}, "", finalPath);
    });
  });

  describe("combined options", () => {
    it("should replace state and add trailing slash when both options are set", () => {
      const finalPath = "/test-path";
      const options = { replace: true, useTrailingSlash: true };

      historyState(window.history, finalPath, options);

      expect(replaceStateMock).toHaveBeenCalledWith({}, "", "/test-path/");
      expect(pushStateMock).not.toHaveBeenCalled();
    });

    it("should replace state without trailing slash when only replace is set", () => {
      const finalPath = "/test-path";
      const options = { replace: true, useTrailingSlash: false };

      historyState(window.history, finalPath, options);

      expect(replaceStateMock).toHaveBeenCalledWith({}, "", finalPath);
      expect(pushStateMock).not.toHaveBeenCalled();
    });
  });
});
