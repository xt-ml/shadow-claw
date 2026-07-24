import { jest } from "@jest/globals";

describe("setupEffects", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let oStore: any;

  let mockEffect: any;
  let mockShowSuccess: any;
  let mockShowPage: any;
  let mockUpdateActivityLogToggleVisibility: any;
  let setupEffects: any;

  let effectCallbacks: Array<() => void>;

  beforeEach(async () => {
    jest.clearAllMocks();

    effectCallbacks = [];
    mockEffect = (jest.fn() as any).mockImplementation((cb: () => void) => {
      effectCallbacks.push(cb);
    });

    mockShowSuccess = jest.fn();
    mockShowPage = jest.fn();
    mockUpdateActivityLogToggleVisibility = jest.fn();

    jest.unstable_mockModule("../../../core/effect.js", () => ({
      effect: mockEffect,
    }));

    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showSuccess: mockShowSuccess,
    }));

    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: mockShowPage,
    }));

    jest.unstable_mockModule("./updateActivityLogToggleVisibility.js", () => ({
      updateActivityLogToggleVisibility: mockUpdateActivityLogToggleVisibility,
    }));

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = { previousOrchestratorState: "idle", currentPage: "chat" };
    db = {};
    oStore = { state: "idle", activePage: "chat", activityLog: [] };

    const module = await import("./setupEffects.js");
    setupEffects = module.setupEffects;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if shadowRoot is null", () => {
    setupEffects(null, shadowClaw, db, oStore);
    expect(mockEffect).not.toHaveBeenCalled();
  });

  it("should register three effects", () => {
    setupEffects(shadowRoot, shadowClaw, db, oStore);
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });

  it("orchestrator state effect should showSuccess when transitioning to idle from thinking/responding", () => {
    setupEffects(shadowRoot, shadowClaw, db, oStore);
    const cb = effectCallbacks[0];

    // No transition to idle
    cb();
    expect(mockShowSuccess).not.toHaveBeenCalled();

    // From thinking to idle
    shadowClaw.previousOrchestratorState = "thinking";
    oStore.state = "idle";
    cb();
    expect(mockShowSuccess).toHaveBeenCalledWith("Response complete", 2500);

    mockShowSuccess.mockClear();

    // From responding to idle
    shadowClaw.previousOrchestratorState = "responding";
    oStore.state = "idle";
    cb();
    expect(mockShowSuccess).toHaveBeenCalledWith("Response complete", 2500);

    // Updates previous state
    expect(shadowClaw.previousOrchestratorState).toBe("idle");
  });

  it("page change effect should call showPage when page differs", () => {
    setupEffects(shadowRoot, shadowClaw, db, oStore);
    const cb = effectCallbacks[1];

    // Same page
    cb();
    expect(mockShowPage).not.toHaveBeenCalled();

    // Different page
    oStore.activePage = "files";
    cb();
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      oStore,
      "files",
      false,
    );
  });

  it("activityLog effect should update visibility", () => {
    setupEffects(shadowRoot, shadowClaw, db, oStore);
    const cb = effectCallbacks[2];

    oStore.activityLog = [1, 2, 3];
    cb();

    expect(mockUpdateActivityLogToggleVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      3,
    );
  });
});
