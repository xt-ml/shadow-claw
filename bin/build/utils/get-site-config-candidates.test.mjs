import path from "node:path";
import { getSiteConfigCandidates } from "./get-site-config-candidates.mjs";

describe("getSiteConfigCandidates", () => {
  it("returns only the root candidate paths when no contentRoot is passed", () => {
    expect(getSiteConfigCandidates()).toEqual([
      "shadow-claw-config.json",
      "shadow-claw.config.json",
      "shadowclaw.config.json",
      "site-config.json",
    ]);
  });

  it("returns candidates resolved against contentRoot when provided", () => {
    const root = "/custom/template";
    expect(getSiteConfigCandidates(root)).toEqual([
      path.join(root, "shadow-claw-config.json"),
      path.join(root, "shadow-claw.config.json"),
      path.join(root, "shadowclaw.config.json"),
      path.join(root, "pages/shadow-claw-config.json"),
      path.join(root, "pages/shadow-claw.config.json"),
      path.join(root, "site-config.json"),
      path.join(root, "pages/site-config.json"),
    ]);
  });
});
