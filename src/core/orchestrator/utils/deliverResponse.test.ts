import { jest } from "@jest/globals";

import type { ShadowClawDatabase } from "../../../db/db.js";

const mockSaveMessage = jest.fn() as any;
const mockPlayNotificationChime = jest.fn() as any;
const mockUlid = jest.fn() as any;

jest.unstable_mockModule("../../../db/saveMessage.js", () => ({
  saveMessage: mockSaveMessage,
}));

jest.unstable_mockModule("../../../ui/audio.js", () => ({
  playNotificationChime: mockPlayNotificationChime,
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: mockUlid,
}));

const { deliverIntermediateResponse, deliverResponse } =
  await import("./deliverResponse.js");

describe("deliverResponse", () => {
  let mockOrchestrator: any;
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUlid.mockReturnValue("mock-ulid");
    mockSaveMessage.mockResolvedValue(undefined);

    mockOrchestrator = {
      assistantName: "TestAssistant",
      getChannelTypeForGroup: jest.fn().mockReturnValue("browser"),
      events: {
        emit: jest.fn(),
      },
      router: {
        send: (jest.fn() as any).mockResolvedValue(undefined),
        setTyping: jest.fn(),
      },
      pendingScheduledTasks: new Set(),
      setState: jest.fn(),
      peerjs: {
        completeActiveTask: jest.fn().mockReturnValue(true),
      },
      peerCompletedContexts: new Set(),
    };
  });

  describe("deliverIntermediateResponse", () => {
    it("should handle error when router send fails", async () => {
      mockOrchestrator.getChannelTypeForGroup.mockReturnValue("telegram");
      mockOrchestrator.router.send.mockRejectedValue(new Error("Send failed"));

      const consoleSpy = (
        jest.spyOn(console, "error") as any
      ).mockImplementation();

      await deliverIntermediateResponse(
        mockOrchestrator,
        mockDb,
        "group1",
        "Hello",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to deliver intermediate channel response:",
        expect.any(Error),
      );

      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("error", {
        groupId: "group1",
        error: "Failed to deliver response to telegram: Send failed",
      });

      consoleSpy.mockRestore();
    });
  });

  describe("deliverResponse", () => {
    it("should handle error when router send fails", async () => {
      mockOrchestrator.getChannelTypeForGroup.mockReturnValue("telegram");
      mockOrchestrator.router.send.mockRejectedValue(new Error("Send failed"));

      const consoleSpy = (
        jest.spyOn(console, "error") as any
      ).mockImplementation();

      await deliverResponse(mockOrchestrator, mockDb, "group1", "Hello");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to deliver channel response:",
        expect.any(Error),
      );
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("error", {
        groupId: "group1",
        error: "Failed to deliver response to telegram: Send failed",
      });

      consoleSpy.mockRestore();
    });

    it("should play chime and clear pending scheduled task if present", async () => {
      mockOrchestrator.pendingScheduledTasks.add("group1");

      await deliverResponse(mockOrchestrator, mockDb, "group1", "Hello");

      expect(mockOrchestrator.pendingScheduledTasks.has("group1")).toBe(false);
      expect(mockPlayNotificationChime).toHaveBeenCalled();
    });

    it("should complete active task if group is peer:", async () => {
      mockOrchestrator.getChannelTypeForGroup.mockReturnValue("peerjs");

      await deliverResponse(mockOrchestrator, mockDb, "peer:123", "Hello");

      expect(mockOrchestrator.peerjs.completeActiveTask).toHaveBeenCalledWith(
        "peer:123",
      );
      expect(mockOrchestrator.peerCompletedContexts.has("peer:123")).toBe(true);
    });
  });
});
