import { sanitizeSharedFileName } from "./sanitizeSharedFileName.js";

describe("sanitizeSharedFileName", () => {
  it("should remove paths and return only the file name", () => {
    expect(sanitizeSharedFileName("/path/to/file.txt", "base")).toBe(
      "file.txt",
    );
    expect(sanitizeSharedFileName("C:\\Windows\\path\\file.txt", "base")).toBe(
      "file.txt",
    );
  });

  it("should replace spaces and invalid characters with hyphens", () => {
    expect(sanitizeSharedFileName("my file name.txt", "base")).toBe(
      "my-file-name.txt",
    );
    expect(sanitizeSharedFileName("file!@#$%^&*().txt", "base")).toBe(
      "file-.txt",
    );
    expect(sanitizeSharedFileName("a_b-c.d", "base")).toBe("a_b-c.d");
  });

  it("should collapse multiple hyphens and trim leading/trailing hyphens", () => {
    expect(sanitizeSharedFileName("---file---name---.txt", "base")).toBe(
      "file-name-.txt",
    );
    expect(sanitizeSharedFileName("  file  ", "base")).toBe("file");
    expect(sanitizeSharedFileName("!@#file!@#", "base")).toBe("file");
  });

  it("should return fallback base if resulting name is empty", () => {
    expect(sanitizeSharedFileName("", "base")).toBe("base.txt");
    expect(sanitizeSharedFileName("/", "base")).toBe("base.txt");
    expect(sanitizeSharedFileName("!@#$%", "fallback")).toBe("fallback.txt");
  });
});
