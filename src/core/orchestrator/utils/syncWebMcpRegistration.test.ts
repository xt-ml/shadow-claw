import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { CONFIG_KEYS } from "../../../config/config.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { DeclarativeToolDefinition } from "../../../subsystems/tools/declarative.js";
import type { SkillRecord } from "../../../subsystems/skills/types.js";
import type { ToolDefinition } from "../../../subsystems/tools/tools.js";
import type { WebMcpMode } from "../../../subsystems/mcp/webmcp.js";
import { activate_skill } from "../../../subsystems/skills/tool.js";
import type { Orchestrator } from "../orchestrator.js";

const mockRegisterWebMcpTools = jest
  .fn<
    (
      worker: Worker | null,
      onMessage: (msg: unknown) => Promise<void>,
      activeGroupId: string,
      tools: ToolDefinition[],
    ) => Promise<void>
  >()
  .mockResolvedValue(undefined);

const mockUnregisterWebMcpTools = jest.fn<() => void>();
const mockApplyWebMcpMode = jest.fn<(mode: WebMcpMode) => void>();

jest.unstable_mockModule("../../../subsystems/mcp/webmcp.js", () => ({
  registerWebMcpTools: mockRegisterWebMcpTools,
  unregisterWebMcpTools: mockUnregisterWebMcpTools,
  setWebMcpMode: mockApplyWebMcpMode,
}));

const mockHandleWorkerMessage = jest
  .fn<
    (
      orchestrator: Orchestrator,
      db: ShadowClawDatabase,
      msg: unknown,
    ) => Promise<void>
  >()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

jest.unstable_mockModule("../../effect.js", () => ({
  effect: (cb: () => void) => {
    cb();
    return jest.fn();
  },
}));

const mockSetConfig = jest
  .fn<(db: ShadowClawDatabase, key: string, value: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const mockDiscoverSkills = jest
  .fn<
    (
      db: ShadowClawDatabase,
      groupId: string,
    ) => Promise<{ skills: SkillRecord[] }>
  >()
  .mockResolvedValue({ skills: [] });

jest.unstable_mockModule(
  "../../../subsystems/skills/discoverSkills.js",
  () => ({
    discoverSkills: mockDiscoverSkills,
  }),
);

const mockLoadDeclarativeTools = jest
  .fn<
    (
      db: ShadowClawDatabase,
      groupId: string,
    ) => Promise<{ tools: DeclarativeToolDefinition[] }>
  >()
  .mockResolvedValue({ tools: [] });

jest.unstable_mockModule("../../../subsystems/tools/declarative.js", () => ({
  loadDeclarativeTools: mockLoadDeclarativeTools,
}));

let activeGroupId = "group1";
const mockGroups: { groupId: string; toolTags?: string[] }[] = [
  { groupId: "group1", toolTags: ["tool1", "enabled_decl_tool"] },
  { groupId: "group2" },
];
const mockAllTools: ToolDefinition[] = [
  {
    name: "tool1",
    description: "Tool 1",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "tool2",
    description: "Tool 2",
    input_schema: { type: "object", properties: {} },
  },
];
let mockGlobalTools: ToolDefinition[] = [
  {
    name: "tool2",
    description: "Tool 2",
    input_schema: { type: "object", properties: {} },
  },
];
let declarativeToolsFail = false;

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    get activeGroupId() {
      return activeGroupId;
    },
    get groups() {
      return mockGroups;
    },
  },
}));

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: {
    get allTools() {
      return mockAllTools;
    },
    get enabledTools() {
      return mockGlobalTools;
    },
    declarativeTools: [],
    declarativeToolNamesEnabled: null,
    refreshDeclarativeTools: jest.fn(
      async (db: ShadowClawDatabase, gId: string) => {
        if (declarativeToolsFail) {
          throw new Error("OPFS declarative tools load failed");
        }
        const res = await mockLoadDeclarativeTools(db, gId);
        return res?.tools || [];
      },
    ),
    isDeclarativeToolEnabled: jest.fn(
      (name: string) => name === "enabled_decl_tool",
    ),
  },
}));

