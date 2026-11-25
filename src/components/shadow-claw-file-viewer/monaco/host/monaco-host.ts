import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
import "monaco-editor/editor/contrib/comment/browser/comment.js";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import "monaco-editor/editor/contrib/folding/browser/folding.js";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js";
import "monaco-editor/editor/contrib/links/browser/links.js";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor.js";
import "monaco-editor/editor/contrib/readOnlyMessage/browser/contribution.js";
import "monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js";
import "monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter.js";
import * as monaco from "monaco-editor/editor/editor.api.js";

import {
  MONACO_CONNECT_MESSAGE,
  type EditorToHostMessage,
  type MonacoInitMessage,
  type MonacoThemeMessage,
} from "../types.js";
import { isHostToEditorMessage } from "../utils/is-monaco-message.js";
import { buildMonacoOptions } from "../utils/monaco-options.js";
import { buildMonacoTheme } from "../utils/monaco-theme.js";
import { resolveMonacoWorkerFile } from "../utils/monaco-worker-labels.js";
import { registerBuiltinLanguages } from "./builtin-languages.js";
import { createLanguageRegistry } from "./language-registry.js";

const MONACO_TRUSTED_TYPES_POLICY_NAME = "shadowclaw-monaco";

interface TrustedTypePolicyLike {
  createHTML(input: string): unknown;
  createScriptURL(input: string): unknown;
}

let cachedPolicy: TrustedTypePolicyLike | null | undefined;

function getMonacoTrustedTypesPolicy(): TrustedTypePolicyLike | null {
  if (cachedPolicy !== undefined) {
    return cachedPolicy;
  }

  const factory = (globalThis as any).trustedTypes;
  if (!factory || typeof factory.createPolicy !== "function") {
    cachedPolicy = null;
    return null;
  }

  if (typeof factory.getPolicy === "function") {
    const existing = factory.getPolicy(MONACO_TRUSTED_TYPES_POLICY_NAME);
    if (existing) {
      cachedPolicy = existing as TrustedTypePolicyLike;
      return cachedPolicy;
    }
  }

  try {
    cachedPolicy = factory.createPolicy(MONACO_TRUSTED_TYPES_POLICY_NAME, {
      createHTML: (html: string) => html,
      createScriptURL: (url: string) => {
        const resolved = new URL(url, window.location.href);
        if (resolved.origin !== window.location.origin) {
          throw new TypeError(`Blocked cross-origin Monaco script: ${url}`);
        }
        return resolved.href;
      },
    }) as TrustedTypePolicyLike;
  } catch {
    cachedPolicy = null;
  }

  return cachedPolicy;
}

(globalThis as any).MonacoEnvironment = {
  createTrustedTypesPolicy: () => getMonacoTrustedTypesPolicy(),
  getWorker(_workerId: string, label: string): Worker {
    const workerFile = resolveMonacoWorkerFile(label);
    const workerUrl = new URL(`./workers/${workerFile}`, import.meta.url).href;
    const policy = getMonacoTrustedTypesPolicy();
    const trustedUrl = policy
      ? (policy.createScriptURL(workerUrl) as string)
      : workerUrl;

    return new Worker(trustedUrl, { type: "module" });
  },
};

const languageRegistry = createLanguageRegistry({
  onError: (id, err) => {
    console.warn(`[ShadowClaw Monaco] Failed to load language "${id}":`, err);
  },
});
registerBuiltinLanguages(languageRegistry, monaco);

let port: MessagePort | null = null;
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let model: monaco.editor.ITextModel | null = null;
let suppressChange = false;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
let lastInit: MonacoInitMessage | null = null;
let lastTheme: Pick<
  MonacoThemeMessage,
  "theme" | "customProperties" | "forcedColors"
> | null = null;

const reducedMotionQuery = window.matchMedia?.(
  "(prefers-reduced-motion: reduce)",
);
const forcedColorsQuery = window.matchMedia?.("(forced-colors: active)");
const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");

function postToHost(msg: EditorToHostMessage): void {
  port?.postMessage(msg);
}

function applyTheme(
  input: Pick<
    MonacoThemeMessage,
    "theme" | "customProperties" | "forcedColors"
  >,
): void {
  lastTheme = input;
  const forcedColors =
    input.forcedColors ?? Boolean(forcedColorsQuery?.matches);
  const built = buildMonacoTheme({
    theme: input.theme,
    customProperties: input.customProperties,
    forcedColors,
  });

  document.documentElement.style.colorScheme =
    input.theme === "dark" ? "dark" : "light";

  if (!forcedColors) {
    monaco.editor.defineTheme(built.name, built.data);
  }
  monaco.editor.setTheme(built.name);
}

