import { BASIC_CATALOG_REFERENCE } from "../../../ui/a2ui/types.js";
import { executeListComponents } from "./list-components.js";

describe("executeListComponents", () => {
  it("returns the basic catalog reference string", () => {
    const result = executeListComponents();
    expect(result).toBe(BASIC_CATALOG_REFERENCE);
    expect(result).toContain("A2UI Basic Catalog");
  });
});
