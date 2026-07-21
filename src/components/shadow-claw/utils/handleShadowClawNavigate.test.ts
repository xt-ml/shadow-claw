import { jest } from "@jest/globals";

describe("handleShadowClawNavigate", () => {
  let handleShadowClawNavigate: any;
  let navigateToRouteMock: jest.Mock<any>;
  let normalizePageRouteMock: jest.Mock<any>;
  let shadow: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let fStore: any;
  let oStore: any;
  let event: Event;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("./navigateToRoute.js", () => ({
      navigateToRoute: jest.fn(),
    }));
    jest.unstable_mockModule("./normalizePageRoute.js", () => ({
      normalizePageRoute: jest.fn(),
    }));
    // Re-import the mocked functions
    const navigateModule = await import("./navigateToRoute.js");
    navigateToRouteMock = navigateModule.navigateToRoute as jest.Mock<any>;
    const normalizeModule = await import("./normalizePageRoute.js");
    normalizePageRouteMock =
      normalizeModule.normalizePageRoute as jest.Mock<any>;
    const mainModule = await import("./handleShadowClawNavigate.js");
    handleShadowClawNavigate = mainModule.handleShadowClawNavigate;

    shadow = {} as any;
    shadowClaw = {};
    db = {};
    fStore = {};
    oStore = {
      switchConversation: jest.fn(),
      activeGroupId: "g1",
      loadHistory: jest.fn(),
    };
    event = new CustomEvent("shadow-claw-navigate", { detail: undefined });
  });

  const callHandler = async (detail: any) => {
    event = new CustomEvent("shadow-claw-navigate", { detail });
    await handleShadowClawNavigate(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      event,
    );
  };

  it("should do nothing if event.detail is undefined", async () => {
    await callHandler(undefined);
    expect(navigateToRouteMock).not.toHaveBeenCalled();
    expect(normalizePageRouteMock).not.toHaveBeenCalled();
  });

  it("should call normalizePageRoute with the page or default 'chat'", async () => {
    const detail = {
      page: "home",
      groupId: "g1",
      path: "/path",
      anchor: "anchor",
    };
    await callHandler(detail);
    expect(normalizePageRouteMock).toHaveBeenCalledWith(String(detail.page));
    // Test default page
    await callHandler({ groupId: "g1", path: "/path", anchor: "anchor" });
    expect(normalizePageRouteMock).toHaveBeenCalledWith("chat");
  });

  it("should call navigateToRoute with the correct parameters", async () => {
    const normalizedPage = "normalized-page";
    normalizePageRouteMock.mockReturnValue(normalizedPage);
    const detail = {
      page: "home",
      groupId: "g1",
      path: "/path",
      anchor: "anchor",
    };
    await callHandler(detail);
    expect(navigateToRouteMock).toHaveBeenCalledWith(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      {
        page: normalizedPage,
        groupId: detail.groupId,
        path: detail.path,
        anchor: detail.anchor,
      },
    );
  });

  it("should use undefined for missing optional fields", async () => {
    const normalizedPage = "normalized-page";
    normalizePageRouteMock.mockReturnValue(normalizedPage);
    const detail = { page: "home" }; // missing groupId, path, anchor
    await callHandler(detail);
    expect(navigateToRouteMock).toHaveBeenCalledWith(
      shadow,
      shadowClaw,
      db,
      fStore,
      oStore,
      {
        page: normalizedPage,
        groupId: undefined,
        path: undefined,
        anchor: undefined,
      },
    );
  });
});
