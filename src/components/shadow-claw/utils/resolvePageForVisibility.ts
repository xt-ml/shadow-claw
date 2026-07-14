import { OrchestratorStore } from "../../../stores/orchestrator.js";
import { getDefaultSidebarPage } from "./getDefaultSidebarPage.js";

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
