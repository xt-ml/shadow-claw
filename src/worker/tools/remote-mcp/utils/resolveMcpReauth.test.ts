import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { resolveMcpReauth } from "./resolveMcpReauth.js";
import { pendingReauthRequests, reauthTimeoutHandles } from "../remote-mcp.js";

describe("resolveMcpReauth", () => {
  beforeEach(() => {
    pendingReauthRequests.clear();
    reauthTimeoutHandles.clear();
    jest.clearAllMocks();
  });

  it("clears active timeout and invokes resolve callback when both exist", () => {
    const mockResolve = jest.fn<(success: boolean) => void>();
    const fakeTimer = setTimeout(() => {}, 10000);

    reauthTimeoutHandles.set("conn-1", fakeTimer);
    pendingReauthRequests.set("conn-1", mockResolve);

    resolveMcpReauth("conn-1", true);

    expect(mockResolve).toHaveBeenCalledWith(true);
    expect(reauthTimeoutHandles.has("conn-1")).toBe(false);
    expect(pendingReauthRequests.has("conn-1")).toBe(false);
  });

  it("handles case where only timeout handle exists", () => {
    const fakeTimer = setTimeout(() => {}, 10000);
    reauthTimeoutHandles.set("conn-2", fakeTimer);

    resolveMcpReauth("conn-2", false);

    expect(reauthTimeoutHandles.has("conn-2")).toBe(false);
  });

  it("handles case where only resolve callback exists", () => {
    const mockResolve = jest.fn<(success: boolean) => void>();
    pendingReauthRequests.set("conn-3", mockResolve);

    resolveMcpReauth("conn-3", false);

    expect(mockResolve).toHaveBeenCalledWith(false);
    expect(pendingReauthRequests.has("conn-3")).toBe(false);
  });

  it("safely handles non-existent connectionId", () => {
    expect(() => resolveMcpReauth("non-existent", true)).not.toThrow();
  });
});
