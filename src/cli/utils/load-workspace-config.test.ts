import { loadWorkspaceConfig } from "./load-workspace-config.js";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("load-workspace-config", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sc-cfg-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no config exists", async () => {
    const res = await loadWorkspaceConfig(tmpDir);
    expect(res).toBeNull();
  });

  it("loads shadow-claw.config.json from workspace", async () => {
    const cfgPath = path.join(tmpDir, "shadow-claw.config.json");
    await writeFile(cfgPath, JSON.stringify({ model: "test-model" }), "utf8");

    const res = await loadWorkspaceConfig(tmpDir);
    expect(res).not.toBeNull();
    expect(res?.configPath).toBe(cfgPath);
    expect(res?.config.model).toBe("test-model");
  });

  it("loads config from contentRoot", async () => {
    const contentDir = path.join(tmpDir, "content");
    await mkdir(contentDir, { recursive: true });
    const cfgPath = path.join(contentDir, "site-config.json");
    await writeFile(cfgPath, JSON.stringify({ siteName: "My Site" }), "utf8");

    const res = await loadWorkspaceConfig(undefined, contentDir);
    expect(res).not.toBeNull();
    expect(res?.configPath).toBe(cfgPath);
    expect((res?.config as any).siteName).toBe("My Site");
  });

  it("checks parent directory when workspace is .cache", async () => {
    const cacheDir = path.join(tmpDir, ".cache");
    await mkdir(cacheDir, { recursive: true });
    const cfgPath = path.join(tmpDir, "shadowclaw.config.json");
    await writeFile(cfgPath, JSON.stringify({ provider: "local" }), "utf8");

    const res = await loadWorkspaceConfig(cacheDir);
    expect(res).not.toBeNull();
    expect(res?.configPath).toBe(cfgPath);
    expect(res?.config.provider).toBe("local");
  });

  it("handles malformed JSON gracefully", async () => {
    const cfgPath = path.join(tmpDir, "shadow-claw.config.json");
    await writeFile(cfgPath, "{ malformed json", "utf8");

    const res = await loadWorkspaceConfig(tmpDir);
    expect(res).toBeNull();
  });
});
