import * as utils from "./index.js";

describe("src/utils/index", () => {
  it("exports base64 utilities", () => {
    expect(typeof utils.base64).toBe("function");
    expect(typeof utils.base64ToBytes).toBe("function");
    expect(typeof utils.bytesToBase64).toBe("function");
  });

  it("exports coerce utilities", () => {
    expect(typeof utils.coerceNumber).toBe("function");
    expect(typeof utils.coerceStringArray).toBe("function");
    expect(typeof utils.coerceUidArray).toBe("function");
    expect(typeof utils.coerceArray).toBe("function");
    expect(typeof utils.coerce).toBe("function");
    expect(typeof utils.asNumber).toBe("function");
    expect(typeof utils.asStringArray).toBe("function");
    expect(typeof utils.asUidArray).toBe("function");
  });

  it("exports filename utilities", () => {
    expect(typeof utils.basename).toBe("function");
    expect(typeof utils.sanitizeFilename).toBe("function");
    expect(typeof utils.cleanFilename).toBe("function");
  });

  it("exports mime utilities", () => {
    expect(typeof utils.getMimeType).toBe("function");
    expect(typeof utils.getImageMimeType).toBe("function");
    expect(typeof utils.isImagePath).toBe("function");
    expect(typeof utils.isMimeType).toBe("function");
    expect(typeof utils.mime).toBe("function");
    expect(typeof utils.IMAGE_MIME_TYPES).toBe("object");
    expect(typeof utils.MIME_TYPES).toBe("object");
  });

  it("exports isBinary utilities", () => {
    expect(typeof utils.isBinary).toBe("function");
    expect(typeof utils.isBinaryContent).toBe("function");
    expect(typeof utils.isBinaryContentType).toBe("function");
  });

  it("exports security & path utilities", () => {
    expect(typeof utils.hasPathTraversal).toBe("function");
    expect(typeof utils.normalizeWorkspacePath).toBe("function");
  });

  it("exports jsonPatch utilities", () => {
    expect(typeof utils.applyJsonPatch).toBe("function");
  });

  it("exports namespacedStorage utilities", () => {
    expect(typeof utils.getNamespacedStorageKey).toBe("function");
    expect(typeof utils.getNamespacedItem).toBe("function");
    expect(typeof utils.setNamespacedItem).toBe("function");
    expect(typeof utils.removeNamespacedItem).toBe("function");
  });

  it("exports parseBooleanConfig", () => {
    expect(typeof utils.parseBooleanConfig).toBe("function");
    expect(typeof utils.isTruthyConfigValue).toBe("function");
  });

  it("exports delay utilities", () => {
    expect(typeof utils.computeDelay).toBe("function");
    expect(typeof utils.sleep).toBe("function");
  });

  it("exports string list utilities", () => {
    expect(typeof utils.normalizeStringList).toBe("function");
    expect(typeof utils.parseStoredStringList).toBe("function");
  });

  it("exports ulid utility", () => {
    expect(typeof utils.ulid).toBe("function");
  });

  it("exports general utilities", () => {
    expect(typeof utils.escapeHtml).toBe("function");
    expect(typeof utils.sanitizeHtml).toBe("function");
    expect(typeof utils.formatDateForFilename).toBe("function");
    expect(typeof utils.formatTimestamp).toBe("function");
  });
});
