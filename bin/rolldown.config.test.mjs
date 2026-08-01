import { describe, expect, it } from "@jest/globals";

import config from "../rolldown.config.mjs";

describe("rolldown bundle splitting", () => {
  it("enables code splitting for frontend and agent worker bundles", () => {
    const frontend = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const agentWorker = config.find(
      (entry) => entry.input === "src/worker/worker.ts",
    );

    expect(frontend?.output?.codeSplitting).toBe(true);
    expect(agentWorker?.output?.codeSplitting).toBe(true);
  });
});
