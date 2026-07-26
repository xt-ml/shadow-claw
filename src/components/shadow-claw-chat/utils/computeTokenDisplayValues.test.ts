import { computeTokenDisplayValues } from "./computeTokenDisplayValues.js";

describe("computeTokenDisplayValues", () => {
  it("correctly computes total tokens using logical OR fallback (not bitwise OR)", () => {
    const usage = {
      inputTokens: 10000,
      outputTokens: 5000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
    };

    const result = computeTokenDisplayValues(usage);

    expect(result.promptTokens).toBe(10000);
    expect(result.outputTokens).toBe(5000);
    expect(result.totalTokens).toBe(15000);
  });

  it("uses totalTokens from usage when it is non-zero (not bitwise OR)", () => {
    const usage = {
      inputTokens: 25096,
      outputTokens: 26326,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 26326,
    };

    const result = computeTokenDisplayValues(usage);
    expect(result.promptTokens).toBe(25096);
    expect(result.outputTokens).toBe(26326);
    expect(result.totalTokens).toBe(26326);
    expect(result.totalTokens).not.toBe(26326 | 51422); // 59390
  });

  it("falls back to computed sum when totalTokens is 0", () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheCreationTokens: 10,
      totalTokens: 0,
    };

    const result = computeTokenDisplayValues(usage);

    expect(result.cacheTokens).toBe(60);
    expect(result.promptTokens).toBe(160);
    expect(result.outputTokens).toBe(200);
    expect(result.totalTokens).toBe(360);
  });

  it("includes cache tokens in prompt count", () => {
    const usage = {
      inputTokens: 5000,
      outputTokens: 1000,
      cacheReadTokens: 2000,
      cacheCreationTokens: 500,
      totalTokens: 8500,
    };

    const result = computeTokenDisplayValues(usage);
    expect(result.cacheTokens).toBe(2500);
    expect(result.promptTokens).toBe(7500);
    expect(result.outputTokens).toBe(1000);
    expect(result.totalTokens).toBe(8500);
  });
});
