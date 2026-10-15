import { OrchestratorStore } from "../../../stores/orchestrator.js";
import { getDefaultSidebarPage } from "./get-default-sidebar-page.js";

export function resolvePageForVisibility(
  oStore: OrchestratorStore,
  page: string,
  pagesSidebarHidden: boolean,
): string {
  if (pagesSidebarHidden && page === "pages") {
    return getDefaultSidebarPage(oStore);
  }

  return page;
}
