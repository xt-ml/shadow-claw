import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import {
  registerWebMcpTools,
  unregisterWebMcpTools,
} from "../../../subsystems/mcp/webmcp.js";

import { effect } from "../../effect.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

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
    const groups = orchestratorStore.groups;
    const group = groups.find((g) => g.groupId === activeGroupId);
    const tools =
      group?.toolTags && group.toolTags.length > 0
        ? allTools.filter((t) => group.toolTags!.includes(t.name))
        : globalTools;

    // Serialize WebMCP registration calls to prevent overlapping unregister/register cycles.
    orchestrator.webMcpRegistrationLock = orchestrator.webMcpRegistrationLock
      .then(async () => {
        unregisterWebMcpTools();
        // Small delay to allow the browser's ModelContext to process the unregistrations.
        await new Promise((resolve) => setTimeout(resolve, 0));

        await registerWebMcpTools(
          orchestrator.agentWorker,
          async (msg) => {
            await orchestrator.handleWorkerMessage(db, msg);
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
