import { normalizePageRoute } from "./normalizePageRoute.js";

describe("normalizePageRoute", () => {
  it("should return the given page if it is valid", () => {
    expect(normalizePageRoute("chat")).toBe("chat");
    expect(normalizePageRoute("files")).toBe("files");
    expect(normalizePageRoute("tasks")).toBe("tasks");
    expect(normalizePageRoute("pages")).toBe("pages");
    expect(normalizePageRoute("settings")).toBe("settings");
    expect(normalizePageRoute("tools")).toBe("tools");
    expect(normalizePageRoute("channels")).toBe("channels");
  });

  it("should normalize the given page to lowercase", () => {
    expect(normalizePageRoute("CHAT")).toBe("chat");
    expect(normalizePageRoute("FiLeS")).toBe("files");
  });

  it("should return 'chat' if the given page is invalid", () => {
    expect(normalizePageRoute("invalid")).toBe("chat");
    expect(normalizePageRoute("")).toBe("chat");
    expect(normalizePageRoute(null as any)).toBe("chat");
    expect(normalizePageRoute(undefined as any)).toBe("chat");
  });
});
