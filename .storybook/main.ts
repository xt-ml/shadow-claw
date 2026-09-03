import fs from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const importAttributePlugin = {
  name: "storybook-import-attributes",
  enforce: "pre",
  resolveId(source: string, importer: string | undefined) {
    const cleanSource = source.split("?")[0].split("#")[0];
    if (!cleanSource.endsWith(".css") && !cleanSource.endsWith(".html")) {
      return null;
    }
    if (cleanSource.endsWith("index.css")) {
      return null;
    }
    if (!importer || !importer.includes("src/components/")) {
      return null;
    }

    const dir = dirname(importer.split("?")[0].split("#")[0]);
    const resolvedPath = resolve(dir, cleanSource);
    const isCss = cleanSource.endsWith(".css");
    return `\0shadow-claw-attr:${isCss ? "css" : "html"}:${resolvedPath}.js`;
  },
  async load(id: string) {
    if (!id.startsWith("\0shadow-claw-attr:")) {
      return null;
    }

    const prefix = "\0shadow-claw-attr:";
    const parts = id.slice(prefix.length);
    const colonIdx = parts.indexOf(":");
    const type = parts.slice(0, colonIdx);
    const rawFilePath = parts.slice(colonIdx + 1);
    const filePath = rawFilePath.endsWith(".js")
      ? rawFilePath.slice(0, -3)
      : rawFilePath;

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      if (type === "css") {
        return {
          code: `
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(${JSON.stringify(raw)});
            export default sheet;
          `,
          map: null,
        };
      }

      return {
        code: `
          const doc = new DOMParser().parseFromString(${JSON.stringify(raw)}, 'text/html');
          const templateEl = doc.querySelector('template');
          const elements = templateEl ? Array.from(templateEl.content.children) : Array.from(doc.head.children).concat(Array.from(doc.body.children));
          export default elements;
        `,
        map: null,
      };
    } catch {
      return null;
    }
  },
};

const config = {
  stories: [
    "../src/**/*.stories.ts",
  ],
  addons: ["@storybook/addon-docs"],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: "@storybook/web-components-vite",
    options: {},
  },
  async viteFinal(config) {
    return {
      ...config,
      server: {
        ...(config.server ?? {}),
        watch: {
          ...(config.server?.watch ?? {}),
          ignored: [
            "**/.cache/**",
            "**/dist/**",
            "**/dist-electron/**",
            "**/database/**",
          ],
        },
      },
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          "signal-polyfill": join(
            __dirname,
            "../node_modules/signal-polyfill/dist/index.js",
          ),
        },
      },
      plugins: [...(config.plugins ?? []), importAttributePlugin],
    };
  },
};

export default config;
