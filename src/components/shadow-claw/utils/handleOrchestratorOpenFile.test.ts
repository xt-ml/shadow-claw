import { jest } from "@jest/globals";

describe("handleOrchestratorOpenFile", () => {
  let handleOrchestratorOpenFile: any;
  let mockOpenFile: jest.Mock<any>;
  let mockShowError: jest.Mock;
  let mockDb: any;
  let mockOStore: any;
  let mockFStore: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showError: jest.fn(),
    }));

    const toast = await import("../../../ui/toast.js");
    mockShowError = toast.showError as jest.Mock;

    const module = await import("./handleOrchestratorOpenFile.js");
    handleOrchestratorOpenFile = module.handleOrchestratorOpenFile;

    mockOpenFile = jest.fn<any>();

    mockDb = {};
    mockOStore = {
      activeGroupId: "group-1",
    };
    mockFStore = {
      openFile: mockOpenFile,
    };

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function makePayload(path = "/file.txt", groupId?: string) {
    return { path, groupId } as any;
  }

  it("does nothing if path is missing", async () => {
    await handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(""),
    );
    expect(mockOpenFile).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("does nothing if db is missing", async () => {
    await handleOrchestratorOpenFile(
      null,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    expect(mockOpenFile).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("opens file on first try when no error", async () => {
    mockOpenFile.mockResolvedValueOnce(undefined);
    await handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    expect(mockOpenFile).toHaveBeenCalledWith(mockDb, "/file.txt", "group-1");
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("retries on NotFoundError and succeeds", async () => {
    const notFound = new DOMException("Not Found", "NotFoundError");
    mockOpenFile
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(undefined);

    const promise = handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    await jest.runAllTimersAsync();
    await promise;
    expect(mockOpenFile).toHaveBeenCalledTimes(2);
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("retries up to maxRetries and shows error if still NotFoundError", async () => {
    const notFound = new DOMException("Not Found", "NotFoundError");
    mockOpenFile.mockRejectedValue(notFound);

    const promise = handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    await jest.runAllTimersAsync();
    await promise;
    expect(mockOpenFile).toHaveBeenCalledTimes(4); // attempt 0 + 3 retries = 4
    expect(mockShowError).toHaveBeenCalledWith(
      "Failed to open file from tool: Not Found",
      5000,
    );
  });

  it("does not retry on non-NotFoundError and shows error immediately", async () => {
    const otherErr = new Error("Other error");
    mockOpenFile.mockRejectedValueOnce(otherErr);

    await handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    expect(mockOpenFile).toHaveBeenCalledTimes(1);
    expect(mockShowError).toHaveBeenCalledWith(
      "Failed to open file from tool: Other error",
      5000,
    );
  });

  it("uses payload.groupId when provided instead of oStore.activeGroupId", async () => {
    mockOpenFile.mockResolvedValueOnce(undefined);
    await handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload("/file.txt", "custom-group"),
    );
    expect(mockOpenFile).toHaveBeenCalledWith(
      mockDb,
      "/file.txt",
      "custom-group",
    );
  });

  it("retries with increasing delay", async () => {
    const notFound = new DOMException("Not Found", "NotFoundError");
    mockOpenFile
      .mockRejectedValueOnce(notFound)
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(undefined);

    const promise = handleOrchestratorOpenFile(
      mockDb,
      mockOStore,
      mockFStore,
      makePayload(),
    );
    await jest.runAllTimersAsync();
    await promise;
    expect(mockOpenFile).toHaveBeenCalledTimes(3);
    expect(mockShowError).not.toHaveBeenCalled();
  });
});
