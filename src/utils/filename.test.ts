import { describe, expect, it } from "@jest/globals";
import { basename, sanitizeFilename, cleanFilename } from "./filename.js";

describe("src/utils/filename", () => {
  describe("basename", () => {
    it("extracts basename from posix path", () => {
      expect(basename("foo/bar/baz.txt")).toBe("baz.txt");
      expect(basename("/root/dir/file.png")).toBe("file.png");
    });

    it("extracts basename from windows path", () => {
      expect(basename("C:\\Users\\admin\\file.txt")).toBe("file.txt");
      expect(basename("dir\\sub\\image.jpg")).toBe("image.jpg");
    });

    it("handles trailing slashes and multiple slashes", () => {
      expect(basename("foo/bar/")).toBe("bar");
      expect(basename("foo///bar///baz.txt")).toBe("baz.txt");
    });

    it("returns fallback when path is empty or only slashes", () => {
      expect(basename("")).toBe("attachment.bin");
      expect(basename("/", "fallback.dat")).toBe("fallback.dat");
      expect(basename("///")).toBe("attachment.bin");
    });
  });

  describe("sanitizeFilename", () => {
    it("replaces illegal filename characters with replacement character", () => {
      expect(sanitizeFilename("file:name?.txt")).toBe("file_name_.txt");
      expect(
        sanitizeFilename("hello*world<1>|2.png", { replacement: "-" }),
      ).toBe("hello-world-1--2.png");
    });

    it("replaces or removes control characters", () => {
      expect(sanitizeFilename("evil\x00file\x1fname.txt")).toBe(
        "evil_file_name.txt",
      );
      expect(
        sanitizeFilename("evil\x00file\x1fname.txt", {
          stripControlChars: true,
        }),
      ).toBe("evilfilename.txt");
    });

    it("collapses multiple replacement characters when collapseReplacement is true", () => {
      expect(
        sanitizeFilename(" ../a:b?.png ", {
          replacement: "-",
          stripLeadingDots: true,
          collapseReplacement: true,
          fallback: "attachment",
        }),
      ).toBe("-a-b-.png");
    });

    it("trims whitespace and removes leading dots if configured", () => {
      expect(sanitizeFilename("   foo.txt   ")).toBe("foo.txt");
      expect(
        sanitizeFilename("...hidden.txt", { stripLeadingDots: true }),
      ).toBe("hidden.txt");
    });

    it("returns fallback for empty or purely invalid filenames", () => {
      expect(sanitizeFilename("")).toBe("attachment.bin");
      expect(sanitizeFilename("???", { fallback: "default.txt" })).toBe("___");
      expect(sanitizeFilename("   ", { fallback: "default.txt" })).toBe(
        "default.txt",
      );
    });
  });

  describe("cleanFilename (unified single-function)", () => {
    it("extracts basename and sanitizes illegal characters in one call", () => {
      expect(cleanFilename("/path/to/my:photo?.jpg")).toBe("my_photo_.jpg");
      expect(
        cleanFilename("C:\\Users\\Docs\\report*2024.pdf", { replacement: "-" }),
      ).toBe("report-2024.pdf");
    });

    it("preserves safe plain filenames", () => {
      expect(cleanFilename("document.pdf")).toBe("document.pdf");
    });

    it("uses custom fallback if result is empty", () => {
      expect(cleanFilename("", { fallback: "untitled.dat" })).toBe(
        "untitled.dat",
      );
    });
  });
});
