import { getEmailPluginManifest, listEmailPluginManifests } from "./catalog.js";

describe("email catalog", () => {
  it("includes only supported email manifest", () => {
    const manifests = listEmailPluginManifests();
    const ids = new Set(manifests.map((manifest) => manifest.id));

    expect(manifests).toHaveLength(1);
    expect(ids.has("imap")).toBe(true);
  });

  it("returns null for unknown manifest id", () => {
    expect(getEmailPluginManifest("does-not-exist")).toBeNull();
  });

  it("returns manifest for known id", () => {
    const manifest = getEmailPluginManifest("imap");

    expect(manifest).toBeDefined();
    expect(manifest?.protocol).toBe("imap");
    expect(manifest?.actions).toContain("messages.read");
  });
});
