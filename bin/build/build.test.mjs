import fs from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("../..", import.meta.url).pathname);

jest.setTimeout(120_000);

describe("build without and with pages", () => {
  let tempProjectRoot;

  beforeAll(async () => {
    tempProjectRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-build-"),
    );
    await cp(projectRoot, tempProjectRoot, {
      recursive: true,
      filter(source) {
        return !new Set([
          ".cache",
          ".git",
          ".lighthouseci",
          "cache",
          "coverage",
          "database",
          "dist",
          "dist-electron",
          "e2e-results",
          "node_modules",
          "out",
        ]).has(path.basename(source));
      },
    });
    await symlink(
      path.join(projectRoot, "node_modules"),
      path.join(tempProjectRoot, "node_modules"),
      "dir",
    );
  });

  afterAll(async () => {
    await rm(tempProjectRoot, { recursive: true, force: true });
  });

  async function runBuild() {
    await execFileAsync(process.execPath, ["bin/build/build.mjs"], {
      cwd: tempProjectRoot,
      env: { ...process.env, NODE_ENV: "test" },
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  it("builds with the normal pages tree", async () => {
    await mkdir(path.join(tempProjectRoot, ".agents/tools/main"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempProjectRoot, ".agents/tools/main/echo.json"),
      JSON.stringify({
        name: "echo",
        description: "Echo structured input.",
        input_schema: { type: "object" },
        execution: { type: "javascript", code: "return data;" },
      }),
      "utf8",
    );
    await mkdir(path.join(tempProjectRoot, ".agents/skills/main/example"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempProjectRoot, ".agents/skills/main/example/SKILL.md"),
      "---\nname: example\ndescription: Example skill for build tests\n---\nUse the example workflow.",
      "utf8",
    );
    await writeFile(
      path.join(tempProjectRoot, ".agents/skills/main/purge.md"),
      "---\nslug: shadow-claw--purge-skills\npurge-id: skills-build-001\n---\n",
      "utf8",
    );
    await runBuild();

    const manifest = JSON.parse(
      await readFile(
        path.join(tempProjectRoot, "dist/public/static-main-manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.pages.length).toBeGreaterThan(0);
    expect(manifest.tools).toEqual([
      {
        displayPath: "echo.json",
        content: expect.stringContaining('"name":"echo"'),
      },
    ]);
    expect(manifest.skills).toEqual(
      expect.arrayContaining([
        {
          displayPath: "example/SKILL.md",
          content: expect.stringContaining("name: example"),
        },
        {
          displayPath: "skill-creator/SKILL.md",
          content: expect.stringContaining("name: skill-creator"),
        },
      ]),
    );
    expect(
      manifest.skills.filter((s) => s.displayPath.endsWith("SKILL.md")),
    ).toHaveLength(2);
    expect(manifest.skillsPurgeId).toBe("skills-build-001");

    const wellKnownIndexPath = path.join(
      tempProjectRoot,
      "dist/public/.well-known/agent-skills/index.json",
    );
    expect(fs.existsSync(wellKnownIndexPath)).toBe(true);
    const wellKnownIndex = JSON.parse(
      await readFile(wellKnownIndexPath, "utf8"),
    );
    expect(wellKnownIndex.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    expect(wellKnownIndex.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(["skill-creator", "example"]),
    );
    expect(wellKnownIndex.tools.map((t) => t.name)).toContain("echo");

    const builtIndexHtml = await readFile(
      path.join(tempProjectRoot, "dist/public/index.html"),
      "utf8",
    );
    expect(builtIndexHtml).toMatch(
      /<meta\s+name="version"\s+content="1\.27\.1"/,
    );
  });

  it("builds with no pages directory and keeps default pages", async () => {
    await rm(path.join(tempProjectRoot, "pages"), {
      recursive: true,
      force: true,
    });
    await runBuild();

    const manifest = JSON.parse(
      await readFile(
        path.join(tempProjectRoot, "dist/public/static-main-manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.pages.map(({ displayPath }) => displayPath)).toEqual([
      "index.html",
      "MEMORY.md",
    ]);
    const configPath = [
      path.join(tempProjectRoot, "shadow-claw.config.json"),
      path.join(tempProjectRoot, "shadow-claw-config.json"),
      path.join(tempProjectRoot, "site-config.json"),
    ].find((p) => fs.existsSync(p));
    expect(await readFile(configPath, "utf8")).toContain("ShadowClaw");

    const wellKnownIndexPath = path.join(
      tempProjectRoot,
      "dist/public/.well-known/agent-skills/index.json",
    );
    expect(fs.existsSync(wellKnownIndexPath)).toBe(true);
  });

  it("builds an external consumer content root and falls back to toolchain .agents and .well-known", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-consumer-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { runBuild: runConsumerBuild } = await import("./build.mjs");
      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
      });

      const consumerDistPublic = path.join(tempConsumerRoot, "dist/public");
      expect(
        fs.existsSync(
          path.join(consumerDistPublic, ".well-known/agent-skills/index.json"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            consumerDistPublic,
            ".agents/skills/main/skill-creator/SKILL.md",
          ),
        ),
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("builds an external consumer with custom skills and retains bundled skill-creator in .well-known index", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-custom-consumer-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(
        path.join(tempConsumerRoot, "shadow-claw.config.json"),
        JSON.stringify({
          site: {
            title: "Custom Hub",
            description: "Custom hub description.",
          },
        }),
        "utf8",
      );

      const skillDir = path.join(
        tempConsumerRoot,
        ".agents",
        "skills",
        "main",
        "custom-skill",
      );
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        "---\nname: custom-skill\ndescription: Custom consumer skill.\n---\n",
        "utf8",
      );

      const { runBuild: runConsumerBuild } = await import("./build.mjs");
      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: true,
        quiet: true,
        stdio: "pipe",
      });

      const consumerDistPublic = path.join(tempConsumerRoot, "dist/public");
      const wellKnownPath = path.join(
        consumerDistPublic,
        ".well-known/agent-skills/index.json",
      );
      expect(fs.existsSync(wellKnownPath)).toBe(true);

      const wellKnownIndex = JSON.parse(await readFile(wellKnownPath, "utf8"));
      expect(wellKnownIndex.name).toBe("Custom Hub");
      expect(wellKnownIndex.description).toBe("Custom hub description.");
      expect(wellKnownIndex.skills.map((s) => s.name)).toEqual(
        expect.arrayContaining(["custom-skill", "skill-creator"]),
      );

      // Verify standardized MCP discovery files from toolchain were copied
      const consumerMcpJsonPath = path.join(
        consumerDistPublic,
        ".well-known/mcp.json",
      );
      const consumerServerCardPath = path.join(
        consumerDistPublic,
        ".well-known/mcp/server-card.json",
      );
      const consumerAiCatalogPath = path.join(
        consumerDistPublic,
        ".well-known/ai-catalog.json",
      );

      expect(fs.existsSync(consumerMcpJsonPath)).toBe(true);
      expect(fs.existsSync(consumerServerCardPath)).toBe(true);
      expect(fs.existsSync(consumerAiCatalogPath)).toBe(true);

      const consumerMcpJson = JSON.parse(
        await readFile(consumerMcpJsonPath, "utf8"),
      );
      expect(consumerMcpJson.name).toBe("shadow-claw");
      expect(consumerMcpJson.version).toBeDefined();

      const contentWellKnownPath = path.join(
        tempConsumerRoot,
        ".well-known/agent-skills/index.json",
      );
      expect(fs.existsSync(contentWellKnownPath)).toBe(true);
      const contentIndex = JSON.parse(
        await readFile(contentWellKnownPath, "utf8"),
      );
      expect(contentIndex.skills.map((s) => s.name)).toEqual(
        expect.arrayContaining(["custom-skill", "skill-creator"]),
      );
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });
});
