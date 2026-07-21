import { jest } from "@jest/globals";

import { OrchestratorStore } from "../../../stores/orchestrator.js";
import { getDefaultSidebarPage } from "./getDefaultSidebarPage";

describe("getDefaultSidebarPage", () => {
  let mockOStore: Partial<OrchestratorStore>;

  beforeEach(() => {
    mockOStore = {
      sidebarDefaultPage: "chat", // default value
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 'chat' when sidebarDefaultPage is 'chat'", () => {
    (mockOStore as any).sidebarDefaultPage = "chat";
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("chat");
  });

  it("returns 'tasks' when sidebarDefaultPage is 'tasks'", () => {
    (mockOStore as any).sidebarDefaultPage = "tasks";
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("tasks");
  });

  it("returns 'files' when sidebarDefaultPage is 'files'", () => {
    (mockOStore as any).sidebarDefaultPage = "files";
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("files");
  });

  it("defaults to 'chat' when sidebarDefaultPage is not one of the allowed values", () => {
    (mockOStore as any).sidebarDefaultPage = "unknown";
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("chat");
  });

  it("defaults to 'chat' when sidebarDefaultPage is empty string", () => {
    (mockOStore as any).sidebarDefaultPage = "";
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("chat");
  });

  it("defaults to 'chat' when sidebarDefaultPage is null", () => {
    // @ts-ignore - we are intentionally setting null to test the fallback
    (mockOStore as any).sidebarDefaultPage = null;
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("chat");
  });

  it("defaults to 'chat' when sidebarDefaultPage is undefined", () => {
    // @ts-ignore - we are intentionally setting undefined to test the fallback
    (mockOStore as any).sidebarDefaultPage = undefined;
    const result = getDefaultSidebarPage(mockOStore as OrchestratorStore);
    expect(result).toBe("chat");
  });
});
