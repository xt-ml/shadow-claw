import { jest } from "@jest/globals";

describe("toggleTerminalVisibility", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let toggleTerminalVisibility: any;
  let mockScheduleTerminalPlacement: any;
  let mockUpdateTerminalToggle: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {
      terminalVisible: false,
      currentPage: "chat",
      vmStatus: "running",
      terminalElement: {},
      terminalPlacementFrame: 123,
    };

    mockScheduleTerminalPlacement = jest.fn();
    mockUpdateTerminalToggle = jest.fn();

    jest.unstable_mockModule("./schedule-terminal-placement.js", () => ({
      scheduleTerminalPlacement: mockScheduleTerminalPlacement,
    }));
    jest.unstable_mockModule("./update-terminal-toggle.js", () => ({
      updateTerminalToggle: mockUpdateTerminalToggle,
    }));

    const module = await import("./toggle-terminal-visibility.js");
    toggleTerminalVisibility = module.toggleTerminalVisibility;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should toggle terminalVisible and call sync functions", () => {
    toggleTerminalVisibility(shadowRoot, shadowClaw);

    expect(shadowClaw.terminalVisible).toBe(true);

    expect(mockUpdateTerminalToggle).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      true,
      "running",
    );

    expect(mockScheduleTerminalPlacement).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      shadowClaw.terminalElement,
      true,
      123,
    );
  });
});
