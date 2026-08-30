import { asEmailAttachmentInputs } from "./asEmailAttachmentInputs.js";

describe("asEmailAttachmentInputs", () => {
  it("returns empty array for non-array inputs", () => {
    expect(asEmailAttachmentInputs(null)).toEqual([]);
    expect(asEmailAttachmentInputs(undefined)).toEqual([]);
    expect(asEmailAttachmentInputs("file.txt")).toEqual([]);
    expect(asEmailAttachmentInputs({ path: "file.txt" })).toEqual([]);
  });

  it("parses string attachment items", () => {
    const input = ["file1.txt", "  ", "folder/file2.pdf"];
    const result = asEmailAttachmentInputs(input);
    expect(result).toEqual([
      { path: "file1.txt" },
      { path: "folder/file2.pdf" },
    ]);
  });

  it("parses object attachment items with filename and content_type", () => {
    const input = [
      {
        path: "docs/spec.pdf",
        filename: "specs.pdf",
        content_type: "application/pdf",
      },
      { path: "images/logo.png" },
      { path: "   ", filename: "ignored.txt" },
      null,
      123,
      { notPath: "ignored" },
    ];
    const result = asEmailAttachmentInputs(input);
    expect(result).toEqual([
      {
        path: "docs/spec.pdf",
        filename: "specs.pdf",
        contentType: "application/pdf",
      },
      {
        path: "images/logo.png",
        filename: undefined,
        contentType: undefined,
      },
    ]);
  });
});
