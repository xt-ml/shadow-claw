import { getProjectRoot } from "./resolve-project-root.js";
import { pathToFileURL } from "node:url";

describe("resolve-project-root", () => {
  it("resolves the shadow-claw project root from current module url", () => {
    const root = getProjectRoot();
    expect(root).toContain("shadow-claw");
  });

  it("throws when shadow-claw package.json cannot be found", () => {
    expect(() => {
      getProjectRoot(pathToFileURL("/").href);
    }).toThrow(
      "Could not find shadow-claw project root containing package.json",
    );
  });
});
