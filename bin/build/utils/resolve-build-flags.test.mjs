import { resolveBuildFlags } from "./resolve-build-flags.mjs";

describe("resolveBuildFlags", () => {
  it("resolves production and copyAllAssets flags", () => {
    const flags = resolveBuildFlags({
      NODE_ENV: "production",
      COPY_ALL_ASSETS: "true",
    });

    expect(flags.isProduction).toBe(true);
    expect(flags.copyAllAssets).toBe(true);
  });

  it("defaults prerenderPages and enables prerenderMainMemory", () => {
    const flags = resolveBuildFlags({});

    expect(flags.prerenderPages).toBe("all");
    expect(flags.prerenderMainMemory).toBe(true);
  });

  it("supports omitted environment argument", () => {
    const flags = resolveBuildFlags();
    expect(flags).toEqual(
      expect.objectContaining({
        isProduction: false,
        copyAllAssets: false,
        prerenderPages: "all",
        prerenderMainMemory: true,
      }),
    );
  });

  it("disables prerenderMainMemory for false/none/0", () => {
    expect(
      resolveBuildFlags({
        PRERENDER_MAIN_MEMORY: "false",
        PRERENDER_PAGES: "all",
      }).prerenderMainMemory,
    ).toBe(false);
    expect(
      resolveBuildFlags({ PRERENDER_PAGES: "none" }).prerenderMainMemory,
    ).toBe(false);
    expect(
      resolveBuildFlags({ PRERENDER_PAGES: "0" }).prerenderMainMemory,
    ).toBe(false);
  });
});
