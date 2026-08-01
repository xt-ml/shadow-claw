import { jest } from "@jest/globals";

describe("loadAppShell", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("dynamically imports the app shell component", async () => {
    let shellModuleLoaded = false;

    jest.unstable_mockModule(
      "../../components/shadow-claw/shadow-claw.js",
      () => {
        shellModuleLoaded = true;
        return {};
      },
    );

    const { loadAppShell } = await import("./loadAppShell.js");

    expect(shellModuleLoaded).toBe(false);

    await loadAppShell();

    expect(shellModuleLoaded).toBe(true);
  });
});
