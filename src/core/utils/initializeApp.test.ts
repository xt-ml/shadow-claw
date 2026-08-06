import { jest } from "@jest/globals";

/**
 * Regression tests for the sc-prerender-override flash fix.
 *
 * Previously, initializeApp called clearBootPendingClass() in a finally block
 * immediately after `await orchestratorStore.whenReady`. This raced with
 * shadow-claw-pages.connectedCallback(), which also awaited whenReady and then
 * fired an async renderSelectedPage() — making shadow-claw visible while the
 * CSR content was still loading from OPFS/markdown rendering.
 *
 * The fix moves clearBootPendingClass into shadow-claw.ts so it runs
 * synchronously AFTER applyRouteFromCurrentLocation() completes
 * (which itself awaits pagesComp.renderSelectedPage()). initializeApp
 * no longer touches the boot-pending class at all.
 */

describe("initializeApp", () => {
  let mockWhenReady: Promise<void>;
  let resolveReady: () => void;

  beforeEach(() => {
    jest.resetModules();

    mockWhenReady = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
      orchestratorStore: {
        whenReady: mockWhenReady,
      },
    }));

    jest.unstable_mockModule("../../testing/e2e-bridge.js", () => ({
      shouldInstallE2eBridge: jest.fn(() => false),
      installE2eBridge: jest.fn(),
    }));

    jest.unstable_mockModule(
      "../../components/shadow-claw/shadow-claw.js",
      () => ({}),
    );
    jest.unstable_mockModule(
      "../../core/orchestrator/orchestrator.js",
      () => ({}),
    );
  });

  it("does not import or call clearBootPendingClass", async () => {
    // Verify clearBootPendingClass is NOT imported by initializeApp — the
    // boot-class removal must happen in shadow-claw.ts after the full
    // render cycle, not here where it would race with async CSR content.
    const mockClearBoot = jest.fn();
    jest.unstable_mockModule(
      "../../core/utils/clearBootPendingClass.js",
      () => ({
        clearBootPendingClass: mockClearBoot,
      }),
    );

    const doc = {
      querySelector: jest.fn(() => ({
        orchestrator: {},
      })),
      body: { appendChild: jest.fn((el) => el) },
      createElement: jest.fn(() => ({ orchestrator: {} })),
    } as unknown as Document;

    const { initializeApp } = await import("./initializeApp.js");

    const promise = initializeApp(doc, false);
    resolveReady();
    await promise;

    expect(mockClearBoot).not.toHaveBeenCalled();
  });

  it("resolves after orchestratorStore.whenReady resolves", async () => {
    const doc = {
      querySelector: jest.fn(() => ({ orchestrator: {} })),
      body: { appendChild: jest.fn((el) => el) },
      createElement: jest.fn(() => ({ orchestrator: {} })),
    } as unknown as Document;

    const { initializeApp } = await import("./initializeApp.js");

    let resolved = false;
    const promise = initializeApp(doc, false).then(() => {
      resolved = true;
    });

    // Has not resolved yet
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Trigger whenReady
    resolveReady();
    await promise;
    expect(resolved).toBe(true);
  });

  it("returns early when isInitializing is true", async () => {
    const doc = {
      querySelector: jest.fn(),
      body: { appendChild: jest.fn() },
      createElement: jest.fn(),
    } as unknown as Document;

    const { initializeApp } = await import("./initializeApp.js");

    const result = await initializeApp(doc, true);
    expect(result).toBeUndefined();
    expect(doc.querySelector).not.toHaveBeenCalled();
  });
});
