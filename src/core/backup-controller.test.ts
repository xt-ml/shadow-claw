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

  it("handles private network IP, binary Uint8Array data, and skipped null data", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (
        urlStr.includes("/api/backup/upload") ||
        urlStr.includes("/api/backup/complete")
      ) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
        };
      }
      return { ok: false, status: 404, statusText: "Not Found" };
    });

    const controller = new BackupController({
      clientId: "test-binary-client",
      serverBaseUrl: "http://192.168.1.100:9000",
      fileEnumerator: async () => ["binary.bin", "empty.txt"],
      fileReader: async (p) =>
        p === "binary.bin" ? new Uint8Array([1, 2, 3, 4]) : null,
    });

    const result = await controller.initiate();
    expect(result.fileCount).toBe(1);
    expect(result.totalBytes).toBe(4);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:9000/api/backup/upload",
      expect.objectContaining({
        targetAddressSpace: "private",
        body: expect.stringContaining('"encoding":"base64"'),
      }),
    );
  });

  it("throws when complete endpoint fails", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/backup/upload")) {
        return { ok: true, status: 200 };
      }
      return {
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: async () => {
          throw new Error("Cannot read text");
        },
      };
    });

    const controller = new BackupController({
      clientId: "test-fail-complete",
      serverBaseUrl: "http://127.0.0.1:8888",
      fileEnumerator: async () => ["file.txt"],
      fileReader: async () => "text content",
    });

    await expect(controller.initiate()).rejects.toThrow(
      /Failed to complete backup: Server Error/,
    );
  });

  it("works with default constructor options", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    const controller = new BackupController({
      clientId: "minimal-client",
    });

    const result = await controller.initiate();
    expect(result.fileCount).toBe(0);
    expect(result.totalBytes).toBe(0);
  });
});
