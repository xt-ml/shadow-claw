import { formatDateForFilename, formatTimestamp } from "./utils.js";

describe("utils", () => {
  it("formats date for file names", () => {
    const s = formatDateForFilename(new Date(2024, 0, 2, 3, 4, 5));

    expect(s).toMatch(/^2024-01-02_03-04-05$/);
  });

  it("formats timestamp string", () => {
    const s = formatTimestamp(Date.UTC(2024, 0, 1, 13, 25));

    expect(typeof s).toBe("string");

    expect(s.length).toBeGreaterThan(5);
  });
});
