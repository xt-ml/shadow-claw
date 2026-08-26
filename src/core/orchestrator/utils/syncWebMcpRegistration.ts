import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import {
  setWebMcpMode as applyWebMcpMode,
  registerWebMcpTools,
  unregisterWebMcpTools,
} from "../../../subsystems/mcp/webmcp.js";

import { effect } from "../../effect.js";
import { handleWorkerMessage } from "./handleWorkerMessage.js";

import { CONFIG_KEYS } from "../../../config/config.js";
import { setConfig } from "../../../db/setConfig.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { WebMcpMode } from "../../../subsystems/mcp/webmcp.js";
import type { OrchestratorState } from "../orchestrator-state.js";
import type { Orchestrator } from "../orchestrator.js";

import { discoverSkills } from "../../../subsystems/skills/discoverSkills.js";
import { activate_skill } from "../../../subsystems/skills/tool.js";

export function syncWebMcpRegistration(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): void {
  if (typeof orchestrator.webMcpEffectCleanup === "function") {
    orchestrator.webMcpEffectCleanup();
    orchestrator.webMcpEffectCleanup = null;
  }

  if (!orchestrator.webMcpToolsEnabled) {
    unregisterWebMcpTools();

    return;
  }

  // Register WebMCP tools and re-register when tool config changes.
  // This effect runs once immediately to perform the initial registration.
  // We intentionally do NOT call isWebMcpSupported() here — that accesses
  // the browser's modelContext API which can crash Chrome Canary's
  // early-preview renderer. Instead, registerWebMcpTools handles feature detection
  // internally and skips modelContext access entirely when 0 tools are
  // passed.
  orchestrator.webMcpEffectCleanup = effect(() => {
    // Access signals to establish tracking.
    const activeGroupId = orchestratorStore.activeGroupId;
    const allTools = toolsStore.allTools;
    const globalTools = toolsStore.enabledTools;
    void toolsStore.declarativeTools;
    void toolsStore.declarativeToolNamesEnabled;
    const groups = orchestratorStore.groups;
    const group = groups.find((g) => g.groupId === activeGroupId);

    // Serialize WebMCP registration calls to prevent overlapping unregister/register cycles.
    orchestrator.webMcpRegistrationLock = orchestrator.webMcpRegistrationLock
      .then(async () => {
        unregisterWebMcpTools();
        // Small delay to allow the browser's ModelContext to process the unregistrations.
        await new Promise((resolve) => setTimeout(resolve, 0));

        let declarativeTools: any[] = [];
        try {
          declarativeTools = await toolsStore.refreshDeclarativeTools(
            db,
            activeGroupId,
          );
        } catch {
          // Ignore OPFS load errors
        }

        const enabledDeclarativeTools = declarativeTools.filter((dt) =>
          toolsStore.isDeclarativeToolEnabled(dt.name),
        );

        const candidateTools = [...allTools, ...declarativeTools];
        let tools =
          group?.toolTags && group.toolTags.length > 0
            ? candidateTools.filter((t) => group.toolTags!.includes(t.name))
            : [...globalTools, ...enabledDeclarativeTools];

        let skillDiscovery: { skills: any[] } = { skills: [] };
        try {
          skillDiscovery = await discoverSkills(db, activeGroupId);
        } catch {
          // Ignore OPFS load errors
        }

        if (
          skillDiscovery.skills.length > 0 &&
          !tools.some((t) => t.name === activate_skill.name)
        ) {
          tools = [...tools, activate_skill];
        }

        await registerWebMcpTools(
          orchestrator.agentWorker,
          async (msg) => {
            await handleWorkerMessage(orchestrator, db, msg);
          },
          activeGroupId,
          tools,
        );
      })
      .catch((err) => {
        console.error("WebMCP registration failed:", err);
      });
  });
}
export async function setWebMcpMode(
  _state: Pick<
    OrchestratorState,
    "webMcpToolsEnabled" | "webMcpRegistrationLock"
  > & {
    webMcpEffectCleanup: (() => void) | null;
    agentWorker: Worker | null;
  },
  db: ShadowClawDatabase,
  mode: WebMcpMode,
  syncDeps: { orchestrator: Orchestrator },
): Promise<void> {
  // Unregister with old mode, switch, re-register with new mode.
  unregisterWebMcpTools();
  applyWebMcpMode(mode);

  await setConfig(db, CONFIG_KEYS.WEBMCP_MODE, mode);

  syncWebMcpRegistration(syncDeps.orchestrator, db);
}

export async function setWebMcpToolsEnabled(
  state: Pick<OrchestratorState, "webMcpToolsEnabled">,
  db: ShadowClawDatabase,
  enabled: boolean,
  syncDeps: { orchestrator: Orchestrator },
): Promise<void> {
  state.webMcpToolsEnabled = !!enabled;

  await setConfig(
    db,
    CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
    state.webMcpToolsEnabled ? "true" : "false",
  );

  syncWebMcpRegistration(syncDeps.orchestrator, db);
}
