import { OrchestratorStore } from "../../../stores/orchestrator.js";

export function getDefaultSidebarPage(
  oStore: OrchestratorStore,
): "chat" | "tasks" | "files" {
  const page = oStore.sidebarDefaultPage;
  if (page === "chat" || page === "tasks" || page === "files") {
    return page;
  }

  return "chat";
}
