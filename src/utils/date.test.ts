import { formatDateForFilename, formatTimestamp } from "./date.js";

describe("date utilities", () => {
  describe("formatDateForFilename", () => {
    it("formats a specific date as yyyy-mm-dd_hh-mm-ss", () => {
      const fixedDate = new Date(2026, 9, 15, 14, 30, 45); // Oct 15, 2026, 14:30:45
      expect(formatDateForFilename(fixedDate)).toBe("2026-10-15_14-30-45");
    });

    it("defaults to current date when no argument is passed", () => {
      const formatted = formatDateForFilename();
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe("formatTimestamp", () => {
    it("formats a timestamp into a readable human format", () => {
      const ts = new Date(2026, 9, 15, 14, 30, 0).getTime();
      const formatted = formatTimestamp(ts);
      expect(typeof formatted).toBe("string");
      expect(formatted).toContain("Oct");
      expect(formatted).toContain("15");
    });
  });
});
