import { jest } from "@jest/globals";
import {
  isValidUAX31Identifier,
  CatalogRegistry,
  globalCatalogRegistry,
} from "./catalog-registry.js";

describe("catalog-registry", () => {
  describe("isValidUAX31Identifier", () => {
    it("validates identifiers correctly", () => {
      expect(isValidUAX31Identifier("validName")).toBe(true);
      expect(isValidUAX31Identifier("_underscore")).toBe(true);
      expect(isValidUAX31Identifier("func_123")).toBe(true);
      expect(isValidUAX31Identifier("123invalid")).toBe(false);
      expect(isValidUAX31Identifier("has-hyphen")).toBe(false);
      expect(isValidUAX31Identifier("has space")).toBe(false);
      expect(isValidUAX31Identifier("")).toBe(false);
    });
  });

  describe("CatalogRegistry", () => {
    it("throws if catalogId is empty", () => {
      const registry = new CatalogRegistry();
      expect(() => registry.register("", {})).toThrow("Catalog ID is required");
    });

    it("registers and retrieves a catalog definition", () => {
      const registry = new CatalogRegistry();
      const def = { title: "Test Catalog" };
      registry.register("test-catalog", def);
      expect(registry.get("test-catalog")).toBe(def);
      expect(registry.get("non-existent")).toBeUndefined();
    });

    it("warns if functions contain non-UAX31 identifiers", () => {
      const registry = new CatalogRegistry();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      registry.register("warn-catalog", {
        functions: {
          valid_func: {},
          "invalid-func": {},
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Function name "invalid-func" does not conform to UAX #31',
        ),
      );
      warnSpy.mockRestore();
    });

    it("provides globalCatalogRegistry instance", () => {
      expect(globalCatalogRegistry).toBeInstanceOf(CatalogRegistry);
    });
  });
});
