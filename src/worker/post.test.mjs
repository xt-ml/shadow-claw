import { jest } from "@jest/globals";

import { post, setPostHandler } from "./post.mjs";

describe("post", () => {
  it("posts to self when available", () => {
    const originalSelf = globalThis.self;
    const spy = jest.fn();
    globalThis.self = { postMessage: spy };

    post({ ok: true });

    expect(spy).toHaveBeenCalledWith({ ok: true });
    globalThis.self = originalSelf;
  });

  it("uses custom post handler when set", () => {
    const spy = jest.fn();
    setPostHandler(spy);

    post({ ok: true });

    expect(spy).toHaveBeenCalledWith({ ok: true });
    setPostHandler(null);
  });
});
