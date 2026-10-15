import { describe, expect, it, jest, beforeEach } from "@jest/globals";

const mockGetConfig = jest.fn<any>();
const mockGetAllowFullInternetAccess = jest.fn<any>();
const mockGetVMBootModePreference = jest.fn<any>();
const mockGetVMStatus = jest.fn<any>();
const mockIsVMReady = jest.fn<any>();
const mockBootVM = jest.fn<any>();
const mockExecuteInVM = jest.fn<any>();
const mockWaitForVMReady = jest.fn<any>();
const mockExecuteViaShellFallback = jest.fn<any>();
const mockWriteGroupFile = jest.fn<any>();
const mockDeleteGroupFile = jest.fn<any>();
const mockPost = jest.fn<any>();
let isHeadless = false;

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../utils/get-allow-full-internet-access.js", () => ({
  getAllowFullInternetAccess: mockGetAllowFullInternetAccess,
}));

jest.unstable_mockModule("../../../shell/vm.js", () => ({
  bootVM: mockBootVM,
  executeInVM: mockExecuteInVM,
  getVMBootModePreference: mockGetVMBootModePreference,
  getVMStatus: mockGetVMStatus,
  isVMReady: mockIsVMReady,
}));

jest.unstable_mockModule("./utils/wait-for-vm-ready.js", () => ({
  waitForVMReady: mockWaitForVMReady,
}));

jest.unstable_mockModule("./utils/execute-via-shell-fallback.js", () => ({
  executeViaShellFallback: mockExecuteViaShellFallback,
}));

jest.unstable_mockModule("../../../storage/write-group-file.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("../../../storage/delete-group-file.js", () => ({
  deleteGroupFile: mockDeleteGroupFile,
}));

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: mockPost,
}));

jest.unstable_mockModule("../../../config/headless.js", () => ({
  isHeadlessMode: () => isHeadless,
}));

const { executeBash, setHeadlessBashExecutor } = await import("./bash.js");

describe("executeBash", () => {
  const dummyDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    isHeadless = false;
    setHeadlessBashExecutor(null);
    mockGetConfig.mockReset().mockResolvedValue(null);
    mockGetAllowFullInternetAccess.mockReset().mockResolvedValue(false);
    mockGetVMBootModePreference.mockReset().mockReturnValue("disabled");
    mockGetVMStatus.mockReset().mockReturnValue({ booting: false });
    mockIsVMReady.mockReset().mockReturnValue(false);
    mockBootVM.mockReset().mockResolvedValue(undefined);
    mockExecuteInVM.mockReset().mockResolvedValue("vm output");
    mockWaitForVMReady.mockReset().mockResolvedValue(undefined);
    mockExecuteViaShellFallback.mockReset().mockResolvedValue("shell output");
    mockWriteGroupFile.mockReset().mockResolvedValue(undefined);
    mockDeleteGroupFile.mockReset().mockResolvedValue(undefined);
    mockPost.mockReset();
  });

  describe("headless mode", () => {
    it("throws if headless bash executor is not configured", async () => {
      isHeadless = true;
      await expect(
        executeBash(dummyDb, { command: "echo hi" }, groupId),
      ).rejects.toThrow("Headless bash executor is not configured");
    });

    it("delegates to registered headless bash executor", async () => {
      isHeadless = true;
      const mockExecutor = jest.fn<any>().mockResolvedValue("headless result");
      setHeadlessBashExecutor(mockExecutor);

      const result = await executeBash(
        dummyDb,
        { command: "ls -la", stdin: "input text", timeout: 45 },
        groupId,
      );

      expect(mockExecutor).toHaveBeenCalledWith({
        command: "ls -la",
        stdin: "input text",
        timeoutSec: 45,
      });
      expect(result).toBe("headless result");
    });
  });

  describe("browser execution", () => {
    it("executes via shell fallback when boot mode is disabled", async () => {
      mockGetVMBootModePreference.mockReturnValue("disabled");
      mockExecuteViaShellFallback.mockResolvedValue("fallback ok");

      const result = await executeBash(
        dummyDb,
        { command: "echo fallback" },
        groupId,
      );

      expect(result).toBe("fallback ok");
      expect(mockExecuteViaShellFallback).toHaveBeenCalledWith(
        dummyDb,
        "echo fallback",
        groupId,
        expect.any(Number),
        false,
      );
    });

    it("handles stdin in ext2 mode by wrapping command in heredoc", async () => {
      mockGetVMBootModePreference.mockReturnValue("ext2");
      mockIsVMReady.mockReturnValue(true);
      mockExecuteInVM.mockResolvedValue("heredoc output");

      const result = await executeBash(
        dummyDb,
        { command: "cat", stdin: "hello world" },
        groupId,
      );

      expect(result).toBe("heredoc output");
      expect(mockExecuteInVM).toHaveBeenCalledWith(
        expect.stringContaining("(cat << 'EOF_SC_"),
        expect.any(Number),
        { db: dummyDb, groupId },
      );
      expect(mockWriteGroupFile).not.toHaveBeenCalled();
    });

    it("handles stdin in non-ext2 mode by writing and deleting stdin file", async () => {
      mockGetVMBootModePreference.mockReturnValue("9p");
      mockIsVMReady.mockReturnValue(true);
      mockExecuteInVM.mockResolvedValue("file input output");

      const result = await executeBash(
        dummyDb,
        { command: "grep foo", stdin: "foo bar baz" },
        groupId,
      );

      expect(mockWriteGroupFile).toHaveBeenCalledWith(
        dummyDb,
        groupId,
        ".shadowclaw_stdin",
        "foo bar baz",
      );
      expect(mockDeleteGroupFile).toHaveBeenCalledWith(
        dummyDb,
        groupId,
        ".shadowclaw_stdin",
      );
      expect(result).toBe("file input output");
    });

    it("waits for VM when booting and executes in VM when ready", async () => {
      mockGetVMBootModePreference.mockReturnValue("auto");
      mockIsVMReady
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockGetVMStatus.mockReturnValue({ booting: true });

      const result = await executeBash(dummyDb, { command: "uptime" }, groupId);

      expect(mockBootVM).toHaveBeenCalled();
      expect(mockWaitForVMReady).toHaveBeenCalled();
      expect(mockExecuteInVM).toHaveBeenCalled();
      expect(result).toBe("vm output");
    });

    it("shows warning toast and falls back to shell when VM remains unavailable", async () => {
      mockGetVMBootModePreference.mockReturnValue("auto");
      mockIsVMReady.mockReturnValue(false);
      mockGetVMStatus.mockReturnValue({ error: "Failed to boot kernel" });
      mockExecuteViaShellFallback.mockResolvedValue("fallback after error");

      const result = await executeBash(
        dummyDb,
        { command: "echo fallback" },
        groupId,
      );

      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "show-toast",
          payload: expect.objectContaining({
            type: "warning",
            message: expect.stringContaining("Failed to boot kernel"),
          }),
        }),
      );
      expect(result).toBe("fallback after error");
    });

    it("respects configured timeout from database", async () => {
      mockGetConfig.mockResolvedValue("60");
      mockGetVMBootModePreference.mockReturnValue("disabled");

      await executeBash(dummyDb, { command: "test timeout" }, groupId);

      expect(mockExecuteViaShellFallback).toHaveBeenCalledWith(
        dummyDb,
        "test timeout",
        groupId,
        60,
        false,
      );
    });
  });
});
