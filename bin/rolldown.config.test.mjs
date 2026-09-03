import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import config from "../rolldown.config.mjs";
import libConfig from "../rolldown.lib.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("rolldown.config.mjs", () => {
  describe("library build config", () => {
    it("exports module entries for the public library surface", () => {
      expect(Array.isArray(libConfig)).toBe(true);
      expect(libConfig.length).toBeGreaterThanOrEqual(1);

      const entryInputs = libConfig
        .map((entry) => entry.input)
        .flatMap((input) =>
          Array.isArray(input)
            ? input
            : typeof input === "object" && input !== null
              ? Object.values(input)
              : [input],
        );

      expect(entryInputs).toEqual(
        expect.arrayContaining([
          "src/index.ts",
          "src/components/index.ts",
          "src/utils/index.ts",
          "src/components/common/shadow-claw-card/shadow-claw-card.ts",
          "src/utils/ulid.ts",
        ]),
      );
    });
  });

  describe("bundle configurations and splitting", () => {
    it("exports an array of build configs", () => {
      expect(Array.isArray(config)).toBe(true);
      expect(config.length).toBeGreaterThanOrEqual(8);
    });

    it("enables code splitting for frontend and agent worker bundles", () => {
      const frontend = config.find(
        (entry) => entry.input === "src/core/index.ts",
      );
      const agentWorker = config.find(
        (entry) => entry.input === "src/worker/worker.ts",
      );

      expect(frontend?.output?.codeSplitting).toBe(true);
      expect(agentWorker?.output?.codeSplitting).toBe(true);
    });

    it("configures theme-init as iife and server/electron as node targets", () => {
      const themeInit = config.find(
        (entry) => entry.input === "src/core/theme-init.ts",
      );
      const server = config.find(
        (entry) => entry.input === "src/server/server.ts",
      );
      const electron = config.find(
        (entry) => entry.input === "electron/main.ts",
      );

      expect(themeInit?.output?.format).toBe("iife");
      expect(themeInit?.output?.name).toBe("ShadowClawThemeInit");
      expect(server?.platform).toBe("node");
      expect(electron?.platform).toBe("node");
      expect(server?.external).toContain("express");
      expect(electron?.external).toContain("electron");
    });
  });

  describe("aliasTurndownPlugin", () => {
    const workerConfig = config.find(
      (entry) => entry.input === "src/worker/worker.ts",
    );
    const turndownPlugin = workerConfig?.plugins?.find(
      (p) => p && p.name === "alias-turndown-for-worker",
    );

    it("resolves turndown and @mixmark-io/domino IDs", () => {
      expect(turndownPlugin).toBeDefined();
      expect(turndownPlugin.resolveId("turndown")).toContain("turndown.es.js");
      expect(turndownPlugin.resolveId("@mixmark-io/domino")).toContain(
        "domino",
      );
      expect(turndownPlugin.resolveId("other-module")).toBeNull();
    });

    it("transforms turndown.es.js with domino ESM import", () => {
      const code =
        "var domino = require('@mixmark-io/domino');\nconsole.log(domino);";
      const result = turndownPlugin.transform(
        code,
        "/path/to/node_modules/turndown/lib/turndown.es.js",
      );
      expect(result).not.toBeNull();
      expect(result.code).toContain(
        "import _domino_import from '@mixmark-io/domino';",
      );
      expect(result.code).toContain("var domino = _domino_import;");

      // Non-matching id
      expect(
        turndownPlugin.transform(code, "/path/to/some-other-file.js"),
      ).toBeNull();
    });
  });

  describe("injectGlobalShimPlugin", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const globalShimPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "inject-global-shim",
    );

    it("ignores non-node_modules or non-js files", () => {
      expect(globalShimPlugin).toBeDefined();
      expect(
        globalShimPlugin.transform("global.test = 1;", "/src/app.ts"),
      ).toBeNull();
      expect(
        globalShimPlugin.transform(
          "global.test = 1;",
          "/node_modules/pkg/index.mjs",
        ),
      ).toBeNull();
    });

    it("skips files without global keyword", () => {
      expect(
        globalShimPlugin.transform(
          "const a = 1;",
          "/node_modules/pkg/index.js",
        ),
      ).toBeNull();
    });

    it("replaces standalone global with globalThis in node_modules JS files", () => {
      const input = "var g = typeof global !== 'undefined' ? global : window;";
      const result = globalShimPlugin.transform(
        input,
        "/node_modules/randombytes/browser.js",
      );
      expect(result).not.toBeNull();
      expect(result.code).toContain("globalThis");
    });

    it("returns null if global is only present as member expression (.global)", () => {
      const input = "const x = window.global;";
      const result = globalShimPlugin.transform(
        input,
        "/node_modules/pkg/index.js",
      );
      expect(result).toBeNull();
    });
  });

  describe("patchGrayMatterEvalPlugin", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const grayMatterPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "patch-gray-matter-direct-eval",
    );

    it("ignores files not matching gray-matter/lib/engines.js", () => {
      expect(grayMatterPlugin).toBeDefined();
      expect(
        grayMatterPlugin.transform(
          "return eval(str) || {};",
          "/src/engines.js",
        ),
      ).toBeNull();
    });

    it("replaces direct eval in gray-matter engines.js", () => {
      const input = "function js(str) { return eval(str) || {}; }";
      const result = grayMatterPlugin.transform(
        input,
        "/node_modules/gray-matter/lib/engines.js",
      );
      expect(result).not.toBeNull();
      expect(result.code).toContain("return (0, eval)(str) || {};");
    });

    it("returns null if code in gray-matter engines.js does not contain target eval", () => {
      const input = "function js(str) { return {}; }";
      const result = grayMatterPlugin.transform(
        input,
        "/node_modules/gray-matter/lib/engines.js",
      );
      expect(result).toBeNull();
    });
  });

  describe("replacePrerenderMainMemoryPlugin", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const prerenderPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "replace-prerender-main-memory",
    );

    it("returns null if __PRERENDER_MAIN_MEMORY__ is absent", () => {
      expect(prerenderPlugin).toBeDefined();
      expect(prerenderPlugin.transform("const a = true;")).toBeNull();
    });

    it("replaces __PRERENDER_MAIN_MEMORY__ with true by default", () => {
      const originalEnv = process.env.PRERENDER_MAIN_MEMORY;
      delete process.env.PRERENDER_MAIN_MEMORY;
      try {
        const input = "if (__PRERENDER_MAIN_MEMORY__) { doSomething(); }";
        const result = prerenderPlugin.transform(input);
        expect(result).not.toBeNull();
        expect(result.code).toBe("if (true) { doSomething(); }");
      } finally {
        if (originalEnv !== undefined) {
          process.env.PRERENDER_MAIN_MEMORY = originalEnv;
        }
      }
    });

    it("replaces __PRERENDER_MAIN_MEMORY__ with false when env is 'false'", () => {
      const originalEnv = process.env.PRERENDER_MAIN_MEMORY;
      process.env.PRERENDER_MAIN_MEMORY = "false";
      try {
        const input = "if (__PRERENDER_MAIN_MEMORY__) { doSomething(); }";
        const result = prerenderPlugin.transform(input);
        expect(result).not.toBeNull();
        expect(result.code).toBe("if (false) { doSomething(); }");
      } finally {
        if (originalEnv !== undefined) {
          process.env.PRERENDER_MAIN_MEMORY = originalEnv;
        } else {
          delete process.env.PRERENDER_MAIN_MEMORY;
        }
      }
    });
  });

  describe("rolldownImportAttributes", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const importAttrPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "rolldown-import-attributes",
    );

    it("returns null for non-html and non-css files", () => {
      expect(importAttrPlugin).toBeDefined();
      expect(importAttrPlugin.load("file.ts")).toBeNull();
      expect(importAttrPlugin.load("file.js")).toBeNull();
    });

    it("loads and escapes .html templates with <template> tag", () => {
      const tmpHtmlPath = join(__dirname, "__test_template.html");
      fs.writeFileSync(
        tmpHtmlPath,
        '<template><div class="test">`Hello ${name}`</div></template>',
        "utf-8",
      );
      try {
        const result = importAttrPlugin.load(tmpHtmlPath);
        expect(result).not.toBeNull();
        expect(result.moduleType).toBe("js");
        expect(result.code).toContain("DOMParser().parseFromString");
        expect(result.code).toContain("templateEl.content.children");
        expect(result.code).toContain("\\`Hello \\${name}\\`");
      } finally {
        fs.unlinkSync(tmpHtmlPath);
      }
    });

    it("loads and escapes .html files without <template> tag", () => {
      const tmpHtmlPath = join(__dirname, "__test_notemplate.html");
      fs.writeFileSync(
        tmpHtmlPath,
        "<html><head><title>Test</title></head><body><p>Body</p></body></html>",
        "utf-8",
      );
      try {
        const result = importAttrPlugin.load(tmpHtmlPath);
        expect(result).not.toBeNull();
        expect(result.code).toContain(
          "Array.from(doc.head.children).concat(Array.from(doc.body.children))",
        );
      } finally {
        fs.unlinkSync(tmpHtmlPath);
      }
    });

    it("loads and escapes .css stylesheets", () => {
      const tmpCssPath = join(__dirname, "__test_style.css");
      fs.writeFileSync(
        tmpCssPath,
        ':host { color: red; font-family: `Consolas`; content: "${var}"; }',
        "utf-8",
      );
      try {
        const result = importAttrPlugin.load(tmpCssPath);
        expect(result).not.toBeNull();
        expect(result.moduleType).toBe("js");
        expect(result.code).toContain("new CSSStyleSheet()");
        expect(result.code).toContain("sheet.replaceSync");
      } finally {
        fs.unlinkSync(tmpCssPath);
      }
    });
  });

  describe("swWatchPlugin", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const watchPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "sw-watch-plugin",
    );

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("does nothing when --watch or -w is not in argv", () => {
      expect(watchPlugin).toBeDefined();
      const origArgv = [...process.argv];
      process.argv = ["node", "rolldown"];
      try {
        watchPlugin.writeBundle();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        process.argv = origArgv;
      }
    });

    it("schedules post-build steps when --watch is in argv", () => {
      const origArgv = [...process.argv];
      process.argv = ["node", "rolldown", "--watch"];
      try {
        watchPlugin.writeBundle();
        expect(jest.getTimerCount()).toBe(1);
        // calling again resets the timer
        watchPlugin.writeBundle();
        expect(jest.getTimerCount()).toBe(1);
      } finally {
        process.argv = origArgv;
      }
    });
  });

  describe("copy plugin transforms and rename callbacks", () => {
    const frontendConfig = config.find(
      (entry) => entry.input === "src/core/index.ts",
    );
    const copyPlugin = frontendConfig?.plugins?.find(
      (p) => p && p.name === "copy",
    );

    it("verifies copy targets and their transform/rename functions", async () => {
      expect(copyPlugin).toBeDefined();

      const cssTarget = frontendConfig.plugins
        .flatMap((p) => (p && p.targets ? p.targets : []))
        .find((t) => Array.isArray(t.src) && t.src.includes("src/**/*.css"));

      if (cssTarget && typeof cssTarget.rename === "function") {
        expect(
          cssTarget.rename(
            "shadow-claw.css",
            "",
            "src/components/shadow-claw/shadow-claw.css",
          ),
        ).toBe("components/shadow-claw/shadow-claw.css");
      }

      const htmlTarget = frontendConfig.plugins
        .flatMap((p) => (p && p.targets ? p.targets : []))
        .find((t) => Array.isArray(t.src) && t.src.includes("src/**/*.html"));

      if (htmlTarget && typeof htmlTarget.rename === "function") {
        expect(
          htmlTarget.rename(
            "shadow-claw.html",
            "",
            "src/components/shadow-claw/shadow-claw.html",
          ),
        ).toBe("components/shadow-claw/shadow-claw.html");
      }
    });

    it("transforms files via copy plugin in development and production modes", async () => {
      expect(copyPlugin).toBeDefined();

      // Test dev mode buildEnd (already loaded with !isProduction)
      if (typeof copyPlugin.buildEnd === "function") {
        await copyPlugin.buildEnd();
      }

      // Test production mode buildEnd
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const prodModule = await import(
          `../rolldown.config.mjs?prodTest=${Date.now()}`
        );
        const prodFrontend = prodModule.default.find(
          (entry) => entry.input === "src/core/index.ts",
        );
        const prodCopy = prodFrontend?.plugins?.find(
          (p) => p && p.name === "copy",
        );
        if (prodCopy && typeof prodCopy.buildEnd === "function") {
          await prodCopy.buildEnd();
        }
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    }, 30000);
  });
});
