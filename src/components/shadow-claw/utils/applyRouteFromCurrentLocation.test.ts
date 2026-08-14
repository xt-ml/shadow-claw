import { jest } from "@jest/globals";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

describe("applyRouteFromCurrentLocation", () => {
  let applyRouteFromCurrentLocation: any;
  let shadow: ShadowRoot | null;
  let shadowClaw: ShadowClaw;
  let db: ShadowClawDatabase | null;
  let fStore: FileViewerStore;
  let oStore: OrchestratorStore;
  let url: URL;

  let mockParseRouteFromUrlAsync: jest.Mock<any>;
  let mockApplyRoute: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.unstable_mockModule("../../../core/app-routes.js", () => ({
      parseRouteFromUrlAsync: jest.fn(),
    }));
    jest.unstable_mockModule("./applyRoute.js", () => ({
      applyRoute: jest.fn(),
    }));

    const appRoutes = await import("../../../core/app-routes.js");
    mockParseRouteFromUrlAsync =
      appRoutes.parseRouteFromUrlAsync as jest.Mock<any>;

    const applyRouteModule = await import("./applyRoute.js");
    mockApplyRoute = applyRouteModule.applyRoute as jest.Mock<any>;

    const module = await import("./applyRouteFromCurrentLocation.js");
    applyRouteFromCurrentLocation = module.applyRouteFromCurrentLocation;

    shadow = {
      querySelector: jest.fn(),
    } as unknown as ShadowRoot;
    shadowClaw = {} as ShadowClaw;
    db = {} as ShadowClawDatabase;
    fStore = {
      closeFile: jest.fn(),
      openFile: jest.fn(),
      file: undefined,
    } as any;
    oStore = {
      activeGroupId: "group1",
      switchConversation: jest.fn(),
      loadHistory: jest.fn(),
      loadFiles: jest.fn(),
      setCurrentPath: jest.fn(),
    } as any;
    url = new URL("https://example.com/test?group=group1");

    mockParseRouteFromUrlAsync.mockResolvedValue({
      page: "files",
      groupId: "group1",
      path: "/test/path",
      anchor: undefined,
    });
    mockApplyRoute.mockResolvedValue(undefined as any);
  });

  it("should return early if parseRouteFromUrlAsync returns null", async () => {
    mockParseRouteFromUrlAsync.mockResolvedValue(null);

    await applyRouteFromCurrentLocation(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      url,
    );

    expect(mockParseRouteFromUrlAsync).toHaveBeenCalledWith(
      url,
      oStore.activeGroupId,
    );
    expect(mockApplyRoute).not.toHaveBeenCalled();
  });

  it("should call applyRoute with parsed route", async () => {
    await applyRouteFromCurrentLocation(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      url,
    );

    expect(mockParseRouteFromUrlAsync).toHaveBeenCalledWith(
      url,
      oStore.activeGroupId,
    );
    expect(mockApplyRoute).toHaveBeenCalledWith(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      {
        page: "files",
        groupId: "group1",
        path: "/test/path",
        anchor: undefined,
      },
    );
  });

  it("should pass through db as null", async () => {
    db = null;

    await applyRouteFromCurrentLocation(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      url,
    );

    expect(mockApplyRoute).toHaveBeenCalledWith(
      shadow,
      shadowClaw,
      null,
      fStore,
      oStore,
      {
        page: "files",
        groupId: "group1",
        path: "/test/path",
        anchor: undefined,
      },
    );
  });

  it("should await applyRoute", async () => {
    const mockApplyRoutePromise = Promise.resolve();
    mockApplyRoute.mockReturnValue(mockApplyRoutePromise);

    const promise = applyRouteFromCurrentLocation(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      url,
    );
    await Promise.resolve(); // Let the microtask queue settle
    expect(mockApplyRoute).toHaveBeenCalled();
    await promise;
  });
});
