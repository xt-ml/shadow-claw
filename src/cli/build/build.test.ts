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
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

import { runBuild as runConsumerBuild } from "./build.js";

const projectRoot = path.resolve(new URL("../../..", import.meta.url).pathname);

jest.setTimeout(120_000);

describe("build without and with pages", () => {
  let tempProjectRoot: string;

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
    // bin/*.mjs wrappers import from dist/cli — copy the pre-built CLI artifacts
    // into the temp project so child-process invocations find them.
    await cp(
      path.join(projectRoot, "dist/cli"),
      path.join(tempProjectRoot, "dist/cli"),
      { recursive: true },
    );
  });

  afterAll(async () => {
    await rm(tempProjectRoot, { recursive: true, force: true });
  });

  async function runBuild() {
    await runConsumerBuild({
      contentRoot: tempProjectRoot,
      toolchainRoot: projectRoot,
      isProduction: false,
      quiet: true,
      stdio: "pipe",
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
      manifest.skills.filter((s: any) => s.displayPath.endsWith("SKILL.md")),
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
    expect(wellKnownIndex.skills.map((s: any) => s.name)).toEqual(
      expect.arrayContaining(["skill-creator", "example"]),
    );
    expect(wellKnownIndex.tools.map((t: any) => t.name)).toContain("echo");

    const builtIndexHtml = await readFile(
      path.join(tempProjectRoot, "dist/public/index.html"),
      "utf8",
    );
    expect(builtIndexHtml).toMatch(
      /<meta\s+name="version"\s+content="\d+\.\d+\.\d+"/,
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
    expect(manifest.pages.map(({ displayPath }: any) => displayPath)).toEqual(
      expect.arrayContaining(["index.html", "MEMORY.md"]),
    );
    const configPath = [
      path.join(tempProjectRoot, "shadow-claw.config.json"),
      path.join(tempProjectRoot, "shadow-claw-config.json"),
      path.join(tempProjectRoot, "site-config.json"),
    ].find((p) => fs.existsSync(p))!;
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
            ".agents/skills/skill-creator/SKILL.md",
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
      expect(wellKnownIndex.skills.map((s: any) => s.name)).toEqual(
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
      expect(contentIndex.skills.map((s: any) => s.name)).toEqual(
        expect.arrayContaining(["custom-skill", "skill-creator"]),
      );

      // Verify skill-creator was materialized on disk so the advertised relative URL does not 404
      const contentSkillCreatorPath = path.join(
        tempConsumerRoot,
        ".agents",
        "skills",
        "skill-creator",
        "SKILL.md",
      );
      expect(fs.existsSync(contentSkillCreatorPath)).toBe(true);
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });
  it("honours settings.overridePrerenderSkeleton: false from shadow-claw.config.json with pages pre-rendered", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-prerender-opt-out-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      // Place a config that opts out of the skeleton overlay
      await writeFile(
        path.join(tempConsumerRoot, "shadow-claw.config.json"),
        JSON.stringify({
          site: { title: "No Skeleton Site", description: "Test." },
          settings: { overridePrerenderSkeleton: false },
        }),
        "utf8",
      );

      // Create pages/main/index.html
      const mainDir = path.join(tempConsumerRoot, "pages/main");
      await mkdir(mainDir, { recursive: true });
      await writeFile(
        path.join(mainDir, "index.html"),
        "<main><h1>Welcome to Pre-rendered Site</h1></main>",
        "utf8",
      );

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
      });

      const indexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/index.html"),
        "utf8",
      );

      // When overridePrerenderSkeleton is false, data-prerender-no-seed="true" is baked
      // and the meta tag is present so the skeleton overlay is disabled.
      expect(indexHtml).toMatch(/data-prerender-no-seed="true"/);
      expect(indexHtml).toContain(
        '<meta name="shadow-claw-override-prerender-skeleton" content="false" />',
      );
      // Pre-rendered page content must be preserved and present in DSD
      expect(indexHtml).toContain("Welcome to Pre-rendered Site");
      expect(indexHtml).toContain('data-initial-path="index.html"');
      // Static manifest must include the pre-rendered page
      expect(indexHtml).toContain('"displayPath":"index.html"');
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("cleans stale artifacts in consumer outDir before building", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-consumer-clean-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const staleFile = path.join(
        tempConsumerRoot,
        "dist/public/stale-old-chunk.js",
      );
      await mkdir(path.dirname(staleFile), { recursive: true });
      await writeFile(staleFile, "stale content", "utf8");

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
      });

      expect(fs.existsSync(staleFile)).toBe(false);
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("builds an external consumer with copyAllAssets, pagesOrigin, scripts, and service worker", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-consumer-prod-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await mkdir(path.join(tempConsumerRoot, "assets/icons"), {
        recursive: true,
      });
      await mkdir(path.join(tempConsumerRoot, "assets/fonts"), {
        recursive: true,
      });
      await writeFile(
        path.join(tempConsumerRoot, "assets/icons/icon.png"),
        "icon",
      );
      await writeFile(
        path.join(tempConsumerRoot, "assets/fonts/font.woff2"),
        "font",
      );
      await mkdir(path.join(tempConsumerRoot, ".agents/scripts"), {
        recursive: true,
      });
      await writeFile(
        path.join(tempConsumerRoot, ".agents/scripts/run.sh"),
        "echo hi",
      );
      await writeFile(
        path.join(tempConsumerRoot, "manifest.json"),
        JSON.stringify({ start_url: "/initial" }),
      );

      // Create a dummy service-worker.js in tempProjectRoot/dist/public if missing
      const swPath = path.join(
        tempProjectRoot,
        "dist/public/service-worker.js",
      );
      if (!fs.existsSync(swPath)) {
        await writeFile(swPath, "// sw dummy\nimportScripts();");
      }

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: true,
        copyAllAssets: true,
        pagesOrigin: "https://consumer.example.com",
        quiet: false,
        stdio: "pipe",
      });

      const distDir = path.join(tempConsumerRoot, "dist/public");
      expect(fs.existsSync(path.join(distDir, ".nojekyll"))).toBe(true);
      expect(fs.existsSync(path.join(distDir, ".agents/scripts/run.sh"))).toBe(
        true,
      );

      const manifest = JSON.parse(
        await readFile(path.join(distDir, "manifest.json"), "utf8"),
      );
      expect(manifest.start_url).toBe("https://consumer.example.com");
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("builds in-repo with isProduction, copyAllAssets, and prerenderMainMemory false", async () => {
    const tempInRepoRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-in-repo-prod-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runConsumerBuild({
        contentRoot: tempInRepoRoot,
        toolchainRoot: projectRoot,
        isProduction: true,
        copyAllAssets: true,
        prerenderMainMemory: false,
        pagesOrigin: "https://shadow-claw.example.com/",
        basePath: "/shadow-claw/",
        quiet: false,
        stdio: "pipe",
      });

      const indexHtml = await readFile(
        path.join(tempInRepoRoot, "dist/public/index.html"),
        "utf8",
      );
      expect(indexHtml).toContain('<base href="/shadow-claw/"');
      expect(
        fs.existsSync(path.join(tempInRepoRoot, "dist/public/.nojekyll")),
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
      await rm(tempInRepoRoot, { recursive: true, force: true });
    }
  });

  it("applies branding.siteUrl base href to index.html and pre-rendered pretty paths during consumer build in production", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-base-href-consumer-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(
        path.join(tempConsumerRoot, "shadow-claw.config.json"),
        JSON.stringify({
          site: { title: "Template Hub", description: "Template." },
          branding: {
            siteUrl: "https://xt-ml.github.io/shadow-claw-template/",
          },
        }),
        "utf8",
      );

      const mainDir = path.join(tempConsumerRoot, "pages/main");
      await mkdir(mainDir, { recursive: true });
      await writeFile(
        path.join(mainDir, "about.md"),
        "# About\n\nAbout page content.",
        "utf8",
      );
      await writeFile(
        path.join(tempConsumerRoot, "pages/routes.json"),
        JSON.stringify({
          routes: {
            "/pages/main/about.md": { prettyPath: "/docs/about" },
          },
        }),
        "utf8",
      );

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: true,
        quiet: true,
        stdio: "pipe",
      });

      const indexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/index.html"),
        "utf8",
      );
      const prettyIndexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/docs/about/index.html"),
        "utf8",
      );
      const prettyFileHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/docs/about.html"),
        "utf8",
      );
      const shareTargetHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/share/share-target.html"),
        "utf8",
      );

      expect(indexHtml).toContain('<base href="/shadow-claw-template/" />');
      expect(prettyIndexHtml).toContain(
        '<base href="/shadow-claw-template/" />',
      );
      expect(prettyFileHtml).toContain(
        '<base href="/shadow-claw-template/" />',
      );
      expect(shareTargetHtml).toContain(
        '<base href="/shadow-claw-template/" />',
      );

      // Verify toolchain docs and site pages do not leak into consumer dist
      expect(
        fs.existsSync(
          path.join(tempConsumerRoot, "dist/public/docs/skill-creator.html"),
        ),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(tempConsumerRoot, "dist/public/main.html")),
      ).toBe(false);
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("defaults to root / base href during consumer build in development", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-base-href-dev-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(
        path.join(tempConsumerRoot, "shadow-claw.config.json"),
        JSON.stringify({
          site: { title: "Template Hub", description: "Template." },
          branding: {
            siteUrl: "https://xt-ml.github.io/shadow-claw-template/",
          },
        }),
        "utf8",
      );

      const mainDir = path.join(tempConsumerRoot, "pages/main");
      await mkdir(mainDir, { recursive: true });
      await writeFile(
        path.join(mainDir, "about.md"),
        "# About\n\nAbout page content.",
        "utf8",
      );
      await writeFile(
        path.join(tempConsumerRoot, "pages/routes.json"),
        JSON.stringify({
          routes: {
            "/pages/main/about.md": { prettyPath: "/docs/about" },
          },
        }),
        "utf8",
      );

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
      });

      const indexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/index.html"),
        "utf8",
      );
      const shareTargetHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/share/share-target.html"),
        "utf8",
      );
      expect(indexHtml).toContain('<base href="/" />');
      expect(shareTargetHtml).toContain('<base href="/" />');
      expect(
        fs.existsSync(
          path.join(tempConsumerRoot, "dist/public/docs/skill-creator.html"),
        ),
      ).toBe(false);
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("builds a single-file bundle embedding pages and theme with singleFile: true", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-single-file-build-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await writeFile(
        path.join(tempConsumerRoot, "shadow-claw.config.json"),
        JSON.stringify({
          site: { title: "Single File Hub" },
        }),
        "utf8",
      );

      const mainDir = path.join(tempConsumerRoot, "pages/main");
      await mkdir(mainDir, { recursive: true });
      await writeFile(
        path.join(mainDir, "about.md"),
        "# About Single File\n\nStandalone single-file markdown content.",
        "utf8",
      );
      await writeFile(
        path.join(mainDir, "theme.css"),
        ":root { --single-file-accent: #00ff00; }",
        "utf8",
      );

      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
        singleFile: true,
      });

      const indexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/index.html"),
        "utf8",
      );
      expect(indexHtml).toContain("Single File Hub");
      expect(indexHtml).toContain('id="shadow-claw-theme"');
      expect(indexHtml).toContain("--single-file-accent: #00ff00;");
      expect(indexHtml).toContain('data-shadow-claw-page="about.md"');
      expect(indexHtml).toContain("Standalone single-file markdown content.");
      expect(indexHtml).toContain('name="shadow-claw-asset-base"');
      expect(indexHtml).toContain("https://cdn.jsdelivr.net/npm/shadow-claw@");
      expect(indexHtml).toContain("theme-init.js");
      expect(indexHtml).toContain("index.css");
      expect(indexHtml).toContain('data-shadow-claw-opfs-cleanup="true"');
      expect(indexHtml).toContain('data-shadow-claw-dedent="true"');
      expect(indexHtml).toContain("<!-- prettier-ignore -->");
      expect(indexHtml).not.toContain('<script type="module" src="index.js">');
      expect(indexHtml).not.toContain(
        '<script type="module" src="service-worker/init.js">',
      );
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });

  it("builds a single-file bundle with custom cdnBase", async () => {
    const tempConsumerRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-custom-cdn-"),
    );
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await runConsumerBuild({
        contentRoot: tempConsumerRoot,
        toolchainRoot: tempProjectRoot,
        isProduction: false,
        quiet: true,
        stdio: "pipe",
        singleFile: true,
        cdn: "https://custom.example.com/cdn/shadow-claw@9.9.9",
      });

      const indexHtml = await readFile(
        path.join(tempConsumerRoot, "dist/public/index.html"),
        "utf8",
      );
      expect(indexHtml).toContain(
        '<meta name="shadow-claw-asset-base" content="https://custom.example.com/cdn/shadow-claw@9.9.9/dist/public/" />',
      );
      expect(indexHtml).toContain(
        'src="https://custom.example.com/cdn/shadow-claw@9.9.9/dist/public/theme-init.js"',
      );
      expect(indexHtml).toContain(
        'href="https://custom.example.com/cdn/shadow-claw@9.9.9/dist/public/index.css"',
      );
      expect(indexHtml).toContain(
        '"shadow-claw": "https://custom.example.com/cdn/shadow-claw@9.9.9/dist/lib/index.js"',
      );
    } finally {
      logSpy.mockRestore();
      await rm(tempConsumerRoot, { recursive: true, force: true });
    }
  });
});
