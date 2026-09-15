import { describe, it, expect } from "@jest/globals";
import { extractDisplayPathFromRouteKey } from "./extract-display-path-from-route-key.js";

describe("extractDisplayPathFromRouteKey", () => {
  it("strips pages/main/, pages/br:main/, and main/ prefixes", () => {
    expect(extractDisplayPathFromRouteKey("pages/main/docs/guide.md")).toBe(
      "docs/guide.md",
    );
    expect(extractDisplayPathFromRouteKey("pages/br:main/intro.md")).toBe(
      "intro.md",
    );
    expect(extractDisplayPathFromRouteKey("main/about.md")).toBe("about.md");
  });

  it("extracts path from pages/group/path format", () => {
    expect(extractDisplayPathFromRouteKey("pages/docs/api/reference.md")).toBe(
      "api/reference.md",
    );
  });

  it("leaves other paths unchanged", () => {
    expect(extractDisplayPathFromRouteKey("custom/path.md")).toBe(
      "custom/path.md",
    );
  });
});
