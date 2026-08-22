import { getApprovedCustomElementScripts } from "./get-approved-custom-element-scripts.mjs";

describe("getApprovedCustomElementScripts", () => {
  it("approves allowed scripts and warns on rejected script domains", () => {
    const warns = [];
    const approved = getApprovedCustomElementScripts(
      [
        "",
        "https://bad.example.com/x.mjs",
        "https://allowed.example.com/x.mjs",
        { src: "local.mjs" },
      ],
      ["allowed.example.com"],
      (message) => warns.push(message),
    );

    expect(approved).toEqual([
      "https://allowed.example.com/x.mjs",
      { src: "local.mjs" },
    ]);
    expect(warns).toEqual([
      "[Security] Skipping script from unapproved domain during build: https://bad.example.com/x.mjs",
    ]);
  });

  it("returns empty list when scripts are absent", () => {
    expect(
      getApprovedCustomElementScripts(undefined, ["allowed.example.com"]),
    ).toEqual([]);
    expect(
      getApprovedCustomElementScripts([], ["allowed.example.com"]),
    ).toEqual([]);
  });
});
