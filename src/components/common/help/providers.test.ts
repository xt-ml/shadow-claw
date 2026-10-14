import { buildLlamafileHelpDialogOptions } from "./llamafile.js";
import {
  buildProviderHelpDialogOptions,
  detectProviderHelpType,
} from "./providers.js";
import { buildTransformersJsHelpDialogOptions } from "./transformers.js";

describe("provider help", () => {
  it("detects missing api key errors", () => {
    expect(
      detectProviderHelpType(
        "openrouter",
        "API key not configured. Go to Settings to add your API key.",
        true,
      ),
    ).toBe("api-key-missing");
  });

  it("detects invalid api key errors", () => {
    expect(
      detectProviderHelpType(
        "openrouter",
        "HTTP 401 Unauthorized from upstream provider",
        true,
      ),
    ).toBe("api-key-invalid");
  });

  it("detects provider connectivity errors", () => {
    expect(
      detectProviderHelpType(
        "ollama",
        "TypeError: Failed to fetch from proxy",
        false,
      ),
    ).toBe("provider-unreachable");
  });

  it("builds openrouter auth dialog details", () => {
    const dialog = buildProviderHelpDialogOptions(
      "openrouter",
      "api-key-missing",
      "Missing key",
    );

    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("API Key Required");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) =>
        line.includes("Settings > AI > Model Provider"),
      ),
    ).toBe(true);
    expect(dialog.links?.[0]?.href).toBe("https://openrouter.ai/keys");
  });

  it("builds rate limited dialog details with autoCloseSeconds", () => {
    const dialog = buildProviderHelpDialogOptions(
      "openrouter",
      "rate-limited",
      "Rate limit exceeded",
    );

    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Rate Limited");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(dialog.details?.some((line) => line.includes("throttling"))).toBe(
      false,
    );
    expect(dialog.message).toContain("throttling");
  });

  it("builds llamafile help dialog options with autoCloseSeconds: 30", () => {
    const dialog = buildLlamafileHelpDialogOptions("Model not found");
    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Llamafile");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) => line.includes("Model not found")),
    ).toBe(true);
  });

  it("builds transformers_js help dialog options with autoCloseSeconds: 30", () => {
    const dialog = buildTransformersJsHelpDialogOptions("Runtime missing");
    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Transformers.js");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) => line.includes("Runtime missing")),
    ).toBe(true);
  });

  it("checks isLlamafileResolutionError", async () => {
    const { isLlamafileResolutionError } = await import("./llamafile.js");
    expect(isLlamafileResolutionError("assets/cache/llamafile not found")).toBe(
      true,
    );
    expect(
      isLlamafileResolutionError(
        "missing or invalid 'model' parameter for cli mode",
      ),
    ).toBe(true);
    expect(
      isLlamafileResolutionError("failed to list llamafile binaries"),
    ).toBe(true);
    expect(isLlamafileResolutionError("some random error")).toBe(false);
  });

  it("checks isTransformersJsResolutionError", async () => {
    const { isTransformersJsResolutionError } =
      await import("./transformers.js");
    expect(
      isTransformersJsResolutionError(
        "transformers.js runtime is not installed",
      ),
    ).toBe(true);
    expect(
      isTransformersJsResolutionError("transformers.js runtime is unavailable"),
    ).toBe(true);
    expect(
      isTransformersJsResolutionError(
        "no supported transformers.js model loader",
      ),
    ).toBe(true);
    expect(
      isTransformersJsResolutionError(
        "cannot find package @huggingface/transformers",
      ),
    ).toBe(true);
    expect(isTransformersJsResolutionError("network error")).toBe(false);
  });

  it("builds dialogs for api-key-invalid and provider-unreachable", () => {
    const invalidDialog = buildProviderHelpDialogOptions(
      "openrouter",
      "api-key-invalid",
    );
    expect(invalidDialog.title).toContain("Authentication Failed");

    const localUnreachable = buildProviderHelpDialogOptions(
      "transformers_js_local",
      "provider-unreachable",
    );
    expect(localUnreachable.title).toContain("Not Reachable");
    expect(localUnreachable.details?.some((d) => d.includes("npm start"))).toBe(
      true,
    );

    const remoteUnreachable = buildProviderHelpDialogOptions(
      "openrouter",
      "provider-unreachable",
    );
    expect(
      remoteUnreachable.details?.some((d) =>
        d.includes("internet connectivity"),
      ),
    ).toBe(true);
  });
});
