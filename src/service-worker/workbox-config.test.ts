type WorkboxConfigShape = {
  runtimeCaching: Array<{
    urlPattern: (ctx: { url: URL }) => boolean;
  }>;
};

let workboxConfig: WorkboxConfigShape;

beforeAll(async () => {
  const imported = (await import("./workbox-config.cjs")) as
    | WorkboxConfigShape
    | { default: WorkboxConfigShape };
  workboxConfig =
    "default" in imported ? imported.default : (imported as WorkboxConfigShape);
});

describe("workbox runtime caching rules", () => {
  it("does not cache same-origin telegram proxy requests", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;

    expect(
      matcher({
        url: new URL(
          "http://localhost:8888/telegram/bot123456:getUpdates?offset=0&timeout=30",
        ),
      }),
    ).toBe(false);
  });

  it("still caches regular same-origin app assets", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;

    expect(
      matcher({
        url: new URL("http://localhost:8888/index.js"),
      }),
    ).toBe(true);
  });
});
