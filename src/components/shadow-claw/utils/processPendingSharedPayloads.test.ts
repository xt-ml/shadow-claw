import { jest } from "@jest/globals";

describe("processPendingSharedPayloads", () => {
  let win: Window;
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let oStore: any;
  let fStore: any;
  let url: URL;

  let processPendingSharedPayloads: any;

  let mockConsumePendingShares: any;
  let mockWriteGroupFile: any;
  let mockWriteGroupFileBytes: any;
  let mockShowError: any;
  let mockShowSuccess: any;
  let mockBuildSharedTextPayload: any;
  let mockResolveSharedFilesConversationId: any;
  let mockSanitizeSharedFileName: any;
  let mockShowPage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    win = {
      history: { replaceState: jest.fn() },
    } as any;
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {};
    db = {};
    oStore = { loadFiles: jest.fn() };
    fStore = { openFile: jest.fn() };
    url = new URL("http://localhost?share-target=true");

    mockConsumePendingShares = jest.fn();
    mockWriteGroupFile = jest.fn();
    mockWriteGroupFileBytes = jest.fn();
    mockShowError = jest.fn();
    mockShowSuccess = jest.fn();
    mockBuildSharedTextPayload = jest.fn();
    mockResolveSharedFilesConversationId = (jest.fn() as any).mockResolvedValue(
      "target-group",
    );
    mockSanitizeSharedFileName = jest.fn().mockImplementation((p) => p);
    mockShowPage = jest.fn();

    jest.unstable_mockModule("../../../share-target/pending-shares.js", () => ({
      consumePendingShares: mockConsumePendingShares,
    }));
    jest.unstable_mockModule("../../../storage/writeGroupFile.js", () => ({
      writeGroupFile: mockWriteGroupFile,
    }));
    jest.unstable_mockModule("../../../storage/writeGroupFileBytes.js", () => ({
      writeGroupFileBytes: mockWriteGroupFileBytes,
    }));
    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    }));
    jest.unstable_mockModule("./buildSharedTextPayload.js", () => ({
      buildSharedTextPayload: mockBuildSharedTextPayload,
    }));
    jest.unstable_mockModule("./resolveSharedFilesConversationId.js", () => ({
      resolveSharedFilesConversationId: mockResolveSharedFilesConversationId,
    }));
    jest.unstable_mockModule("./sanitizeSharedFileName.js", () => ({
      sanitizeSharedFileName: mockSanitizeSharedFileName,
    }));
    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: mockShowPage,
    }));

    const module = await import("./processPendingSharedPayloads.js");
    processPendingSharedPayloads = module.processPendingSharedPayloads;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if db is not provided", async () => {
    await processPendingSharedPayloads(
      win,
      shadowRoot,
      shadowClaw,
      oStore,
      fStore,
      null,
      url,
    );
    expect(mockConsumePendingShares).not.toHaveBeenCalled();
  });

  it("should return early if no pending shares", async () => {
    mockConsumePendingShares.mockResolvedValue([]);
    await processPendingSharedPayloads(
      win,
      shadowRoot,
      shadowClaw,
      oStore,
      fStore,
      db,
      url,
    );
    expect(mockResolveSharedFilesConversationId).not.toHaveBeenCalled();
  });

  it("should process text payloads and array buffers", async () => {
    const textShare = { title: "Test", text: "Test content", fileBytes: null };
    const bufferShare = {
      fileName: "test.pdf",
      fileType: "application/pdf",
      fileBytes: new ArrayBuffer(8),
    };

    mockConsumePendingShares.mockResolvedValue([textShare, bufferShare]);
    mockBuildSharedTextPayload.mockReturnValue("payload content");

    await processPendingSharedPayloads(
      win,
      shadowRoot,
      shadowClaw,
      oStore,
      fStore,
      db,
      url,
    );

    expect(mockResolveSharedFilesConversationId).toHaveBeenCalledWith(
      db,
      oStore,
    );

    // Check text share
    expect(mockBuildSharedTextPayload).toHaveBeenCalledWith(textShare);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      db,
      "target-group",
      expect.stringMatching(/\.md$/),
      "payload content",
    );

    // Check buffer share
    expect(mockWriteGroupFileBytes).toHaveBeenCalledWith(
      db,
      "target-group",
      "test.pdf",
      expect.any(Uint8Array),
    );

    expect(oStore.loadFiles).toHaveBeenCalledWith(db);
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      oStore,
      "files",
    );

    expect(fStore.openFile).toHaveBeenCalledWith(
      db,
      expect.stringMatching(/\.md$/),
      "target-group",
    );

    expect(mockShowSuccess).toHaveBeenCalledWith("Imported 2 shared items.");
    expect(win.history.replaceState).toHaveBeenCalledWith({}, "", "/");
  });

  it("should handle array buffers without name but with filetype", async () => {
    const bufferShare = {
      fileType: "application/pdf",
      fileBytes: new ArrayBuffer(8),
    };
    mockConsumePendingShares.mockResolvedValue([bufferShare]);
    mockSanitizeSharedFileName.mockImplementation(
      (preferred: any) => preferred,
    );

    await processPendingSharedPayloads(
      win,
      shadowRoot,
      shadowClaw,
      oStore,
      fStore,
      db,
      url,
    );

    expect(mockWriteGroupFileBytes).toHaveBeenCalledWith(
      db,
      "target-group",
      expect.stringMatching(/\.pdf$/),
      expect.any(Uint8Array),
    );
  });

  it("should handle errors", async () => {
    mockConsumePendingShares.mockResolvedValue([{}]);
    mockResolveSharedFilesConversationId.mockRejectedValue(
      new Error("Test error"),
    );
    await processPendingSharedPayloads(
      win,
      shadowRoot,
      shadowClaw,
      oStore,
      fStore,
      db,
      url,
    );
    expect(mockShowError).toHaveBeenCalledWith(
      "Failed to import shared content: Test error",
      6000,
    );
  });
});
