import { matchesCron } from "./cron.js";

describe("matchesCron", () => {
  it("returns false for invalid or non-5-part expressions", () => {
    expect(matchesCron("", new Date())).toBe(false);
    expect(matchesCron(null as any, new Date())).toBe(false);
    expect(matchesCron("* * *", new Date())).toBe(false);
    expect(matchesCron("* * * * * *", new Date())).toBe(false);
  });

  it("matches wildcard expression", () => {
    expect(matchesCron("* * * * *", new Date())).toBe(true);
  });

  it("matches exact numbers", () => {
    // 2026-08-30 14:15:00, Sunday (day 0), August (month 8), day of month 30
    const testDate = new Date(2026, 7, 30, 14, 15, 0); // Month is 0-indexed in JS Date: 7 = August

    expect(matchesCron("15 14 30 8 0", testDate)).toBe(true);
    expect(matchesCron("16 14 30 8 0", testDate)).toBe(false);
  });

  it("matches lists of numbers", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("10,15,20 * * * *", testDate)).toBe(true);
    expect(matchesCron("10,20,30 * * * *", testDate)).toBe(false);
  });

  it("matches ranges (N-M)", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("10-20 * * * *", testDate)).toBe(true);
    expect(matchesCron("20-30 * * * *", testDate)).toBe(false);
  });

  it("matches steps (*/N)", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("*/5 * * * *", testDate)).toBe(true);
    expect(matchesCron("*/7 * * * *", testDate)).toBe(false);
  });

  it("matches range with step (N-M/S)", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("10-20/5 * * * *", testDate)).toBe(true); // 10, 15, 20 -> 15 matches
    expect(matchesCron("10-20/4 * * * *", testDate)).toBe(false); // 10, 14, 18
  });

  it("matches start with step (N/S)", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("5/10 * * * *", testDate)).toBe(true); // 5, 15, 25... -> 15 matches
    expect(matchesCron("6/10 * * * *", testDate)).toBe(false);
  });

  it("handles invalid step strings", () => {
    const testDate = new Date(2026, 7, 30, 14, 15, 0);

    expect(matchesCron("*/0 * * * *", testDate)).toBe(false);
    expect(matchesCron("*/abc * * * *", testDate)).toBe(false);
  });
});
