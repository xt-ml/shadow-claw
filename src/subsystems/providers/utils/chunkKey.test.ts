import { chunkKey } from "./chunkKey.js";

describe("chunkKey", () => {
  it("formats the chunk cache key with the chunk index query parameter", () => {
    expect(chunkKey("https://example.com/model.bin", 0)).toBe(
      "https://example.com/model.bin?__sc_chunk=0",
    );
    expect(chunkKey("https://example.com/model.bin", 42)).toBe(
      "https://example.com/model.bin?__sc_chunk=42",
    );
  });
});