function getResponsiveOptions(init: MonacoInitMessage) {
  return buildMonacoOptions({
    viewportWidth: window.innerWidth,
    coarsePointer: Boolean(coarsePointerQuery?.matches),
    reducedMotion: Boolean(reducedMotionQuery?.matches),
    readOnly: init.readOnly,
    ariaLabel: init.ariaLabel,
    fontFamily: init.fontFamily,
  });
}

async function createOrUpdateEditor(init: MonacoInitMessage): Promise<void> {
  lastInit = init;
  const container = document.getElementById("editor");
  if (!container) {
    postToHost({
      type: "error",
      message: "Monaco container #editor not found",
    });
    return;
  }

  const languageLoaded = await languageRegistry.ensure(init.language);
  const effectiveLanguage = languageLoaded ? init.language : "plaintext";

  if (!editor) {
    model = monaco.editor.createModel(init.value, effectiveLanguage);
    editor = monaco.editor.create(container, {
      ...getResponsiveOptions(init),
      model,
    });

    applyTheme({
      theme: init.theme,
      customProperties: init.customProperties,
      forcedColors: init.forcedColors,
    });

    editor.onDidChangeModelContent(() => {
      if (suppressChange || !model) {
        return;
      }

      if (changeTimer !== null) {
        clearTimeout(changeTimer);
      }

      changeTimer = setTimeout(() => {
        changeTimer = null;
        if (model) {
          postToHost({ type: "change", value: model.getValue() });
        }
      }, 150);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      postToHost({ type: "save-request" });
    });

    editor.addCommand(
      monaco.KeyCode.Escape,
      () => {
        postToHost({ type: "escape" });
      },
      "!suggestWidgetVisible && !findWidgetVisible && !parameterHintsVisible && !renameInputVisible",
    );

    return;
  }

  if (model) {
    monaco.editor.setModelLanguage(model, effectiveLanguage);
    if (model.getValue() !== init.value) {
      suppressChange = true;
      model.setValue(init.value);
      suppressChange = false;
    }
  }

  editor.updateOptions(getResponsiveOptions(init));
  applyTheme({
    theme: init.theme,
    customProperties: init.customProperties,
    forcedColors: init.forcedColors,
  });
}

async function handleHostMessage(data: unknown): Promise<void> {
  if (!isHostToEditorMessage(data)) {
    return;
  }

  switch (data.type) {
    case "init":
      await createOrUpdateEditor(data);
      break;
    case "set-value":
      if (model && model.getValue() !== data.value) {
        suppressChange = true;
        model.setValue(data.value);
        suppressChange = false;
      }
      break;
    case "set-read-only":
      if (lastInit) {
        lastInit = { ...lastInit, readOnly: data.readOnly };
      }
      editor?.updateOptions({ readOnly: data.readOnly });
      break;
    case "set-language": {
      const ok = await languageRegistry.ensure(data.language);
      if (model) {
        monaco.editor.setModelLanguage(model, ok ? data.language : "plaintext");
      }
      break;
    }
    case "theme":
      applyTheme(data);
      break;
    case "focus":
      editor?.focus();
      break;
    case "get-value":
      postToHost({
        type: "value",
        requestId: data.requestId,
        value: model ? model.getValue() : "",
      });
      break;
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  if (
    event.origin !== window.location.origin ||
    event.source !== window.parent
  ) {
    return;
  }

  const data = event.data;
  if (
    !data ||
    typeof data !== "object" ||
    (data as any).type !== MONACO_CONNECT_MESSAGE
  ) {
    return;
  }

  const transferred = event.ports?.[0];
  if (!transferred) {
    return;
  }

  port = transferred;
  port.onmessage = (portEvent: MessageEvent) => {
    void handleHostMessage(portEvent.data).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      postToHost({ type: "error", message });
    });
  };
  port.start?.();
  postToHost({ type: "ready" });
});

function syncResponsiveOptions(): void {
  if (editor && lastInit) {
    editor.updateOptions(getResponsiveOptions(lastInit));
  }
}

window.addEventListener("resize", syncResponsiveOptions);
reducedMotionQuery?.addEventListener?.("change", syncResponsiveOptions);
coarsePointerQuery?.addEventListener?.("change", syncResponsiveOptions);
forcedColorsQuery?.addEventListener?.("change", () => {
  if (lastTheme) {
    applyTheme(lastTheme);
  }
});
