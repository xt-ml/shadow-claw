import { jest } from "@jest/globals";

// We'll test the DB layer and orchestrator store directly
// since the component has browser-only dependencies (jszip from CDN)
const { orchestratorStore } = await import("../stores/orchestrator.mjs");
const { clearGroupMessages } = await import("../db/clearGroupMessages.mjs");
const { setDB } = await import("../db/db.mjs");

describe("shadow-claw-chat clear functionality", () => {
  let mockDb;
  let mockTx;
  let mockStore;
  let mockIndex;

  beforeEach(() => {
    // Create mock database with proper IndexedDB structure
    mockIndex = {
      openCursor: jest.fn(),
    };

    mockStore = {
      get: jest.fn(),
      put: jest.fn(),
      index: jest.fn().mockReturnValue(mockIndex),
      delete: jest.fn(),
    };

    mockTx = {
      objectStore: jest.fn().mockReturnValue(mockStore),
    };

    mockDb = {
      transaction: jest.fn().mockReturnValue(mockTx),
    };

    setDB(mockDb);
  });

  describe("orchestratorStore.newSession", () => {
    it("should accept db parameter and pass it to orchestrator (BUG FIX)", async () => {
      // Setup mock orchestrator
      const mockOrchestrator = {
        newSession: jest.fn().mockResolvedValue(undefined),
      };

      orchestratorStore.orchestrator = mockOrchestrator;

      // Mock loadHistory to avoid IDBKeyRange issues in tests
      const loadHistorySpy = jest
        .spyOn(orchestratorStore, "loadHistory")
        .mockResolvedValue(undefined);

      // Execute: Call newSession with db
      // This test will PASS after the fix because newSession now accepts db parameter
      await orchestratorStore.newSession(mockDb);

      // Assert: orchestrator.newSession should be called with db and groupId
      expect(mockOrchestrator.newSession).toHaveBeenCalledWith(
        mockDb,
        orchestratorStore.activeGroupId,
      );

      // Assert: loadHistory should be called after clearing
      expect(loadHistorySpy).toHaveBeenCalled();

      // Clean up
      loadHistorySpy.mockRestore();
    });

    it("should clear messages from DB when called", async () => {
      const deletedIds = [];

      // Setup: Create mock orchestrator that calls clearGroupMessages
      const mockOrchestrator = {
        newSession: jest.fn(async (db, groupId) => {
          // Simulate what the real orchestrator does
          await clearGroupMessages(db, groupId);
        }),
      };

      orchestratorStore.orchestrator = mockOrchestrator;

      // Mock loadHistory to avoid IDBKeyRange issues
      jest.spyOn(orchestratorStore, "loadHistory").mockResolvedValue(undefined);

      // Mock cursor for clearGroupMessages
      mockIndex.openCursor.mockImplementation((key) => {
        const request = {};
        const messages = [
          { id: "1", groupId: "default", content: "test1" },
          { id: "2", groupId: "default", content: "test2" },
        ];

        let currentIndex = 0;

        // Trigger onsuccess asynchronously
        const triggerSuccess = () => {
          if (currentIndex < messages.length) {
            const msg = messages[currentIndex];
            request.result = {
              value: msg,
              delete: () => {
                deletedIds.push(msg.id);
              },
              continue: () => {
                currentIndex++;
                setTimeout(triggerSuccess, 0);
              },
            };
          } else {
            request.result = null;
          }

          if (request.onsuccess) {
            request.onsuccess();
          }
        };

        setTimeout(triggerSuccess, 0);

        return request;
      });

      // Execute
      await orchestratorStore.newSession(mockDb);

      // Wait for async cursor operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Assert: Messages should be deleted from DB
      expect(deletedIds).toEqual(["1", "2"]);
    });
  });

  describe("clearGroupMessages", () => {
    it("should delete all messages for a group from IndexedDB", async () => {
      const deletedIds = [];

      // Mock cursor behavior for clearGroupMessages
      mockIndex.openCursor.mockImplementation((key) => {
        const request = {};

        // Simulate 3 messages in DB
        const mockMessages = [
          { id: "1", content: "msg1" },
          { id: "2", content: "msg2" },
          { id: "3", content: "msg3" },
        ];

        let currentIndex = 0;

        const triggerSuccess = () => {
          if (currentIndex < mockMessages.length) {
            const msg = mockMessages[currentIndex];
            request.result = {
              value: msg,
              delete: () => {
                deletedIds.push(msg.id);
              },
              continue: () => {
                currentIndex++;
                setTimeout(triggerSuccess, 0);
              },
            };
          } else {
            request.result = null;
          }

          if (request.onsuccess) {
            request.onsuccess();
          }
        };

        setTimeout(triggerSuccess, 0);

        return request;
      });

      // Call clearGroupMessages directly
      await clearGroupMessages(mockDb, "default");

      // Wait for async cursor operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify all messages were deleted
      expect(deletedIds).toEqual(["1", "2", "3"]);
    }, 10000);

    it("should handle empty database gracefully", async () => {
      // Mock cursor with no results
      mockIndex.openCursor.mockImplementation(() => {
        const request = {};
        setTimeout(() => {
          request.result = null; // No messages
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      // Should not throw
      await expect(
        clearGroupMessages(mockDb, "default"),
      ).resolves.not.toThrow();
    });

    it("should throw error when db transaction fails", async () => {
      const badDb = {
        transaction: jest.fn().mockReturnValue(null),
      };

      await expect(clearGroupMessages(badDb, "default")).rejects.toThrow(
        "failed to get transaction",
      );
    });
  });
});
