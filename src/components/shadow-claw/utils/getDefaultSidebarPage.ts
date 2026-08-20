import { OrchestratorStore } from "../../../stores/orchestrator.js";

interface SidebarContext {
  pagesSidebarHidden?: boolean;
  chatSidebarHidden?: boolean;
  tasksSidebarHidden?: boolean;
  filesSidebarHidden?: boolean;
}

export function getDefaultSidebarPage(
  oStore: OrchestratorStore,
  context?: SidebarContext,
): "pages" | "chat" | "tasks" | "files" {
  const preferred = oStore.sidebarDefaultPage;
  const candidates: Array<"pages" | "chat" | "tasks" | "files"> = [
    preferred,
    "pages",
    "chat",
    "tasks",
    "files",
  ];

  if (!context) {
    if (
      preferred === "pages" ||
      preferred === "chat" ||
      preferred === "tasks" ||
      preferred === "files"
    ) {
      return preferred;
    }
    return "chat";
  }

  for (const page of candidates) {
    if (page === "pages" && !context.pagesSidebarHidden) {
      return "pages";
    }
    if (page === "chat" && !context.chatSidebarHidden) {
      return "chat";
    }
    if (page === "tasks" && !context.tasksSidebarHidden) {
      return "tasks";
    }
    if (page === "files" && !context.filesSidebarHidden) {
      return "files";
    }
  }

  return "pages";
}
