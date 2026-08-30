import { executeGetCurrentTime } from "./get-current-time.js";

describe("executeGetCurrentTime", () => {
  it("returns ISO string when timezone is not provided", () => {
    const result = executeGetCurrentTime({});
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns formatted date and time when valid timezone is provided", () => {
    const result = executeGetCurrentTime({ timezone: "America/New_York" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns error string when invalid timezone is provided", () => {
    const result = executeGetCurrentTime({ timezone: "NonExistent/Timezone" });
    expect(result).toContain("Error: Invalid timezone NonExistent/Timezone");
  });
});
