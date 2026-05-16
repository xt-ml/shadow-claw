import { jest } from "@jest/globals";

const mockGetConfig = jest.fn();
const mockSetConfig = jest.fn();

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const {
  getGroupMetadata,
  saveGroupMetadata,
  createGroup,
  renameGroup,
  deleteGroupMetadata,
  listGroups,
  reorderGroups,
  cloneGroup,
  updateGroupToolTags,
} = await import("./groups.js");

const db: any = {} as any;

describe("groups", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (mockSetConfig as any).mockResolvedValue(undefined);
  });

  describe("getGroupMetadata", () => {
    it("returns empty array when no metadata stored", async () => {
      (mockGetConfig as any).mockResolvedValue(undefined);

      const result = await getGroupMetadata(db);

      expect(result).toEqual([]);
    });

    it("parses stored JSON metadata", async () => {
      const stored = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(stored));

      const result = await getGroupMetadata(db);

      expect(result).toEqual(stored);
    });
  });

  describe("saveGroupMetadata", () => {
    it("stores metadata as JSON in config", async () => {
      const meta = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      await saveGroupMetadata(db, meta);

      expect(mockSetConfig).toHaveBeenCalledWith(
        db,
        "group_metadata",
        JSON.stringify(meta),
      );
    });
  });

  describe("createGroup", () => {
    it("creates a new group with a generated ID and returns it", async () => {
      (mockGetConfig as any).mockResolvedValue(undefined);

      const group = await createGroup(db, "My Project");

      expect(group.groupId).toMatch(/^br:/);
      expect(group.name).toBe("My Project");
      expect(group.createdAt).toBeGreaterThan(0);

      expect(mockSetConfig).toHaveBeenCalledWith(
        db,
        "group_metadata",
        expect.stringContaining("My Project"),
      );
    });

    it("appends to existing groups", async () => {
      const existing = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await createGroup(db, "Second");

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(2);
      expect(saved[0].groupId).toBe("br:main");
      expect(saved[1].name).toBe("Second");
    });
  });

  describe("renameGroup", () => {
    it("updates the name of an existing group", async () => {
      const existing = [
        { groupId: "br:main", name: "Main", createdAt: 1000 },
        { groupId: "br:abc", name: "Old Name", createdAt: 2000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await renameGroup(db, "br:abc", "New Name");

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved[1].name).toBe("New Name");
      expect(saved[0].name).toBe("Main");
    });

    it("does nothing if group not found", async () => {
      const existing = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await renameGroup(db, "br:nonexistent", "Whatever");

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe("Main");
    });
  });

  describe("updateGroupToolTags", () => {
    it("updates toolTags for an existing group", async () => {
      const existing = [
        { groupId: "br:main", name: "Main", createdAt: 1000 },
        { groupId: "br:abc", name: "Tagged", createdAt: 2000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await updateGroupToolTags(db, "br:abc", ["get_weather", "search_web"]);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved[1].toolTags).toEqual(["get_weather", "search_web"]);
      expect(saved[0].toolTags).toBeUndefined();
    });

    it("does nothing if group not found", async () => {
      const existing = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await updateGroupToolTags(db, "br:nonexistent", ["get_weather"]);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(1);
      expect(saved[0].toolTags).toBeUndefined();
    });
  });

  describe("deleteGroupMetadata", () => {
    it("removes a group from metadata", async () => {
      const existing = [
        { groupId: "br:main", name: "Main", createdAt: 1000 },
        { groupId: "br:abc", name: "Delete Me", createdAt: 2000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await deleteGroupMetadata(db, "br:abc");

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(1);
      expect(saved[0].groupId).toBe("br:main");
    });
  });

  describe("listGroups", () => {
    it("returns stored metadata in persisted order", async () => {
      const stored = [
        { groupId: "br:b", name: "B", createdAt: 2000 },
        { groupId: "br:a", name: "A", createdAt: 1000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(stored));

      const result = await listGroups(db);

      expect(result[0].groupId).toBe("br:b");
      expect(result[1].groupId).toBe("br:a");
    });

    it("preserves reordered group order across round-trip", async () => {
      const original = [
        { groupId: "br:a", name: "A", createdAt: 1000 },
        { groupId: "br:b", name: "B", createdAt: 2000 },
        { groupId: "br:c", name: "C", createdAt: 3000 },
      ];

      (mockGetConfig as any).mockResolvedValueOnce(JSON.stringify(original));

      // Reorder: c, a, b
      await reorderGroups(db, ["br:c", "br:a", "br:b"]);

      // Simulate listGroups reading back what reorderGroups saved

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);

      (mockGetConfig as any).mockResolvedValueOnce(JSON.stringify(saved));

      const result = await listGroups(db);

      expect(result.map((g) => g.groupId)).toEqual(["br:c", "br:a", "br:b"]);
    });

    it("returns default group when no metadata exists", async () => {
      (mockGetConfig as any).mockResolvedValue(undefined);

      const result = await listGroups(db);

      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe("br:main");
      expect(result[0].name).toBe("Main");
    });

    it("persists the default group so it survives future reads", async () => {
      (mockGetConfig as any).mockResolvedValue(undefined);

      await listGroups(db);

      expect(mockSetConfig).toHaveBeenCalledWith(
        db,
        "group_metadata",
        expect.any(String),
      );

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(1);
      expect(saved[0].groupId).toBe("br:main");
      expect(saved[0].name).toBe("Main");
    });

    it("default group is retained after creating a new group", async () => {
      // First call: no groups exist, default is created and persisted

      (mockGetConfig as any).mockResolvedValueOnce(undefined);

      await listGroups(db);

      // Capture what was persisted

      const persisted = JSON.parse((mockSetConfig as any).mock.calls[0][2]);

      // Second call: simulate createGroup reading the now-persisted default

      (mockGetConfig as any).mockResolvedValueOnce(JSON.stringify(persisted));
      await createGroup(db, "Secondary");

      // The saved data should contain both groups
      const saved = JSON.parse(
        (mockSetConfig as any).mock.calls[
          (mockSetConfig as any).mock.calls.length - 1
        ][2],
      );
      expect(saved).toHaveLength(2);
      expect(saved[0].groupId).toBe("br:main");
      expect(saved[0].name).toBe("Main");
      expect(saved[1].name).toBe("Secondary");
    });
  });

  describe("reorderGroups", () => {
    it("reorders groups according to the provided ID list", async () => {
      const existing = [
        { groupId: "br:a", name: "A", createdAt: 1000 },
        { groupId: "br:b", name: "B", createdAt: 2000 },
        { groupId: "br:c", name: "C", createdAt: 3000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await reorderGroups(db, ["br:c", "br:a", "br:b"]);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved.map((g) => g.groupId)).toEqual(["br:c", "br:a", "br:b"]);
      // Original data is preserved
      expect(saved[0].name).toBe("C");
      expect(saved[1].name).toBe("A");
      expect(saved[2].name).toBe("B");
    });

    it("ignores unknown IDs in the order list", async () => {
      const existing = [
        { groupId: "br:a", name: "A", createdAt: 1000 },
        { groupId: "br:b", name: "B", createdAt: 2000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      await reorderGroups(db, ["br:b", "br:unknown", "br:a"]);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved.map((g) => g.groupId)).toEqual(["br:b", "br:a"]);
    });

    it("appends groups missing from the order list at the end", async () => {
      const existing = [
        { groupId: "br:a", name: "A", createdAt: 1000 },
        { groupId: "br:b", name: "B", createdAt: 2000 },
        { groupId: "br:c", name: "C", createdAt: 3000 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      // Only specify order for two of three
      await reorderGroups(db, ["br:c", "br:a"]);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved.map((g) => g.groupId)).toEqual(["br:c", "br:a", "br:b"]);
    });
  });

  describe("cloneGroup", () => {
    it("creates a new group with cloned name and returns it", async () => {
      const existing = [{ groupId: "br:main", name: "Main", createdAt: 1000 }];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      const clone = await cloneGroup(db, "br:main");

      expect(clone!.groupId).toMatch(/^br:/);

      expect(clone!.groupId).not.toBe("br:main");

      expect(clone!.name).toBe("Main (copy)");

      expect(clone!.createdAt).toBeGreaterThan(0);

      const saved = JSON.parse((mockSetConfig as any).mock.calls[0][2]);
      expect(saved).toHaveLength(2);
      expect(saved[1].name).toBe("Main (copy)");
    });

    it("returns null if source group not found", async () => {
      (mockGetConfig as any).mockResolvedValue(JSON.stringify([]));

      const clone = await cloneGroup(db, "br:nonexistent");

      expect(clone).toBeNull();
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it("preserves the channel prefix from the source group", async () => {
      const existing = [
        { groupId: "ext:custom123", name: "External", createdAt: 500 },
      ];

      (mockGetConfig as any).mockResolvedValue(JSON.stringify(existing));

      const clone = await cloneGroup(db, "ext:custom123");

      expect(clone!.groupId).toMatch(/^ext:/);
    });
  });
});
