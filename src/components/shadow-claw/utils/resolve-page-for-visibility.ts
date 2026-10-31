import { OrchestratorStore } from "../../../stores/orchestrator.js";
import { getDefaultSidebarPage } from "./get-default-sidebar-page.js";

export function resolvePageForVisibility(
  oStore: OrchestratorStore,
  page: string,
  pagesSidebarHidden: boolean,
  context?: Parameters<typeof getDefaultSidebarPage>[1],
): string {
  if (pagesSidebarHidden && page === "pages") {
    if (oStore.sidebarDefaultPage === "pages") {
      return "pages";
    }
    return getDefaultSidebarPage(oStore, context);
  }

  return page;
}
