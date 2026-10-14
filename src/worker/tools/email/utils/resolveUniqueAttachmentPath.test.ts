import { jest } from "@jest/globals";

let resolveUniqueAttachmentPath: any;
let mockGroupFileExists: any;
let mockUlid: any;

describe("resolveUniqueAttachmentPath", () => {
  beforeEach(async () => {
    jest.resetModules();
    mockGroupFileExists = jest.fn();
    mockUlid = jest.fn(() => "mock-ulid-123");

    jest.unstable_mockModule("../../../../storage/groupFileExists.js", () => ({
      groupFileExists: mockGroupFileExists,
    }));
    jest.unstable_mockModule("../../../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));

    const mod = await import("./resolveUniqueAttachmentPath.js");
    resolveUniqueAttachmentPath = mod.resolveUniqueAttachmentPath;
  });

  it("returns base path when file does not exist", async () => {
    mockGroupFileExists.mockResolvedValueOnce(false);
    const result = await resolveUniqueAttachmentPath(
      {} as any,
      "group-1",
      "downloads/email",
      "file.pdf",
    );
    expect(result).toBe("downloads/email/file.pdf");
  });

  it("returns incremented name when initial exists", async () => {
    mockGroupFileExists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const result = await resolveUniqueAttachmentPath(
      {} as any,
      "group-1",
      "downloads/email",
      "file.pdf",
    );
    expect(result).toBe("downloads/email/file-2.pdf");
  });

  it("handles empty directory", async () => {
    mockGroupFileExists.mockResolvedValueOnce(false);
    const result = await resolveUniqueAttachmentPath(
      {} as any,
      "group-1",
      "  ",
      "file.txt",
    );
    expect(result).toBe("file.txt");
  });

  it("falls back to ulid when all 1000 candidate names exist", async () => {
    mockGroupFileExists.mockResolvedValue(true);
    const result = await resolveUniqueAttachmentPath(
      {} as any,
      "group-1",
      "downloads",
      "file.txt",
    );
    expect(result).toBe("downloads/mock-ulid-123-file.txt");
  });

  it("falls back to ulid when all 1000 candidate names exist in root directory", async () => {
    mockGroupFileExists.mockResolvedValue(true);
    const result = await resolveUniqueAttachmentPath(
      {} as any,
      "group-1",
      "",
      "file.txt",
    );
    expect(result).toBe("mock-ulid-123-file.txt");
  });
});
