import { jest } from "@jest/globals";
import { BackupController } from "./backup-controller.js";

describe("backup-controller", () => {
  let mockFetch: jest.Mock<any>;

  beforeEach(() => {
    mockFetch = jest.fn() as any;
    (globalThis as any).fetch = mockFetch;
  });

  it("enumerates files, uploads each, and completes the backup", async () => {
    const mockFiles: Record<string, string> = {
      "MEMORY.md": "# Memory content",
      "src/index.ts": "console.log('hello');",
    };

    mockFetch.mockImplementation(async (url: string, init: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/backup/upload")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }
      if (urlStr.includes("/api/backup/complete")) {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            backupId: body.backupId,
            fileCount: body.fileCount,
            totalBytes: body.totalBytes,
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const progressUpdates: any[] = [];
    const controller = new BackupController({
      clientId: "test-client-backup",
      token: "secret-token",
      serverBaseUrl: "http://127.0.0.1:8888",
      fileEnumerator: async () => Object.keys(mockFiles),
      fileReader: async (path: string) => mockFiles[path] || null,
      onProgress: (p) => progressUpdates.push(p),
    });

    const result = await controller.initiate();

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(2);
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(result.backupId).toBeTruthy();

    // Verify upload calls
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/backup/upload"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-control-token": "secret-token",
        }),
      }),
    );

    // Verify complete call
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/backup/complete"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-control-token": "secret-token",
        }),
      }),
    );

    expect(progressUpdates.length).toBe(2);
  });

  it("handles upload failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const controller = new BackupController({
      clientId: "test-err-client",
      serverBaseUrl: "http://127.0.0.1:8888",
      fileEnumerator: async () => ["file1.txt"],
      fileReader: async () => "content",
    });

    await expect(controller.initiate()).rejects.toThrow(/Upload failed/i);
  });
});
