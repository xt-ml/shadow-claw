import { isCustomElementScriptDomainAllowed } from "./is-custom-element-script-domain-allowed.mjs";

describe("isCustomElementScriptDomainAllowed", () => {
  it("allows local relative script paths", () => {
    expect(
      isCustomElementScriptDomainAllowed("local-script.mjs", [
        "allowed.example.com",
      ]),
    ).toBe(true);
  });

  it("allows matching and subdomain hosts and blocks non-matching hosts", () => {
    expect(
      isCustomElementScriptDomainAllowed("https://allowed.example.com/x.mjs", [
        "allowed.example.com",
      ]),
    ).toBe(true);
    expect(
      isCustomElementScriptDomainAllowed(
        "https://sub.allowed.example.com/x.mjs",
        ["allowed.example.com"],
      ),
    ).toBe(true);
    expect(
      isCustomElementScriptDomainAllowed("https://bad.example.com/x.mjs", [
        "allowed.example.com",
      ]),
    ).toBe(false);
  });

  it("handles wildcard and no-domain-filter behavior", () => {
    expect(
      isCustomElementScriptDomainAllowed("https://any.example.com/x.mjs", "*"),
    ).toBe(true);
    expect(
      isCustomElementScriptDomainAllowed("https://no-filter.example.com/x.mjs"),
    ).toBe(true);
    expect(
      isCustomElementScriptDomainAllowed("https://bad.example.com/x.mjs", ""),
    ).toBe(true);
    expect(
      isCustomElementScriptDomainAllowed("https://bad.example.com/x.mjs", []),
    ).toBe(true);
  });

  it("returns false for invalid URLs when allow list is enforced", () => {
    expect(
      isCustomElementScriptDomainAllowed("http://[::1", ["example.com"]),
    ).toBe(false);
  });

  it("accepts non-http URL strings with matching hostname parsing", () => {
    expect(
      isCustomElementScriptDomainAllowed("ftp://allowed.example.com/x.mjs", [
        "allowed.example.com",
      ]),
    ).toBe(true);
    expect(isCustomElementScriptDomainAllowed("::not a url::", ["any"])).toBe(
      true,
    );
  });
});