const { syncWebMcpRegistration, setWebMcpMode, setWebMcpToolsEnabled } =
  await import("./syncWebMcpRegistration.js");

interface MockOrchestrator {
  webMcpEffectCleanup: (() => void) | null;
  webMcpToolsEnabled: boolean;
  webMcpRegistrationLock: Promise<void>;
  agentWorker: Worker | null;
}

describe("syncWebMcpRegistration", () => {
  let mockOrchestrator: MockOrchestrator;
  let mockDb: ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    activeGroupId = "group1";
    declarativeToolsFail = false;
    mockGlobalTools = [
      {
        name: "tool2",
        description: "Tool 2",
        input_schema: { type: "object", properties: {} },
      },
    ];
    mockDb = {} as unknown as ShadowClawDatabase;
    mockOrchestrator = {
      webMcpEffectCleanup: jest.fn(),
      webMcpToolsEnabled: true,
      webMcpRegistrationLock: Promise.resolve(),
      agentWorker: {} as unknown as Worker,
    };
    mockDiscoverSkills.mockResolvedValue({ skills: [] });
    mockLoadDeclarativeTools.mockResolvedValue({
      tools: [
        {
          name: "enabled_decl_tool",
          description: "Enabled Declarative Tool",
          input_schema: { type: "object", properties: {} },
          execution: { type: "bash", command: "echo test" },
        },
        {
          name: "disabled_decl_tool",
          description: "Disabled Declarative Tool",
          input_schema: { type: "object", properties: {} },
          execution: { type: "bash", command: "echo disabled" },
        },
      ],
    });
  });

  it("should clean up existing effect and unregister if not enabled", () => {
    mockOrchestrator.webMcpToolsEnabled = false;
    const cleanupMock = mockOrchestrator.webMcpEffectCleanup!;

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);

    expect(cleanupMock).toHaveBeenCalled();
    expect(mockOrchestrator.webMcpEffectCleanup).toBeNull();
    expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
  });

  it("should setup effect and register tools filtered by group toolTags", async () => {
    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);

    expect(mockOrchestrator.webMcpEffectCleanup).toBeDefined();
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
    expect(mockRegisterWebMcpTools).toHaveBeenCalledWith(
      mockOrchestrator.agentWorker,
      expect.any(Function),
      "group1",
      [
        {
          name: "tool1",
          description: "Tool 1",
          input_schema: { type: "object", properties: {} },
        },
        expect.objectContaining({
          name: "enabled_decl_tool",
          description: "Enabled Declarative Tool",
        }),
      ],
    );

    const onMessageCb = mockRegisterWebMcpTools.mock.calls[0][1];
    await onMessageCb({ type: "worker-message" });
    expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
      mockOrchestrator as unknown as Orchestrator,
      mockDb,
      { type: "worker-message" },
    );
  });

  it("should register globalTools and enabledDeclarativeTools when group has no toolTags", async () => {
    activeGroupId = "group2";

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockRegisterWebMcpTools).toHaveBeenCalledWith(
      mockOrchestrator.agentWorker,
      expect.any(Function),
      "group2",
      [
        {
          name: "tool2",
          description: "Tool 2",
          input_schema: { type: "object", properties: {} },
        },
        expect.objectContaining({
          name: "enabled_decl_tool",
          description: "Enabled Declarative Tool",
        }),
      ],
    );
  });

  it("should register globalTools and enabledDeclarativeTools when activeGroupId is not found in groups", async () => {
    activeGroupId = "unknown-group";

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockRegisterWebMcpTools).toHaveBeenCalledWith(
      mockOrchestrator.agentWorker,
      expect.any(Function),
      "unknown-group",
      [
        {
          name: "tool2",
          description: "Tool 2",
          input_schema: { type: "object", properties: {} },
        },
        expect.objectContaining({
          name: "enabled_decl_tool",
          description: "Enabled Declarative Tool",
        }),
      ],
    );
  });

  it("should ignore OPFS load errors in refreshDeclarativeTools and discoverSkills", async () => {
    declarativeToolsFail = true;
    mockDiscoverSkills.mockRejectedValueOnce(new Error("OPFS skills failure"));

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockRegisterWebMcpTools).toHaveBeenCalled();
  });

  it("should append activate_skill when skills are discovered and tool is not present", async () => {
    mockDiscoverSkills.mockResolvedValueOnce({
      skills: [
        {
          name: "test-skill",
          description: "Test skill description",
          path: "skills/test/SKILL.md",
          basePath: "skills/test",
          userInvocable: true,
          disableModelInvocation: false,
        },
      ],
    });

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockRegisterWebMcpTools).toHaveBeenCalledWith(
      mockOrchestrator.agentWorker,
      expect.any(Function),
      "group1",
      expect.arrayContaining([
        expect.objectContaining({ name: "activate_skill" }),
      ]),
    );
  });

  it("should not duplicate activate_skill if already present in tool list", async () => {
    mockDiscoverSkills.mockResolvedValueOnce({
      skills: [
        {
          name: "test-skill",
          description: "Test skill description",
          path: "skills/test/SKILL.md",
          basePath: "skills/test",
          userInvocable: true,
          disableModelInvocation: false,
        },
      ],
    });
    activeGroupId = "group2";
    mockGlobalTools = [
      {
        name: "tool2",
        description: "Tool 2",
        input_schema: { type: "object", properties: {} },
      },
      activate_skill,
    ];

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    const registeredTools = mockRegisterWebMcpTools.mock.calls[0][3];
    const activateSkillCount = registeredTools.filter(
      (t) => t.name === "activate_skill",
    ).length;
    expect(activateSkillCount).toBe(1);
  });

  it("should catch and log errors in registration lock promise", async () => {
    mockRegisterWebMcpTools.mockRejectedValueOnce(
      new Error("Registration error"),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(consoleError).toHaveBeenCalledWith(
      "WebMCP registration failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("should proceed without calling cleanup if webMcpEffectCleanup is null", async () => {
    mockOrchestrator.webMcpEffectCleanup = null;

    syncWebMcpRegistration(mockOrchestrator as unknown as Orchestrator, mockDb);
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockRegisterWebMcpTools).toHaveBeenCalled();
  });

  describe("setWebMcpMode", () => {
    it("should unregister tools, apply mode, save config, and trigger sync", async () => {
      const syncDeps = {
        orchestrator: mockOrchestrator as unknown as Orchestrator,
      };

      await setWebMcpMode(mockOrchestrator, mockDb, "native", syncDeps);
      await mockOrchestrator.webMcpRegistrationLock;

      expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
      expect(mockApplyWebMcpMode).toHaveBeenCalledWith("native");
      expect(mockSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.WEBMCP_MODE,
        "native",
      );
      expect(mockRegisterWebMcpTools).toHaveBeenCalled();
    });
  });

  describe("setWebMcpToolsEnabled", () => {
    it("should update enabled state to true, persist config, and sync", async () => {
      mockOrchestrator.webMcpToolsEnabled = false;
      const syncDeps = {
        orchestrator: mockOrchestrator as unknown as Orchestrator,
      };

      await setWebMcpToolsEnabled(mockOrchestrator, mockDb, true, syncDeps);
      await mockOrchestrator.webMcpRegistrationLock;

      expect(mockOrchestrator.webMcpToolsEnabled).toBe(true);
      expect(mockSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
        "true",
      );
      expect(mockRegisterWebMcpTools).toHaveBeenCalled();
    });

    it("should update enabled state to false, persist config, and sync", async () => {
      mockOrchestrator.webMcpToolsEnabled = true;
      const syncDeps = {
        orchestrator: mockOrchestrator as unknown as Orchestrator,
      };

      await setWebMcpToolsEnabled(mockOrchestrator, mockDb, false, syncDeps);

      expect(mockOrchestrator.webMcpToolsEnabled).toBe(false);
      expect(mockSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
        "false",
      );
      expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
    });
  });
});
