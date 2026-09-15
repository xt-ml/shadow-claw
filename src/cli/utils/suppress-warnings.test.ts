import process from "node:process";
import { suppressExperimentalWarnings } from "./suppress-warnings.js";

describe("suppressExperimentalWarnings", () => {
  let originalEmitWarning: typeof process.emitWarning;

  beforeEach(() => {
    originalEmitWarning = process.emitWarning;
  });

  afterEach(() => {
    process.emitWarning = originalEmitWarning;
  });

  it("suppresses ExperimentalWarning SQLite messages", () => {
    let forwarded = false;
    process.emitWarning = (() => {
      forwarded = true;
    }) as any;
    suppressExperimentalWarnings();

    process.emitWarning(
      "SQLite is an experimental feature and might change at any time",
      "ExperimentalWarning",
    );
    expect(forwarded).toBe(false);

    process.emitWarning({
      name: "ExperimentalWarning",
      message: "SQLite is an experimental feature",
    } as any);
    expect(forwarded).toBe(false);
  });

  it("forwards non-experimental warnings through to the original emitter", () => {
    let captured: { warning: any; args: any[] } | null = null;
    process.emitWarning = ((warning: any, ...args: any[]) => {
      captured = { warning, args };
    }) as any;
    suppressExperimentalWarnings();

    process.emitWarning("Some other warning", "UserWarning");
    expect(captured).not.toBeNull();
    expect(captured!.warning).toBe("Some other warning");
    expect(captured!.args[0]).toBe("UserWarning");
  });
});
