import { metaKey } from "./metaKey.js";

describe("metaKey", () => {
  it("formats the meta cache key with the query parameter suffix", () => {
    expect(metaKey("https://example.com/model.bin")).toBe(
      "https://example.com/model.bin?__sc_meta=1",
    );
  });

  it("handles URLs that already have query strings", () => {
    expect(metaKey("https://example.com/model.bin?revision=main")).toBe(
      "https://example.com/model.bin?revision=main?__sc_meta=1",
    );
  });
});
