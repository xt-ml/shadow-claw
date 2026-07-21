import { buildSharedTextPayload } from "./buildSharedTextPayload";

describe("buildSharedTextPayload", () => {
  it("should return only the header when all fields are empty", () => {
    const result = buildSharedTextPayload({ title: "", text: "", url: "" });
    expect(result).toBe("# Shared Content\n");
  });

  it("should include title when provided", () => {
    const result = buildSharedTextPayload({
      title: "Test Title",
      text: "",
      url: "",
    });
    expect(result).toBe("# Shared Content\n\nTitle: Test Title\n");
  });

  it("should include URL when provided", () => {
    const result = buildSharedTextPayload({
      title: "",
      text: "",
      url: "http://example.com",
    });
    expect(result).toBe("# Shared Content\n\nURL: http://example.com\n");
  });

  it("should include text when provided", () => {
    const result = buildSharedTextPayload({
      title: "",
      text: "Hello world",
      url: "",
    });
    expect(result).toBe("# Shared Content\n\n\nHello world\n");
  });

  it("should include all fields when provided", () => {
    const result = buildSharedTextPayload({
      title: "Test Title",
      text: "Hello world",
      url: "http://example.com",
    });
    expect(result).toBe(
      "# Shared Content\n\nTitle: Test Title\nURL: http://example.com\n\nHello world\n",
    );
  });

  it("should handle undefined fields as empty strings", () => {
    // @ts-ignore - we are passing undefined to test the default behavior
    const result = buildSharedTextPayload({
      title: undefined,
      text: undefined,
      url: undefined,
    } as { title: string; text: string; url: string });
    expect(result).toBe("# Shared Content\n");
  });

  it("should trim extra newlines and add a single trailing newline", () => {
    const result = buildSharedTextPayload({
      title: "  Title  ",
      text: "  text  ",
      url: "  http://example.com  ",
    });
    expect(result).toBe(
      "# Shared Content\n\nTitle:   Title  \nURL:   http://example.com  \n\n  text\n",
    );
  });
});
